import { useEffect, useState } from "react";
import { getVouchers, deleteVoucher } from "../api";
import { defaultFinancialYearRange, formatAmount, formatDate } from "../format";
import DataTable from "./DataTable";
import Modal from "./Modal";
import VoucherDetail from "./VoucherDetail";
import VoucherFormPage from "./VoucherFormPage";

const COLUMNS = [
  { key: "date", header: "Date", render: (r) => formatDate(r.date) },
  { key: "voucherNumber", header: "No." },
  { key: "party", header: "Party" },
  { key: "narration", header: "Narration" },
  {
    key: "amount",
    header: "Amount",
    align: "right",
    render: (r) => <span className={r.amount < 0 ? "neg" : undefined}>{formatAmount(r.amount)}</span>,
  },
];

const EDIT_UNSUPPORTED_TYPES = new Set(["Credit Note", "Debit Note"]);

/** One page per Tally voucher type (Sales, Purchase, Receipt, Payment,
 * Contra, Journal, Credit Note, Debit Note) - same list/view UI as before,
 * scoped server-side to a single VOUCHERTYPENAME, plus Create/Edit/Delete.
 * Create and Edit swap in a full page (VoucherFormPage) rather than a modal,
 * matching the LedgerStatement pattern elsewhere in the app. Tally
 * identifies a voucher for Alter/Delete by its (date, MASTERID) pair, not a
 * stable id derived from the voucher's own data - both need the ORIGINAL
 * date and masterId from the row being acted on (see tally_client.py). Edit
 * is hidden for Credit Note/Debit Note only - those have no real voucher of
 * that type to clone from, so neither Create nor Edit is supported for them
 * yet. */
export default function VoucherTypeTab({ voucherType }) {
  const supportsEdit = !EDIT_UNSUPPORTED_TYPES.has(voucherType);
  const [range, setRange] = useState(defaultFinancialYearRange());
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = (from, to) => {
    setLoading(true);
    setError(null);
    getVouchers(from, to, voucherType)
      .then(setVouchers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(range.from, range.to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voucherType]);

  // Tally's read-back can lag a freshly created/edited voucher by a few
  // minutes (confirmed live), so update the list from what we just sent
  // instead of depending on a re-fetch that might not reflect it yet.
  const handleSaved = (voucher) => {
    const wasEditing = Boolean(editing);
    setCreating(false);
    setEditing(null);
    setVouchers((prev) => {
      if (wasEditing) {
        return prev.map((v) => (v.guid === voucher.guid ? voucher : v));
      }
      return [voucher, ...prev];
    });
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteVoucher(voucherType, deleting.date, deleting.masterId);
      setVouchers((prev) => prev.filter((v) => v.guid !== deleting.guid));
      setDeleting(null);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  if (creating || editing) {
    return (
      <VoucherFormPage
        voucherType={voucherType}
        editing={editing}
        onBack={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <>
      <div className="toolbar range-toolbar">
        <label className="date-field">
          From
          <input
            type="date"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
        </label>
        <label className="date-field">
          To
          <input
            type="date"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </label>
        <button className="btn-secondary" onClick={() => load(range.from, range.to)}>Apply</button>
        <button className="btn" style={{ marginLeft: "auto" }} onClick={() => setCreating(true)}>
          + New {voucherType}
        </button>
      </div>

      <DataTable
        columns={COLUMNS}
        data={vouchers}
        rowKey={(r, idx) => r.guid || `${r.date}-${r.voucherNumber}-${idx}`}
        loading={loading}
        error={error}
        onView={setSelected}
        onEdit={supportsEdit ? setEditing : undefined}
        onDelete={setDeleting}
        searchPlaceholder="Search by party, number or narration…"
        emptyMessage={`No ${voucherType} vouchers found in this date range.`}
      />

      {selected && (
        <Modal title="Voucher Preview" onClose={() => setSelected(null)} wide>
          <VoucherDetail voucher={selected} />
        </Modal>
      )}

      {deleting && (
        <Modal title={`Delete ${voucherType} #${deleting.voucherNumber}?`} onClose={() => !deleteBusy && setDeleting(null)}>
          <p style={{ margin: "0 0 20px", color: "var(--text-secondary)", fontSize: 13.5 }}>
            This permanently deletes this voucher from Tally. This cannot be undone from here.
          </p>
          {deleteError && <div className="form-error">{deleteError}</div>}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setDeleting(null)} disabled={deleteBusy}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={confirmDelete} disabled={deleteBusy}>
              {deleteBusy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
