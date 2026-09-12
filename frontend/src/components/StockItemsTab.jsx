import { useEffect, useState } from "react";
import { getStockItemDetail, getStockItems } from "../api";
import { formatAmount } from "../format";
import DataTable from "./DataTable";
import Modal from "./Modal";
import StockItemDetail from "./StockItemDetail";
import CreateStockItemModal from "./CreateStockItemModal";

const COLUMNS = [
  { key: "name", header: "Name" },
  { key: "parent", header: "Group" },
  { key: "baseUnit", header: "Unit" },
  { key: "openingBalance", header: "Opening Qty", align: "right", render: (r) => r.openingBalance || "-" },
  { key: "closingBalance", header: "Closing Qty", align: "right", render: (r) => r.closingBalance || "-" },
  {
    key: "closingValue",
    header: "Closing Value",
    align: "right",
    render: (r) => <span className={r.closingValue < 0 ? "neg" : undefined}>{formatAmount(r.closingValue)}</span>,
  },
];

export default function StockItemsTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingDetail, setEditingDetail] = useState(null);
  const [editingLoading, setEditingLoading] = useState(false);

  const load = () => {
    setLoading(true);
    getStockItems()
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openItem = (row) => {
    setSelected(row);
    setDetail(null);
    setDetailLoading(true);
    getStockItemDetail(row.name)
      .then(setDetail)
      .finally(() => setDetailLoading(false));
  };

  const startEdit = (row) => {
    setEditingLoading(true);
    getStockItemDetail(row.name)
      .then((d) => setEditingDetail({ ...row, ...d }))
      .catch((err) => setError(err.message))
      .finally(() => setEditingLoading(false));
  };

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={items}
        rowKey={(r) => r.guid || r.name}
        loading={loading}
        error={error}
        onView={openItem}
        onEdit={startEdit}
        searchPlaceholder="Search by name or group…"
        emptyMessage="No stock items found."
        toolbarExtra={<button className="btn" onClick={() => setShowCreate(true)}>+ New Item</button>}
      />
      {selected && (
        <Modal title={selected.name} subtitle={selected.parent} onClose={() => setSelected(null)}>
          {detailLoading || !detail ? (
            <div className="state-msg">Loading item details…</div>
          ) : (
            <StockItemDetail item={{ ...selected, ...detail }} />
          )}
        </Modal>
      )}
      {showCreate && (
        <CreateStockItemModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
      {editingLoading && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 320 }}>
            <div className="state-msg">Loading item details…</div>
          </div>
        </div>
      )}
      {editingDetail && (
        <CreateStockItemModal
          editing={editingDetail}
          onClose={() => setEditingDetail(null)}
          onCreated={() => {
            setEditingDetail(null);
            load();
          }}
        />
      )}
    </>
  );
}
