export default function ReportContent({ text, reportType }) {
  const content = String(text || '')
  const isTimetableGrid =
    reportType === 'TIMETABLE' ||
    reportType === 'TIMETABLE_STUDENTS' ||
    reportType === 'TIMETABLE_TEACHERS' ||
    content.includes('class="timetable-grid-wrap"')

  if (isTimetableGrid && content.includes('<table class="timetable-grid">')) {
    return (
      <div
        className="ai-report-body ai-report-body--timetable"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    )
  }

  if (content.includes('timetable-grid-wrap') || content.includes('<table')) {
    return (
      <div
        className="ai-report-body ai-report-body--timetable"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    )
  }

  const paragraphs = content.split(/\n\n+/)
  return (
    <div className="ai-report-body">
      {paragraphs.map((block, index) => {
        const lines = block.split('\n')
        const isHeading =
          lines.length === 1 &&
          (lines[0].endsWith(':') || /^#+\s/.test(lines[0]) || /^[A-Z][^.]{0,60}$/.test(lines[0]))
        if (isHeading) {
          return (
            <h4 key={index} className="ai-report-heading">
              {lines[0].replace(/^#+\s*/, '')}
            </h4>
          )
        }
        if (lines.some((l) => l.trim().startsWith('- ') || l.trim().startsWith('• '))) {
          return (
            <ul key={index} className="ai-report-list">
              {lines
                .filter((l) => l.trim())
                .map((line, i) => (
                  <li key={i}>{line.replace(/^[-•]\s*/, '')}</li>
                ))}
            </ul>
          )
        }
        return <p key={index}>{block}</p>
      })}
    </div>
  )
}
