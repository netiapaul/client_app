// Downloading a file from an endpoint that requires the bearer token.
//
// A plain <a href> or window.open cannot do this: the browser issues that request without our
// Authorization header, so the API answers 401 and the user gets a login page where they expected a
// PDF. The file therefore has to be fetched as a blob through axios and handed to the browser here.

import axios from 'axios'
import { getToken } from './session'

/**
 * With responseType 'blob' axios gives us a Blob for FAILURES too, so the usual
 * `e.response.data.message` reads undefined and every error becomes "Something went wrong". The
 * body is still JSON — it just arrived as a blob — so read it back out before giving up.
 */
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

/**
 * Fetch `url` as a file and save it.
 *
 * Returns nothing on success and THROWS an Error carrying the server's own message on failure, so
 * the calling screen can show it the way it shows every other error rather than this module
 * deciding how to surface it.
 *
 * `inline: true` opens the file in a new tab instead of saving it — used for a preview, where
 * downloading something the admin only wants to glance at is a nuisance.
 */
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
      // noopener: the opened tab must not get a handle back to the app's window.
      const w = window.open(blobUrl, '_blank', 'noopener')
      // Pop-up blocked — saving it is better than silently doing nothing.
      if (!w) saveAs(blobUrl, filename)
    } else {
      saveAs(blobUrl, filename)
    }
  } finally {
    // Revoked on a delay: revoking immediately can cancel the download or the tab's load in
    // Chrome, which reads as a file that never arrived.
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
