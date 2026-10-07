import React from 'react'
import PropTypes from 'prop-types'

// Top-level boundary: one render error shows a fallback instead of a blank white app.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-vh-100 d-flex flex-column justify-content-center align-items-center text-center p-4">
          <span className="material-icons" style={{ fontSize: 48, color: '#f58b40' }}>
            error_outline
          </span>
          <h4 className="mt-3 mb-1">Something went wrong</h4>
          <p className="text-muted mb-3" style={{ maxWidth: 420 }}>
            An unexpected error occurred while rendering this page. Try reloading.
          </p>
          <button type="button" className="btn btn-primary" onClick={this.handleReload}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node,
}

export default ErrorBoundary
