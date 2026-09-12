import { useEffect, useState } from "react";
import DataTable from "./DataTable";

/** Thin wrapper for master lists: fetch -> loading/error -> DataTable, with
 * optional create/edit modals. `CreateModal` is used for both - when editing
 * it's given the row via the `editing` prop instead of `onClose`/`onCreated`
 * alone. */
export default function SimpleMasterTab({
  fetcher,
  columns,
  searchPlaceholder,
  emptyMessage,
  createLabel,
  CreateModal,
  createModalProps,
}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingRow, setEditingRow] = useState(null);

  const load = () => {
    setLoading(true);
    fetcher()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        rowKey={(r) => r.guid || r.name}
        loading={loading}
        error={error}
        searchPlaceholder={searchPlaceholder}
        emptyMessage={emptyMessage}
        onEdit={CreateModal ? setEditingRow : undefined}
        toolbarExtra={
          CreateModal && (
            <button className="btn" onClick={() => setShowCreate(true)}>{createLabel}</button>
          )
        }
      />
      {showCreate && CreateModal && (
        <CreateModal
          {...createModalProps}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
      {editingRow && CreateModal && (
        <CreateModal
          {...createModalProps}
          editing={editingRow}
          onClose={() => setEditingRow(null)}
          onCreated={() => {
            setEditingRow(null);
            load();
          }}
        />
      )}
    </>
  );
}
