import { formatAmount } from "../format";

function Field({ label, value, negative, mono }) {
  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <span className={`field-value ${negative ? "neg" : ""} ${mono ? "mono" : ""}`}>{value}</span>
    </div>
  );
}

function drCr(amount) {
  const value = amount ?? 0;
  return `${formatAmount(Math.abs(value))} ${value < 0 ? "DR" : "CR"}`;
}

export default function PartyDetail({ party }) {
  return (
    <div className="detail-fields">
      <Field label="Name" value={party.name} />
      {party.alias && <Field label="Alias" value={party.alias} />}
      <Field label="Group" value={party.parent || "-"} />
      <Field label="Address" value={party.address?.length ? party.address.join(", ") : "-"} />
      <Field label="State" value={party.state || "-"} />
      <Field label="Country" value={party.country || "-"} />
      <Field label="Pincode" value={party.pincode || "-"} />
      <Field label="Mobile" value={party.mobile || "-"} />
      <Field label="Email" value={party.email || "-"} />
      <Field label="GSTIN" value={party.gstin || "-"} />
      <Field label="GST Registration Type" value={party.gstRegistrationType || "-"} />
      <Field label="PAN" value={party.pan || "-"} />
      <Field label="Bill-wise Tracking" value={party.billWiseOn ? "Yes" : "No"} />
      <Field label="TDS Deductable" value={party.tdsDeductable ? "Yes" : "No"} />
      <Field label="TCS Applicable" value={party.tcsApplicable ? "Yes" : "No"} />
      <Field label="Opening Balance" value={drCr(party.openingBalance)} negative={(party.openingBalance ?? 0) < 0} />
      <Field label="Closing Balance" value={drCr(party.closingBalance)} negative={(party.closingBalance ?? 0) < 0} />
      {party.guid && <Field label="GUID" value={party.guid} mono />}
    </div>
  );
}
