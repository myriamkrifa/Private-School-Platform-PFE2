const fs = require('fs')
const path = require('path')
const admin = require('firebase-admin')

const DEFAULT_SERVICE_ACCOUNT_PATH = path.resolve(
  __dirname,
  'firebase-service-account.json'
)

/**
 * Loads the Firebase service account JSON from disk.
 * @returns {{ serviceAccount: object, filePath: string } | null}
 */
function loadServiceAccount() {
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    ? path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
    : DEFAULT_SERVICE_ACCOUNT_PATH

  if (!fs.existsSync(filePath)) {
    console.error(`[Firebase] Service account file not found: ${filePath}`)
    return null
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const serviceAccount = JSON.parse(raw)

    if (!serviceAccount?.project_id || !serviceAccount?.private_key || !serviceAccount?.client_email) {
      console.error(
        '[Firebase] Service account JSON is missing required fields (project_id, private_key, client_email).'
      )
      return null
    }

    return { serviceAccount, filePath }
  } catch (error) {
    console.error(`[Firebase] Failed to read/parse service account at ${filePath}:`, error.message)
    return null
  }
}

function initializeFirebaseAdmin() {
  if (admin.apps.length) {
    return true
  }

  const loaded = loadServiceAccount()
  if (!loaded) {
    console.warn('[Firebase] Admin SDK not initialized — Google SSO will be unavailable.')
    return false
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert(loaded.serviceAccount)
    })
    console.log(
      `[Firebase] Admin SDK initialized (project: ${loaded.serviceAccount.project_id}, file: ${loaded.filePath})`
    )
    return true
  } catch (error) {
    console.error('[Firebase] initializeApp failed:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    return false
  }
}

initializeFirebaseAdmin()

module.exports = admin
