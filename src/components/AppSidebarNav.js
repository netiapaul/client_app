import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import PropTypes from 'prop-types'

import { CBadge } from '@coreui/react'
import { hasModule } from '../utils/session'

/**
 * Hide any item (or child) the user lacks the module for. Items with neither field are always shown.
 *
 * `modules` is ANY-OF, matching how [RequireModule] gates the endpoints: an entry that leads to a
 * page made of independently-gated sections — Setup is the one — should appear for anyone who can
 * use at least one of them, not only for someone holding every right.
 */
const allowed = (item) => {
  if (item.modules?.length) return item.modules.some((m) => hasModule(m))
  return !item.module || hasModule(item.module)
}

const isTitle = (item) => !item.to && !item.items

/**
 * Prune the tree to what this user may see.
 *
 * Recursive, and the reason it has to be: a group is only worth showing if something inside it
 * survived. Filtering the top level alone would leave someone with, say, no billing rights looking
 * at a "Billing" row that expands into nothing.
 *
 * Returns copies rather than mutating — _nav.js is a module-level constant, so trimming it in place
 * would permanently remove items for the rest of the session once a user with fewer rights signed in.
 */
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

// Section headings are still supported even though the nav no longer uses them: drop one that ends
// up last, or immediately followed by another heading, because its section was filtered away.
const dropOrphanTitles = (items) =>
  items.filter((item, i, list) => !isTitle(item) || (list[i + 1] && !isTitle(list[i + 1])))

export const AppSidebarNav = ({ items }) => {
  const location = useLocation()

  /**
   * The contents of one nav row: icon, label, optional badge.
   *
   * The label is WRAPPED rather than rendered as a bare text node, and that wrapper is the whole
   * reason this function has a comment. Collapsed to the icon rail there is no room for text, and
   * CSS cannot hide a bare text node — so the rail was centring icon-plus-label together, pushing
   * the icon off the left edge and leaving a clipped word ("MESSAGI", "RASTRUC") where the glyph
   * should have been. With a span there is something to hide.
   */
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

  /**
   * Does this group contain the page being viewed? Used to open it on arrival, so a reload or a
   * deep link never leaves someone on a page whose menu entry is hidden inside a collapsed group.
   */
  const containsActive = (item) =>
    (item.items ?? []).some((child) =>
      child.items ? containsActive(child) : child.to && location.pathname.startsWith(child.to),
    )

  /**
   * A collapsed group hides whatever its children are flagged with, so if anything inside carries
   * a badge the group carries one too.
   *
   * Nothing in _nav.js is badged today — the NEW markers were removed once the billing and SMS
   * screens stopped being new. Kept because the next badge is likely to be a live count (pending
   * approvals, failed emails), and that is exactly the kind of thing that must not be invisible
   * behind a collapsed group.
   */
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
    // Our own gating fields — not DOM/component props. Left in, React warns about an unknown
    // attribute on the rendered element.
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
        // Collapsed to the icon rail there is no label, so the CSS pops this out beside the icon
        // on hover. A data attribute rather than `title`, or the browser's own tooltip shows up
        // alongside it.
        data-label={name}
        {...rest}
      >
        {navLink(name, icon, badge)}
      </Component>
    )
  }

  const navGroup = (item, index) => {
    // `items` is pulled out so it is not spread onto the component as a stray prop, and
    // `module`/`modules` are ours rather than CoreUI's.
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
