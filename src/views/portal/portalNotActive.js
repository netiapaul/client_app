import React from 'react'
import PropTypes from 'prop-types'

/** The banner each not-yet-active billing page carries. */
const PortalNotActive = ({ children }) => (
  <div className="pt-note">
    <span className="pt-note__icon">
      <span className="material-icons">info</span>
    </span>
    <span>
      <strong>Not switched on yet</strong>
      <span>
        {children} Your licences and renewal dates are live under Dashboard and My companies, and
        billing continues exactly as it does today until this page goes live.
      </span>
    </span>
  </div>
)

PortalNotActive.propTypes = {
  children: PropTypes.node,
}

export default PortalNotActive
