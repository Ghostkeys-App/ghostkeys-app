// SecurityNotes.tsx
import React from "react";
import funnyGhostIcon from "../../../public/funny-ghost.svg";

type Note = {
  id: string;
  title: string;
  body: string;
  pinned?: boolean;
  createdAt: number;
  updatedAt: number;
};

const uid = () =>
    (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) +
    Date.now().toString(36);

export default function SecurityNotes(): JSX.Element {
  // Seed with a few example notes
  const [notes, setNotes] = React.useState<Note[]>([
    {
      id: uid(),
      title: "Recovery steps",
      body:
          "1) Use backup code from vault\n2) Disable lost device\n3) Re-enroll TOTP\n4) Test the flow",
      createdAt: Date.now() - 1000 * 60 * 60 * 24,
      updatedAt: Date.now() - 1000 * 60 * 60 * 6,
      pinned: true,
    },
    {
      id: uid(),
      title: "API key – staging",
      body: "sk-staging-…  (rotate monthly; lives in ICP vault)",
      createdAt: Date.now() - 1000 * 60 * 60 * 20,
      updatedAt: Date.now() - 1000 * 60 * 60 * 3,
    },
    {
      id: uid(),
      title: "SSH snippet",
      body: "ssh -i ~/.ssh/ghostkeys_ed25519 user@server",
      createdAt: Date.now() - 1000 * 60 * 60 * 10,
      updatedAt: Date.now() - 1000 * 60 * 60 * 2,
    },
  ]);

  const [q, setQ] = React.useState("");
  const [toast, setToast] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const n = q.trim().toLowerCase();
    const byPinned = (a: Note, b: Note) => Number(b.pinned) - Number(a.pinned);
    if (!n) return [...notes].sort(byPinned);
    return notes
        .filter(
            (it) =>
                it.title.toLowerCase().includes(n) ||
                it.body.toLowerCase().includes(n)
        )
        .sort(byPinned);
  }, [q, notes]);

  function notify(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1300);
  }

  function addNote() {
    const title = prompt("Title")?.trim() || "Untitled";
    const body = prompt("Note")?.trim() || "";
    const now = Date.now();
    setNotes((prev) => [
      { id: uid(), title, body, createdAt: now, updatedAt: now },
      ...prev,
    ]);
    notify("Note added");
  }

  function editNote(id: string) {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    const title = prompt("Edit title", n.title)?.trim();
    if (title == null) return;
    const body = prompt("Edit note", n.body)?.trim();
    if (body == null) return;
    setNotes((prev) =>
        prev.map((x) =>
            x.id === id ? { ...x, title, body, updatedAt: Date.now() } : x
        )
    );
    notify("Note updated");
  }

  function deleteNote(id: string) {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    if (!confirm(`Delete "${n.title}"?`)) return;
    setNotes((prev) => prev.filter((x) => x.id !== id));
    notify("Note deleted");
  }

  async function copyNote(id: string) {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    try {
      await navigator.clipboard.writeText(n.body);
      notify("Copied");
    } catch {
      notify("Copy failed");
    }
  }

  function togglePin(id: string) {
    setNotes((prev) =>
        prev.map((x) => (x.id === id ? { ...x, pinned: !x.pinned } : x))
    );
  }

  return (
      <section className="security-notes">
        <div className="security-notes-header">
          <div className={'title-and-button'}>
            <img src={'/ghost-white.png'} alt={'logo'} className={'ghost-icon'}></img>
            <h1>Secure notes</h1>


            <div className="header-actions">
              <button className="gk-btn gk-btn-add" onClick={addNote}>
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

        {/* Grid of sticky/notes */}
        <div className="notes-grid">
          {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="ghost-float" style={{fontSize: 64}}>
                  <img src={funnyGhostIcon}></img>
                </div>
                <h2 style={{marginBottom: 24}}>No notes yet</h2>
                <button className="gk-btn gk-btn-add" onClick={addNote}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M12 4v16m8-8H4"/>
                  </svg>
                  Add
                </button>
              </div>
          ) : (
              filtered.map((n, i) => (
                    <article
                        className="note-card"
                        key={n.id}
                    >
                      {n.pinned && (
                          <div className="note-pin-badge" title="Pinned">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 17v5"/><path d="M5 8l14-4-4 14L5 8z"/>
                            </svg>
                          </div>
                      )}
                      {/* Title */}
                      <input
                          aria-label="Note title"
                          value={n.title}
                          onChange={(e) =>
                              setNotes((prev) =>
                                  prev.map((x) =>
                                      x.id === n.id ? {...x, title: e.target.value} : x
                                  )
                              )
                          }
                          style={{
                            background: "transparent",
                            border: "none",
                            outline: "none",
                            color: "#fff",
                            fontWeight: 700,
                            marginBottom: 8,
                          }}
                      />

                      {/* Body */}
                      <textarea
                          aria-label="Note body"
                          value={n.body}
                          onChange={(e) =>
                              setNotes((prev) =>
                                  prev.map((x) =>
                                      x.id === n.id ? {...x, body: e.target.value} : x
                                  )
                              )
                          }
                          rows={6}
                      />

                      {/* Actions */}
                      <div className="note-card-actions">
                        <button
                            className="note-btn"
                            onClick={() => togglePin(n.id)}
                            title={n.pinned ? "Unpin" : "Pin"}
                            aria-label={n.pinned ? "Unpin note" : "Pin note"}
                        >
                          {/* pin / unpin icon */}
                          {n.pinned ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                                   fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 3l18 18"/>
                                <path d="M9.5 9.5L5 4l4-2 4 4 4 4-2 4-5.5-5.5L12 12l-1 7-2-2 1-5"/>
                              </svg>
                          ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                                   fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 17v5"/>
                                <path d="M5 8l14-4-4 14L5 8z"/>
                              </svg>
                          )}
                        </button>
                        <button
                            className="note-btn"
                            onClick={() => copyNote(n.id)}
                            title="Copy"
                            aria-label="Copy note"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                               stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2"/>
                            <path d="M5 15V5a2 2 0 0 1 2-2h10"/>
                          </svg>
                        </button>
                        <button
                            className="note-btn"
                            onClick={() => editNote(n.id)}
                            title="Edit"
                            aria-label="Edit note"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                               stroke="currentColor" strokeWidth="2">
                            <path d="M12 20h9"/>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                          </svg>
                        </button>
                        <button
                            className="note-btn"
                            onClick={() => deleteNote(n.id)}
                            title="Delete"
                            aria-label="Delete note"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                               stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path
                                d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                          </svg>
                        </button>
                      </div>
                    </article>
                ))
          )}
        </div>

        {toast && (
            <div
                className="notes-toast"
                role="status"
                aria-live="polite"
                style={{position: "fixed", right: 20, bottom: 20}}
            >
              {toast}
            </div>
        )}
      </section>
  );
}
