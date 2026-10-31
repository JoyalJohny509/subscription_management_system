import React from 'react'

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
      const v = row[col.key]
      if (v && typeof v === 'object') return <span className="text-muted">—</span>
      return v ?? <span className="text-muted">—</span>
    }

    const val = row[col.key]
    let result

    if (val === undefined) {
      try {
        result = col.render(row, row)
      } catch (err) {
        result = <span className="text-muted">—</span>
      }
    } else {
      try {
        result = col.render(val, row)
      } catch (err) {
        try {
          result = col.render(row, val)
        } catch (err2) {
          result = <span className="text-muted">—</span>
        }
      }
    }

    // Safety guard: prevent raw Objects from rendering as JSX children which causes React fatal crashes
    if (result && typeof result === 'object' && !React.isValidElement(result)) {
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
