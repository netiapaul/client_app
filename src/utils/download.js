// Downloading a file from an endpoint that requires the bearer token.

import axios from 'axios'
import { getToken } from './session'

/** With responseType 'blob' axios gives us a Blob for FAILURES too. */
const readBlobError = async (e, fallback) => {
  const data = e?.response?.data
  if (data instanceof Blob) {
    try {
      const text = await data.text()
      const parsed = JSON.parse(text)
      if (parsed?.message) return parsed.message
    } catch {
      // Not JSON (an HTML error page, or an empty body). Fall through to the generic message.
    }
  }
  return data?.message || e?.message || fallback
}

/** Fetch `url` as a file and save it. */
export const downloadFile = async (url, filename, { params, inline = false } = {}) => {
  let res
  try {
    res = await axios.get(url, {
      params,
      responseType: 'blob',
      headers: { Authorization: `Bearer ${getToken()}` },
    })
  } catch (e) {
    throw new Error(await readBlobError(e, 'The file could not be downloaded.'))
  }

  // A 200 with nothing in it would otherwise "succeed" and save a 0-byte file the user cannot open.
  if (!res.data || res.data.size === 0) throw new Error('The file came back empty.')

  const blobUrl = window.URL.createObjectURL(res.data)
  try {
    if (inline) {
      const w = window.open(blobUrl, '_blank', 'noopener')
      // Pop-up blocked — saving it is better than silently doing nothing.
      if (!w) saveAs(blobUrl, filename)
    } else {
      saveAs(blobUrl, filename)
    }
  } finally {
    // Revoked on a delay: revoking immediately can cancel the download or the tab's load in Chrome.
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000)
  }
}

const saveAs = (blobUrl, filename) => {
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename || 'download'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
