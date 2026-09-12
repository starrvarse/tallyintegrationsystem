import { useState } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import LedgersTab from "./components/LedgersTab";
import LedgerGroupsTab from "./components/LedgerGroupsTab";
import StockItemsTab from "./components/StockItemsTab";
import StockGroupsTab from "./components/StockGroupsTab";
import StockCategoriesTab from "./components/StockCategoriesTab";
import VoucherTypeTab from "./components/VoucherTypeTab";
import UnitsTab from "./components/UnitsTab";
import LedgerStatement from "./components/LedgerStatement";
import "./App.css";

const voucherTab = (id, label, voucherType) => ({
  id,
  label,
  section: "Vouchers",
  component: () => <VoucherTypeTab voucherType={voucherType} />,
});

const TABS = [
  { id: "ledgers", label: "Ledgers", component: LedgersTab, section: "Accounting" },
  { id: "ledgerGroups", label: "Ledger Groups", component: LedgerGroupsTab, section: "Accounting" },
  voucherTab("sales", "Sales", "Sales"),
  voucherTab("purchase", "Purchase", "Purchase"),
  voucherTab("receipt", "Receipt", "Receipt"),
  voucherTab("payment", "Payment", "Payment"),
  voucherTab("contra", "Contra", "Contra"),
  voucherTab("journal", "Journal", "Journal"),
  voucherTab("creditNote", "Credit Note", "Credit Note"),
  voucherTab("debitNote", "Debit Note", "Debit Note"),
  { id: "stock", label: "Stock Items", component: StockItemsTab, section: "Inventory" },
  { id: "stockGroups", label: "Stock Groups", component: StockGroupsTab, section: "Inventory" },
  { id: "stockCategories", label: "Stock Categories", component: StockCategoriesTab, section: "Inventory" },
  { id: "units", label: "Units", component: UnitsTab, section: "Inventory" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("ledgers");
  const [openLedger, setOpenLedger] = useState(null);
  const activeMeta = TABS.find((t) => t.id === activeTab) ?? TABS[0];
  const ActiveComponent = activeMeta.component;

  const selectTab = (tabId) => {
    setOpenLedger(null);
    setActiveTab(tabId);
  };

  return (
    <div className="shell">
      <Header />
      <div className="body">
        <Sidebar tabs={TABS} activeTab={activeTab} onSelect={selectTab} />
        <main className="content scroll-thin">
          {openLedger ? (
            <LedgerStatement ledger={openLedger} onBack={() => setOpenLedger(null)} />
          ) : (
            <>
              <div className="page-header-strip">
                <h2 className="page-title">
                  {activeMeta.label}
                  <span className="page-title-badge">{activeMeta.section}</span>
                </h2>
              </div>
              <ActiveComponent onOpenLedger={setOpenLedger} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
