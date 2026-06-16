import { useEffect, useState } from 'react'
import { CalendarRange } from 'lucide-react'
import DashboardShell from '../components/DashboardShell'
import ReportContent from '../components/ReportContent'
import { getMyTimetable } from '../services/ai.service'

export default function MyTimetable() {
  const [timetable, setTimetable] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await getMyTimetable()
        if (!cancelled) {
          setTimetable(res.data?.data || null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Failed to load your timetable.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    const intervalId = setInterval(load, 30000)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [])

  return (
    <DashboardShell
      title="TimeTable"
      subtitle="Your published weekly schedule from the school administration."
    >
      <section className="page-card timetable-interface">
        <div className="timetable-interface-header">
          <div className="timetable-interface-icon" aria-hidden>
            <CalendarRange size={22} />
          </div>
          <div>
            <h2 className="section-heading">My TimeTable</h2>
            <p className="text-muted">
              This appears after the administrator accepts and publishes the school timetable.
            </p>
          </div>
        </div>

        {error ? <p className="field-error page-feedback">{error}</p> : null}

        {loading ? (
          <p className="text-muted">Loading timetable…</p>
        ) : timetable?.content ? (
          <div className="timetable-panel-result page-card ai-generated-report-card">
            <div className="ai-report-card-header">
              <div>
                <h4 className="section-heading">{timetable.title}</h4>
                <p className="text-muted">
                  Published {new Date(timetable.publishedAt).toLocaleString()}
                </p>
              </div>
            </div>
            <ReportContent text={timetable.content} reportType="TIMETABLE_STUDENTS" />
          </div>
        ) : (
          <div className="page-card">
            <p className="text-muted">No timetable has been published for your account yet.</p>
          </div>
        )}
      </section>
    </DashboardShell>
  )
}
