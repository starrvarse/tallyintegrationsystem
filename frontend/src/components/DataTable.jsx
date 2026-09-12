import { useMemo, useState } from "react";

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

/**
 * Generic excel-style data table: gridlines, row numbers, sticky header,
 * built-in search, and an optional "view" / "edit" action column.
 *
 * columns: [{ key, header, align: 'left' | 'right', width?, render?(row), searchValue?(row) }]
 */
export default function DataTable({
  columns,
  data,
  rowKey,
  searchable = true,
  searchPlaceholder = "Search…",
  onView,
  onEdit,
  onDelete,
  loading = false,
  error = null,
  emptyMessage = "No records found.",
  toolbarExtra = null,
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!searchable || !search.trim()) return data;
    const q = search.trim().toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const raw = col.searchValue ? col.searchValue(row) : row[col.key];
        return raw != null && String(raw).toLowerCase().includes(q);
      })
    );
  }, [data, search, columns, searchable]);

  if (loading) return <div className="state-msg">Loading…</div>;
  if (error) return <div className="state-msg error">{error}</div>;

  const hasActions = Boolean(onView || onEdit || onDelete);
  const colSpan = columns.length + 1 + (hasActions ? 1 : 0);

  return (
    <div>
      <div className="toolbar">
        {searchable && (
          <div className="search-wrap">
            <svg
              className="search-icon"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              className="search-input"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
        {toolbarExtra}
        <span className="count-badge">{filtered.length} of {data.length}</span>
      </div>

      <div className="table-wrap xl-table scroll-thin">
        <table>
          <thead>
            <tr>
              <th className="row-num-col">#</th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={col.align === "right" ? "num" : undefined}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
              {hasActions && <th className="action-col">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="empty-cell">{emptyMessage}</td>
              </tr>
            )}
            {filtered.map((row, idx) => (
              <tr key={rowKey ? rowKey(row, idx) : idx}>
                <td className="row-num-col muted">{idx + 1}</td>
                {columns.map((col) => (
                  <td key={col.key} className={col.align === "right" ? "num" : undefined}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
                {hasActions && (
                  <td className="action-col">
                    {onView && (
                      <button className="icon-btn" title="View details" onClick={() => onView(row)}>
                        <EyeIcon />
                      </button>
                    )}
                    {onEdit && (
                      <button className="icon-btn" title="Edit" onClick={() => onEdit(row)}>
                        <EditIcon />
                      </button>
                    )}
                    {onDelete && (
                      <button className="icon-btn icon-btn-danger" title="Delete" onClick={() => onDelete(row)}>
                        <TrashIcon />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
