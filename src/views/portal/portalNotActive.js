import React from 'react'
import PropTypes from 'prop-types'

/**
 * The banner each not-yet-active billing page carries.
 *
 * Shared so the three pages say the same thing in the same words. The pages themselves are built
 * out properly — real headers, real table columns, real empty states — so the navigation never
 * lands anywhere broken or obviously unfinished; this is the one element that admits the data
 * isn't flowing yet.
 */
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
