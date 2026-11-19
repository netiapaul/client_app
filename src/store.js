import { createStore } from 'redux'

const initialState = {
  sidebarShow: true,

  // Collapsed to the icon rail. Was read by AppSidebar but never written by anything, so the
  // collapsed menu was unreachable — the hamburger only ever hid the sidebar outright. The header
  // toggler now drives this on desktop (see AppHeader) and the choice is remembered below.
  sidebarUnfoldable: localStorage.getItem('sidebarCollapsed') === '1',
}

const changeState = (state = initialState, { type, ...rest }) => {
  switch (type) {
    case 'set':
      return { ...state, ...rest }
    default:
      return state
  }
}

const store = createStore(changeState)
export default store
