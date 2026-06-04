import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'

const ConfirmDialogContext = createContext(null)

export function ConfirmDialogProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const dialogRef = useRef(null)

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      const payload = {
        title: options.title || 'Confirm',
        message: options.message || 'Are you sure?',
        confirmLabel: options.confirmLabel || 'Confirm',
        cancelLabel: options.cancelLabel || 'Cancel',
        variant: options.variant || 'danger',
        resolve
      }
      dialogRef.current = payload
      setDialog(payload)
    })
  }, [])

  const close = useCallback((result) => {
    const current = dialogRef.current
    if (current?.resolve) {
      current.resolve(result)
    }
    dialogRef.current = null
    setDialog(null)
  }, [])

  const modal =
    dialog &&
    createPortal(
      <div
        className="confirm-dialog-overlay"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) close(false)
        }}
      >
        <div
          className="confirm-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-message"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div
            className={`confirm-dialog-icon ${
              dialog.variant === 'danger' ? 'confirm-dialog-icon--danger' : 'confirm-dialog-icon--primary'
            }`}
          >
            <AlertTriangle size={22} strokeWidth={2} />
          </div>

          <h3 id="confirm-dialog-title" className="confirm-dialog-title">
            {dialog.title}
          </h3>
          <p id="confirm-dialog-message" className="confirm-dialog-message">
            {dialog.message}
          </p>

          <div className="confirm-dialog-actions">
            <button
              type="button"
              className="confirm-dialog-btn confirm-dialog-btn--cancel"
              onClick={() => close(false)}
            >
              {dialog.cancelLabel}
            </button>
            <button
              type="button"
              className={`confirm-dialog-btn confirm-dialog-btn--confirm confirm-dialog-btn--${dialog.variant}`}
              onClick={() => close(true)}
            >
              {dialog.confirmLabel}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      {modal}
    </ConfirmDialogContext.Provider>
  )
}

export function useConfirm() {
  const context = useContext(ConfirmDialogContext)
  if (!context) {
    throw new Error('useConfirm must be used within ConfirmDialogProvider')
  }
  return context
}
