import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import RoleSpecificView from '../components/RoleSpecificView'
import DashboardShell from '../components/DashboardShell'
import { getAnnouncements } from '../services/auth.service'

export default function Dashboard() {
  const { user } = useAuth()
  const [emergencyBanner, setEmergencyBanner] = useState('')

  useEffect(() => {
    const localBanner = localStorage.getItem('globalEmergencyBanner')
    if (localBanner) {
      setEmergencyBanner(localBanner)
      return
    }

    const loadEmergencyBanner = async () => {
      try {
        const response = await getAnnouncements()
        const items = response.data?.data || []
        const emergency = items.find((item) =>
          String(item.title || '').toUpperCase().includes('[EMERGENCY]')
        )
        if (emergency) {
          setEmergencyBanner(emergency.content)
        }
      } catch (_error) {
        setEmergencyBanner('')
      }
    }

    loadEmergencyBanner()
  }, [])

  return (
    <DashboardShell
      title="Role Dashboard"
      subtitle={`Signed in as ${user?.role || 'USER'}`}
    >
      {emergencyBanner ? (
        <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-rose-800">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle size={16} />
            Emergency Broadcast: {emergencyBanner}
          </div>
        </div>
      ) : null}
      <RoleSpecificView />
    </DashboardShell>
  )
}
