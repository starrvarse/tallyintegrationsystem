from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import tally_client as tc

app = FastAPI(title="Tally Integration API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _resolve_date_range(from_date: Optional[str], to_date: Optional[str]):
    fy_start, fy_end = tc.current_financial_year()
    start = datetime.strptime(from_date, "%Y-%m-%d").date() if from_date else fy_start
    end = datetime.strptime(to_date, "%Y-%m-%d").date() if to_date else fy_end
    return start, end


@app.get("/api/status")
async def status():
    try:
        return await tc.get_status()
    except tc.TallyConnectionError as exc:
        return {"connected": False, "error": str(exc)}
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.get("/api/company")
async def company_details():
    try:
        return await tc.get_company_details()
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.get("/api/ledger")
async def ledger_detail(name: str = Query(...)):
    try:
        return await tc.get_ledger_detail(name)
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.get("/api/companies")
async def companies():
    try:
        return await tc.get_companies()
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.get("/api/ledgers")
async def ledgers():
    try:
        return await tc.get_ledgers()
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


class LedgerCreateRequest(BaseModel):
    name: str
    originalName: str = ""
    alias: str = ""
    parent: str
    openingBalance: float = 0
    isDebit: bool = True
    billWiseOn: bool = False
    mailingName: str = ""
    address: list[str] = Field(default_factory=list)
    state: str = ""
    country: str = "India"
    pincode: str = ""
    email: str = ""
    mobile: str = ""
    pan: str = ""
    gstin: str = ""
    gstRegistrationType: str = ""


@app.post("/api/ledgers")
async def create_ledger(payload: LedgerCreateRequest):
    try:
        return await tc.create_ledger(payload.model_dump())
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.put("/api/ledgers")
async def update_ledger(payload: LedgerCreateRequest):
    try:
        return await tc.update_ledger(payload.model_dump())
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.get("/api/stock-items")
async def stock_items():
    try:
        return await tc.get_stock_items()
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.get("/api/stock-item")
async def stock_item_detail(name: str = Query(...)):
    try:
        return await tc.get_stock_item_detail(name)
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


class StockItemCreateRequest(BaseModel):
    name: str
    originalName: str = ""
    alias: str = ""
    parent: str
    baseUnit: str
    alternateUnit: str = ""
    conversionFactor: float = 0
    typeOfSupply: str = "Goods"
    hsnCode: str = ""
    taxability: str = ""
    gstRate: float = 0
    openingBalance: float = 0
    openingRate: float = 0


@app.post("/api/stock-items")
async def create_stock_item(payload: StockItemCreateRequest):
    try:
        return await tc.create_stock_item(payload.model_dump())
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.put("/api/stock-items")
async def update_stock_item(payload: StockItemCreateRequest):
    try:
        return await tc.update_stock_item(payload.model_dump())
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.get("/api/units")
async def units():
    try:
        return await tc.get_units()
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


class UnitCreateRequest(BaseModel):
    name: str
    originalName: str = ""
    decimalPlaces: int = 0
    reportingUQC: str = ""


@app.post("/api/units")
async def create_unit(payload: UnitCreateRequest):
    try:
        return await tc.create_unit(payload.model_dump())
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.put("/api/units")
async def update_unit(payload: UnitCreateRequest):
    try:
        return await tc.update_unit(payload.model_dump())
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.get("/api/stock-categories")
async def stock_categories():
    try:
        return await tc.get_stock_categories()
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.get("/api/stock-groups")
async def stock_groups():
    try:
        return await tc.get_stock_groups()
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


class GroupCreateRequest(BaseModel):
    name: str
    originalName: str = ""
    alias: str = ""
    parent: str = "Primary"


@app.post("/api/stock-groups")
async def create_stock_group(payload: GroupCreateRequest):
    try:
        return await tc.create_stock_group(payload.model_dump())
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.put("/api/stock-groups")
async def update_stock_group(payload: GroupCreateRequest):
    try:
        return await tc.update_stock_group(payload.model_dump())
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.post("/api/stock-categories")
async def create_stock_category(payload: GroupCreateRequest):
    try:
        return await tc.create_stock_category(payload.model_dump())
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.put("/api/stock-categories")
async def update_stock_category(payload: GroupCreateRequest):
    try:
        return await tc.update_stock_category(payload.model_dump())
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.get("/api/ledger-groups")
async def ledger_groups():
    try:
        return await tc.get_ledger_groups()
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.post("/api/ledger-groups")
async def create_ledger_group(payload: GroupCreateRequest):
    try:
        return await tc.create_ledger_group(payload.model_dump())
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.put("/api/ledger-groups")
async def update_ledger_group(payload: GroupCreateRequest):
    try:
        return await tc.update_ledger_group(payload.model_dump())
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.get("/api/vouchers")
async def vouchers(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    voucher_type: Optional[str] = Query(None, alias="type"),
    limit: int = 500,
):
    start, end = _resolve_date_range(from_date, to_date)
    try:
        if voucher_type:
            return await tc.get_vouchers_by_type(voucher_type, start, end, limit=limit)
        return await tc.get_vouchers(start, end, limit=limit)
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


class VoucherLedgerEntry(BaseModel):
    ledger: str
    amount: float
    isDebit: bool = True


class VoucherItemEntry(BaseModel):
    name: str
    quantity: float = 0
    unit: str = ""
    rate: float = 0
    amount: float = 0


class VoucherCreateRequest(BaseModel):
    voucherType: str
    date: str
    narration: str = ""
    partyLedger: str = ""
    entries: list[VoucherLedgerEntry] = Field(default_factory=list)
    items: list[VoucherItemEntry] = Field(default_factory=list)


class VoucherUpdateRequest(VoucherCreateRequest):
    # Tally identifies an existing voucher for Alter by its CURRENT date +
    # MASTERID (not by GUID/REMOTEID, and not reliably by voucher number for
    # every voucher type - see tally_client.py) - these must be the values
    # the voucher had *before* this edit.
    originalDate: str
    masterId: str


@app.post("/api/vouchers")
async def create_voucher(payload: VoucherCreateRequest):
    try:
        return await tc.create_voucher(payload.model_dump())
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.put("/api/vouchers")
async def update_voucher(payload: VoucherUpdateRequest):
    try:
        return await tc.update_voucher(payload.model_dump())
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.delete("/api/vouchers")
async def delete_voucher(
    voucher_type: str = Query(..., alias="voucherType"),
    voucher_date: str = Query(..., alias="date"),
    master_id: str = Query(..., alias="masterId"),
):
    try:
        return await tc.delete_voucher(voucher_type, voucher_date, master_id)
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.get("/api/ledger-vouchers")
async def ledger_vouchers(
    name: str = Query(...),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    limit: int = 2000,
):
    start, end = _resolve_date_range(from_date, to_date)
    try:
        return await tc.get_ledger_vouchers(name, start, end, limit=limit)
    except tc.TallyConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except tc.TallyResponseError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
