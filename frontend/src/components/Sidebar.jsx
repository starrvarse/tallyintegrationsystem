const ICONS = {
  ledgers: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  ),
  vouchers: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2H4v20l2.5-1.5L9 22l2.5-1.5L14 22l2.5-1.5L19 22V7l-5-5H9Z" />
      <path d="M14 2v5h5" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  ),
  sales: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h2l2.4 12.4a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L21 8H6" />
      <circle cx="9" cy="20" r="1" fill="currentColor" stroke="none" />
      <circle cx="17" cy="20" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  purchase: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 3h-2l-2.4 12.4a2 2 0 0 1-2 1.6H7.4a2 2 0 0 1-2-1.6L3 8h15" />
      <circle cx="9" cy="20" r="1" fill="currentColor" stroke="none" />
      <circle cx="17" cy="20" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  receipt: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 6.5a3.5 3.5 0 0 0-3.5-2H10a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-3.5A3.5 3.5 0 0 1 7 14.5" />
    </svg>
  ),
  payment: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22v-20M7 5.5A3.5 3.5 0 0 1 10.5 3.5H14a3 3 0 0 1 0 6h-4a3 3 0 0 0 0 6h3.5a3.5 3.5 0 0 0 3.5-2" />
    </svg>
  ),
  contra: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 2 21 6l-4 4M3 6h18M7 22l-4-4 4-4M21 18H3" />
    </svg>
  ),
  journal: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
      <path d="M9 7h7M9 11h7" />
    </svg>
  ),
  creditNote: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2H4v20l2.5-1.5L9 22l2.5-1.5L14 22l2.5-1.5L19 22V7l-5-5H9Z" />
      <path d="M14 2v5h5" />
      <path d="m8.5 15 3-3M8.5 12h3v3" />
    </svg>
  ),
  debitNote: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2H4v20l2.5-1.5L9 22l2.5-1.5L14 22l2.5-1.5L19 22V7l-5-5H9Z" />
      <path d="M14 2v5h5" />
      <path d="m8.5 12 3 3M11.5 12v3h-3" />
    </svg>
  ),
  stock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  ),
  units: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 3v4M11 3v4M15 3v2M19 3v4" />
    </svg>
  ),
  ledgerGroups: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  stockGroups: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  ),
  stockCategories: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.42 0l8.58-8.58a1 1 0 0 0 0-1.42L12 2Z" />
      <circle cx="7" cy="7" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  ),
};

export default function Sidebar({ tabs, activeTab, onSelect }) {
  let lastSection = null;
  return (
    <aside className="sidebar">
      <nav>
        {tabs.map((tab) => {
          const showHeader = tab.section && tab.section !== lastSection;
          lastSection = tab.section;
          return (
            <div key={tab.id}>
              {showHeader && <div className="side-section">{tab.section}</div>}
              <button
                className={`side-link ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => onSelect(tab.id)}
              >
                <span className="side-icon">{ICONS[tab.id]}</span>
                {tab.label}
              </button>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
