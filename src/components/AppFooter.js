import React from 'react'

const AppFooter = () => {
  return (
    <footer className="footer mt-2 d-flex justify-content-center">
      <p>
        All rights Reserved{' '}
        <a href="https://corebase.co.ke/" rel="noopener noreferrer" target="_blank">
          &copy; CoreBase Solutions Limited
        </a>
      </p>
    </footer>
  )
}

export default React.memo(AppFooter)
