export default function DataTable({ columns, data, loading, emptyMessage }) {
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <span>Loading data...</span>
      </div>
    )
  }

  const renderCell = (col, row) => {
    if (!col.render) {
      return row[col.key] ?? <span className="text-muted">—</span>
    }

    const val = row[col.key]

    // If the key is a virtual column (e.g. 'actions', 'customer', 'period', etc.)
    // and val is undefined, invoke render directly with the whole row object.
    if (val === undefined) {
      try {
        return col.render(row, row)
      } catch (err) {
        return <span className="text-muted">—</span>
      }
    }

    // Try calling with (val, row) first
    try {
      return col.render(val, row)
    } catch (err) {
      // If render expects (row), retry with (row, val)
      try {
        return col.render(row, val)
      } catch (err2) {
        console.error('DataTable render error:', err2)
        return <span className="text-muted">—</span>
      }
    }
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
          {!data || data.length === 0 ? (
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
            data.map((row, rowIdx) => (
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
