// SecurityNotes.tsx — pin toggle icon, read-only cards, size filter, IDB-backed
import React from "react";
import funnyGhostIcon from "../../../public/funny-ghost.svg";
import { ghostkeysStorage } from "../../storage/IDBService.ts";
import { useIdentitySystem } from "../../utility/identity";
import GKFormModal from "./GKFormModal";

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
  const { currentProfile } = useIdentitySystem();
  const userId = currentProfile.principal.toString();
  const vaultId = "default";

  const modelRef = React.useRef<{ notes: Note[] }>({ notes: [] });
  const [tick, setTick] = React.useState(0);
  const rerender = () => setTick((t) => t + 1);

  const [q, setQ] = React.useState("");
  const [toast, setToast] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // size filter: small | medium | big
  const [viewSize, setViewSize] = React.useState<"small" | "medium" | "big">("medium");

  const [openAddNote, setOpenAddNote] = React.useState(false);
  const [editingNote, setEditingNote] = React.useState<Note | null>(null);

  React.useEffect(() => {
    (async () => {
      if (!userId) return;
      const raw = await ghostkeysStorage.getSecureNotes(userId, vaultId);
      modelRef.current.notes = (raw ?? []).map(deserializeNote);
      rerender();
    })();
  }, [userId]);

  async function saveNotesToIDB() {
    if (!userId) return;
    setSaving(true);
    try {
      const payload = modelRef.current.notes.map(serializeNote);
      await ghostkeysStorage.setSecureNotes(userId, vaultId, payload);
      notify("Saved");
    } finally {
      setSaving(false);
    }
  }

  function notify(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1200);
  }

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = modelRef.current.notes;
    const byPinned = (a: Note, b: Note) => Number(!!b.pinned) - Number(!!a.pinned);
    if (!needle) return [...list].sort(byPinned);
    return list
        .filter((n) => n.title.toLowerCase().includes(needle) || n.body.toLowerCase().includes(needle))
        .sort(byPinned);
  }, [q, tick]);

  // --- CRUD ---
  function addNoteViaModal(values: { title: string; body: string }) {
    const now = Date.now();
    const next: Note = {
      id: uid(),
      title: values.title?.trim() || "Untitled",
      body: values.body ?? "",
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    modelRef.current.notes = [next, ...modelRef.current.notes];
    setOpenAddNote(false);
    rerender();
    saveNotesToIDB();
  }

  function editNoteViaModal(values: { title: string; body: string }) {
    if (!editingNote) return;
    modelRef.current.notes = modelRef.current.notes.map((n) =>
        n.id === editingNote.id
            ? { ...n, title: values.title ?? n.title, body: values.body ?? n.body, updatedAt: Date.now() }
            : n
    );
    setEditingNote(null);
    rerender();
    saveNotesToIDB();
  }

  function deleteNote(id: string) {
    const n = modelRef.current.notes.find((x) => x.id === id);
    if (!n) return;
    if (!confirm(`Delete "${n.title}"?`)) return;
    modelRef.current.notes = modelRef.current.notes.filter((x) => x.id !== id);
    rerender();
    saveNotesToIDB();
  }

  async function copyNote(id: string) {
    const n = modelRef.current.notes.find((x) => x.id === id);
    if (!n) return;
    try {
      await navigator.clipboard.writeText(n.body);
      notify("Copied");
    } catch {
      notify("Copy failed");
    }
  }

  function togglePin(id: string) {
    modelRef.current.notes = modelRef.current.notes.map((x) =>
        x.id === id ? { ...x, pinned: !x.pinned, updatedAt: Date.now() } : x
    );
    rerender();
    saveNotesToIDB();
  }

  return (
      <section className="security-notes">
        <div className="security-notes-header">
          <div className="title-and-button">
            <img src={"/ghost-white.png"} alt={"logo"} className={"ghost-icon"} />
            <h1>Secure notes {saving ? "· Saving…" : ""}</h1>

            <div className="header-actions">
              <button className="gk-btn gk-btn-add" onClick={() => setOpenAddNote(true)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                Add
              </button>
              <button className="gk-btn gk-btn-save" onClick={saveNotesToIDB}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 16l4-4-4-4M7 12h14M13 20v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1"/></svg>
                Save
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="search-bar">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search notes…"
                aria-label="Search notes"
            />
          </div>

          {/* Size switcher (under search) */}
          <div className="notes-view-switch" role="group" aria-label="Notes size">
            {(["small", "medium", "big"] as const).map((sz) => (
                <button
                    key={sz}
                    className={`notes-size-btn ${viewSize === sz ? "is-active" : ""}`}
                    onClick={() => setViewSize(sz)}
                    aria-pressed={viewSize === sz}
                >
                  {sz === "small" ? "Small" : sz === "medium" ? "Medium" : "Big"}
                </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className={`notes-grid notes-size-${viewSize}`}>
          {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="ghost-float" style={{ fontSize: 64 }}>
                  <img src={funnyGhostIcon} />
                </div>
                <h2 style={{ marginBottom: 24 }}>No notes yet</h2>
                <button className="gk-btn gk-btn-add" onClick={() => setOpenAddNote(true)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                  Add
                </button>
              </div>
          ) : (
              filtered.map((n) => (
                  <article className="note-card" key={n.id}>
                    {/* Pin toggle in the corner (two states) */}
                    <button
                        className={`note-pin-toggle ${n.pinned ? "is-pinned" : ""}`}
                        title={n.pinned ? "Unpin" : "Pin"}
                        aria-label={n.pinned ? "Unpin note" : "Pin note"}
                        onClick={() => togglePin(n.id)}
                    >
                      {/* simple pin glyph */}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M12 17v5"/><path d="M5 8l14-4-4 14L5 8z"/>
                      </svg>
                    </button>

                    {/* Title (read-only) */}
                    <h4 className="note-title">{n.title}</h4>

                    {/* Body (read-only) */}
                    <p className="note-body">
                      {n.body}
                    </p>

                    {/* Actions */}
                    <div className="note-card-actions">
                      <button className="note-btn" onClick={() => copyNote(n.id)} title="Copy" aria-label="Copy note">Copy</button>
                      <button className="note-btn" onClick={() => setEditingNote(n)} title="Edit" aria-label="Edit note">Edit</button>
                      <button className="note-btn" onClick={() => deleteNote(n.id)} title="Delete" aria-label="Delete note">Delete</button>
                    </div>
                  </article>
              ))
          )}
        </div>

        {toast && (
            <div className="notes-toast" role="status" aria-live="polite" style={{ position: "fixed", right: 20, bottom: 20 }}>
              {toast}
            </div>
        )}

        {/* Modals */}
        <GKFormModal
            open={openAddNote}
            title="New secure note"
            description="Quickly jot down private info."
            onClose={() => setOpenAddNote(false)}
            okLabel="Create"
            fields={[
              { name: "title", label: "Title", placeholder: "e.g. Recovery steps", required: true },
              { name: "body",  label: "Note",  type: "textarea", placeholder: "Write your note…" },
            ]}
            onSubmit={(v) => addNoteViaModal({ title: v.title, body: v.body })}
        />
        <GKFormModal
            open={!!editingNote}
            title="Edit note"
            onClose={() => setEditingNote(null)}
            okLabel="Save"
            fields={[
              { name: "title", label: "Title", required: true, defaultValue: editingNote?.title },
              { name: "body",  label: "Note",  type: "textarea", defaultValue: editingNote?.body },
            ]}
            onSubmit={(v) => editNoteViaModal({ title: v.title, body: v.body })}
        />
      </section>
  );
}

/* ---------- IDB <-> UI serialization ---------- */
function deserializeNote(row: { id: string; content: string }): Note {
  try {
    const parsed = JSON.parse(row.content) as Partial<Note>;
    if (parsed && typeof parsed === "object" && ("title" in parsed || "body" in parsed)) {
      return {
        id: row.id,
        title: String(parsed.title ?? "Untitled"),
        body: String(parsed.body ?? ""),
        pinned: !!parsed.pinned,
        createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : Date.now(),
        updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
      };
    }
  } catch { /* legacy plain text fallback */ }
  const txt = row.content ?? "";
  const [first, ...rest] = txt.split(/\r?\n/);
  const title = (first || "Note").slice(0, 120);
  const body  = rest.join("\n");
  const now = Date.now();
  return { id: row.id, title, body, createdAt: now, updatedAt: now, pinned: false };
}

function serializeNote(n: Note): { id: string; content: string } {
  const payload = {
    title: n.title,
    body: n.body,
    pinned: !!n.pinned,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  };
  return { id: n.id, content: JSON.stringify(payload) };
}
