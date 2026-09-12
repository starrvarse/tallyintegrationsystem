import { useMemo, useState } from "react";
import { createUnit, updateUnit } from "../api";
import Modal from "./Modal";
import Autocomplete from "./Autocomplete";

// Standard GST Unit Quantity Codes (as published by CBIC / shown in Tally's
// own Unit Creation screen).
const UQC_CODES = [
  "BAG-BAGS", "BAL-BALE", "BDL-BUNDLES", "BKL-BUCKLES", "BOU-BILLION OF UNITS",
  "BOX-BOX", "BTL-BOTTLES", "BUN-BUNCHES", "CAN-CANS", "CBM-CUBIC METERS",
  "CCM-CUBIC CENTIMETERS", "CMS-CENTIMETERS", "CTN-CARTONS", "DOZ-DOZENS",
  "DRM-DRUMS", "GGK-GREAT GROSS", "GMS-GRAMMES", "GRS-GROSS", "GYD-GROSS YARDS",
  "KGS-KILOGRAMS", "KLR-KILOLITRE", "KME-KILOMETRE", "MLT-MILILITRE",
  "MTR-METERS", "MTS-METRIC TON", "NOS-NUMBERS", "PAC-PACKS", "PCS-PIECES",
  "PRS-PAIRS", "QTL-QUINTAL", "ROL-ROLLS", "SET-SETS", "SQF-SQUARE FEET",
  "SQM-SQUARE METERS", "SQY-SQUARE YARDS", "TBS-TABLETS", "TGM-TEN GROSS",
  "THD-THOUSANDS", "TON-TONNES", "TUB-TUBES", "UGS-US GALLONS", "UNT-UNITS",
  "YDS-YARDS", "OTH-OTHERS",
];

function Field({ label, children, span }) {
  return (
    <label className={`form-field ${span ? "form-field-span" : ""}`}>
      <span className="form-label">{label}</span>
      {children}
    </label>
  );
}

export default function CreateUnitModal({ editing, onClose, onCreated }) {
  const initialUQC = editing?.reportingUQC && editing.reportingUQC !== "Not Applicable" ? editing.reportingUQC : "";
  const [form, setForm] = useState({
    name: editing?.name || "",
    decimalPlaces: editing ? String(editing.decimalPlaces ?? 0) : "0",
    reportingUQC: initialUQC,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = form.name.trim().toUpperCase();
    if (!name) {
      setError("A unit symbol is required.");
      return;
    }
    if (name.includes(" ")) {
      setError("Unit symbols can't contain spaces (e.g. PCS, KGS, BOX).");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name,
        ...(editing ? { originalName: editing.name } : {}),
        decimalPlaces: parseInt(form.decimalPlaces, 10) || 0,
        reportingUQC: form.reportingUQC,
      };
      await (editing ? updateUnit(payload) : createUnit(payload));
      onCreated(name);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={editing ? "Edit Unit" : "Create Unit"} onClose={onClose}>
      <form className="ledger-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <Field label="Symbol *" span>
            <input
              value={form.name}
              onChange={set("name")}
              placeholder="e.g. PCS, KGS, BOX"
              style={{ textTransform: "uppercase" }}
              required
              autoFocus
            />
          </Field>
          <Field label="Reporting UQC (GST)" span>
            <Autocomplete
              options={useMemo(() => [
                { value: "", label: "Not Applicable" },
                ...UQC_CODES.map((code) => ({ value: code, label: code })),
              ], [])}
              value={form.reportingUQC}
              onChange={set("reportingUQC")}
              placeholder="Search or select UQC code…"
            />
          </Field>
          <Field label="Decimal Places">
            <input type="number" min="0" max="4" value={form.decimalPlaces} onChange={set("decimalPlaces")} />
          </Field>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? "Saving…" : editing ? "Save Changes" : "Create Unit"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
