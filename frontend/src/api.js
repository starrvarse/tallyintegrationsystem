const API_BASE = "http://127.0.0.1:8001";

async function handleResponse(res) {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // ignore, keep statusText
    }
    throw new Error(detail);
  }
  return res.json();
}

function getJSON(path) {
  return fetch(`${API_BASE}${path}`).then(handleResponse);
}

function postJSON(path, payload) {
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(handleResponse);
}

function putJSON(path, payload) {
  return fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then(handleResponse);
}

function deleteJSON(path) {
  return fetch(`${API_BASE}${path}`, { method: "DELETE" }).then(handleResponse);
}

export const getStatus = () => getJSON("/api/status");
export const getCompany = () => getJSON("/api/company");
export const getLedgerDetail = (name) => getJSON(`/api/ledger?name=${encodeURIComponent(name)}`);
export const getLedgers = () => getJSON("/api/ledgers");
export const createLedger = (payload) => postJSON("/api/ledgers", payload);
export const updateLedger = (payload) => putJSON("/api/ledgers", payload);
export const getStockItems = () => getJSON("/api/stock-items");
export const getStockItemDetail = (name) => getJSON(`/api/stock-item?name=${encodeURIComponent(name)}`);
export const createStockItem = (payload) => postJSON("/api/stock-items", payload);
export const updateStockItem = (payload) => putJSON("/api/stock-items", payload);
export const getUnits = () => getJSON("/api/units");
export const createUnit = (payload) => postJSON("/api/units", payload);
export const updateUnit = (payload) => putJSON("/api/units", payload);
export const getStockCategories = () => getJSON("/api/stock-categories");
export const createStockCategory = (payload) => postJSON("/api/stock-categories", payload);
export const updateStockCategory = (payload) => putJSON("/api/stock-categories", payload);
export const getStockGroups = () => getJSON("/api/stock-groups");
export const createStockGroup = (payload) => postJSON("/api/stock-groups", payload);
export const updateStockGroup = (payload) => putJSON("/api/stock-groups", payload);
export const getLedgerGroups = () => getJSON("/api/ledger-groups");
export const createLedgerGroup = (payload) => postJSON("/api/ledger-groups", payload);
export const updateLedgerGroup = (payload) => putJSON("/api/ledger-groups", payload);
export const getVouchers = (from, to, voucherType) => {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (voucherType) params.set("type", voucherType);
  const qs = params.toString();
  return getJSON(`/api/vouchers${qs ? `?${qs}` : ""}`);
};
export const createVoucher = (payload) => postJSON("/api/vouchers", payload);
export const updateVoucher = (payload) => putJSON("/api/vouchers", payload);
export const deleteVoucher = (voucherType, date, masterId) => {
  const params = new URLSearchParams({ voucherType, date, masterId });
  return deleteJSON(`/api/vouchers?${params.toString()}`);
};
export const getLedgerVouchers = (name, from, to) => {
  const params = new URLSearchParams({ name });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return getJSON(`/api/ledger-vouchers?${params.toString()}`);
};
