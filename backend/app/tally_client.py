"""Thin client that talks to Tally's XML/HTTP gateway (default http://localhost:9000).

Builds native TDL "Collection" requests and parses the XML Tally sends back.
No TDL report objects are needed on the Tally side - COLLECTION requests read
straight off Tally's native object types (Company, Ledger, StockItem, Voucher).
"""
from __future__ import annotations

import asyncio
import re
import xml.etree.ElementTree as ET
from datetime import date, datetime
from typing import Optional
from xml.sax.saxutils import escape

import httpx

TALLY_URL = "http://localhost:9000"
REQUEST_TIMEOUT = 60.0

# Tally's XML export can contain raw control characters that break strict XML
# parsers - strip them the same way TallyConnector's C# client does.
_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F]")
_LINE_ERROR_RE = re.compile(r"<LINEERROR>(.*?)</LINEERROR>", re.IGNORECASE | re.DOTALL)


class TallyConnectionError(Exception):
    """Tally is not reachable at the configured URL."""


class TallyResponseError(Exception):
    """Tally responded but reported an error (bad report/collection request)."""


def _clean(xml_text: str) -> str:
    xml_text = xml_text.replace("&#4;", "")
    return _CONTROL_CHARS_RE.sub("", xml_text)


async def send_request(xml: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            resp = await client.post(
                TALLY_URL,
                content=xml.encode("utf-8"),
                headers={"Content-Type": "text/xml; charset=utf-8"},
            )
    except httpx.ConnectError as exc:
        raise TallyConnectionError(
            f"Tally is not reachable at {TALLY_URL}. Make sure Tally is running "
            "and F1 > Settings > Connectivity > Client/Server configuration has "
            "the ODBC/XML server enabled on this port."
        ) from exc
    except httpx.TimeoutException as exc:
        raise TallyConnectionError("Tally did not respond in time.") from exc

    text = _clean(resp.text)
    if resp.status_code != 200:
        raise TallyResponseError(f"Tally returned HTTP {resp.status_code}: {text[:500]}")

    match = _LINE_ERROR_RE.search(text)
    if match:
        raise TallyResponseError(match.group(1).strip())
    return text


def parse(xml_text: str) -> ET.Element:
    return ET.fromstring(xml_text)


def _static_variables(extra: Optional[dict] = None) -> str:
    parts = ["<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>"]
    for key, value in (extra or {}).items():
        parts.append(f"<{key}>{escape(str(value))}</{key}>")
    return "".join(parts)


def build_collection_xml(collection_type: str,
                          fields: list[str],
                          static_vars: Optional[dict] = None,
                          collection_id: str = "TCCollection") -> str:
    field_tags = "".join(f"<FETCH>{f}</FETCH>" for f in fields)
    return f"""<ENVELOPE>
 <HEADER>
  <VERSION>1</VERSION>
  <TALLYREQUEST>Export Data</TALLYREQUEST>
  <TYPE>Collection</TYPE>
  <ID>{collection_id}</ID>
 </HEADER>
 <BODY>
  <DESC>
   <STATICVARIABLES>{_static_variables(static_vars)}</STATICVARIABLES>
   <TDL>
    <TDLMESSAGE>
     <COLLECTION NAME="{collection_id}" ISMODIFY="No">
      <TYPE>{collection_type}</TYPE>
      {field_tags}
     </COLLECTION>
    </TDLMESSAGE>
   </TDL>
  </DESC>
 </BODY>
</ENVELOPE>"""


def _text(elem: Optional[ET.Element]) -> str:
    return (elem.text or "").strip() if elem is not None else ""


def _number(elem: Optional[ET.Element]) -> float:
    raw = _text(elem)
    if not raw:
        return 0.0
    try:
        return float(raw)
    except ValueError:
        return 0.0


def current_financial_year() -> tuple[date, date]:
    """Tally's default financial year runs April 1 - March 31."""
    today = date.today()
    start_year = today.year if today.month >= 4 else today.year - 1
    return date(start_year, 4, 1), date(start_year + 1, 3, 31)


def _format_tally_date(d: date) -> str:
    return d.strftime("%Y%m%d")


def _parse_tally_date(raw: str) -> Optional[str]:
    if not raw or len(raw) != 8:
        return None
    return f"{raw[0:4]}-{raw[4:6]}-{raw[6:8]}"


async def get_status() -> dict:
    xml = build_collection_xml("Company", ["NAME", "STARTINGFROM", "BOOKSFROM"], collection_id="TCStatus")
    resp = await send_request(xml)
    root = parse(resp)
    company_el = root.find(".//COLLECTION/COMPANY")
    if company_el is None:
        return {"connected": True, "company": None}
    return {
        "connected": True,
        "company": company_el.get("NAME"),
        "startingFrom": _parse_tally_date(_text(company_el.find("STARTINGFROM"))),
        "booksFrom": _parse_tally_date(_text(company_el.find("BOOKSFROM"))),
    }


def _alias(el: ET.Element) -> str:
    # A master's alias is stored as the second <NAME> entry inside
    # LANGUAGENAME.LIST/NAME.LIST, not a separate field.
    names = el.findall("LANGUAGENAME.LIST/NAME.LIST/NAME")
    return (names[1].text or "").strip() if len(names) > 1 and names[1].text else ""


def _address_lines(el: ET.Element) -> list[str]:
    return [(a.text or "").strip() for a in el.findall("ADDRESS.LIST/ADDRESS") if a.text and a.text.strip()]


def _split_flat_address(raw: str) -> list[str]:
    # Tally flattens the company's multi-line "Address" field into one
    # comma-joined string under REMOTEFULLLISTNAME - split it back into lines.
    return [part.strip() for part in raw.split(",") if part.strip()]


async def get_gst_registrations() -> list[dict]:
    # In TallyPrime 5+, a company's GST registration(s) are their own master
    # object - internally typed TAXUNIT, not a field on Company itself.
    # A company with a single registration still gets one TAXUNIT record
    # (plus an unrelated "Default Tax Unit" placeholder with no GSTIN).
    xml = build_collection_xml(
        "TAXUNIT",
        ["NAME", "GSTREGNUMBER", "PAN", "GSTEINVBILLFROMPLACE", "GSTREGISTRATIONDETAILS.LIST"],
        collection_id="TCTaxUnits",
    )
    resp = await send_request(xml)
    root = parse(resp)
    registrations = []
    for el in root.findall(".//COLLECTION/TAXUNIT"):
        gstin = _text(el.find("GSTREGNUMBER")) or el.get("TAXREGISTRATION", "")
        if not gstin:
            continue
        reg_details = el.find("GSTREGISTRATIONDETAILS.LIST")
        registrations.append({
            "name": el.get("NAME"),
            "gstin": gstin,
            "pan": _text(el.find("PAN")),
            "state": _text(reg_details.find("STATE")) if reg_details is not None else "",
            "registrationType": _text(reg_details.find("REGISTRATIONTYPE")) if reg_details is not None else "",
            "placeOfSupply": _text(el.find("GSTEINVBILLFROMPLACE")),
        })
    return registrations


async def get_company_details() -> dict:
    xml = build_collection_xml(
        "Company",
        [
            "NAME",
            "REMOTEFULLLISTNAME",
            "STATENAME",
            "COUNTRYNAME",
            "PINCODE",
            "EMAIL",
            "WEBSITE",
            "PHONENUMBER",
            "MOBILENO",
            "COUNTRYISDCODE",
            "INCOMETAXNUMBER",
            "CORPORATEIDENTITYNO",
            "COMPANYCONTACTPERSON",
            "COMPANYCONTACTNUMBER",
        ],
        collection_id="TCCompanyDetail",
    )
    resp, registrations = await asyncio.gather(send_request(xml), get_gst_registrations())
    root = parse(resp)
    el = root.find(".//COLLECTION/COMPANY")
    if el is None:
        return {}
    isd = _text(el.find("COUNTRYISDCODE"))
    phone = _text(el.find("PHONENUMBER"))
    mobile = _text(el.find("MOBILENO"))
    contact_number = phone or mobile
    primary_gst = registrations[0] if registrations else None
    return {
        "name": el.get("NAME"),
        "address": _split_flat_address(_text(el.find("REMOTEFULLLISTNAME"))),
        "state": _text(el.find("STATENAME")),
        "country": _text(el.find("COUNTRYNAME")),
        "pincode": _text(el.find("PINCODE")),
        "email": _text(el.find("EMAIL")),
        "website": _text(el.find("WEBSITE")),
        "phone": f"{isd} {contact_number}".strip() if contact_number else "",
        "gstin": primary_gst["gstin"] if primary_gst else "",
        "gstRegistrationType": primary_gst["registrationType"] if primary_gst else "",
        "gstRegistrations": registrations,
        "pan": _text(el.find("INCOMETAXNUMBER")) or (primary_gst["pan"] if primary_gst else ""),
        "cin": _text(el.find("CORPORATEIDENTITYNO")),
        "contactPerson": _text(el.find("COMPANYCONTACTPERSON")),
        "contactNumber": _text(el.find("COMPANYCONTACTNUMBER")),
    }


def _ledger_gstin(el: ET.Element) -> tuple[str, str]:
    # Tally Prime keeps a party's live GSTIN under the (possibly multi-entry,
    # state-wise) LEDGSTREGDETAILS.LIST - the flat PARTYGSTIN field is legacy
    # and usually empty. Fall back to it only if the list has nothing.
    reg = el.find("LEDGSTREGDETAILS.LIST")
    if reg is not None:
        gstin = _text(reg.find("GSTIN"))
        if gstin:
            return gstin, _text(reg.find("GSTREGISTRATIONTYPE"))
    return _text(el.find("PARTYGSTIN")), _text(el.find("GSTREGISTRATIONTYPE"))


async def get_ledger_detail(name: str) -> dict:
    xml = build_collection_xml(
        "Ledger",
        [
            "NAME",
            "PARENT",
            "ADDRESS.LIST",
            "STATE",
            "STATENAME",
            "PRIORSTATENAME",
            "COUNTRYNAME",
            "PINCODE",
            "PARTYGSTIN",
            "LEDGSTREGDETAILS.LIST",
            "LEDMAILINGDETAILS.LIST",
            "LEDGERMOBILE",
            "EMAIL",
            "INCOMETAXNUMBER",
            "ISBILLWISEON",
            "ISTDSDEDUCTABLE",
            "ISTCSAPPLICABLE",
            "OPENINGBALANCE",
            "CLOSINGBALANCE",
            "GUID",
            "LANGUAGENAME.LIST",
        ],
        collection_id="TCLedgerDetail",
    )
    resp = await send_request(xml)
    root = parse(resp)
    for el in root.findall(".//COLLECTION/LEDGER"):
        if el.get("NAME") == name:
            gstin, gst_type = _ledger_gstin(el)
            return {
                "name": el.get("NAME"),
                "guid": _text(el.find("GUID")),
                "alias": _alias(el),
                "parent": _text(el.find("PARENT")),
                "address": _address_lines(el),
                "state": (
                    _text(el.find("STATE"))
                    or _text(el.find("STATENAME"))
                    or _text(el.find("PRIORSTATENAME"))
                    or _text(el.find("LEDMAILINGDETAILS.LIST/STATE"))
                ),
                "country": _text(el.find("COUNTRYNAME")),
                "pincode": _text(el.find("PINCODE")),
                "gstin": gstin,
                "gstRegistrationType": gst_type,
                "pan": _text(el.find("INCOMETAXNUMBER")),
                "mobile": _text(el.find("LEDGERMOBILE")),
                "email": _text(el.find("EMAIL")),
                "billWiseOn": _text(el.find("ISBILLWISEON")) == "Yes",
                "tdsDeductable": _text(el.find("ISTDSDEDUCTABLE")) == "Yes",
                "tcsApplicable": _text(el.find("ISTCSAPPLICABLE")) == "Yes",
                "openingBalance": _number(el.find("OPENINGBALANCE")),
                "closingBalance": _number(el.find("CLOSINGBALANCE")),
            }
    return {"name": name, "address": [], "state": "", "country": "", "pincode": "", "gstin": "", "mobile": ""}


async def get_companies() -> list[dict]:
    xml = build_collection_xml("Company", ["NAME", "STARTINGFROM", "BOOKSFROM"], collection_id="TCCompanies")
    resp = await send_request(xml)
    root = parse(resp)
    companies = []
    for el in root.findall(".//COLLECTION/COMPANY"):
        companies.append({
            "name": el.get("NAME"),
            "startingFrom": _parse_tally_date(_text(el.find("STARTINGFROM"))),
            "booksFrom": _parse_tally_date(_text(el.find("BOOKSFROM"))),
        })
    return companies


async def get_ledgers() -> list[dict]:
    xml = build_collection_xml(
        "Ledger",
        ["NAME", "PARENT", "OPENINGBALANCE", "CLOSINGBALANCE", "LEDGERMOBILE", "PARTYGSTIN", "LEDGSTREGDETAILS.LIST", "GUID"],
        collection_id="TCLedgers",
    )
    resp = await send_request(xml)
    root = parse(resp)
    ledgers = []
    for el in root.findall(".//COLLECTION/LEDGER"):
        gstin, _gst_type = _ledger_gstin(el)
        ledgers.append({
            "name": el.get("NAME"),
            "guid": _text(el.find("GUID")),
            "parent": _text(el.find("PARENT")),
            "openingBalance": _number(el.find("OPENINGBALANCE")),
            "closingBalance": _number(el.find("CLOSINGBALANCE")),
            "mobile": _text(el.find("LEDGERMOBILE")),
            "gstin": gstin,
        })
    ledgers.sort(key=lambda l: l["name"] or "")
    return ledgers


async def get_stock_item_detail(name: str) -> dict:
    xml = build_collection_xml(
        "StockItem",
        [
            "NAME",
            "PARENT",
            "BASEUNITS",
            "ADDITIONALUNITS",
            "DENOMINATOR",
            "OPENINGBALANCE",
            "OPENINGVALUE",
            "OPENINGRATE",
            "CLOSINGBALANCE",
            "CLOSINGVALUE",
            "GSTTYPEOFSUPPLY",
            "HSNDETAILS.LIST",
            "GSTDETAILS.LIST",
            "GUID",
            "LANGUAGENAME.LIST",
        ],
        collection_id="TCStockItemDetail",
    )
    resp = await send_request(xml)
    root = parse(resp)
    for el in root.findall(".//COLLECTION/STOCKITEM"):
        if el.get("NAME") != name:
            continue
        gst = el.find("GSTDETAILS.LIST")
        rates: dict[str, float] = {}
        statewise = gst.find("STATEWISEDETAILS.LIST") if gst is not None else None
        if statewise is not None:
            for rate_el in statewise.findall("RATEDETAILS.LIST"):
                head = _text(rate_el.find("GSTRATEDUTYHEAD"))
                rate = _text(rate_el.find("GSTRATE"))
                if head and rate:
                    rates[head] = _number(rate_el.find("GSTRATE"))
        gst_rate = rates.get("IGST")
        if gst_rate is None and ("CGST" in rates or "SGST/UTGST" in rates):
            gst_rate = rates.get("CGST", 0) + rates.get("SGST/UTGST", 0)
        return {
            "name": el.get("NAME"),
            "guid": _text(el.find("GUID")),
            "alias": _alias(el),
            "parent": _text(el.find("PARENT")),
            "baseUnit": _text(el.find("BASEUNITS")),
            "alternateUnit": _text(el.find("ADDITIONALUNITS")),
            "conversionFactor": _number(el.find("DENOMINATOR")),
            "openingBalance": _text(el.find("OPENINGBALANCE")),
            "openingValue": _number(el.find("OPENINGVALUE")),
            "openingRate": _text(el.find("OPENINGRATE")),
            "closingBalance": _text(el.find("CLOSINGBALANCE")),
            "closingValue": _number(el.find("CLOSINGVALUE")),
            "typeOfSupply": _text(el.find("GSTTYPEOFSUPPLY")),
            "hsnCode": _text(el.find("HSNDETAILS.LIST/HSNCODE")),
            "taxability": _text(gst.find("TAXABILITY")) if gst is not None else "",
            "gstRate": gst_rate,
        }
    return {"name": name}


async def get_stock_items() -> list[dict]:
    xml = build_collection_xml(
        "StockItem",
        ["NAME", "PARENT", "BASEUNITS", "OPENINGBALANCE", "OPENINGVALUE", "CLOSINGBALANCE", "CLOSINGVALUE", "GUID"],
        collection_id="TCStockItems",
    )
    resp = await send_request(xml)
    root = parse(resp)
    items = []
    for el in root.findall(".//COLLECTION/STOCKITEM"):
        items.append({
            "name": el.get("NAME"),
            "guid": _text(el.find("GUID")),
            "parent": _text(el.find("PARENT")),
            "baseUnit": _text(el.find("BASEUNITS")),
            "openingBalance": _text(el.find("OPENINGBALANCE")),
            "openingValue": _number(el.find("OPENINGVALUE")),
            "closingBalance": _text(el.find("CLOSINGBALANCE")),
            "closingValue": _number(el.find("CLOSINGVALUE")),
        })
    items.sort(key=lambda i: i["name"] or "")
    return items


async def get_units() -> list[dict]:
    xml = build_collection_xml(
        "Unit",
        [
            "NAME",
            "ISSIMPLEUNIT",
            "BASEUNITS",
            "ADDITIONALUNITS",
            "CONVERSION",
            "DECIMALPLACES",
            "REPORTINGUQCDETAILS.LIST",
            "GUID",
        ],
        collection_id="TCUnits",
    )
    resp = await send_request(xml)
    root = parse(resp)
    units = []
    for el in root.findall(".//COLLECTION/UNIT"):
        units.append({
            "name": el.get("NAME"),
            "guid": _text(el.find("GUID")),
            "isSimple": _text(el.find("ISSIMPLEUNIT")) != "No",
            "baseUnit": _text(el.find("BASEUNITS")),
            "additionalUnit": _text(el.find("ADDITIONALUNITS")),
            "conversion": _number(el.find("CONVERSION")),
            "decimalPlaces": _text(el.find("DECIMALPLACES")),
            "reportingUQC": _text(el.find("REPORTINGUQCDETAILS.LIST/REPORTINGUQCNAME")),
        })
    units.sort(key=lambda u: u["name"] or "")
    return units


async def get_stock_categories() -> list[dict]:
    xml = build_collection_xml(
        "StockCategory", ["NAME", "PARENT", "GUID", "LANGUAGENAME.LIST"], collection_id="TCStockCategories"
    )
    resp = await send_request(xml)
    root = parse(resp)
    categories = []
    for el in root.findall(".//COLLECTION/STOCKCATEGORY"):
        categories.append({
            "name": el.get("NAME"),
            "guid": _text(el.find("GUID")),
            "alias": _alias(el),
            "parent": _text(el.find("PARENT")),
        })
    categories.sort(key=lambda c: c["name"] or "")
    return categories


async def get_stock_groups() -> list[dict]:
    xml = build_collection_xml(
        "StockGroup", ["NAME", "PARENT", "GUID", "LANGUAGENAME.LIST"], collection_id="TCStockGroups"
    )
    resp = await send_request(xml)
    root = parse(resp)
    groups = []
    for el in root.findall(".//COLLECTION/STOCKGROUP"):
        groups.append({
            "name": el.get("NAME"),
            "guid": _text(el.find("GUID")),
            "alias": _alias(el),
            "parent": _text(el.find("PARENT")),
        })
    groups.sort(key=lambda g: g["name"] or "")
    return groups


async def get_ledger_groups() -> list[dict]:
    xml = build_collection_xml(
        "Group",
        ["NAME", "PARENT", "ISDEEMEDPOSITIVE", "AFFECTSGROSSPROFIT", "ISSUBLEDGER", "GUID", "LANGUAGENAME.LIST"],
        collection_id="TCGroups",
    )
    resp = await send_request(xml)
    root = parse(resp)
    groups = []
    for el in root.findall(".//COLLECTION/GROUP"):
        groups.append({
            "name": el.get("NAME"),
            "guid": _text(el.find("GUID")),
            "alias": _alias(el),
            "parent": _text(el.find("PARENT")),
            "nature": "Debit" if _text(el.find("ISDEEMEDPOSITIVE")) == "Yes" else "Credit",
            "affectsGrossProfit": _text(el.find("AFFECTSGROSSPROFIT")) == "Yes",
            "isSubledger": _text(el.find("ISSUBLEDGER")) == "Yes",
        })
    groups.sort(key=lambda g: g["name"] or "")
    return groups


def _clean_qty(raw: str) -> str:
    # Tally returns quantities like " 175 PCS =  1 CASE" - collapse the whitespace.
    return re.sub(r"\s+", " ", raw).strip()


def _parse_voucher_el(el: ET.Element) -> dict:
    entries = []
    for entry_el in el.findall("ALLLEDGERENTRIES.LIST"):
        entries.append({
            "ledger": _text(entry_el.find("LEDGERNAME")),
            "amount": _number(entry_el.find("AMOUNT")),
        })
    items = []
    for item_el in el.findall("ALLINVENTORYENTRIES.LIST"):
        name = _text(item_el.find("STOCKITEMNAME"))
        if not name:
            continue
        items.append({
            "name": name,
            "quantity": _clean_qty(_text(item_el.find("BILLEDQTY")) or _text(item_el.find("ACTUALQTY"))),
            "rate": _text(item_el.find("RATE")),
            "amount": _number(item_el.find("AMOUNT")),
        })
    # Voucher's headline amount = sum of the positive (debit) side entries.
    amount = sum(e["amount"] for e in entries if e["amount"] > 0)
    return {
        "guid": _text(el.find("GUID")),
        "masterId": _text(el.find("MASTERID")).strip(),
        "date": _parse_tally_date(_text(el.find("DATE"))),
        "voucherType": el.get("VCHTYPE") or _text(el.find("VOUCHERTYPENAME")),
        "voucherNumber": _text(el.find("VOUCHERNUMBER")),
        "party": _text(el.find("PARTYLEDGERNAME")),
        "narration": _text(el.find("NARRATION")),
        "amount": amount,
        "entries": entries,
        "items": items,
    }


async def _fetch_vouchers(from_date: date, to_date: date) -> list[dict]:
    xml = build_collection_xml(
        "Voucher",
        [
            "DATE",
            "VOUCHERTYPENAME",
            "VOUCHERNUMBER",
            "PARTYLEDGERNAME",
            "NARRATION",
            "GUID",
            "MASTERID",
            "ALLLEDGERENTRIES.LIST",
            "ALLINVENTORYENTRIES.LIST",
        ],
        static_vars={
            "SVFROMDATE": _format_tally_date(from_date),
            "SVTODATE": _format_tally_date(to_date),
        },
        collection_id="TCVouchers",
    )
    resp = await send_request(xml)
    root = parse(resp)
    vouchers = [_parse_voucher_el(el) for el in root.findall(".//COLLECTION/VOUCHER")]
    # SVFROMDATE/SVTODATE is silently ignored by this Tally instance for a
    # bare TYPE="Voucher" collection - confirmed live, a single-day range
    # still returned the company's entire voucher history. Filter in Python
    # instead of trusting Tally to have scoped the result.
    from_str, to_str = _format_tally_date(from_date), _format_tally_date(to_date)
    lo, hi = f"{from_str[:4]}-{from_str[4:6]}-{from_str[6:]}", f"{to_str[:4]}-{to_str[4:6]}-{to_str[6:]}"
    return [v for v in vouchers if v["date"] and lo <= v["date"] <= hi]


# The generic TYPE="Voucher" collection above is fast (fine for the high
# volume Sales/Purchase/Receipt/Payment/Contra usually have) but was found
# live to never return Journal/Credit Note/Debit Note vouchers at all, even
# ones that are genuinely committed and visible in Tally's own Day Book. The
# "Voucher Register" report doesn't have this gap, but dumps every field per
# voucher (huge payload) and times out for high-volume types - so it's only
# used as a fallback for the low-volume types the collection can't see.
_REGISTER_ONLY_TYPES = {"Journal", "Credit Note", "Debit Note"}


async def _fetch_vouchers_via_register(voucher_type: str, from_date: date, to_date: date) -> list[dict]:
    xml = f"""<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Export Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <EXPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>Voucher Register</REPORTNAME>
    <STATICVARIABLES>
     <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
     <SVFROMDATE>{_format_tally_date(from_date)}</SVFROMDATE>
     <SVTODATE>{_format_tally_date(to_date)}</SVTODATE>
     <VOUCHERTYPENAME>{escape(voucher_type)}</VOUCHERTYPENAME>
    </STATICVARIABLES>
   </REQUESTDESC>
  </EXPORTDATA>
 </BODY>
</ENVELOPE>"""
    resp = await send_request(xml)
    root = parse(resp)
    return [_parse_voucher_el(el) for el in root.findall(".//TALLYMESSAGE/VOUCHER")]


async def get_vouchers_by_type(voucher_type: str, from_date: date, to_date: date, limit: int = 500) -> list[dict]:
    if voucher_type in _REGISTER_ONLY_TYPES:
        vouchers = await _fetch_vouchers_via_register(voucher_type, from_date, to_date)
    else:
        all_vouchers = await _fetch_vouchers(from_date, to_date)
        vouchers = [v for v in all_vouchers if v["voucherType"] == voucher_type]
    vouchers.sort(key=lambda v: v["date"] or "", reverse=True)
    return vouchers[:limit]


async def get_vouchers(from_date: date, to_date: date, limit: int = 500) -> list[dict]:
    vouchers = await _fetch_vouchers(from_date, to_date)
    vouchers.sort(key=lambda v: v["date"] or "", reverse=True)
    return vouchers[:limit]


async def get_ledger_vouchers(ledger_name: str, from_date: date, to_date: date, limit: int = 2000) -> list[dict]:
    """All vouchers that post an entry to `ledger_name`, oldest first, each
    tagged with `ledgerAmount` - the signed amount posted to that ledger
    specifically (negative side = its Debit, positive = its Credit)."""
    vouchers = await _fetch_vouchers(from_date, to_date)
    matched = []
    for v in vouchers:
        entry = next((e for e in v["entries"] if e["ledger"] == ledger_name), None)
        if entry is None:
            continue
        matched.append({**v, "ledgerAmount": entry["amount"]})
    matched.sort(key=lambda v: v["date"] or "")
    return matched[:limit]


# ---------------------------------------------------------------------------
# Writes (Import Data)
# ---------------------------------------------------------------------------
# Confirmed live against this Tally instance: OPENINGBALANCE follows the same
# sign convention as everywhere else in this file - negative = Debit,
# positive = Credit (verified via Tally's own "Group Summary" report, which
# put a ledger created with OPENINGBALANCE=1000 under the Credit column).

_TALLYMESSAGE_HEADER = """<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Import Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>All Masters</REPORTNAME>
   </REQUESTDESC>
   <REQUESTDATA>
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
"""

_TALLYMESSAGE_FOOTER = """
    </TALLYMESSAGE>
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>"""


def _target_name(data: dict, name: str) -> str:
    # On Alter, the tag's NAME attribute must identify the EXISTING record
    # (its name before this edit) while <NAME> inside NAME.LIST carries the
    # new name - renaming to the same value in both places doesn't match any
    # record. Verified live: attribute=old, NAME.LIST=new renames cleanly
    # with no orphaned duplicate. `originalName` is only sent by the frontend
    # when editing; Create has nothing to rename from, so it just reuses name.
    return (data.get("originalName") or name).strip()


def _name_and_alias_xml(name: str, alias: str) -> str:
    # Tally ignores a flat <ALIAS> tag on Create - the alias must be the
    # second <NAME> entry inside NAME.LIST (confirmed by checking how the
    # TallyConnector library actually serializes it, then verified live).
    names = f"<NAME>{escape(name)}</NAME>"
    if alias.strip():
        names += f"<NAME>{escape(alias.strip())}</NAME>"
    return f"<LANGUAGENAME.LIST><NAME.LIST>{names}</NAME.LIST></LANGUAGENAME.LIST>"


async def _send_import(inner_xml: str) -> None:
    xml = f"{_TALLYMESSAGE_HEADER}{inner_xml}{_TALLYMESSAGE_FOOTER}"
    resp = await send_request(xml)
    root = parse(resp)
    created = _text(root.find(".//CREATED"))
    altered = _text(root.find(".//ALTERED"))
    errors = _text(root.find(".//ERRORS"))
    if errors and errors != "0":
        raise TallyResponseError(f"Tally reported {errors} error(s) processing this request.")
    if created not in ("1",) and altered not in ("1",):
        raise TallyResponseError("Tally did not confirm the change (no record created or altered).")


async def _get_books_from_date() -> str:
    xml = build_collection_xml("Company", ["BOOKSFROM", "STARTINGFROM"], collection_id="TCBooksFrom")
    resp = await send_request(xml)
    root = parse(resp)
    el = root.find(".//COLLECTION/COMPANY")
    if el is not None:
        raw = _text(el.find("BOOKSFROM")) or _text(el.find("STARTINGFROM"))
        if raw and len(raw) == 8:
            return raw
    return _format_tally_date(date.today())


async def create_ledger(data: dict, action: str = "Create") -> dict:
    name = (data.get("name") or "").strip()
    if not name:
        raise TallyResponseError("Ledger name is required.")
    target_name = _target_name(data, name)
    parent = (data.get("parent") or "").strip()
    if not parent:
        raise TallyResponseError("A group ('Under') is required.")

    opening_balance = float(data.get("openingBalance") or 0)
    signed_balance = -abs(opening_balance) if data.get("isDebit", True) else abs(opening_balance)

    mailing_name = (data.get("mailingName") or name).strip()
    address_lines = [line for line in (data.get("address") or []) if line.strip()]
    address_xml = "".join(f"<ADDRESS>{escape(line.strip())}</ADDRESS>" for line in address_lines)

    gstin = (data.get("gstin") or "").strip()
    gst_reg_type = (data.get("gstRegistrationType") or "").strip()

    # Must match the company's actual books-from date - Tally silently drops
    # the rest of a master's fields (no error reported) if this is set to an
    # arbitrary "today" date instead of the effective start of the books.
    applicable_from = await _get_books_from_date()

    gst_block = ""
    if gstin or gst_reg_type:
        gst_block = f"""
      <LEDGSTREGDETAILS.LIST>
       <APPLICABLEFROM>{applicable_from}</APPLICABLEFROM>
       <GSTREGISTRATIONTYPE>{escape(gst_reg_type or "Regular")}</GSTREGISTRATIONTYPE>
       <GSTIN>{escape(gstin)}</GSTIN>
       <PLACEOFSUPPLY>{escape(data.get("state") or "")}</PLACEOFSUPPLY>
      </LEDGSTREGDETAILS.LIST>"""

    inner = f"""     <LEDGER NAME="{escape(target_name)}" ACTION="{action}">
      {_name_and_alias_xml(name, data.get("alias") or "")}
      <PARENT>{escape(parent)}</PARENT>
      <OPENINGBALANCE>{signed_balance}</OPENINGBALANCE>
      <ISBILLWISEON>{"Yes" if data.get("billWiseOn") else "No"}</ISBILLWISEON>
      <EMAIL>{escape((data.get("email") or "").strip())}</EMAIL>
      <LEDGERMOBILE>{escape((data.get("mobile") or "").strip())}</LEDGERMOBILE>
      <INCOMETAXNUMBER>{escape((data.get("pan") or "").strip())}</INCOMETAXNUMBER>
      <LEDMAILINGDETAILS.LIST>
       <APPLICABLEFROM>{applicable_from}</APPLICABLEFROM>
       <MAILINGNAME>{escape(mailing_name)}</MAILINGNAME>
       <ADDRESS.LIST>{address_xml}</ADDRESS.LIST>
       <STATE>{escape((data.get("state") or "").strip())}</STATE>
       <COUNTRY>{escape((data.get("country") or "India").strip())}</COUNTRY>
       <PINCODE>{escape((data.get("pincode") or "").strip())}</PINCODE>
      </LEDMAILINGDETAILS.LIST>{gst_block}
     </LEDGER>
"""
    await _send_import(inner)
    return {"success": True, "name": name}


async def update_ledger(data: dict) -> dict:
    return await create_ledger(data, action="Alter")


async def create_stock_item(data: dict, action: str = "Create") -> dict:
    name = (data.get("name") or "").strip()
    if not name:
        raise TallyResponseError("Item name is required.")
    target_name = _target_name(data, name)
    parent = (data.get("parent") or "").strip()
    if not parent:
        raise TallyResponseError("A group ('Under') is required.")
    base_unit = (data.get("baseUnit") or "").strip()
    if not base_unit:
        raise TallyResponseError("A base unit is required.")

    applicable_from = await _get_books_from_date()

    alternate_unit = (data.get("alternateUnit") or "").strip()
    conversion_factor = float(data.get("conversionFactor") or 0)
    unit_block = f"<ADDITIONALUNITS>{escape(alternate_unit)}</ADDITIONALUNITS>"
    if alternate_unit and conversion_factor > 0:
        unit_block += f"<DENOMINATOR>{conversion_factor}</DENOMINATOR><CONVERSION>1</CONVERSION>"

    opening_qty = float(data.get("openingBalance") or 0)
    opening_rate = float(data.get("openingRate") or 0)
    # Stock item OPENINGVALUE/CLOSINGVALUE use the opposite sign convention
    # from what you'd naively expect: normal owned stock (positive quantity)
    # is stored as a NEGATIVE value - confirmed against every existing item
    # in this company's data (e.g. real stock worth 20,565.55 is stored as
    # -20565.55). Sending a positive value here creates data inconsistent
    # with the rest of the books (Tally's own UI flags it with a "(-)").
    opening_value = -(opening_qty * opening_rate)
    opening_block = ""
    if opening_qty:
        opening_block = f"""
      <OPENINGBALANCE>{opening_qty} {escape(base_unit)}</OPENINGBALANCE>
      <OPENINGRATE>{opening_rate}/{escape(base_unit)}</OPENINGRATE>
      <OPENINGVALUE>{opening_value}</OPENINGVALUE>"""

    hsn_code = (data.get("hsnCode") or "").strip()
    hsn_block = ""
    if hsn_code:
        hsn_block = f"""
      <HSNDETAILS.LIST>
       <APPLICABLEFROM>{applicable_from}</APPLICABLEFROM>
       <HSNCODE>{escape(hsn_code)}</HSNCODE>
       <SRCOFHSNDETAILS>Specify Details Here</SRCOFHSNDETAILS>
      </HSNDETAILS.LIST>"""

    taxability = (data.get("taxability") or "").strip()
    gst_rate = data.get("gstRate")
    gst_block = ""
    if taxability or gst_rate:
        rate = float(gst_rate or 0)
        half_rate = rate / 2
        rate_entries = ""
        if rate > 0:
            rate_entries = f"""
        <RATEDETAILS.LIST>
         <GSTRATEDUTYHEAD>CGST</GSTRATEDUTYHEAD>
         <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>
         <GSTRATE>{half_rate}</GSTRATE>
        </RATEDETAILS.LIST>
        <RATEDETAILS.LIST>
         <GSTRATEDUTYHEAD>SGST/UTGST</GSTRATEDUTYHEAD>
         <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>
         <GSTRATE>{half_rate}</GSTRATE>
        </RATEDETAILS.LIST>
        <RATEDETAILS.LIST>
         <GSTRATEDUTYHEAD>IGST</GSTRATEDUTYHEAD>
         <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>
         <GSTRATE>{rate}</GSTRATE>
        </RATEDETAILS.LIST>"""
        gst_block = f"""
      <GSTDETAILS.LIST>
       <APPLICABLEFROM>{applicable_from}</APPLICABLEFROM>
       <TAXABILITY>{escape(taxability or "Taxable")}</TAXABILITY>
       <SRCOFGSTDETAILS>Specify Details Here</SRCOFGSTDETAILS>
       <STATEWISEDETAILS.LIST>
        <STATENAME>\x04 Any</STATENAME>{rate_entries}
       </STATEWISEDETAILS.LIST>
      </GSTDETAILS.LIST>"""

    type_of_supply = (data.get("typeOfSupply") or "Goods").strip()

    inner = f"""     <STOCKITEM NAME="{escape(target_name)}" ACTION="{action}">
      {_name_and_alias_xml(name, data.get("alias") or "")}
      <PARENT>{escape(parent)}</PARENT>
      <BASEUNITS>{escape(base_unit)}</BASEUNITS>
      {unit_block}
      <GSTTYPEOFSUPPLY>{escape(type_of_supply)}</GSTTYPEOFSUPPLY>{opening_block}{hsn_block}{gst_block}
     </STOCKITEM>
"""
    await _send_import(inner)
    return {"success": True, "name": name}


async def update_stock_item(data: dict) -> dict:
    return await create_stock_item(data, action="Alter")


def _group_parent_xml(parent: str) -> str:
    # A top-level group's parent is the reserved value "Primary" - like the
    # GST "Any" state, Tally requires the literal control-char-prefixed form
    # on write (plain "Primary" is rejected: "Stock Group 'Primary' does not
    # exist!"), even though export shows it the same way.
    value = "\x04 Primary" if parent.strip().lower() == "primary" else parent.strip()
    return f"<PARENT>{escape(value)}</PARENT>"


async def create_ledger_group(data: dict, action: str = "Create") -> dict:
    name = (data.get("name") or "").strip()
    if not name:
        raise TallyResponseError("Group name is required.")
    target_name = _target_name(data, name)
    parent = (data.get("parent") or "Primary").strip()

    inner = f"""     <GROUP NAME="{escape(target_name)}" ACTION="{action}">
      {_name_and_alias_xml(name, data.get("alias") or "")}
      {_group_parent_xml(parent)}
     </GROUP>
"""
    await _send_import(inner)
    return {"success": True, "name": name}


async def update_ledger_group(data: dict) -> dict:
    return await create_ledger_group(data, action="Alter")


async def create_stock_group(data: dict, action: str = "Create") -> dict:
    name = (data.get("name") or "").strip()
    if not name:
        raise TallyResponseError("Group name is required.")
    target_name = _target_name(data, name)
    parent = (data.get("parent") or "Primary").strip()

    inner = f"""     <STOCKGROUP NAME="{escape(target_name)}" ACTION="{action}">
      {_name_and_alias_xml(name, data.get("alias") or "")}
      {_group_parent_xml(parent)}
     </STOCKGROUP>
"""
    await _send_import(inner)
    return {"success": True, "name": name}


async def update_stock_group(data: dict) -> dict:
    return await create_stock_group(data, action="Alter")


async def create_stock_category(data: dict, action: str = "Create") -> dict:
    name = (data.get("name") or "").strip()
    if not name:
        raise TallyResponseError("Category name is required.")
    target_name = _target_name(data, name)
    parent = (data.get("parent") or "Primary").strip()

    inner = f"""     <STOCKCATEGORY NAME="{escape(target_name)}" ACTION="{action}">
      {_name_and_alias_xml(name, data.get("alias") or "")}
      {_group_parent_xml(parent)}
     </STOCKCATEGORY>
"""
    await _send_import(inner)
    return {"success": True, "name": name}


async def update_stock_category(data: dict) -> dict:
    return await create_stock_category(data, action="Alter")


async def create_unit(data: dict, action: str = "Create") -> dict:
    name = (data.get("name") or "").strip()
    if not name:
        raise TallyResponseError("Unit symbol is required.")
    if " " in name:
        raise TallyResponseError("Unit symbols can't contain spaces (e.g. PCS, KGS, BOX).")
    target_name = _target_name(data, name)
    decimal_places = int(data.get("decimalPlaces") or 0)

    uqc_block = ""
    reporting_uqc = (data.get("reportingUQC") or "").strip()
    if reporting_uqc and reporting_uqc != "Not Applicable":
        applicable_from = await _get_books_from_date()
        uqc_block = f"""
      <REPORTINGUQCDETAILS.LIST>
       <APPLICABLEFROM>{applicable_from}</APPLICABLEFROM>
       <REPORTINGUQCNAME>{escape(reporting_uqc)}</REPORTINGUQCNAME>
      </REPORTINGUQCDETAILS.LIST>"""

    # Units reject the alias-via-NAME.LIST trick that works for every other
    # master type here ("BAD UNIT NAME") - only a flat NAME is accepted, and
    # ALIAS silently doesn't persist either way, so it's left out entirely.
    inner = f"""     <UNIT NAME="{escape(target_name)}" ACTION="{action}">
      <NAME>{escape(name)}</NAME>
      <ISSIMPLEUNIT>Yes</ISSIMPLEUNIT>
      <DECIMALPLACES>{decimal_places}</DECIMALPLACES>{uqc_block}
     </UNIT>
"""
    await _send_import(inner)
    return {"success": True, "name": name}


async def update_unit(data: dict) -> dict:
    return await create_unit(data, action="Alter")


# ---------------------------------------------------------------------------
# Vouchers (Create, Alter, Delete)
# ---------------------------------------------------------------------------
# Confirmed live: a voucher's DATE (the nested field, inside the body) is
# plain YYYYMMDD, same as every master field. PERSISTEDVIEW is required.
#
# This Tally installation is a "Tally Prime EDU" (free/educational) license,
# which only accepts voucher dates up to a fixed cutoff (bisected live:
# 2 Sep 2026 works, 3 Sep 2026 onward fails - not a day-of-month pattern,
# a hard date). EVERY voucher type fails identically past that date with
# `LINEERROR: Voucher date is missing for ... retry Split`, including plain
# Journal - this is Tally itself refusing, not anything wrong with the XML.
# If vouchers start failing with that exact error again, check the date
# against the license first before re-debugging the XML shape.
#
# Separately, that same error text was also the symptom of a real shape bug
# for item-invoice vouchers (Sales/Purchase/Credit Note/Debit Note): Tally's
# GST "Split" computation needs a large set of company/party GST context
# fields, and a hand-built minimal set was proven UNRELIABLE - even every
# obviously-relevant field found in a real export (party GSTIN/state/address,
# company GST registration, VCHENTRYMODE, tax-adjustment status fields) still
# got silently rejected (EXCEPTIONS>1, usually with no error text at all).
# The only approach confirmed to work live is cloning an ACTUAL existing
# voucher of that type and substituting values into it, keeping the ~150
# other GST/status fields exactly as Tally itself wrote them - see
# create_item_voucher()/_fetch_voucher_template() below. This only works for
# a company that already has at least one real voucher of that type.
#
# Alter/Delete needed a completely different identification mechanism than
# every master type in this file: vouchers have no NAME attribute to key off
# (Tally itself calls them "unnamed" objects). REMOTEID/VCHKEY - the fields
# Tally's own XML *export* shows on every voucher, and the obvious thing to
# echo back - do NOT work for lookup; every attempt against them failed with
# "Voucher does not exist", including a full Tally restart in between. The
# actual documented mechanism (confirmed live, both directions) is a set of
# attributes on the <VOUCHER> tag itself:
#   <VOUCHER DATE="02-Apr-2026" TAGNAME="Master Id" TAGVALUE="6488"
#            VCHTYPE="Sales" ACTION="Alter"|"Delete">
# - DATE here is dd-MMM-yyyy (e.g. "02-Apr-2026"), NOT the same format as the
#   nested <DATE> field in the body. TAGNAME can also be "Voucher Number"
#   (Tally's docs list "Master Id, Voucher Number, Reference, Narration" as
#   valid options) - Voucher Number worked fine for Journal/Contra, but for a
#   Sales voucher under "Automatic (Manual Override)" numbering it silently
#   no-ops (reports DELETED>1, nothing actually removed). Master Id worked
#   reliably for every type tried, so it's what this file uses everywhere.
#   Verified live end-to-end: Alter actually changes the record (ALTERID
#   incremented, re-read confirmed) and Delete actually removes it (confirmed
#   via Day Book / Voucher Register, both before/after).
_ITEM_VOUCHER_TYPES = {"Sales", "Purchase", "Credit Note", "Debit Note"}
_OUTWARD_ITEM_TYPES = {"Sales", "Credit Note"}


def _tag_date(iso_date: str) -> str:
    """YYYY-MM-DD -> dd-MMM-yyyy, the format Tally's TAGNAME/TAGVALUE voucher
    identification needs on the <VOUCHER DATE="..."> attribute."""
    y, m, d = iso_date.split("-")
    return date(int(y), int(m), int(d)).strftime("%d-%b-%Y")


async def _send_voucher_import(inner_xml: str, expect: str = "CREATED") -> None:
    xml = f"""<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Import Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>Vouchers</REPORTNAME>
   </REQUESTDESC>
   <REQUESTDATA>
    <TALLYMESSAGE xmlns:UDF="TallyUDF">
{inner_xml}
    </TALLYMESSAGE>
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>"""
    resp = await send_request(xml)
    root = parse(resp)
    result = _text(root.find(f".//{expect}"))
    errors = _text(root.find(".//ERRORS"))
    exceptions = _text(root.find(".//EXCEPTIONS"))
    if errors and errors != "0":
        raise TallyResponseError(f"Tally reported {errors} error(s) processing this voucher.")
    if exceptions and exceptions != "0":
        raise TallyResponseError(
            "Tally rejected this voucher - check that ledger/item names exist "
            "exactly as in Tally and that debit and credit amounts balance."
        )
    if result != "1":
        raise TallyResponseError("Tally did not confirm the change to this voucher.")


async def _voucher_body_xml(data: dict, voucher_type: str) -> str:
    """Builds a plain accounting voucher (Payment/Receipt/Contra/Journal) -
    NOT used for item-invoice types (Sales/Purchase), which need the
    clone-and-substitute approach in create_item_voucher() below instead."""
    raw_date = (data.get("date") or "").strip()
    if not raw_date:
        raise TallyResponseError("Date is required.")
    tally_date = raw_date.replace("-", "")
    narration = (data.get("narration") or "").strip()
    party = (data.get("partyLedger") or "").strip()

    entries = [e for e in (data.get("entries") or []) if (e.get("ledger") or "").strip() and float(e.get("amount") or 0)]
    if len(entries) < 2:
        raise TallyResponseError("At least two ledger entries are required.")
    debit_total = sum(abs(float(e["amount"])) for e in entries if e.get("isDebit"))
    credit_total = sum(abs(float(e["amount"])) for e in entries if not e.get("isDebit"))
    if round(debit_total - credit_total, 2) != 0:
        raise TallyResponseError(
            f"Debit total ({debit_total}) must equal credit total ({credit_total})."
        )

    ledger_xml_parts = []
    for e in entries:
        ledger = (e["ledger"]).strip()
        is_debit = bool(e.get("isDebit"))
        signed = -abs(float(e["amount"])) if is_debit else abs(float(e["amount"]))
        ledger_xml_parts.append(f"""      <ALLLEDGERENTRIES.LIST>
       <LEDGERNAME>{escape(ledger)}</LEDGERNAME>
       <ISDEEMEDPOSITIVE>{"Yes" if is_debit else "No"}</ISDEEMEDPOSITIVE>
       <AMOUNT>{signed}</AMOUNT>
      </ALLLEDGERENTRIES.LIST>""")

    party_xml = f"\n      <PARTYLEDGERNAME>{escape(party)}</PARTYLEDGERNAME>" if party else ""
    all_lines = "\n".join(ledger_xml_parts)

    return f"""      <DATE>{tally_date}</DATE>
      <VOUCHERTYPENAME>{escape(voucher_type)}</VOUCHERTYPENAME>
      <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>{party_xml}
      <NARRATION>{escape(narration)}</NARRATION>
{all_lines}"""


def _replace_tag_once(xml: str, tag: str, new_value: str) -> str:
    # Tally's export self-closes an empty field as <TAG/> rather than
    # <TAG></TAG> - confirmed live this silently broke NARRATION substitution
    # whenever the template's original was empty, since <TAG>.*?</TAG> alone
    # never matches a self-closing tag (sub() just no-ops, no error).
    escaped_tag = re.escape(tag)
    pattern = re.compile(rf"<{escaped_tag}>.*?</{escaped_tag}>|<{escaped_tag}/>", re.DOTALL)
    return pattern.sub(f"<{tag}>{escape(new_value)}</{tag}>", xml, count=1)


def _strip_all_blocks(xml: str, tag: str) -> str:
    pattern = re.compile(rf"<{re.escape(tag)}>.*?</{re.escape(tag)}>\s*", re.DOTALL)
    return pattern.sub("", xml)


async def _fetch_voucher_template(voucher_type: str) -> tuple[str, str]:
    """One real existing voucher of this type, as raw XML, to use as a
    clone-and-substitute template - see the module comment above for why
    this is necessary for item-invoice types instead of building from
    scratch. Only works if the company already has at least one.

    Two-step lookup, NOT a single wide-range "Voucher Register" export:
    that report dumps every field for every match and reliably times out /
    hangs Tally for a high-volume type across a wide range (confirmed live -
    it's what caused this exact function to hang Tally on the first attempt).
    Instead, use the fast lean Collection query (get_vouchers_by_type) just
    to find ONE recent voucher's date, then fetch the full-detail Voucher
    Register scoped to that single day only, which stays fast."""
    fy_start, _ = current_financial_year()
    candidates = await get_vouchers_by_type(voucher_type, fy_start, date.today(), limit=1)
    if not candidates:
        raise TallyResponseError(
            f"Creating a {voucher_type} voucher isn't supported yet - it needs at least one "
            f"existing {voucher_type} voucher in Tally to use as a template, and none was found."
        )
    template_date = datetime.strptime(candidates[0]["date"], "%Y-%m-%d").date()

    xml = f"""<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Export Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <EXPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>Voucher Register</REPORTNAME>
    <STATICVARIABLES>
     <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
     <SVFROMDATE>{_format_tally_date(template_date)}</SVFROMDATE>
     <SVTODATE>{_format_tally_date(template_date)}</SVTODATE>
     <VOUCHERTYPENAME>{escape(voucher_type)}</VOUCHERTYPENAME>
    </STATICVARIABLES>
   </REQUESTDESC>
  </EXPORTDATA>
 </BODY>
</ENVELOPE>"""
    resp = await send_request(xml)
    match = re.search(r'<VOUCHER REMOTEID="[^"]*"[^>]*>.*?</VOUCHER>', resp, re.DOTALL)
    if not match:
        raise TallyResponseError(
            f"Creating a {voucher_type} voucher isn't supported yet - it needs at least one "
            f"existing {voucher_type} voucher in Tally to use as a template, and none was found."
        )
    block = match.group(0)
    party_match = re.search(r"<PARTYLEDGERNAME>(.*?)</PARTYLEDGERNAME>", block)
    template_party = (party_match.group(1) if party_match else "").strip()
    return block, template_party


async def _fetch_voucher_by_master_id(voucher_type: str, voucher_date: str, master_id: str) -> tuple[str, str]:
    """The exact existing voucher (by date + MASTERID) as raw XML, to use as
    an Alter template - same clone-and-substitute idea as
    _fetch_voucher_template, but for one SPECIFIC voucher instead of any
    example of the type. Editing Sales/Purchase was proven live to work this
    way: clone the voucher's OWN current XML, substitute the changed fields,
    strip REMOTEID/VCHKEY, and submit with ACTION="Alter" plus the usual
    TAGNAME="Master Id" identification (see update_item_voucher)."""
    d = datetime.strptime(voucher_date, "%Y-%m-%d").date()
    xml = f"""<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Export Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <EXPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>Voucher Register</REPORTNAME>
    <STATICVARIABLES>
     <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
     <SVFROMDATE>{_format_tally_date(d)}</SVFROMDATE>
     <SVTODATE>{_format_tally_date(d)}</SVTODATE>
     <VOUCHERTYPENAME>{escape(voucher_type)}</VOUCHERTYPENAME>
    </STATICVARIABLES>
   </REQUESTDESC>
  </EXPORTDATA>
 </BODY>
</ENVELOPE>"""
    resp = await send_request(xml)
    for match in re.finditer(r'<VOUCHER REMOTEID="[^"]*"[^>]*>.*?</VOUCHER>', resp, re.DOTALL):
        block = match.group(0)
        id_match = re.search(r"<MASTERID>\s*(\d+)\s*</MASTERID>", block)
        if id_match and id_match.group(1) == master_id:
            party_match = re.search(r"<PARTYLEDGERNAME>(.*?)</PARTYLEDGERNAME>", block)
            template_party = (party_match.group(1) if party_match else "").strip()
            return block, template_party
    raise TallyResponseError(f"Could not find this {voucher_type} voucher to edit.")


async def _substitute_item_voucher_fields(data: dict, voucher_type: str, block: str, template_party: str) -> tuple[str, str]:
    """Fills a cloned voucher block (from either _fetch_voucher_template or
    _fetch_voucher_by_master_id) with the requested date/party/items/ledger
    entries. Shared by create_item_voucher and update_item_voucher - see
    those for what differs (identity attributes, ACTION, voucher number)."""
    raw_date = (data.get("date") or "").strip()
    if not raw_date:
        raise TallyResponseError("Date is required.")
    tally_date = raw_date.replace("-", "")
    narration = (data.get("narration") or "").strip()
    party = (data.get("partyLedger") or "").strip()
    if not party:
        raise TallyResponseError("A party ledger is required.")
    items = [it for it in (data.get("items") or []) if (it.get("name") or "").strip()]
    if not items:
        raise TallyResponseError("At least one item is required.")
    entries = [e for e in (data.get("entries") or []) if (e.get("ledger") or "").strip()]
    other_entry = next((e for e in entries if e["ledger"].strip() != party), None)
    item_ledger_name = other_entry["ledger"].strip() if other_entry else ""
    if not item_ledger_name:
        raise TallyResponseError("A sales/purchase account ledger is required.")
    is_outward = voucher_type in _OUTWARD_ITEM_TYPES
    is_debit_side = not is_outward  # Purchase/Debit Note: party is credited, item ledger debited.

    block = _replace_tag_once(block, "DATE", tally_date)
    block = _replace_tag_once(block, "EFFECTIVEDATE", tally_date)
    block = _replace_tag_once(block, "VCHSTATUSDATE", tally_date)
    block = _replace_tag_once(block, "NARRATION", narration)

    # Party - swap the template's party name for the requested one everywhere
    # it appears, then pull the requested party's actual GST/address details
    # in over the template's. Confirmed live: Tally does NOT cross-check
    # these against the ledger master, but they need to be present.
    if template_party and template_party != party:
        block = block.replace(template_party, party)
    detail = await get_ledger_detail(party)
    state = (detail.get("state") or "").strip()
    gstin = (detail.get("gstin") or "").strip()
    pincode = (detail.get("pincode") or "").strip()
    address_lines = detail.get("address") or []
    if state:
        block = _replace_tag_once(block, "STATENAME", state)
        block = _replace_tag_once(block, "PLACEOFSUPPLY", state)
    if gstin:
        block = _replace_tag_once(block, "PARTYGSTIN", gstin)
    if pincode:
        block = _replace_tag_once(block, "PARTYPINCODE", pincode)
    if address_lines:
        address_xml = "".join(f"<BASICBUYERADDRESS>{escape(a)}</BASICBUYERADDRESS>" for a in address_lines)
        block = re.sub(
            r"<BASICBUYERADDRESS\.LIST[^>]*>.*?</BASICBUYERADDRESS\.LIST>",
            f"<BASICBUYERADDRESS.LIST>{address_xml}</BASICBUYERADDRESS.LIST>",
            block, count=1, flags=re.DOTALL,
        )

    # Items and the accounting entries they post to - strip every original
    # inventory/ledger-entry block from the template and rebuild our own.
    # v1 scope: item(s) against a single ledger for the full amount, no
    # separate GST duty ledgers (CGST/SGST/round-off) yet.
    block = _strip_all_blocks(block, "ALLINVENTORYENTRIES.LIST")
    block = _strip_all_blocks(block, "LEDGERENTRIES.LIST")

    item_xml_parts = []
    total = 0.0
    for it in items:
        name = it["name"].strip()
        qty = abs(float(it.get("quantity") or 0))
        unit = (it.get("unit") or "").strip()
        rate = float(it.get("rate") or 0)
        amount = abs(float(it.get("amount") or (qty * rate)))
        total += amount
        # Confirmed live against real Sales/Purchase exports: qty stays
        # positive regardless of direction; AMOUNT follows the same
        # debit(-)/credit(+) sign convention as every ledger entry in this
        # file, just carried down onto the nested inventory/allocation too.
        signed_amount = -amount if is_debit_side else amount
        qty_str = f"{qty} {unit}".strip()
        item_xml_parts.append(f"""      <ALLINVENTORYENTRIES.LIST>
       <STOCKITEMNAME>{escape(name)}</STOCKITEMNAME>
       <ISDEEMEDPOSITIVE>{"Yes" if is_debit_side else "No"}</ISDEEMEDPOSITIVE>
       <RATE>{rate}{f"/{escape(unit)}" if unit else ""}</RATE>
       <AMOUNT>{signed_amount}</AMOUNT>
       <ACTUALQTY>{escape(qty_str)}</ACTUALQTY>
       <BILLEDQTY>{escape(qty_str)}</BILLEDQTY>
       <ACCOUNTINGALLOCATIONS.LIST>
        <LEDGERNAME>{escape(item_ledger_name)}</LEDGERNAME>
        <ISDEEMEDPOSITIVE>{"Yes" if is_debit_side else "No"}</ISDEEMEDPOSITIVE>
        <AMOUNT>{signed_amount}</AMOUNT>
       </ACCOUNTINGALLOCATIONS.LIST>
      </ALLINVENTORYENTRIES.LIST>""")

    party_signed = total if is_debit_side else -total
    party_ledger_xml = f"""      <LEDGERENTRIES.LIST>
       <LEDGERNAME>{escape(party)}</LEDGERNAME>
       <ISDEEMEDPOSITIVE>{"No" if is_debit_side else "Yes"}</ISDEEMEDPOSITIVE>
       <AMOUNT>{party_signed}</AMOUNT>
      </LEDGERENTRIES.LIST>"""

    insertion = "\n".join(item_xml_parts) + "\n" + party_ledger_xml
    block = block.replace("</VOUCHER>", f"{insertion}\n     </VOUCHER>")
    return block, raw_date


async def create_item_voucher(data: dict) -> dict:
    """Sales/Purchase creation via clone-and-substitute (see module comment
    above create_voucher() for why a hand-built XML doesn't work here)."""
    voucher_type = (data.get("voucherType") or "").strip()
    block, template_party = await _fetch_voucher_template(voucher_type)

    # Identity: strip REMOTEID/VCHKEY (this is a fresh Create, not an Alter
    # of the template) and the template's own voucher number (omit it so
    # Tally auto-assigns the next one in series - keeping the original
    # number verbatim produces a duplicate, confirmed live).
    block = re.sub(r'\s+REMOTEID="[^"]*"', "", block, count=1)
    block = re.sub(r'\s+VCHKEY="[^"]*"', "", block, count=1)
    block = re.sub(r"<VOUCHERNUMBER>.*?</VOUCHERNUMBER>\s*", "", block, count=1, flags=re.DOTALL)

    block, raw_date = await _substitute_item_voucher_fields(data, voucher_type, block, template_party)
    await _send_voucher_import(block, expect="CREATED")
    return {"success": True, "voucherType": voucher_type, "date": raw_date}


async def update_item_voucher(data: dict) -> dict:
    """Sales/Purchase editing - clones the voucher's OWN current XML (not a
    generic template) and submits with ACTION="Alter" + the usual
    TAGNAME="Master Id" identification. Confirmed live: including the
    original REMOTEID/VCHKEY here makes Tally silently CREATE a duplicate
    instead of altering (it takes priority over TAGNAME/TAGVALUE matching),
    so they're stripped exactly as for Create."""
    voucher_type = (data.get("voucherType") or "").strip()
    original_date = (data.get("originalDate") or "").strip()
    master_id = (data.get("masterId") or "").strip()
    if not original_date or not master_id:
        raise TallyResponseError("originalDate and masterId are required to edit a voucher.")

    block, template_party = await _fetch_voucher_by_master_id(voucher_type, original_date, master_id)
    block = re.sub(r'\s+REMOTEID="[^"]*"', "", block, count=1)
    block = re.sub(r'\s+VCHKEY="[^"]*"', "", block, count=1)
    block = block.replace(
        f'VCHTYPE="{voucher_type}" ACTION="Create"',
        f'DATE="{_tag_date(original_date)}" TAGNAME="Master Id" TAGVALUE="{escape(master_id)}" VCHTYPE="{voucher_type}" ACTION="Alter"',
        1,
    )

    block, raw_date = await _substitute_item_voucher_fields(data, voucher_type, block, template_party)
    await _send_voucher_import(block, expect="ALTERED")
    return {"success": True, "voucherType": voucher_type, "date": raw_date}


async def create_voucher(data: dict) -> dict:
    voucher_type = (data.get("voucherType") or "").strip()
    if not voucher_type:
        raise TallyResponseError("Voucher type is required.")
    if voucher_type in ("Sales", "Purchase"):
        return await create_item_voucher(data)
    if voucher_type in ("Credit Note", "Debit Note"):
        raise TallyResponseError(
            f"Creating {voucher_type} vouchers isn't supported yet - this company has no "
            f"existing {voucher_type} to use as a template."
        )
    body = await _voucher_body_xml(data, voucher_type)
    inner = f"""     <VOUCHER VCHTYPE="{escape(voucher_type)}" ACTION="Create">
{body}
     </VOUCHER>"""
    await _send_voucher_import(inner, expect="CREATED")
    return {"success": True, "voucherType": voucher_type, "date": data.get("date")}


async def update_voucher(data: dict) -> dict:
    voucher_type = (data.get("voucherType") or "").strip()
    if not voucher_type:
        raise TallyResponseError("Voucher type is required.")
    if voucher_type in ("Sales", "Purchase"):
        return await update_item_voucher(data)
    if voucher_type in ("Credit Note", "Debit Note"):
        raise TallyResponseError(f"Editing {voucher_type} vouchers isn't supported yet.")
    original_date = (data.get("originalDate") or "").strip()
    master_id = (data.get("masterId") or "").strip()
    if not original_date or not master_id:
        raise TallyResponseError("originalDate and masterId are required to edit a voucher.")
    body = await _voucher_body_xml(data, voucher_type)
    inner = f"""     <VOUCHER DATE="{_tag_date(original_date)}" TAGNAME="Master Id" TAGVALUE="{escape(master_id)}" VCHTYPE="{escape(voucher_type)}" ACTION="Alter">
{body}
     </VOUCHER>"""
    await _send_voucher_import(inner, expect="ALTERED")
    return {"success": True, "voucherType": voucher_type, "date": data.get("date")}


async def delete_voucher(voucher_type: str, voucher_date: str, master_id: str) -> dict:
    # Identified by MASTERID rather than "Voucher Number" - confirmed live
    # that "Voucher Number" reliably works for Journal/Contra but silently
    # no-ops for a Sales voucher under "Automatic (Manual Override)"
    # numbering (reports DELETED>1 but nothing is actually removed).
    # MASTERID - Tally's own true internal id, already needed for the
    # Sales/Purchase cleanup during testing - worked 100% of the time across
    # every type tried, so it's used for both Alter and Delete here.
    voucher_type = (voucher_type or "").strip()
    voucher_date = (voucher_date or "").strip()
    master_id = (master_id or "").strip()
    if not voucher_type or not voucher_date or not master_id:
        raise TallyResponseError("voucherType, date and masterId are required to delete a voucher.")
    inner = f"""     <VOUCHER DATE="{_tag_date(voucher_date)}" TAGNAME="Master Id" TAGVALUE="{escape(master_id)}" VCHTYPE="{escape(voucher_type)}" ACTION="Delete">
     </VOUCHER>"""
    await _send_voucher_import(inner, expect="DELETED")
    return {"success": True}
