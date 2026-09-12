import { useEffect, useState } from "react";
import { getCompany, getLedgerDetail } from "../api";
import { amountInWords, formatAmount, formatDate } from "../format";

const INVOICE_TITLES = {
  Sales: "Tax Invoice",
  "Credit Note": "Credit Note",
  Purchase: "Purchase Voucher",
  "Debit Note": "Debit Note",
};

function addressLine(details) {
  if (!details) return [];
  const parts = [...(details.address || [])];
  const cityLine = [details.pincode].filter(Boolean).join(" ");
  if (cityLine) parts.push(cityLine);
  const region = [details.state, details.country].filter(Boolean).join(", ");
  if (region) parts.push(region);
  return parts;
}

function PartyBox({ label, name, details, gstinFallback }) {
  const lines = addressLine(details);
  return (
    <div className="invoice-party-box">
      <div className="invoice-party-label">{label}</div>
      <div className="invoice-party-name">{name}</div>
      {lines.map((line, i) => (
        <div key={i} className="invoice-party-line">{line}</div>
      ))}
      <div className="invoice-party-line">GSTIN: {details?.gstin || gstinFallback || "-"}</div>
    </div>
  );
}

function cityStateLine(details) {
  if (!details) return "";
  const region = [details.state, details.country].filter(Boolean).join(", ");
  return [details.pincode, region].filter(Boolean).join(" — ");
}

// Splits Tally's flattened address (e.g. "...ROAD, MANKACHAR, FSSAI: 123, FSSAI: 456")
// into the plain street-address parts and any "LABEL: value" registration lines.
function splitAddress(address) {
  const lines = [];
  const licenses = [];
  for (const part of address || []) {
    if (/^[A-Z ]+:\s*\S/.test(part)) {
      licenses.push(part);
    } else {
      lines.push(part);
    }
  }
  return { lines, licenses };
}

export default function VoucherDetail({ voucher }) {
  const [company, setCompany] = useState(null);
  const [party, setParty] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setDetailsLoading(true);
    Promise.all([getCompany(), getLedgerDetail(voucher.party)])
      .then(([companyData, partyData]) => {
        if (cancelled) return;
        setCompany(companyData);
        setParty(partyData);
      })
      .catch(() => {
        // Invoice still renders with the data already on the voucher.
      })
      .finally(() => !cancelled && setDetailsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [voucher.party]);

  const partyEntry =
    voucher.entries.find((e) => e.ledger === voucher.party) || voucher.entries[0];
  const chargeEntries = voucher.entries.filter((e) => e !== partyEntry);
  const grandTotal = Math.abs(partyEntry?.amount ?? voucher.amount);
  const invoiceTitle = INVOICE_TITLES[voucher.voucherType] || `${voucher.voucherType} Voucher`;
  const { lines: companyAddressLines, licenses: companyLicenses } = splitAddress(company?.address);
  const contactStrip = [
    company?.phone && `Ph ${company.phone}`,
    company?.email,
    company?.website,
  ].filter(Boolean);

  return (
    <div className="invoice">
      <div className="invoice-header">
        <div className="invoice-company-block">
          <div className="invoice-company-name">{company?.name || "…"}</div>
          <div className="invoice-company-meta">
            {companyAddressLines.length > 0 && <div>{companyAddressLines.join(", ")}</div>}
            {cityStateLine(company) && <div>{cityStateLine(company)}</div>}
            {contactStrip.length > 0 && <div>{contactStrip.join(" · ")}</div>}
            {companyLicenses.length > 0 && (
              <div className="invoice-company-licenses">{companyLicenses.join(" · ")}</div>
            )}
          </div>
          <div className="invoice-company-ids">
            <span>GSTIN: {company?.gstin || "-"}</span>
            {company?.pan && <span>PAN: {company.pan}</span>}
            {company?.cin && <span>CIN: {company.cin}</span>}
            {company?.contactPerson && (
              <span>
                Contact: {company.contactPerson}
                {company.contactNumber ? ` (${company.contactNumber})` : ""}
              </span>
            )}
          </div>
        </div>
        <div className="invoice-title-block">
          <div className="invoice-title">{invoiceTitle}</div>
          <div className="invoice-meta-row"><strong>No.</strong> {voucher.voucherNumber}</div>
          <div className="invoice-meta-row"><strong>Date</strong> {formatDate(voucher.date)}</div>
        </div>
      </div>

      <div className="invoice-parties">
        <PartyBox label="Bill To" name={voucher.party} details={party} />
        <div className="invoice-party-box">
          <div className="invoice-party-label">Voucher Details</div>
          <div className="invoice-party-line">Type: {voucher.voucherType}</div>
          <div className="invoice-party-line">Number: {voucher.voucherNumber}</div>
          <div className="invoice-party-line">Date: {formatDate(voucher.date)}</div>
        </div>
      </div>

      {detailsLoading && <div className="invoice-loading">Loading company &amp; party details…</div>}

      {voucher.items?.length > 0 && (
        <table className="invoice-items-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>#</th>
              <th>Item</th>
              <th>Qty</th>
              <th>Rate</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {voucher.items.map((it, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{it.name}</td>
                <td>{it.quantity}</td>
                <td>{it.rate}</td>
                <td className={`num ${it.amount < 0 ? "neg" : ""}`}>{formatAmount(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="invoice-totals">
        <table>
          <tbody>
            {chargeEntries.map((e, i) => (
              <tr key={i}>
                <td>{e.ledger}</td>
                <td className={e.amount < 0 ? "neg" : undefined}>{formatAmount(e.amount)}</td>
              </tr>
            ))}
            <tr className="grand-total">
              <td>Grand Total</td>
              <td>{formatAmount(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="invoice-words">Amount in Words: {amountInWords(grandTotal)}</div>

      {voucher.narration && (
        <div className="invoice-footer">
          <strong>Narration:</strong> {voucher.narration}
        </div>
      )}

      {voucher.guid && (
        <div className="invoice-footer mono">
          <strong>GUID:</strong> {voucher.guid}
        </div>
      )}
    </div>
  );
}
