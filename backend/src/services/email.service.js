const nodemailer = require('nodemailer')

const APP_NAME = process.env.APP_NAME || 'EduManage'
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

let transporter = null

const isEmailConfigured = () => {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

const getTransporter = () => {
  if (!isEmailConfigured()) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  }
  return transporter
}

const sendEmail = async ({ to, subject, html, text }) => {
  const transport = getTransporter()
  if (!transport) {
    console.warn(`[Email] SMTP not configured — skipped: "${subject}" → ${to}`)
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' }
  }

  const from = process.env.SMTP_FROM || `"${APP_NAME}" <${process.env.SMTP_USER}>`

  try {
    await transport.sendMail({ from, to, subject, html, text })
    console.log(`[Email] Sent "${subject}" → ${to}`)
    return { sent: true }
  } catch (error) {
    console.error(`[Email] Failed "${subject}" → ${to}:`, error.message)
    return { sent: false, reason: error.message }
  }
}

const layout = (title, bodyHtml) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#1e293b;max-width:560px;margin:0 auto;padding:24px;">
  <h2 style="color:#0f172a;margin:0 0 16px;">${APP_NAME}</h2>
  ${bodyHtml}
  <p style="margin-top:24px;font-size:12px;color:#64748b;">This is an automated message. Please do not reply.</p>
</body>
</html>
`

const sendAccountApprovedEmail = async ({ to, name }) => {
  const loginUrl = `${CLIENT_URL}/login`
  const subject = `Your ${APP_NAME} account has been approved`
  const html = layout(
    subject,
    `
    <p>Hello <strong>${name}</strong>,</p>
    <p>Your registration has been approved by the school administrator. You can now sign in to your account.</p>
    <p><a href="${loginUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Sign in</a></p>
    <p style="font-size:14px;color:#475569;">Login page: <a href="${loginUrl}">${loginUrl}</a></p>
    `
  )
  const text = `Hello ${name},\n\nYour ${APP_NAME} account has been approved. Sign in at: ${loginUrl}`

  return sendEmail({ to, subject, html, text })
}

const sendParentAccountEmail = async ({
  to,
  parentName,
  loginEmail,
  temporaryPassword,
  studentName
}) => {
  const loginUrl = `${CLIENT_URL}/login`
  const subject = `Your ${APP_NAME} parent account`
  const html = layout(
    subject,
    `
    <p>Hello <strong>${parentName}</strong>,</p>
    <p>A parent account has been created for you and linked to student <strong>${studentName}</strong>.</p>
    <table style="border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:6px 12px 6px 0;color:#64748b;">Login email</td><td><strong>${loginEmail}</strong></td></tr>
      <tr><td style="padding:6px 12px 6px 0;color:#64748b;">Temporary password</td><td><strong>${temporaryPassword}</strong></td></tr>
    </table>
    <p>Please sign in and change your password on first login.</p>
    <p><a href="${loginUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Sign in</a></p>
    `
  )
  const text = [
    `Hello ${parentName},`,
    '',
    `A parent account was created and linked to ${studentName}.`,
    `Login email: ${loginEmail}`,
    `Temporary password: ${temporaryPassword}`,
    '',
    `Sign in at: ${loginUrl}`,
    'Please change your password after first login.'
  ].join('\n')

  return sendEmail({ to, subject, html, text })
}

module.exports = {
  isEmailConfigured,
  sendAccountApprovedEmail,
  sendParentAccountEmail
}
