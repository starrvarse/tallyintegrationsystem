import { formatAmount } from "../format";

function Field({ label, value, negative, mono }) {
  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <span className={`field-value ${negative ? "neg" : ""} ${mono ? "mono" : ""}`}>{value}</span>
    </div>
  );
}

export default function StockItemDetail({ item }) {
  return (
    <div className="detail-fields">
      <Field label="Name" value={item.name} />
      {item.alias && <Field label="Alias" value={item.alias} />}
      <Field label="Group" value={item.parent || "-"} />
      <Field label="Base Unit" value={item.baseUnit || "-"} />
      <Field label="Alternate Unit" value={item.alternateUnit || "-"} />
      <Field label="Type of Supply" value={item.typeOfSupply || "-"} />
      <Field label="HSN/SAC Code" value={item.hsnCode || "-"} />
      <Field label="Taxability" value={item.taxability || "-"} />
      <Field label="GST Rate" value={item.gstRate != null ? `${item.gstRate}%` : "-"} />
      <Field label="Opening Qty" value={item.openingBalance || "-"} />
      <Field label="Opening Rate" value={item.openingRate || "-"} />
      <Field label="Opening Value" value={formatAmount(item.openingValue)} negative={item.openingValue < 0} />
      <Field label="Closing Qty" value={item.closingBalance || "-"} />
      <Field label="Closing Value" value={formatAmount(item.closingValue)} negative={item.closingValue < 0} />
      {item.guid && <Field label="GUID" value={item.guid} mono />}
    </div>
  );
}
