# Tally Integration System

A full‑stack dashboard for **TallyPrime** — talk to your live Tally company straight from a modern web UI. No middleware, no exported files: the backend speaks Tally's own XML/HTTP gateway directly, and the frontend gives you an Excel‑like workspace for ledgers, stock, and every voucher type.

```
┌─────────────────┐      REST/JSON      ┌──────────────────┐      XML/HTTP      ┌─────────────┐
│   React + Vite   │  ◄───────────────►  │  FastAPI backend  │  ◄──────────────►  │  TallyPrime  │
│  (localhost:5173) │                    │ (localhost:8001)  │                    │ (localhost:9000)│
└─────────────────┘                      └──────────────────┘                    └─────────────┘
```

---

## ✨ Features

- **Ledgers & Ledger Groups** — browse, create, edit, rename; per‑party statement with running balance and a printable‑style detail view
- **Stock Items, Stock Groups, Stock Categories & Units** — full create/edit, GST/HSN detail, alternate‑unit conversions
- **Every voucher type as its own page** — Sales, Purchase, Receipt, Payment, Contra, Journal, Credit Note, Debit Note
  - Create, edit, and delete vouchers straight from the browser (see [caveats](#-known-limitations) below)
  - Full‑page Create/Edit forms — not cramped popups
- **Excel‑style data tables** — sticky headers, instant search, row actions, clean scrollbars
- **Standalone API reference** — [`docs.html`](frontend/public/docs.html) documents every field, gotcha, and sign convention discovered by testing directly against a live Tally instance. It has **zero dependency on this app** — copy any example and point it at your own Tally.

---

## 🏗️ Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React 19 + Vite, no router (in‑app page state) |
| Backend | Python 3 + FastAPI + httpx (async) |
| Data source | TallyPrime's built‑in XML/HTTP gateway — no plugins, no ODBC driver |

---

## ✅ Prerequisites

- **TallyPrime**, running, with the XML/HTTP server enabled:
  `F1 (Help) → Settings → Connectivity → Client/Server configuration` → turn on the ODBC/HTTP server (default port `9000`)
- **Python 3.11+**
- **Node.js 18+**

---

## 🚀 Getting Started

### 1. Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

The API is now live at **http://127.0.0.1:8001** (interactive Swagger docs at `/docs`).

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** — the dashboard connects to the backend automatically.

> Make sure Tally is open with the company you want to work with loaded **before** starting the backend.

---

## 📁 Project Structure

```
tallyintegration/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI routes
│   │   └── tally_client.py  # All Tally XML gateway logic (reads + writes)
│   └── requirements.txt
├── frontend/
│   ├── public/
│   │   └── docs.html        # Standalone Tally XML API reference (see below)
│   └── src/
│       ├── components/      # One component per master/voucher type
│       ├── api.js           # Thin fetch wrapper around the backend
│       └── App.jsx          # Sidebar + page routing
└── README.md
```

---

## 📖 API Reference

Open the app and click **"API Docs ↗"** in the header, or go straight to
[`/docs.html`](frontend/public/docs.html) — it's a self‑contained page covering:

- The exact XML shape for reading and writing every master type and every voucher type
- Sign conventions (Tally is **not** consistent about what negative means across fields — this page tells you exactly where)
- Every silent‑failure gotcha found by testing live: undocumented required fields, reserved‑value control characters, the correct voucher Alter/Delete identification mechanism, and more

This page is useful even if you're building a **completely separate** integration — it doesn't call this app's backend at all.

---

## ⚠️ Known Limitations

Discovered through extensive live testing against a real TallyPrime instance — documented here so nothing is a surprise:

- **Editing Credit Note / Debit Note vouchers isn't supported yet.** Item‑invoice voucher types need a real existing voucher of that type to clone from (Tally's GST validation can't be satisfied by a hand‑built minimal XML) — if your company has none yet, those two types stay read‑only.
- **Master records (Ledgers, Stock Items, etc.) can't be deleted from the app.** A malformed delete request triggered a genuine crash in Tally itself during testing — deletion for masters was intentionally left out rather than risk instability. Delete them from Tally's own UI instead.
- **A TallyPrime "EDU" (free/educational) license restricts voucher entry to dates up to a fixed cutoff.** If voucher creation suddenly starts failing with `Voucher date is missing … retry Split`, check your license status before assuming something's broken — see `docs.html` for the full story.
- **Freshly created/edited/deleted vouchers can take a few minutes to show up in Tally's own read responses**, even though the write itself is instant and real. The app updates its own list optimistically so this shouldn't be visible in normal use.

---

## 🔒 A note on scope

This project talks **directly** to your local TallyPrime instance over `localhost` — nothing leaves your machine. There's no cloud sync, no external server, no telemetry.
