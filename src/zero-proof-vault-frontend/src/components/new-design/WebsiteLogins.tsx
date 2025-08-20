import React from "react";
import { Copy, Edit2, Trash2, MoreVertical, Globe } from "lucide-react";
import funnyGhostIcon from "../../../public/funny-ghost.svg";

// Self-contained Website Logins view (no external props). Uses plain CSS classes
// expected in your stylesheet (see previous message for CSS).

export type LoginItem = {
  id: string;
  name: string;
  domain?: string;
  username: string;
  password?: string;
};

export default function WebsiteLogins(): JSX.Element {
  // --- Mock data ---
  const [items, setItems] = React.useState<LoginItem[]>([
    { id: crypto.randomUUID(), name: "Google", domain: "google.com", username: "nick@example.com", password: "p@55W0rd!" },
    { id: crypto.randomUUID(), name: "GitHub", domain: "github.com", username: "nick", password: "hunter2" },
    { id: crypto.randomUUID(), name: "AWS Console", domain: "aws.amazon.com", username: "nick.ireland", password: "Very$ecret123" },
    { id: crypto.randomUUID(), name: "Dropbox", domain: "dropbox.com", username: "nick.ireland", password: "Very$ecret123" },
    { id: crypto.randomUUID(), name: "Facebook", domain: "facebook.com", username: "nick.ireland", password: "Very$ecret123" },
    { id: crypto.randomUUID(), name: "Twitter", domain: "twitter.com", username: "nick.ireland", password: "Very$ecret123" },
  ]);

  const [q, setQ] = React.useState("");

  // --- Derived ---
  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((it) =>
        [it.name, it.username, it.domain]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(needle))
    );
  }, [q, items]);

  // --- Actions ---
  async function handleCopyPassword(id: string) {
    const it = items.find((x) => x.id === id);
    if (!it?.password) return;
    try {
      await navigator.clipboard.writeText(it.password);
      toast("Password copied");
    } catch (e) {
      console.error(e);
      toast("Could not copy");
    }
  }

  function handleAdd() {
    // ultra-minimal add flow with prompt()s for MVP
    const name = prompt("Website name (e.g. Google)")?.trim();
    if (!name) return;
    const domain = prompt("Domain (e.g. google.com)")?.trim() || undefined;
    const username = prompt("Username / Email")?.trim() || "";
    const password = prompt("Password (optional)")?.trim() || undefined;
    const next: LoginItem = { id: crypto.randomUUID(), name, domain, username, password };
    setItems((prev) => [next, ...prev]);
    toast("Login added");
  }

  function handleEdit(id: string) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const name = prompt("Edit name", it.name)?.trim();
    if (!name) return;
    const domain = prompt("Edit domain", it.domain ?? "")?.trim() || undefined;
    const username = prompt("Edit username", it.username)?.trim() || "";
    const password = prompt("Edit password (leave blank to keep)")?.trim();
    setItems((prev) =>
        prev.map((x) =>
            x.id === id ? { ...x, name, domain, username, password: password === "" ? x.password : password } : x
        )
    );
    toast("Login updated");
  }

  function handleDelete(id: string) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    if (!confirm(`Delete “${it.name}”?`)) return;
    setItems((prev) => prev.filter((x) => x.id !== id));
    toast("Login deleted");
  }

  // tiny toast helper
  const [toastMsg, setToastMsg] = React.useState<string | null>(null);
  function toast(msg: string) {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 1500);
  }

  return (
      <section className="website-logins">
        {/* Header */}
        <div className="website-logins-header">
          <div className={'title-and-button'}>
            <img src={'/ghost-white.png'} alt={'logo'} className={'ghost-icon'}></img>
            <h1>Website Logins</h1>


            <div className="header-actions">
              <button className="gk-btn gk-btn-add" onClick={handleAdd}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 4v16m8-8H4"/>
                </svg>
                Add
              </button>

              <button className="gk-btn gk-btn-export">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 4v8m0 0l-3-3m3 3l3-3m-9 8h12"/>
                </svg>
                Export
              </button>

              <button className="gk-btn gk-btn-save">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"/>
                </svg>
                Save
              </button>
            </div>
          </div>

          <div className="search-bar">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search logins…"
                aria-label="Search logins"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="website-logins-grid">
          {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="ghost-float" style={{fontSize: 64}}>
                  <img src={funnyGhostIcon}></img>
                </div>
                <h2 style={{marginBottom: 24}}>No logins yet</h2>
                <button className="gk-btn gk-btn-add" onClick={handleAdd}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M12 4v16m8-8H4"/>
                  </svg>
                  Add
                </button>
              </div>
          ) : (
              filtered.map((it) => (
                  <article key={it.id} className="login-card" aria-label={`${it.name} login`}>
                    <div style={{display: "flex", alignItems: "center", gap: 12}}>
                      <LogoFavicon domain={it.domain}/>
                      <div style={{flex: 1, minWidth: 0}}>
                        <h3 style={{ margin: 0, color: "#fff", fontSize: 16, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name}</h3>
                        <p style={{ margin: 0, color: "rgba(255,255,255,.7)", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.username}</p>
                      </div>
                      <button title="More" aria-label="More" style={btnIconStyle}>
                        <MoreVertical size={18} />
                      </button>
                    </div>

                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                      {it.password && (
                          <span style={{ letterSpacing: 3, color: "#fff" }}>{"•".repeat(10)}</span>
                      )}
                      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                        <IconButton label="Copy" onClick={() => handleCopyPassword(it.id)}><Copy size={14} /></IconButton>
                        <IconButton label="Edit" onClick={() => handleEdit(it.id)}><Edit2 size={14} /></IconButton>
                        <IconButton label="Delete" onClick={() => handleDelete(it.id)}><Trash2 size={14} /></IconButton>
                      </div>
                    </div>
                  </article>
              ))
          )}
        </div>

        {/* Toast */}
        {toastMsg && (
            <div style={toastStyle} role="status" aria-live="polite">{toastMsg}</div>
        )}
      </section>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick?: () => void; children: React.ReactNode }) {
  return (
      <button onClick={onClick} title={label} aria-label={label} style={btnChipStyle}>
        {children}
      </button>
  );
}

function LogoFavicon({ domain }: { domain?: string }) {
  if (domain == 'google.com') {
    return <img src={'/google.png'} alt="favicon" style={{ height: 40, width: 40, borderRadius: 12 }} />;
  }
  if (domain == 'github.com') {
    return <img src={'/github.jpeg'} alt="favicon" style={{ height: 40, width: 40, borderRadius: 12 }} />;
  }
  if (domain == 'aws.amazon.com') {
    return <img src={'/aws.png'} alt="favicon" style={{ height: 40, width: 40, borderRadius: 12 }} />;
  }
  if (domain == 'facebook.com') {
    return <img src={'/facebook.png'} alt="favicon" style={{ height: 40, width: 40, borderRadius: 12 }} />;
  }
  if (domain == 'dropbox.com') {
    return <img src={'/dropbox.png'} alt="favicon" style={{ height: 40, width: 40, borderRadius: 12 }} />;
  }
  if (domain == 'twitter.com') {
    return <img src={'/twitter.png'} alt="favicon" style={{ height: 40, width: 40, borderRadius: 12 }} />;
  }
  return (
      <div style={faviconBoxStyle}>
        <Globe size={18} />
      </div>
  );
}

// --- Inline style tokens for small bits (keeps CSS file clean) ---
const btnChipStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.85)",
  padding: 6,
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
};

const btnIconStyle: React.CSSProperties = {
  background: "rgba(255,255,255,.15)",
  color: "rgba(255,255,255,0.75)",
  padding: 6,
  borderRadius: 999,
  width: 30,
  height: 30,
  border: "none",
  cursor: "pointer",
};

const faviconBoxStyle: React.CSSProperties = {
  height: 40,
  width: 40,
  borderRadius: 12,
  background: "rgba(255,255,255,0.1)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "rgba(255,255,255,0.85)",
};

const toastStyle: React.CSSProperties = {
  position: "fixed",
  right: 20,
  bottom: 20,
  background: "rgba(17,24,39,0.9)",
  color: "#fff",
  padding: "10px 14px",
  borderRadius: 10,
  boxShadow: "0 10px 30px rgba(0,0,0,.25)",
};