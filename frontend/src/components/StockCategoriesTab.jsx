import { createStockCategory, getStockCategories, updateStockCategory } from "../api";
import SimpleMasterTab from "./SimpleMasterTab";
import CreateGroupModal from "./CreateGroupModal";

const COLUMNS = [
  { key: "name", header: "Name" },
  { key: "parent", header: "Under" },
];

export default function StockCategoriesTab() {
  return (
    <SimpleMasterTab
      fetcher={getStockCategories}
      columns={COLUMNS}
      searchPlaceholder="Search by category name…"
      emptyMessage="No stock categories found."
      createLabel="+ New Stock Category"
      CreateModal={CreateGroupModal}
      createModalProps={{
        title: "Create Stock Category",
        fetchGroups: getStockCategories,
        createFn: createStockCategory,
        updateFn: updateStockCategory,
      }}
    />
  );
}
