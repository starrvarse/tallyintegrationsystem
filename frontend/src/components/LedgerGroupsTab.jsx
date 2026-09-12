import { createLedgerGroup, getLedgerGroups, updateLedgerGroup } from "../api";
import SimpleMasterTab from "./SimpleMasterTab";
import CreateGroupModal from "./CreateGroupModal";

const COLUMNS = [
  { key: "name", header: "Name" },
  { key: "parent", header: "Under" },
  {
    key: "nature",
    header: "Nature",
    render: (r) => <span className="pill">{r.nature}</span>,
  },
  { key: "affectsGrossProfit", header: "Affects Gross Profit", render: (r) => (r.affectsGrossProfit ? "Yes" : "No") },
  { key: "isSubledger", header: "Bill-wise / Subledger", render: (r) => (r.isSubledger ? "Yes" : "No") },
];

export default function LedgerGroupsTab() {
  return (
    <SimpleMasterTab
      fetcher={getLedgerGroups}
      columns={COLUMNS}
      searchPlaceholder="Search by group name…"
      emptyMessage="No ledger groups found."
      createLabel="+ New Ledger Group"
      CreateModal={CreateGroupModal}
      createModalProps={{
        title: "Create Ledger Group",
        fetchGroups: getLedgerGroups,
        createFn: createLedgerGroup,
        updateFn: updateLedgerGroup,
      }}
    />
  );
}
