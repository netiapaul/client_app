import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import PropTypes from 'prop-types'

import { CBadge } from '@coreui/react'
import { hasModule } from '../utils/session'

/** Hide any item (or child) the user lacks the module for. */
const allowed = (item) => {
  if (item.modules?.length) return item.modules.some((m) => hasModule(m))
  return !item.module || hasModule(item.module)
}

const isTitle = (item) => !item.to && !item.items

/** Prune the tree to what this user may see. */
const prune = (items) =>
  items.reduce((kept, item) => {
    if (!allowed(item)) return kept

    if (item.items) {
      const children = prune(item.items)
      if (children.length > 0) kept.push({ ...item, items: children })
      return kept
    }

    kept.push(item)
    return kept
  }, [])

// Section headings are still supported even though the nav no longer uses them.
const dropOrphanTitles = (items) =>
  items.filter((item, i, list) => !isTitle(item) || (list[i + 1] && !isTitle(list[i + 1])))

export const AppSidebarNav = ({ items }) => {
  const location = useLocation()

  /** The contents of one nav row: icon, label, optional badge. */
  const navLink = (name, icon, badge) => {
    return (
      <>
        {icon && icon}
        {name && <span className="nav-link-text">{name}</span>}
        {badge && (
          <CBadge color={badge.color} className="ms-auto">
            {badge.text}
          </CBadge>
        )}
      </>
    )
  }

  /** Does this group contain the page being viewed? */
  const containsActive = (item) =>
    (item.items ?? []).some((child) =>
      child.items ? containsActive(child) : child.to && location.pathname.startsWith(child.to),
    )

  /** A collapsed group hides whatever its children are flagged. */
  const rolledUpBadge = (item) => {
    const flagged = (item.items ?? []).find((child) =>
      child.items ? rolledUpBadge(child) : child.badge,
    )
    if (!flagged) return undefined
    // Mirror the child's own badge rather than inventing a label, so a count stays a count.
    return flagged.items ? rolledUpBadge(flagged) : flagged.badge
  }

  const navItem = (item, index) => {
    const { component, name, badge, icon, ...rest } = item
    // Our own gating fields — not DOM/component props.
    delete rest.module
    delete rest.modules
    const Component = component
    return (
      <Component
        {...(rest.to &&
          !rest.items && {
            component: NavLink,
          })}
        key={item.name ?? index}
        // Collapsed to the icon rail there is no label.
        data-label={name}
        {...rest}
      >
        {navLink(name, icon, badge)}
      </Component>
    )
  }

  const navGroup = (item, index) => {
    // `items` is pulled out so it is not spread onto the component as a stray prop.
    const { component, name, icon, to, items: children, badge, ...rest } = item
    delete rest.module
    delete rest.modules
    const Component = component
    return (
      <Component
        idx={String(index)}
        key={item.name ?? index}
        toggler={navLink(name, icon, badge ?? rolledUpBadge(item))}
        visible={containsActive(item)}
        {...rest}
      >
        {children?.map((child, i) => (child.items ? navGroup(child, i) : navItem(child, i)))}
      </Component>
    )
  }

  return (
    <React.Fragment>
      {items &&
        dropOrphanTitles(prune(items)).map((item, index) =>
          item.items ? navGroup(item, index) : navItem(item, index),
        )}
    </React.Fragment>
  )
}

AppSidebarNav.propTypes = {
  items: PropTypes.arrayOf(PropTypes.any).isRequired,
}
