import { GraduationCap, Users, UserCircle } from 'lucide-react'

const ACCENT_META = {
  blue: { Icon: GraduationCap, label: 'Student' },
  orange: { Icon: Users, label: 'Staff' },
  violet: { Icon: UserCircle, label: 'Account' }
}

export default function FormModal({
  accent = 'blue',
  title,
  subtitle,
  onClose,
  closeDisabled = false,
  children,
  footer
}) {
  const { Icon } = ACCENT_META[accent] || ACCENT_META.blue

  return (
    <div className="form-modal-overlay" role="presentation" onClick={closeDisabled ? undefined : onClose}>
      <div
        className={`form-modal form-modal--${accent}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`form-modal-header form-modal-header--${accent}`}>
          <div className="form-modal-header-main">
            <span className={`form-modal-icon form-modal-icon--${accent}`}>
              <Icon size={20} strokeWidth={2} />
            </span>
            <div>
              <h3 id="form-modal-title" className="form-modal-title">
                {title}
              </h3>
              {subtitle ? <p className="form-modal-subtitle">{subtitle}</p> : null}
            </div>
          </div>
          <button
            type="button"
            className="form-modal-close"
            onClick={onClose}
            disabled={closeDisabled}
          >
            Close
          </button>
        </div>

        <div className="form-modal-body">{children}</div>

        {footer ? <div className={`form-modal-footer form-modal-footer--${accent}`}>{footer}</div> : null}
      </div>
    </div>
  )
}
