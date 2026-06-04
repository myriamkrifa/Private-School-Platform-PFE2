const fs = require('fs')
const path = require('path')

const ENV_PATH = path.join(__dirname, '../../.env')

function updateEnvVariable(key, value) {
  const safeKey = String(key || '').trim()
  if (!safeKey) throw new Error('Env key is required.')

  const lineValue = String(value ?? '').trim()
  const newLine = `${safeKey}=${lineValue}`

  let content = ''
  if (fs.existsSync(ENV_PATH)) {
    content = fs.readFileSync(ENV_PATH, 'utf8')
  }

  const lineRegex = new RegExp(`^${safeKey}=.*$`, 'm')
  if (lineRegex.test(content)) {
    content = content.replace(lineRegex, newLine)
  } else {
    content = content.trimEnd() + (content.endsWith('\n') || !content ? '' : '\n') + `\n${newLine}\n`
  }

  fs.writeFileSync(ENV_PATH, content, 'utf8')
  return { key: safeKey, saved: true }
}

module.exports = { updateEnvVariable, ENV_PATH }
