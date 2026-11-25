import React, { useState, useCallback, useRef } from 'react'
import { CModal, CModalBody, CModalHeader, CModalTitle } from '@coreui/react'

/** A confirmation dialog that looks like the rest of the application. */
const useConfirm = () => {
  const [state, setState] = useState(null)

  // What the user has typed, when the dialog is asking for something.
  const [value, setValue] = useState('')

  // The promise's resolve, held across renders so the buttons can answer the original caller.
  const resolver = useRef(null)

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        resolver.current = resolve
        const next = typeof options === 'string' ? { body: options } : options ?? {}
        setValue(next.input?.value ?? '')
        setState(next)
      }),
    [],
  )

  /** Resolve the question. */
  const answer = useCallback(
    (ok, typed) => {
      const asked = state
      setState(null)

      // Cleared before resolving: the caller usually re-renders immediately.
      const resolve = resolver.current
      resolver.current = null
      if (!resolve) return

      if (!asked?.input) return resolve(ok)
      resolve(ok ? (typed ?? '').trim() || null : null)
    },
    [state],
  )

  const dialog = (
    <CModal
      visible={!!state}
      // Dismissing by backdrop or Escape is a NO.
      onClose={() => answer(false)}
      alignment="center"
      size={state?.size ?? undefined}
    >
      <CModalHeader closeButton={false}>
        <CModalTitle className="cb-fs-section">{state?.title ?? 'Please confirm'}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {/* Line breaks are preserved: several of these messages are a question then detail. */}
        <div className="cb-fs-body" style={{ whiteSpace: 'pre-line' }}>
          {state?.body}
        </div>

        {state?.detail && (
          <div
            className={`alert rounded-0 py-2 cb-fs-body mt-3 mb-0 ${
              state.danger ? 'alert-danger' : 'alert-warning'
            }`}
          >
            {state.detail}
          </div>
        )}

        {state?.input && (
          <div className="mt-3">
            <label className="cb-fs-meta text-muted d-block mb-1" htmlFor="cb-confirm-input">
              {state.input.label}
            </label>
            <input
              id="cb-confirm-input"
              type="text"
              className="form-control form-control-sm rounded-0"
              maxLength={state.input.maxLength ?? 400}
              placeholder={state.input.placeholder ?? ''}
              value={value}
              autoFocus
              onChange={(e) => setValue(e.target.value)}
              // Enter submits, as it did in window.prompt.
              onKeyDown={(e) => {
                if (e.key === 'Enter' && value.trim()) answer(true, value)
              }}
            />
            {state.input.help && (
              <span className="cb-fs-meta text-muted d-block mt-1">{state.input.help}</span>
            )}
          </div>
        )}

        <div className="d-flex justify-content-end gap-1 mt-3 pt-2 border-top">
          <button
            type="button"
            className="btn btn-sm cancel-btn rounded-0"
            onClick={() => answer(false)}
          >
            {state?.cancelText ?? 'Cancel'}
          </button>
          <button
            type="button"
            // Destructive actions are red — something window.confirm could not do.
            className={`btn btn-sm rounded-0 ${state?.danger ? 'delete-btn' : 'add-btn'}`}
            // A required answer cannot be submitted empty.
            disabled={!!state?.input && !value.trim()}
            // Focused on open so Enter confirms and Escape cancels.
            autoFocus={!state?.input}
            onClick={() => answer(true, value)}
          >
            {state?.confirmText ?? 'Confirm'}
          </button>
        </div>
      </CModalBody>
    </CModal>
  )

  return [confirm, dialog]
}

export default useConfirm
