import { useEffect, useMemo, useState } from "react";
import { getLedgerDetail, getLedgerVouchers } from "../api";
import { defaultFinancialYearRange, formatAmount, formatDate } from "../format";
import DataTable from "./DataTable";
import Modal from "./Modal";
import VoucherDetail from "./VoucherDetail";
import PartyDetail from "./PartyDetail";

function otherLedgerNames(voucher, ledgerName) {
  const others = voucher.entries.filter((e) => e.ledger !== ledgerName).map((e) => e.ledger);
  if (others.length === 0) return "-";
  if (others.length <= 2) return others.join(", ");
  return `${others.slice(0, 2).join(", ")} & ${others.length - 2} more`;
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function LedgerStatement({ ledger, onBack }) {
  const [range, setRange] = useState(defaultFinancialYearRange());
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [partyDetail, setPartyDetail] = useState(null);
  const [partyDetailLoading, setPartyDetailLoading] = useState(false);
  const [showPartyDetail, setShowPartyDetail] = useState(false);

  const openPartyDetail = () => {
    setShowPartyDetail(true);
    if (partyDetail || partyDetailLoading) return;
    setPartyDetailLoading(true);
    getLedgerDetail(ledger.name)
      .then(setPartyDetail)
      .finally(() => setPartyDetailLoading(false));
  };

  const load = (from, to) => {
    setLoading(true);
    setError(null);
    getLedgerVouchers(ledger.name, from, to)
      .then(setTransactions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(range.from, range.to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledger.name]);

  const rows = useMemo(() => {
    let balance = ledger.openingBalance ?? 0;
    return transactions.map((t) => {
      balance += t.ledgerAmount;
      return { ...t, runningBalance: balance };
    });
  }, [transactions, ledger.openingBalance]);

  const periodMovement = transactions.reduce((sum, t) => sum + t.ledgerAmount, 0);
  const closingBalance = (ledger.openingBalance ?? 0) + periodMovement;

  const columns = [
    { key: "date", header: "Date", render: (r) => formatDate(r.date) },
    { key: "particulars", header: "Particulars", render: (r) => otherLedgerNames(r, ledger.name) },
    { key: "voucherType", header: "Type", render: (r) => <span className="pill">{r.voucherType}</span> },
    { key: "voucherNumber", header: "No." },
    {
      key: "debit",
      header: "Debit",
      align: "right",
      render: (r) => (r.ledgerAmount < 0 ? formatAmount(-r.ledgerAmount) : ""),
    },
    {
      key: "credit",
      header: "Credit",
      align: "right",
      render: (r) => (r.ledgerAmount > 0 ? formatAmount(r.ledgerAmount) : ""),
    },
    {
      key: "runningBalance",
      header: "Balance",
      align: "right",
      render: (r) => (
        <span className={r.runningBalance < 0 ? "neg" : undefined}>
          {formatAmount(Math.abs(r.runningBalance))} {r.runningBalance < 0 ? "DR" : "CR"}
        </span>
      ),
    },
  ];

  return (
    <div>
      <button className="btn-link back-link" onClick={onBack}>&larr; Back to Ledgers</button>

      <div className="ledger-statement-header">
        <div>
          <h2 className="page-title ledger-statement-title" style={{ marginBottom: 4 }}>
            {ledger.name}
            <button className="icon-btn" title="View party details" onClick={openPartyDetail}>
              <EyeIcon />
            </button>
          </h2>
          <div className="muted">{ledger.parent}{ledger.gstin ? ` · GSTIN: ${ledger.gstin}` : ""}</div>
        </div>
        <div className="ledger-statement-balances">
          <div className="balance-card">
            <div className="detail-label">Opening Balance</div>
            <div className={`balance-amount ${ledger.openingBalance < 0 ? "neg" : ""}`}>
              {formatAmount(Math.abs(ledger.openingBalance ?? 0))} {(ledger.openingBalance ?? 0) < 0 ? "DR" : "CR"}
            </div>
          </div>
          <div className="balance-card">
            <div className="detail-label">Closing Balance</div>
            <div className={`balance-amount ${closingBalance < 0 ? "neg" : ""}`}>
              {formatAmount(Math.abs(closingBalance))} {closingBalance < 0 ? "DR" : "CR"}
            </div>
          </div>
        </div>
      </div>

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
        <button className="btn" onClick={() => load(range.from, range.to)}>Apply</button>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        rowKey={(r, idx) => r.guid || `${r.date}-${r.voucherType}-${r.voucherNumber}-${idx}`}
        loading={loading}
        error={error}
        onView={setSelected}
        searchPlaceholder="Search by particulars, type or number…"
        emptyMessage="No transactions in this date range."
      />

      {selected && (
        <Modal title="Voucher Preview" onClose={() => setSelected(null)} wide>
          <VoucherDetail voucher={selected} />
        </Modal>
      )}

      {showPartyDetail && (
        <Modal title={ledger.name} subtitle={ledger.parent} onClose={() => setShowPartyDetail(false)}>
          {partyDetailLoading || !partyDetail ? (
            <div className="state-msg">Loading party details…</div>
          ) : (
            <PartyDetail party={partyDetail} />
          )}
        </Modal>
      )}
    </div>
  );
}
