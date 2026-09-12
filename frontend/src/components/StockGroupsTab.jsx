import { createStockGroup, getStockGroups, updateStockGroup } from "../api";
import SimpleMasterTab from "./SimpleMasterTab";
import CreateGroupModal from "./CreateGroupModal";

const COLUMNS = [
  { key: "name", header: "Name" },
  { key: "parent", header: "Under" },
];

export default function StockGroupsTab() {
  return (
    <SimpleMasterTab
      fetcher={getStockGroups}
      columns={COLUMNS}
      searchPlaceholder="Search by group name…"
      emptyMessage="No stock groups found."
      createLabel="+ New Stock Group"
      CreateModal={CreateGroupModal}
      createModalProps={{
        title: "Create Stock Group",
        fetchGroups: getStockGroups,
        createFn: createStockGroup,
        updateFn: updateStockGroup,
      }}
    />
  );
}
