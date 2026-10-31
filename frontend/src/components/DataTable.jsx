export default function DataTable({ columns, data, loading, emptyMessage }) {
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <span>Loading data...</span>
      </div>
    )
  }

  const safeData = Array.isArray(data) ? data : []

  const renderCell = (col, row) => {
    if (!col.render) {
      const directVal = row[col.key]
      return directVal !== undefined && directVal !== null ? directVal : <span className="text-muted">—</span>
    }

    const val = row[col.key]
    let result

    try {
      if (val !== undefined) {
        result = col.render(val, row)
      } else {
        // Try calling render(undefined, row) first
        try {
          result = col.render(undefined, row)
        } catch {
          result = col.render(row, row)
        }
      }
    } catch (err) {
      try {
        result = col.render(row, val)
      } catch (err2) {
        console.error('DataTable render error:', err2)
        return <span className="text-muted">—</span>
      }
    }

    // Safety guard: Never allow a plain non-element object to be rendered directly into JSX
    if (result !== null && typeof result === 'object' && !result.$$typeof && !Array.isArray(result)) {
      return <span className="text-muted">—</span>
    }

    return result ?? <span className="text-muted">—</span>
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {safeData.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <div className="empty-state">
                  <div className="empty-state-icon">📭</div>
                  <div className="empty-state-text">
                    {emptyMessage || 'No data found'}
                  </div>
                </div>
              </td>
            </tr>
          ) : (
            safeData.map((row, rowIdx) => (
              <tr key={row._id || row.id || rowIdx}>
                {columns.map((col) => (
                  <td key={col.key}>
                    {renderCell(col, row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
