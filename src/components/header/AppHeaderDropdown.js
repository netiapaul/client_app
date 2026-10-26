import React from 'react'
import { getName, clearSession } from '../../utils/session'
import { useNavigate } from 'react-router-dom'
import swal from 'sweetalert'

import {
  CDropdown,
  CDropdownHeader,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
} from '@coreui/react'
import { cilLockLocked, cilUser } from '@coreui/icons'
import CIcon from '@coreui/icons-react'

const AppHeaderDropdown = () => {
  const navigate = useNavigate()

  const handleLogOut = () => {
    swal({
      title: 'Log out?',
      text: 'You will need to sign in again to access the system.',
      icon: 'warning',
      buttons: ['Cancel', 'Log out'],
      dangerMode: true,
    }).then((confirmed) => {
      if (confirmed) {
        clearSession()
        navigate('/', { replace: true })
      }
    })
  }

  return (
    <CDropdown>
      <CDropdownToggle placement="bottom-end" className="profile" size="sm">
        {getName()}
      </CDropdownToggle>
      <CDropdownMenu className="p-1">
        <CDropdownHeader className="bg-light fw-semibold py-2">Account</CDropdownHeader>
        <CDropdownItem
          onClick={() => navigate('/profile')}
          className="accout"
          style={{ cursor: 'pointer' }}
        >
          <CIcon icon={cilUser} className="me-2" />
          Profile
        </CDropdownItem>
        <CDropdownItem
          onClick={handleLogOut}
          className="accout text-danger fw-bold"
          style={{ cursor: 'pointer' }}
        >
          <CIcon icon={cilLockLocked} className="me-2" />
          Log Out
        </CDropdownItem>
      </CDropdownMenu>
    </CDropdown>
  )
}

export default AppHeaderDropdown
