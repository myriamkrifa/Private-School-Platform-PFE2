const API = 'http://localhost:5000/api'

async function request(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

async function main() {
  const login = await request('POST', '/auth/login', {
    email: 'mohamed.@horizon-tech.tn',
    password: 'password123'
  })
  if (login.status !== 200) {
    console.log('Try admin login instead...')
    const admin = await request('POST', '/auth/login', {
      email: 'admin@school.com',
      password: 'Admin@1234'
    })
    if (admin.status !== 200) {
      console.error('Login failed', admin.data)
      return
    }
    login.data = admin.data
  }

  const gen = await request(
    'POST',
    '/ai/reports/generate',
    { reportType: 'TIMETABLE_STUDENTS' },
    login.data.token
  )
  console.log(gen.status, gen.data?.message || gen.data?.data?.title || gen.data)
}

main().catch(console.error)
