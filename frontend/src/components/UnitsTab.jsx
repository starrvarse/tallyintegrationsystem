import { getUnits } from "../api";
import SimpleMasterTab from "./SimpleMasterTab";
import CreateUnitModal from "./CreateUnitModal";

const COLUMNS = [
  { key: "name", header: "Name" },
  {
    key: "type",
    header: "Type",
    render: (r) => <span className="pill">{r.isSimple ? "Simple" : "Compound"}</span>,
  },
  {
    key: "conversion",
    header: "Conversion",
    render: (r) =>
      !r.isSimple && r.baseUnit ? `1 ${r.name} = ${r.conversion} ${r.baseUnit}` : "-",
  },
  { key: "decimalPlaces", header: "Decimal Places", align: "right" },
  { key: "reportingUQC", header: "Reporting UQC (GST)" },
];

export default function UnitsTab() {
  return (
    <SimpleMasterTab
      fetcher={getUnits}
      columns={COLUMNS}
      searchPlaceholder="Search by unit name…"
      emptyMessage="No units found."
      createLabel="+ New Unit"
      CreateModal={CreateUnitModal}
    />
  );
}
