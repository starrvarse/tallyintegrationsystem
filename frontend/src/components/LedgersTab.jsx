import { useEffect, useState } from "react";
import { getLedgerDetail, getLedgers } from "../api";
import { formatAmount } from "../format";
import DataTable from "./DataTable";
import CreateLedgerModal from "./CreateLedgerModal";

const COLUMNS = [
  { key: "name", header: "Name" },
  { key: "parent", header: "Group" },
  { key: "mobile", header: "Mobile", render: (r) => r.mobile || "-" },
  { key: "gstin", header: "GSTIN", render: (r) => r.gstin || "-" },
  {
    key: "openingBalance",
    header: "Opening Balance",
    align: "right",
    render: (r) => <span className={r.openingBalance < 0 ? "neg" : undefined}>{formatAmount(r.openingBalance)}</span>,
  },
  {
    key: "closingBalance",
    header: "Closing Balance",
    align: "right",
    render: (r) => <span className={r.closingBalance < 0 ? "neg" : undefined}>{formatAmount(r.closingBalance)}</span>,
  },
];

export default function LedgersTab({ onOpenLedger }) {
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingDetail, setEditingDetail] = useState(null);
  const [editingLoading, setEditingLoading] = useState(false);

  const load = () => {
    setLoading(true);
    getLedgers()
      .then(setLedgers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEdit = (row) => {
    setEditingLoading(true);
    getLedgerDetail(row.name)
      .then(setEditingDetail)
      .catch((err) => setError(err.message))
      .finally(() => setEditingLoading(false));
  };

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={ledgers}
        rowKey={(r) => r.guid || r.name}
        loading={loading}
        error={error}
        onView={onOpenLedger}
        onEdit={startEdit}
        searchPlaceholder="Search by name or group…"
        emptyMessage="No ledgers found."
        toolbarExtra={<button className="btn" onClick={() => setShowCreate(true)}>+ New Ledger</button>}
      />
      {showCreate && (
        <CreateLedgerModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
      {editingLoading && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 320 }}>
            <div className="state-msg">Loading ledger details…</div>
          </div>
        </div>
      )}
      {editingDetail && (
        <CreateLedgerModal
          editing={editingDetail}
          onClose={() => setEditingDetail(null)}
          onCreated={() => {
            setEditingDetail(null);
            load();
          }}
        />
      )}
    </>
  );
}
