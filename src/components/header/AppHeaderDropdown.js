import React from 'react'
import { getName, clearSession } from '../../utils/session'
import { useNavigate } from 'react-router-dom'

import {
  // CAvatar,
  // CBadge,
  CDropdown,
  // CDropdownDivider,
  CDropdownHeader,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
} from '@coreui/react'
import {
  // cilBell,
  // cilCreditCard,
  // cilCommentSquare,
  // cilEnvelopeOpen,
  // cilFile,
  cilLockLocked,
  // cilSettings,
  // cilTask,
  // cilUser,
} from '@coreui/icons'
import CIcon from '@coreui/icons-react'
// import Avatar from '@mui/material/Avatar'
// import avatar8 from './../../assets/images/avatars/8.jpg'

const AppHeaderDropdown = () => {
  const handleLogOut = () => {
    clearSession()
    return navigate('/', { replace: true })
  }
  // function stringAvatar(name) {
  //   return {
  //     children: `${name?.split(' ')[0][0]}${name?.split(' ')[1][0]}`,
  //   }
  // }

  const navigate = useNavigate()
  return (
    <CDropdown>
      <CDropdownToggle placement="bottom-end" className="profile" size="sm">
        {getName()}
        {/* <Avatar
          {...stringAvatar(getName())}
          sx={{ bgcolor: '#C58C4F', width: 24, height: 24, fontSize: '11px' }}
        /> */}
        {/* <CAvatar src={avatar8} size="md" /> */}
      </CDropdownToggle>
      {/* <CDropdownMenu className="pt-0 rounded-0" placement="bottom-end"> */}
      <CDropdownMenu className="p-1">
        <CDropdownHeader className="bg-light fw-semibold py-2">Account</CDropdownHeader>
        <CDropdownItem onClick={handleLogOut} className="accout text-danger fw-bold">
          <CIcon icon={cilLockLocked} className="me-2" />
          Log Out
        </CDropdownItem>
      </CDropdownMenu>
    </CDropdown>
  )
}

export default AppHeaderDropdown
