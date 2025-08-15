// VaultSelector.tsx
import React from "react";

type Vault = {
  id: string;
  name: string;
  color: string;   // accent for tile (e.g. "#2F3A70")
  items: number;
  lastSync: string; // human text like "1h ago"
  emoji?: string;   // quick visual tag
};

export default function VaultSelector() {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [current, setCurrent] = React.useState("v1");

  // Mock vaults (tweak colors to your palette)
  const [vaults, setVaults] = React.useState<Vault[]>([
    { id: "v1", name: "Vault 1", color: "#2F3A70", items: 42, lastSync: "1h ago"},
    { id: "v2", name: "Personal", color: "#704481", items: 18, lastSync: "3h ago"},
    { id: "v3", name: "Work", color: "#EC748F", items: 73, lastSync: "5m ago"},
    { id: "v4", name: "Shared", color: "#FFD18D", items: 9,  lastSync: "yesterday"},
  ]);

  const active = vaults.find(v => v.id === current)!;

  const filtered = q.trim()
      ? vaults.filter(v => v.name.toLowerCase().includes(q.trim().toLowerCase()))
      : vaults;

  function selectVault(id: string) {
    setCurrent(id);
    setOpen(false);
  }

  function createVault() {
    const name = prompt("New vault name?")?.trim();
    if (!name) return;
    const id = crypto.randomUUID();
    setVaults(v => [{ id, name, color: "#22c55e", items: 0, lastSync: "now"}, ...v]);
    setCurrent(id);
    setOpen(false);
  }

  React.useEffect(() => {
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  return (
      <div className="gk-vault">
        {/* Toggle pill */}
        <button
            className="gk-vault-toggle"
            onClick={() => setOpen(s => !s)}
            aria-expanded={open}
            aria-haspopup="listbox"
        >
          <span className="gk-vault-dot" style={{ background: active.color }} />
          <span className="gk-vault-name">{active.name}</span>
          <span className="gk-vault-meta">{active.items} items · {active.lastSync}</span>
          <svg className={`gk-vault-caret ${open ? "is-open" : ""}`} viewBox="0 0 20 20" aria-hidden>
            <path d="M5 7l5 6 5-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {/* Flyout */}
        {open && (
            <>
              <div className="gk-vault-backdrop" onClick={() => setOpen(false)} />
              <div className="gk-vault-flyout" role="listbox" aria-label="Select vault">
                {/* Subtle header with search */}
                <div className="gk-vault-head">
                  <div className="gk-vault-title">
                    Vaults
                  </div>
                  <div className="gk-vault-search">
                    <svg viewBox="0 0 24 24" aria-hidden><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input
                        placeholder="Search vaults…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                  </div>
                </div>

                {/* Vault tiles */}
                <div className="gk-vault-grid">
                  {filtered.map(v => (
                      <button
                          key={v.id}
                          className={`gk-vault-tile ${v.id === current ? "is-active" : ""}`}
                          role="option"
                          aria-selected={v.id === current}
                          onClick={() => selectVault(v.id)}
                      >
                        <div className="gk-vault-spark" style={{ background: v.color }} />
                        <div className="gk-vault-info">
                          <div className="gk-vault-label">{v.name}</div>
                          <div className="gk-vault-sub">{v.items} items · {v.lastSync}</div>
                        </div>
                        <svg className="gk-vault-arrow" viewBox="0 0 20 20" aria-hidden>
                          <path d="M7 5l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </button>
                  ))}

                  {/* New vault CTA */}
                  <button className="gk-vault-new" onClick={createVault}>
                    <svg viewBox="0 0 24 24" aria-hidden style={{width: 24}}>
                      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    New vault
                  </button>
                </div>
              </div>
            </>
        )}
      </div>
  );
}