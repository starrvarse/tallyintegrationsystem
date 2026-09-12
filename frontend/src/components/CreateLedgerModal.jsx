import { useEffect, useState } from "react";
import { createLedger, getLedgerGroups, updateLedger } from "../api";
import Modal from "./Modal";
import Autocomplete from "./Autocomplete";

const GST_TYPES = ["Regular", "Composition", "Consumer", "Unregistered"];
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh", "Chandigarh",
  "Puducherry", "Andaman and Nicobar Islands", "Dadra and Nagar Haveli and Daman and Diu",
  "Lakshadweep",
];

function formFromEditing(editing) {
  if (!editing) {
    return {
      name: "", alias: "", parent: "", openingBalance: "", isDebit: true, billWiseOn: false,
      mailingName: "", addressText: "", state: "", country: "India", pincode: "",
      email: "", mobile: "", pan: "", gstin: "", gstRegistrationType: "",
    };
  }
  const balance = editing.openingBalance ?? 0;
  return {
    name: editing.name || "",
    alias: editing.alias || "",
    parent: editing.parent || "",
    openingBalance: balance ? String(Math.abs(balance)) : "",
    isDebit: balance <= 0,
    billWiseOn: Boolean(editing.billWiseOn),
    mailingName: "",
    addressText: (editing.address || []).join("\n"),
    state: editing.state || "",
    country: editing.country || "India",
    pincode: editing.pincode || "",
    email: editing.email || "",
    mobile: editing.mobile || "",
    pan: editing.pan || "",
    gstin: editing.gstin || "",
    gstRegistrationType: editing.gstRegistrationType || "",
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

export default function CreateLedgerModal({ editing, onClose, onCreated }) {
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState(() => formFromEditing(editing));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getLedgerGroups()
      .then((data) => setGroups(data.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setGroups([]));
  }, []);

  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.parent) {
      setError("Name and Under (group) are required.");
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
        openingBalance: parseFloat(form.openingBalance) || 0,
        isDebit: form.isDebit,
        billWiseOn: form.billWiseOn,
        mailingName: form.mailingName.trim(),
        address: form.addressText.split("\n").map((l) => l.trim()).filter(Boolean),
        state: form.state,
        country: form.country.trim(),
        pincode: form.pincode.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        pan: form.pan.trim().toUpperCase(),
        gstin: form.gstin.trim().toUpperCase(),
        gstRegistrationType: form.gstRegistrationType,
      };
      await (editing ? updateLedger(payload) : createLedger(payload));
      onCreated(form.name.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={editing ? "Edit Ledger" : "Create Ledger"} onClose={onClose} wide>
      <form className="ledger-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <Field label="Name *">
            <input value={form.name} onChange={set("name")} required autoFocus />
          </Field>
          <Field label="Alias">
            <input value={form.alias} onChange={set("alias")} />
          </Field>
          <Field label="Under (Group) *">
            <Autocomplete
              options={groups.map((g) => ({ value: g.name, label: g.name }))}
              value={form.parent}
              onChange={set("parent")}
              placeholder="Search or select group…"
              required
            />
          </Field>
          <Field label="Opening Balance">
            <div className="form-inline">
              <input type="number" step="0.01" value={form.openingBalance} onChange={set("openingBalance")} placeholder="0.00" />
              <div style={{ width: "95px" }}>
                <Autocomplete
                  options={[
                    { value: "dr", label: "Dr" },
                    { value: "cr", label: "Cr" },
                  ]}
                  value={form.isDebit ? "dr" : "cr"}
                  onChange={(e) => setForm((f) => ({ ...f, isDebit: e.target.value === "dr" }))}
                  placeholder="Dr/Cr"
                />
              </div>
            </div>
          </Field>

          <Field label="Mailing Name">
            <input value={form.mailingName} onChange={set("mailingName")} placeholder={form.name || "Defaults to ledger name"} />
          </Field>
          <Field label="Bill-wise Tracking">
            <label className="form-checkbox">
              <input type="checkbox" checked={form.billWiseOn} onChange={set("billWiseOn")} />
              Maintain balances bill-by-bill
            </label>
          </Field>

          <Field label="Address" span>
            <textarea rows={2} value={form.addressText} onChange={set("addressText")} placeholder="One line per row" />
          </Field>

          <Field label="State">
            <Autocomplete
              options={INDIAN_STATES}
              value={form.state}
              onChange={set("state")}
              placeholder="Search or select state…"
              allowCustom
            />
          </Field>
          <Field label="Country">
            <input value={form.country} onChange={set("country")} />
          </Field>
          <Field label="Pincode">
            <input value={form.pincode} onChange={set("pincode")} />
          </Field>
          <Field label="Mobile">
            <input value={form.mobile} onChange={set("mobile")} />
          </Field>

          <Field label="Email">
            <input type="email" value={form.email} onChange={set("email")} />
          </Field>
          <Field label="PAN / IT No.">
            <input value={form.pan} onChange={set("pan")} style={{ textTransform: "uppercase" }} />
          </Field>
          <Field label="GST Registration Type">
            <Autocomplete
              options={[
                { value: "", label: "None / Not Specified" },
                ...GST_TYPES.map((t) => ({ value: t, label: t })),
              ]}
              value={form.gstRegistrationType}
              onChange={set("gstRegistrationType")}
              placeholder="Search or select GST type…"
            />
          </Field>
          <Field label="GSTIN / UIN">
            <input value={form.gstin} onChange={set("gstin")} style={{ textTransform: "uppercase" }} />
          </Field>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? "Saving…" : editing ? "Save Changes" : "Create Ledger"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
