import { useEffect, useMemo, useState } from "react";
import { createVoucher, updateVoucher, getLedgers, getStockItems } from "../api";
import Autocomplete from "./Autocomplete";

const ITEM_VOUCHER_TYPES = new Set(["Sales", "Purchase", "Credit Note", "Debit Note"]);

function Field({ label, children, span }) {
  return (
    <label className={`form-field ${span ? "form-field-span" : ""}`}>
      <span className="form-label">{label}</span>
      {children}
    </label>
  );
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

let rowId = 0;
const nextId = () => `r${++rowId}`;

// A saved voucher's `quantity` comes back from Tally already formatted as a
// string like "10 PCS" (or "10 PCS = 1 CASE" for alt-unit items) - split off
// just the leading number/unit pair for the editable qty/unit fields.
function splitQty(raw) {
  const match = /^(-?[\d.]+)\s*([A-Za-z%]*)/.exec((raw || "").trim());
  return match ? { quantity: match[1], unit: match[2] } : { quantity: "", unit: "" };
}

export default function VoucherFormPage({ voucherType, editing, onBack, onSaved }) {
  const isItemVoucher = ITEM_VOUCHER_TYPES.has(voucherType);

  const [ledgers, setLedgers] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [date, setDate] = useState(editing?.date || todayISO());
  const [narration, setNarration] = useState(editing?.narration || "");
  const [partyLedger, setPartyLedger] = useState(editing?.party || "");
  const [entries, setEntries] = useState(
    editing?.entries?.length
      ? editing.entries.map((e) => ({
          id: nextId(),
          ledger: e.ledger,
          amount: String(Math.abs(e.amount)),
          isDebit: e.amount < 0,
        }))
      : [
          { id: nextId(), ledger: "", amount: "", isDebit: true },
          { id: nextId(), ledger: "", amount: "", isDebit: false },
        ]
  );
  const [items, setItems] = useState(
    editing?.items?.length
      ? editing.items.map((it) => {
          const { quantity, unit } = splitQty(it.quantity);
          return { id: nextId(), name: it.name, quantity, unit, rate: it.rate || "", amount: String(it.amount || "") };
        })
      : isItemVoucher
      ? [{ id: nextId(), name: "", quantity: "", unit: "", rate: "", amount: "" }]
      : []
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getLedgers().then(setLedgers).catch(() => setLedgers([]));
    if (isItemVoucher) {
      getStockItems().then(setStockItems).catch(() => setStockItems([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ledgerOptions = useMemo(() => ledgers.map((l) => ({ value: l.name, label: l.name })), [ledgers]);
  const itemOptions = useMemo(() => stockItems.map((s) => ({ value: s.name, label: s.name })), [stockItems]);

  const updateEntry = (id, patch) =>
    setEntries((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addEntry = () => setEntries((rows) => [...rows, { id: nextId(), ledger: "", amount: "", isDebit: true }]);
  const removeEntry = (id) => setEntries((rows) => rows.filter((r) => r.id !== id));

  const updateItem = (id, patch) =>
    setItems((rows) =>
      rows.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        const qty = parseFloat(next.quantity) || 0;
        const rate = parseFloat(next.rate) || 0;
        if ((patch.quantity !== undefined || patch.rate !== undefined) && qty && rate) {
          next.amount = String(Math.round(qty * rate * 100) / 100);
        }
        return next;
      })
    );
  const addItem = () => setItems((rows) => [...rows, { id: nextId(), name: "", quantity: "", unit: "", rate: "", amount: "" }]);
  const removeItem = (id) => setItems((rows) => rows.filter((r) => r.id !== id));

  const debitTotal = entries.filter((e) => e.isDebit).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const creditTotal = entries.filter((e) => !e.isDebit).reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const balanced = Math.abs(debitTotal - creditTotal) < 0.01;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanEntries = entries
      .filter((r) => r.ledger.trim() && parseFloat(r.amount) > 0)
      .map((r) => ({ ledger: r.ledger.trim(), amount: parseFloat(r.amount), isDebit: r.isDebit }));
    const cleanItems = items
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        quantity: parseFloat(r.quantity) || 0,
        unit: r.unit.trim(),
        rate: parseFloat(r.rate) || 0,
        amount: parseFloat(r.amount) || 0,
      }));

    if (cleanEntries.length < 2) {
      setError("At least two ledger entries (one debit, one credit) are required.");
      return;
    }
    if (!balanced) {
      setError(`Debit total (${debitTotal.toFixed(2)}) must equal credit total (${creditTotal.toFixed(2)}).`);
      return;
    }
    if (isItemVoucher && cleanItems.length === 0) {
      setError("Add at least one item.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        voucherType,
        date,
        narration: narration.trim(),
        partyLedger: partyLedger.trim(),
        entries: cleanEntries,
        items: cleanItems,
      };
      if (editing) {
        await updateVoucher({
          ...payload,
          originalDate: editing.date,
          masterId: editing.masterId,
        });
      } else {
        await createVoucher(payload);
      }
      onSaved({
        guid: editing?.guid || `pending-${Date.now()}`,
        masterId: editing?.masterId,
        date,
        voucherType,
        voucherNumber: editing?.voucherNumber || "(new)",
        party: partyLedger.trim(),
        narration: narration.trim(),
        amount: debitTotal,
        entries: cleanEntries.map((e) => ({ ledger: e.ledger, amount: e.isDebit ? -e.amount : e.amount })),
        items: cleanItems,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <button type="button" className="btn-link back-link" onClick={onBack} disabled={submitting}>
        &larr; Back to {voucherType}
      </button>

      <div className="page-header-strip">
        <h2 className="page-title">
          {editing ? `Edit ${voucherType} #${editing.voucherNumber}` : `Create ${voucherType} Voucher`}
        </h2>
      </div>

      <form className="ledger-form voucher-form-page" onSubmit={handleSubmit}>
        <div className="form-grid">
          <Field label="Date *">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          {isItemVoucher && (
            <Field label="Party Ledger">
              <Autocomplete
                options={ledgerOptions}
                value={partyLedger}
                onChange={(e) => setPartyLedger(e.target.value)}
                placeholder="Search party ledger…"
                allowCustom
              />
            </Field>
          )}
          <Field label="Narration" span>
            <input value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="Optional note" />
          </Field>
        </div>

        {isItemVoucher && (
          <div className="voucher-entries-block">
            <div className="voucher-entries-header">
              <span>Items</span>
              <button type="button" className="btn-secondary btn-sm" onClick={addItem}>+ Add Item</button>
            </div>
            {items.map((row) => (
              <div key={row.id} className="voucher-item-row">
                <Autocomplete
                  options={itemOptions}
                  value={row.name}
                  onChange={(e) => updateItem(row.id, { name: e.target.value })}
                  placeholder="Item name…"
                  allowCustom
                />
                <input
                  type="number"
                  step="any"
                  value={row.quantity}
                  onChange={(e) => updateItem(row.id, { quantity: e.target.value })}
                  placeholder="Qty"
                />
                <input
                  value={row.unit}
                  onChange={(e) => updateItem(row.id, { unit: e.target.value })}
                  placeholder="Unit"
                  style={{ width: 70 }}
                />
                <input
                  type="number"
                  step="any"
                  value={row.rate}
                  onChange={(e) => updateItem(row.id, { rate: e.target.value })}
                  placeholder="Rate"
                />
                <input
                  type="number"
                  step="any"
                  value={row.amount}
                  onChange={(e) => updateItem(row.id, { amount: e.target.value })}
                  placeholder="Amount"
                />
                <button type="button" className="icon-btn" onClick={() => removeItem(row.id)} aria-label="Remove item">✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="voucher-entries-block">
          <div className="voucher-entries-header">
            <span>Ledger Entries {!balanced && <span className="form-error-inline">(Dr {debitTotal.toFixed(2)} ≠ Cr {creditTotal.toFixed(2)})</span>}</span>
            <button type="button" className="btn-secondary btn-sm" onClick={addEntry}>+ Add Row</button>
          </div>
          {entries.map((row) => (
            <div key={row.id} className="voucher-entry-row">
              <Autocomplete
                options={ledgerOptions}
                value={row.ledger}
                onChange={(e) => updateEntry(row.id, { ledger: e.target.value })}
                placeholder="Ledger name…"
                allowCustom
              />
              <select value={row.isDebit ? "dr" : "cr"} onChange={(e) => updateEntry(row.id, { isDebit: e.target.value === "dr" })}>
                <option value="dr">Debit</option>
                <option value="cr">Credit</option>
              </select>
              <input
                type="number"
                step="any"
                value={row.amount}
                onChange={(e) => updateEntry(row.id, { amount: e.target.value })}
                placeholder="Amount"
              />
              <button type="button" className="icon-btn" onClick={() => removeEntry(row.id)} aria-label="Remove entry">✕</button>
            </div>
          ))}
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onBack} disabled={submitting}>Cancel</button>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? "Saving…" : editing ? "Save Changes" : `Create ${voucherType}`}
          </button>
        </div>
      </form>
    </div>
  );
}
