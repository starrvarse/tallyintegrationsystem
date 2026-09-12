import StatusBar from "./StatusBar";
import ThemeSwitcher from "./ThemeSwitcher";

export default function Header() {
  return (
    <header className="header">
      <div className="brand">
        <img src="/logo-icon.png" alt="" className="brand-mark" />
        <div className="brand-info">
          <span className="brand-name">
            Tally Integration System
            <span className="brand-badge">Gateway</span>
          </span>
        </div>
      </div>
      <div className="header-right">
        <ThemeSwitcher />
        <a className="docs-link" href="/docs.html" target="_blank" rel="noopener noreferrer">
          API Docs ↗
        </a>
        <StatusBar />
      </div>
    </header>
  );
}
