import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import Autocomplete from "./Autocomplete";

function Field({ label, children, span }) {
  return (
    <label className={`form-field ${span ? "form-field-span" : ""}`}>
      <span className="form-label">{label}</span>
      {children}
    </label>
  );
}

/** Shared create/edit form for Ledger Groups, Stock Groups and Stock
 * Categories - same shape, just a different pair of backend endpoints and a
 * different set of existing groups to pick "Under" from. Pass `editing` (the
 * row being edited) to switch into edit mode. */
export default function CreateGroupModal({ title, fetchGroups, createFn, updateFn, editing, onClose, onCreated }) {
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState({
    name: editing?.name || "",
    alias: editing?.alias || "",
    parent: editing?.parent || "Primary",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchGroups()
      .then((data) => setGroups(data.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setGroups([]));
  }, [fetchGroups]);

  const parentOptions = useMemo(() => [
    { value: "Primary", label: "Primary (top level)" },
    ...groups
      .filter((g) => g.name !== editing?.name)
      .map((g) => ({ value: g.name, label: g.name })),
  ], [groups, editing?.name]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required.");
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
      };
      await (editing ? updateFn(payload) : createFn(payload));
      onCreated(form.name.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={editing ? `Edit ${title.replace("Create ", "")}` : title} onClose={onClose}>
      <form className="ledger-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <Field label="Name *" span>
            <input value={form.name} onChange={set("name")} required autoFocus />
          </Field>
          <Field label="Alias">
            <input value={form.alias} onChange={set("alias")} />
          </Field>
          <Field label="Under">
            <Autocomplete
              options={parentOptions}
              value={form.parent}
              onChange={set("parent")}
              placeholder="Search or select parent group…"
            />
          </Field>
        </div>

        {error && <div className="form-error">{error}</div>}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? "Saving…" : editing ? "Save Changes" : "Create Group"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
