import React, { useState, useEffect, useCallback } from 'react'
import { getToken } from '../../utils/session'

const axios = require('axios')
const BASE_URL = process.env.REACT_APP_URL_CONFIG

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
})
const readErr = (e) =>
  e?.response?.data?.message || e?.request?.response || `${e?.code}: ${e?.message}`

const Locations = () => {
  const [regions, setRegions] = useState([])
  const [counties, setCounties] = useState([])
  const [towns, setTowns] = useState([])
  const [selRegion, setSelRegion] = useState(null)
  const [selCounty, setSelCounty] = useState(null)
  const [error, setError] = useState('')

  // add inputs
  const [newRegion, setNewRegion] = useState('')
  const [newCounty, setNewCounty] = useState('')
  const [newCountyNo, setNewCountyNo] = useState('')
  const [newTown, setNewTown] = useState('')

  // per-panel search filters
  const [regionSearch, setRegionSearch] = useState('')
  const [countySearch, setCountySearch] = useState('')
  const [townSearch, setTownSearch] = useState('')

  const err = (e) => setError(readErr(e))

  const loadRegions = useCallback(async () => {
    try {
      const r = await axios.get(`${BASE_URL}/api/Locations/Regions`, { headers: authHeaders() })
      setRegions(r.data ?? [])
    } catch (e) {
      err(e)
    }
  }, [])

  const loadCounties = useCallback(async (regionId) => {
    if (!regionId) {
      setCounties([])
      return
    }
    try {
      const r = await axios.get(`${BASE_URL}/api/Locations/Counties?regionId=${regionId}`, {
        headers: authHeaders(),
      })
      setCounties(r.data ?? [])
    } catch (e) {
      err(e)
    }
  }, [])

  const loadTowns = useCallback(async (countyId) => {
    if (!countyId) {
      setTowns([])
      return
    }
    try {
      const r = await axios.get(`${BASE_URL}/api/Locations/Towns?countyId=${countyId}`, {
        headers: authHeaders(),
      })
      setTowns(r.data ?? [])
    } catch (e) {
      err(e)
    }
  }, [])

  useEffect(() => {
    loadRegions()
  }, [loadRegions])

  const pickRegion = (r) => {
    setSelRegion(r)
    setSelCounty(null)
    setTowns([])
    setCountySearch('')
    setTownSearch('')
    loadCounties(r.regionId)
  }
  const pickCounty = (c) => {
    setSelCounty(c)
    setTownSearch('')
    loadTowns(c.countyId)
  }

  // ---- Region actions ----
  const addRegion = async () => {
    if (!newRegion.trim()) return
    try {
      await axios.post(
        `${BASE_URL}/api/Locations/Region`,
        { name: newRegion.trim() },
        { headers: authHeaders() },
      )
      setNewRegion('')
      loadRegions()
    } catch (e) {
      err(e)
    }
  }
  const renameRegion = async (r) => {
    const name = window.prompt('Region name', r.name)
    if (!name || name === r.name) return
    try {
      await axios.put(
        `${BASE_URL}/api/Locations/Region/${r.regionId}`,
        { name },
        { headers: authHeaders() },
      )
      loadRegions()
    } catch (e) {
      err(e)
    }
  }
  const deleteRegion = async (r) => {
    if (!window.confirm(`Delete region "${r.name}"?`)) return
    try {
      await axios.delete(`${BASE_URL}/api/Locations/Region/${r.regionId}`, {
        headers: authHeaders(),
      })
      if (selRegion?.regionId === r.regionId) {
        setSelRegion(null)
        setCounties([])
        setTowns([])
      }
      loadRegions()
    } catch (e) {
      err(e)
    }
  }

  // ---- County actions ----
  const addCounty = async () => {
    if (!newCounty.trim() || !selRegion) return
    try {
      await axios.post(
        `${BASE_URL}/api/Locations/County`,
        {
          name: newCounty.trim(),
          countyNo: newCountyNo ? Number(newCountyNo) : null,
          regionId: selRegion.regionId,
        },
        { headers: authHeaders() },
      )
      setNewCounty('')
      setNewCountyNo('')
      loadCounties(selRegion.regionId)
    } catch (e) {
      err(e)
    }
  }
  const renameCounty = async (c) => {
    const name = window.prompt('County name', c.name)
    if (!name || name === c.name) return
    try {
      await axios.put(
        `${BASE_URL}/api/Locations/County/${c.countyId}`,
        { name, regionId: c.regionId },
        { headers: authHeaders() },
      )
      loadCounties(selRegion.regionId)
    } catch (e) {
      err(e)
    }
  }
  const deleteCounty = async (c) => {
    if (!window.confirm(`Delete county "${c.name}"?`)) return
    try {
      await axios.delete(`${BASE_URL}/api/Locations/County/${c.countyId}`, {
        headers: authHeaders(),
      })
      if (selCounty?.countyId === c.countyId) {
        setSelCounty(null)
        setTowns([])
      }
      loadCounties(selRegion.regionId)
    } catch (e) {
      err(e)
    }
  }

  // ---- Town actions ----
  const addTown = async () => {
    if (!newTown.trim() || !selCounty) return
    try {
      await axios.post(
        `${BASE_URL}/api/Locations/Town`,
        { name: newTown.trim(), countyId: selCounty.countyId },
        { headers: authHeaders() },
      )
      setNewTown('')
      loadTowns(selCounty.countyId)
    } catch (e) {
      err(e)
    }
  }
  const renameTown = async (t) => {
    const name = window.prompt('Town name', t.name)
    if (!name || name === t.name) return
    try {
      await axios.put(
        `${BASE_URL}/api/Locations/Town/${t.townId}`,
        { name, countyId: t.countyId },
        { headers: authHeaders() },
      )
      loadTowns(selCounty.countyId)
    } catch (e) {
      err(e)
    }
  }
  const deleteTown = async (t) => {
    if (!window.confirm(`Delete town "${t.name}"?`)) return
    try {
      await axios.delete(`${BASE_URL}/api/Locations/Town/${t.townId}`, { headers: authHeaders() })
      loadTowns(selCounty.countyId)
    } catch (e) {
      err(e)
    }
  }

  const panel = (title, subtitle) => (
    <div className="d-flex justify-content-between align-items-center px-2 py-2 border-bottom">
      <span className="fw-bold" style={{ fontSize: '12px' }}>
        {title}
      </span>
      <span className="text-muted" style={{ fontSize: '11px' }}>
        {subtitle}
      </span>
    </div>
  )

  const rowStyle = (active) => ({
    cursor: 'pointer',
    // Theme-neutral translucent accent so it reads on both light and dark without a re-render.
    background: active ? 'rgba(245, 139, 64, 0.18)' : 'transparent',
    borderLeft: active ? '3px solid #F58B40' : '3px solid transparent',
  })

  const actionBtns = (onEdit, onDelete) => (
    <span>
      <span
        className="material-icons"
        role="button"
        title="Rename"
        onClick={onEdit}
        style={{ fontSize: '15px', cursor: 'pointer' }}
      >
        edit
      </span>
      <span
        className="material-icons ms-2"
        role="button"
        title="Delete"
        onClick={onDelete}
        style={{ fontSize: '15px', color: '#c0392b', cursor: 'pointer' }}
      >
        delete
      </span>
    </span>
  )

  const match = (name, q) => !q || (name ?? '').toLowerCase().includes(q.trim().toLowerCase())
  const shownRegions = regions.filter((r) => match(r.name, regionSearch))
  const shownCounties = counties.filter(
    (c) => match(c.name, countySearch) || match(String(c.countyNo ?? ''), countySearch),
  )
  const shownTowns = towns.filter((t) => match(t.name, townSearch))

  const searchBox = (value, onChange, placeholder) => (
    <input
      className="form-control form-control-sm rounded-0 border-0 border-bottom"
      style={{ fontSize: '12px', maxWidth: 150 }}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )

  return (
    <>
      <hr className="my-2" />
      <div className="d-flex justify-content-between align-items-center">
        <h6 className="m-0">Locations — Regions, Counties &amp; Towns</h6>
        <span className="text-muted" style={{ fontSize: '11px' }}>
          Pick a region to see its counties, then a county to see its towns.
        </span>
      </div>
      <hr className="my-2" />

      {error && (
        <div className="alert alert-danger rounded-0 p-2" role="alert">
          {error}
        </div>
      )}

      <div className="row g-2" style={{ fontSize: '12px' }}>
        {/* Regions */}
        <div className="col-md-4">
          <div className="card rounded-0">
            {panel('Regions', `${shownRegions.length}/${regions.length}`)}
            <div className="px-2 py-1 border-bottom">
              {searchBox(regionSearch, setRegionSearch, 'Search regions…')}
            </div>
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {shownRegions.map((r) => (
                <div
                  key={r.regionId}
                  className="d-flex justify-content-between align-items-center px-2 py-1 border-bottom"
                  style={rowStyle(selRegion?.regionId === r.regionId)}
                  onClick={() => pickRegion(r)}
                >
                  <span>{r.name}</span>
                  {actionBtns(
                    (e) => {
                      e.stopPropagation()
                      renameRegion(r)
                    },
                    (e) => {
                      e.stopPropagation()
                      deleteRegion(r)
                    },
                  )}
                </div>
              ))}
            </div>
            <div className="d-flex p-2 gap-1 border-top">
              <input
                className="form-control form-control-sm rounded-0"
                placeholder="New region"
                value={newRegion}
                onChange={(e) => setNewRegion(e.target.value)}
              />
              <button className="btn btn-sm add-btn rounded-0" onClick={addRegion}>
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Counties */}
        <div className="col-md-4">
          <div className="card rounded-0">
            {panel('Counties', selRegion ? selRegion.name : 'select a region')}
            {selRegion && (
              <div className="px-2 py-1 border-bottom">
                {searchBox(countySearch, setCountySearch, 'Search counties…')}
              </div>
            )}
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {shownCounties.map((c) => (
                <div
                  key={c.countyId}
                  className="d-flex justify-content-between align-items-center px-2 py-1 border-bottom"
                  style={rowStyle(selCounty?.countyId === c.countyId)}
                  onClick={() => pickCounty(c)}
                >
                  <span>
                    {c.countyNo ? <span className="text-muted">{c.countyNo}. </span> : null}
                    {c.name}
                  </span>
                  {actionBtns(
                    (e) => {
                      e.stopPropagation()
                      renameCounty(c)
                    },
                    (e) => {
                      e.stopPropagation()
                      deleteCounty(c)
                    },
                  )}
                </div>
              ))}
              {selRegion && shownCounties.length === 0 && (
                <div className="text-muted p-2">
                  {counties.length ? 'No matches' : 'No counties'}
                </div>
              )}
            </div>
            {selRegion && (
              <div className="d-flex p-2 gap-1 border-top">
                <input
                  className="form-control form-control-sm rounded-0"
                  style={{ maxWidth: 60 }}
                  placeholder="No."
                  value={newCountyNo}
                  onChange={(e) => setNewCountyNo(e.target.value)}
                />
                <input
                  className="form-control form-control-sm rounded-0"
                  placeholder="New county"
                  value={newCounty}
                  onChange={(e) => setNewCounty(e.target.value)}
                />
                <button className="btn btn-sm add-btn rounded-0" onClick={addCounty}>
                  Add
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Towns */}
        <div className="col-md-4">
          <div className="card rounded-0">
            {panel('Towns', selCounty ? selCounty.name : 'select a county')}
            {selCounty && (
              <div className="px-2 py-1 border-bottom">
                {searchBox(townSearch, setTownSearch, 'Search towns…')}
              </div>
            )}
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {shownTowns.map((t) => (
                <div
                  key={t.townId}
                  className="d-flex justify-content-between align-items-center px-2 py-1 border-bottom"
                >
                  <span>{t.name}</span>
                  {actionBtns(
                    () => renameTown(t),
                    () => deleteTown(t),
                  )}
                </div>
              ))}
              {selCounty && shownTowns.length === 0 && (
                <div className="text-muted p-2">{towns.length ? 'No matches' : 'No towns'}</div>
              )}
            </div>
            {selCounty && (
              <div className="d-flex p-2 gap-1 border-top">
                <input
                  className="form-control form-control-sm rounded-0"
                  placeholder="New town"
                  value={newTown}
                  onChange={(e) => setNewTown(e.target.value)}
                />
                <button className="btn btn-sm add-btn rounded-0" onClick={addTown}>
                  Add
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default Locations
