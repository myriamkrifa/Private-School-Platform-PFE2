import { useCallback, useEffect, useState } from 'react'
import { CalendarRange, FileText, GraduationCap, Loader2 } from 'lucide-react'
import { Navigate, NavLink } from 'react-router-dom'
import DashboardShell from '../components/DashboardShell'
import ReportContent from '../components/ReportContent'
import { useAuth } from '../context/AuthContext'
import {
  TIMETABLE_PAGES,
  getTimetablePageConfig,
  matchesTimetableReport
} from '../config/timetableConfig'
import {
  deleteAiReport,
  generateAiReport,
  getAiReport,
  getAiReports
} from '../services/ai.service'

function formatDateTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString()
}

const TIMETABLE_TABS = [
  { key: 'students', path: '/timetables/students', icon: GraduationCap },
  { key: 'teachers', path: '/timetables/teachers', icon: CalendarRange }
]

function TimetablePanel({ variant }) {
  const config = getTimetablePageConfig(variant)

  const [reports, setReports] = useState([])
  const [activeReport, setActiveReport] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [loadingReports, setLoadingReports] = useState(true)
  const [error, setError] = useState('')

  const loadReportContent = useCallback(async (reportId) => {
    const res = await getAiReport(reportId)
    return res.data?.data || null
  }, [])

  const loadReports = useCallback(async () => {
    if (!config) return []
    setLoadingReports(true)
    try {
      const res = await getAiReports()
      const matching = (res.data?.data || []).filter((report) => matchesTimetableReport(report, config))
      setReports(matching)
      return matching
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load timetables.')
      setReports([])
      return []
    } finally {
      setLoadingReports(false)
    }
  }, [config])

  useEffect(() => {
    if (!config) return undefined

    let cancelled = false

    const init = async () => {
      setActiveReport(null)
      setReports([])
      setError('')

      const matching = await loadReports()
      if (cancelled || !matching.length) return

      try {
        const fullReport = await loadReportContent(matching[0].id)
        if (!cancelled && fullReport) {
          setActiveReport(fullReport)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.response?.data?.message || 'Failed to load timetable.')
        }
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [variant, config, loadReports, loadReportContent])

  if (!config) return null

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    try {
      const res = await generateAiReport(config.reportType)
      const report = res.data?.data
      if (!report?.content) {
        throw new Error('Timetable was generated but returned no content.')
      }
      setActiveReport(report)
      await loadReports()
    } catch (e) {
      setError(
        e.response?.data?.message ||
          e.message ||
          'Failed to generate timetable. Make sure teaching assignments exist for your classes.'
      )
    } finally {
      setGenerating(false)
    }
  }

  const handleOpenReport = async (reportId) => {
    setError('')
    try {
      const report = await loadReportContent(reportId)
      setActiveReport(report)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load timetable.')
    }
  }

  const handleDeleteReport = async (reportId) => {
    setError('')
    try {
      await deleteAiReport(reportId)
      const matching = await loadReports()
      if (activeReport?.id === reportId) {
        if (matching[0]) {
          const report = await loadReportContent(matching[0].id)
          setActiveReport(report)
        } else {
          setActiveReport(null)
        }
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete timetable.')
    }
  }

  return (
    <div className="timetable-panel">
      {error ? <p className="field-error page-feedback">{error}</p> : null}

      <div className="timetable-panel-intro">
        <h3>{config.label}</h3>
        <p className="text-muted">{config.description}</p>
        <button
          type="button"
          className="btn btn-primary"
          disabled={generating}
          onClick={handleGenerate}
        >
          {generating ? (
            <>
              <Loader2 size={16} className="ai-spinner" aria-hidden />
              Generating…
            </>
          ) : (
            'Generate'
          )}
        </button>
      </div>

      {reports.length > 0 ? (
        <div className="timetable-panel-history">
          <h4 className="section-heading">Previous timetables</h4>
          <ul className="ai-report-history-list">
            {reports.map((report) => (
              <li key={report.id} className="ai-report-history-item">
                <button
                  type="button"
                  className={`ai-report-history-btn${activeReport?.id === report.id ? ' is-active' : ''}`}
                  onClick={() => handleOpenReport(report.id)}
                >
                  <span>{report.title}</span>
                  <span className="text-muted">{formatDateTime(report.createdAt)}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleDeleteReport(report.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : loadingReports ? (
        <p className="text-muted">Loading…</p>
      ) : null}

      {activeReport?.content ? (
        <div className="timetable-panel-result page-card ai-generated-report-card">
          <div className="ai-report-card-header">
            <FileText size={20} aria-hidden />
            <div>
              <h4 className="section-heading">{activeReport.title}</h4>
              <p className="text-muted">{formatDateTime(activeReport.createdAt)}</p>
            </div>
          </div>
          <ReportContent text={activeReport.content} reportType={config.reportType} />
        </div>
      ) : null}
    </div>
  )
}

export default function Timetables({ variant }) {
  const { user } = useAuth()
  const config = getTimetablePageConfig(variant)

  if (!config) {
    return <Navigate to="/timetables/students" replace />
  }

  if (user?.role !== 'ADMIN') {
    return (
      <DashboardShell title="Access denied" subtitle="Administrator access required">
        <div className="page-card">
          <p className="field-error">Only administrators can view and generate school timetables.</p>
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell
      title="TimeTable"
      subtitle="Generate and view weekly schedules for students and teachers."
    >
      <section className="page-card timetable-interface">
        <div className="timetable-interface-header">
          <div className="timetable-interface-icon" aria-hidden>
            <CalendarRange size={22} />
          </div>
          <div>
            <h2 className="section-heading">TimeTable</h2>
            <p className="text-muted">Choose a timetable type below.</p>
          </div>
        </div>

        <nav className="timetable-interface-tabs" aria-label="Timetable types">
          {TIMETABLE_TABS.map(({ key, path, icon: TabIcon }) => {
            const tabConfig = TIMETABLE_PAGES[key]
            return (
              <NavLink
                key={key}
                to={path}
                className={({ isActive }) =>
                  `timetable-interface-tab${isActive ? ' is-active' : ''}`
                }
              >
                <TabIcon size={16} aria-hidden />
                <span>{tabConfig.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="timetable-interface-body">
          <TimetablePanel variant={variant} />
        </div>
      </section>
    </DashboardShell>
  )
}
