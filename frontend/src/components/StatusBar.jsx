import { useEffect, useState } from "react";
import { getStatus } from "../api";

export default function StatusBar() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  const refresh = () => {
    setError(null);
    getStatus()
      .then(setStatus)
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, []);

  const connected = status?.connected;

  return (
    <div className={`status-bar ${connected ? "ok" : "down"}`}>
      <span className={`dot ${connected ? "ok" : "down"}`} />
      {connected ? (
        <span className="status-text">
          <span>Connected</span> ·{" "}
          <strong className="status-company" title={status.company}>{status.company}</strong>
          {status.startingFrom && (
            <span className="muted status-fy"> ({status.startingFrom})</span>
          )}
        </span>
      ) : (
        <span className="status-text">{status?.error || error || "Checking Tally connection…"}</span>
      )}
      <button className="btn-link" onClick={refresh} title="Refresh connection status">refresh</button>
    </div>
  );
}
