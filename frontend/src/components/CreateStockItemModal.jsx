import { useEffect, useState } from "react";
import { createStockItem, getStockGroups, getUnits, updateStockItem } from "../api";
import { formatAmount } from "../format";
import Modal from "./Modal";
import Autocomplete from "./Autocomplete";

const TAXABILITY_TYPES = ["Taxable", "Exempt", "Nil Rated"];
const SUPPLY_TYPES = ["Goods", "Services"];

function leadingNumber(text) {
  const match = String(text || "").match(/-?[\d.]+/);
  return match ? match[0] : "";
}

function formFromEditing(editing) {
  if (!editing) {
    return {
      name: "", alias: "", parent: "", baseUnit: "", alternateUnit: "", conversionFactor: "",
      typeOfSupply: "Goods", hsnCode: "", taxability: "Taxable", gstRate: "",
      openingBalance: "", openingRate: "",
    };
  }
  return {
    name: editing.name || "",
    alias: editing.alias || "",
    parent: editing.parent || "",
    baseUnit: editing.baseUnit || "",
    alternateUnit: editing.alternateUnit && editing.alternateUnit !== "Not Applicable" ? editing.alternateUnit : "",
    conversionFactor: editing.conversionFactor ? String(editing.conversionFactor) : "",
    typeOfSupply: editing.typeOfSupply || "Goods",
    hsnCode: editing.hsnCode || "",
    taxability: editing.taxability || "Taxable",
    gstRate: editing.gstRate != null ? String(editing.gstRate) : "",
    openingBalance: leadingNumber(editing.openingBalance),
    openingRate: leadingNumber(editing.openingRate),
  };
}

function Field({ label, children, span }) {
  return (
    <label className={`form-field ${span ? "form-field-span" : ""}`}>
      <span className="form-label">{label}</span>
      {children}
    </label>
  );
}

export default function CreateStockItemModal({ editing, onClose, onCreated }) {
  const [groups, setGroups] = useState([]);
  const [units, setUnits] = useState([]);
  const [form, setForm] = useState(() => formFromEditing(editing));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getStockGroups()
      .then((data) => setGroups(data.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setGroups([]));
    getUnits()
      .then((data) => setUnits(data.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setUnits([]));
  }, []);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  const openingValue = (parseFloat(form.openingBalance) || 0) * (parseFloat(form.openingRate) || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.parent || !form.baseUnit) {
      setError("Name, Under (group) and Base Unit are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        ...(editing ? { originalName: editing.name } : {}),
        alias: form.alias.trim(),
        parent: form.parent,
        baseUnit: form.baseUnit,
        alternateUnit: form.alternateUnit,
        conversionFactor: parseFloat(form.conversionFactor) || 0,
        typeOfSupply: form.typeOfSupply,
        hsnCode: form.hsnCode.trim(),
        taxability: form.taxability,
        gstRate: parseFloat(form.gstRate) || 0,
        openingBalance: parseFloat(form.openingBalance) || 0,
        openingRate: parseFloat(form.openingRate) || 0,
      };
      await (editing ? updateStockItem(payload) : createStockItem(payload));
      onCreated(form.name.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={editing ? "Edit Stock Item" : "Create Stock Item"} onClose={onClose} wide>
      <form className="ledger-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <Field label="Name *">
            <input value={form.name} onChange={set("name")} required autoFocus />
          </Field>
          <Field label="Alias">
            <input value={form.alias} onChange={set("alias")} />
          </Field>
          <Field label="Under (Stock Group) *">
            <Autocomplete
              options={groups.map((g) => ({ value: g.name, label: g.name }))}
              value={form.parent}
              onChange={set("parent")}
              placeholder="Search or select stock group…"
              required
            />
          </Field>

          <Field label="Base Unit *">
            <Autocomplete
              options={units.map((u) => ({ value: u.name, label: u.name }))}
              value={form.baseUnit}
              onChange={set("baseUnit")}
              placeholder="Search or select base unit…"
              required
            />
          </Field>
          <Field label="Alternate Unit">
            <Autocomplete
              options={[
                { value: "", label: "None / Not Applicable" },
                ...units.map((u) => ({ value: u.name, label: u.name })),
              ]}
              value={form.alternateUnit}
              onChange={set("alternateUnit")}
              placeholder="Search or select alternate unit…"
            />
          </Field>
          {form.alternateUnit && (
            <Field label={`1 ${form.alternateUnit} = ? ${form.baseUnit || "base units"}`}>
              <input type="number" step="1" min="1" value={form.conversionFactor} onChange={set("conversionFactor")} placeholder="e.g. 12" />
            </Field>
          )}

          <Field label="Type of Supply">
            <Autocomplete
              options={SUPPLY_TYPES}
              value={form.typeOfSupply}
              onChange={set("typeOfSupply")}
              placeholder="Search or select supply type…"
            />
          </Field>
          <Field label="HSN/SAC Code">
            <input value={form.hsnCode} onChange={set("hsnCode")} />
          </Field>
          <Field label="Taxability Type">
            <Autocomplete
              options={TAXABILITY_TYPES}
              value={form.taxability}
              onChange={set("taxability")}
              placeholder="Search or select taxability…"
            />
          </Field>
          {form.taxability === "Taxable" && (
            <Field label="GST Rate (%)">
              <input type="number" step="0.01" value={form.gstRate} onChange={set("gstRate")} placeholder="e.g. 18" />
            </Field>
          )}

          <Field label="Opening Qty">
            <input type="number" step="0.01" value={form.openingBalance} onChange={set("openingBalance")} placeholder="0" />
          </Field>
          <Field label={`Opening Rate (per ${form.baseUnit || "unit"})`}>
            <input type="number" step="0.01" value={form.openingRate} onChange={set("openingRate")} placeholder="0.00" />
          </Field>
          <Field label="Opening Value">
            <input value={formatAmount(openingValue)} readOnly disabled />
          </Field>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? "Saving…" : editing ? "Save Changes" : "Create Item"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
