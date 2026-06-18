export function EditIconButton({
  label = 'Edit',
  onClick,
  disabled = false,
  loading = false,
  active = false,
  className = ''
}) {
  return (
    <button
      type="button"
      className={`btn-icon${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      title={label}
      aria-label={label}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? '…' : '✏️'}
    </button>
  )
}

export function DeleteIconButton({
  label = 'Delete',
  onClick,
  disabled = false,
  loading = false,
  className = ''
}) {
  return (
    <button
      type="button"
      className={`btn-icon btn-icon-danger${className ? ` ${className}` : ''}`}
      title={label}
      aria-label={label}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? '…' : '🗑️'}
    </button>
  )
}
