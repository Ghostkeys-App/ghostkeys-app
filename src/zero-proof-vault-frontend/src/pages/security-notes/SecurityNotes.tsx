import React, {useMemo} from "react";
import funnyGhostIcon from "../../../public/funny-ghost.svg";
import GKFormModal from "../../components/modals/gk-form-modal/GKFormModal.tsx";
import {SecurityNote, Vault} from "../../utility/vault-provider/types.ts";
import {useVaultProviderActions, useVaultProviderState} from "../../utility/vault-provider";
import {toast} from "../../utility/toast";
import {copyToClipboard} from "../../utility/clipboard";

export default function SecurityNotes(): JSX.Element {
  const { currentVault } = useVaultProviderState();
  const { saveCurrentVaultDataToIDB, syncCurrentVaultWithBackend } = useVaultProviderActions();

  // UI-only states
  const [q, setQ] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [openAddNote, setOpenAddNote] = React.useState(false);
  const [editingNoteId, setEditingNoteId] = React.useState<number | null>(null);

  // Derived values
  const filteredSecurityNotes = React.useMemo(() => {
    const all = getVisibleNotes(currentVault);
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((n) => n.name.toLowerCase().includes(needle) || n.content.toLowerCase().includes(needle));
  }, [q, currentVault]);

  const editingNote: SecurityNote | null = useMemo(
      () => editingNoteId !== null ? filteredSecurityNotes[editingNoteId] : null,
      [editingNoteId, filteredSecurityNotes]
  );

  const synced = useMemo(
      () => currentVault?.synced,
      [currentVault]
  );

  function getVisibleNotes(vault: Vault | null) {
    let notes: SecurityNote[] = [];

    if (!vault?.data?.secure_notes?.length) {
      return [];
    }

    vault.data.secure_notes.forEach((note) => {
      let shallowNote = JSON.parse(JSON.stringify(note))

      if (note.name && note.content) {
        notes.push(shallowNote);
      }
    })

    return notes;
  }

  async function onAddSecurityNote(values: { title: string; body: string }) {
    if (!currentVault) {return}
    const newSecurityNote: SecurityNote = {name: values.title, content: values.body, x: editingNoteId || currentVault.data.secure_notes.length + 1, committed: false};
    await saveCurrentVaultDataToIDB({...currentVault.data, secure_notes: [newSecurityNote, ...currentVault.data.secure_notes]});
    setOpenAddNote(false);
    toast.success('Successfully added the note');
  }

  async function onEditSecurityNote(values: { title: string; body: string }) {
    if (!currentVault) return;
    if (editingNoteId === null) return;
    const currentSecurityNote: SecurityNote = currentVault.data.secure_notes[editingNoteId];
    const updatedSecurityNote: SecurityNote = {name: values.title, content: values.body, x: editingNoteId, committed: currentSecurityNote.committed};
    const updatedSecurityNotes: SecurityNote[] = filteredSecurityNotes.map((sn, i) => i == editingNoteId ? updatedSecurityNote : sn);

    await saveCurrentVaultDataToIDB({...currentVault.data, secure_notes: updatedSecurityNotes});
    setEditingNoteId(null);
    toast.success('Successfully updated the note');
  }

  async function deleteSecurityNote(idx: number) {
    if (!currentVault) return;
    const updatedSecurityNotes: SecurityNote[] = filteredSecurityNotes.filter((note, i) => {
      if (i == idx) {
        if (note.committed) {
          note.name = "";
          note.content = "";
        } else {
          return false;
        }
      }

      return true;
    });

    await saveCurrentVaultDataToIDB({...currentVault.data, secure_notes: updatedSecurityNotes});
    toast.success('Successfully deleted the note');
  }

  async function sync () {
    setSaving(true);

    try {
      await syncCurrentVaultWithBackend();
      toast.success('Successfully synced!');
    } catch (err) {
      toast.error('Could not sync with the ICP');
    } finally {
      setSaving(false);
    }
  }


  return (
      <section className={`security-notes ${saving ? 'saving' : ''}`}>
        <div className="security-notes-header">
          <div className="title-and-button">
            <img src={"/ghost-white.png"} alt={"logo"} className={"ghost-icon"} />
            <h1>Secure notes</h1>

            <div className="header-actions">
              <button className="gk-btn gk-btn-add" onClick={() => setOpenAddNote(true)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Add
              </button>
              <button className={`gk-btn gk-btn-save ${synced ? 'synced' : 'not-synced'}`} onClick={sync}>
                {(synced ? 'Synced' : 'Sync changes')}
              </button>
            </div>
          </div>

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

          {/*<div className="notes-view-switch" role="group" aria-label="Notes size">*/}
          {/*  {(["small", "medium", "big"] as const).map((sz) => (*/}
          {/*      <button*/}
          {/*          key={sz}*/}
          {/*          className={`notes-size-btn ${viewSize === sz ? "is-active" : ""}`}*/}
          {/*          onClick={() => setViewSize(sz)}*/}
          {/*          aria-pressed={viewSize === sz}*/}
          {/*      >*/}
          {/*        {sz === "small" ? "Small" : sz === "medium" ? "Medium" : "Big"}*/}
          {/*      </button>*/}
          {/*  ))}*/}
          {/*</div>*/}
        </div>

        <div className="notes-grid">
          {filteredSecurityNotes.length === 0 ? (
              <div className="empty-state">
                <div className="ghost-float"><img src={funnyGhostIcon} alt={'funny-ghost'}/></div>
                <div className={"empty-state-title"}>No notes yet</div>
                <button className="gk-btn gk-btn-add" onClick={() => setOpenAddNote(true)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  Add
                </button>
              </div>
          ) : (
              filteredSecurityNotes.map((n, idx) => (
                  <article className="note-card">
                    {/*<button*/}
                    {/*    className={`note-pin-toggle ${n.pinned ? "is-pinned" : ""}`}*/}
                    {/*    title={n.pinned ? "Unpin" : "Pin"}*/}
                    {/*    aria-label={n.pinned ? "Unpin note" : "Pin note"}*/}
                    {/*    onClick={() => togglePin(n.id)}*/}
                    {/*>*/}
                    {/*  /!* simple pin glyph *!/*/}
                    {/*  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">*/}
                    {/*    <path d="M12 17v5"/><path d="M5 8l14-4-4 14L5 8z"/>*/}
                    {/*  </svg>*/}
                    {/*</button>*/}

                    <h4 className="note-title">{n.name}</h4>
                    <p className="note-body">{n.content}</p>

                    <div className="note-card-actions">
                      <button className="note-btn" onClick={() => copyToClipboard(n.content)}>Copy</button>
                      <button className="note-btn" onClick={() => setEditingNoteId(idx)}>Edit</button>
                      <button className="note-btn" onClick={() => deleteSecurityNote(idx)}>Delete</button>
                    </div>
                  </article>
              ))
          )}
        </div>

        <GKFormModal
            open={openAddNote}
            title="New secure note"
            description="Quickly jot down private info."
            onClose={() => setOpenAddNote(false)}
            okLabel="Create"
            fields={[
              { name: "title", label: "Title", placeholder: "e.g. Recovery steps", required: true },
              { name: "body",  label: "Note",  type: "textarea", placeholder: "Write your note…", required: true },
            ]}
            onSubmit={(v) => onAddSecurityNote({ title: v.title, body: v.body })}
        />
        <GKFormModal
            open={!!editingNote}
            title="Edit note"
            onClose={() => setEditingNoteId(null)}
            okLabel="Save"
            fields={[
              { name: "title", label: "Title", required: true, defaultValue: editingNote?.name },
              { name: "body",  label: "Note",  type: "textarea", defaultValue: editingNote?.content },
            ]}
            onSubmit={(v) => onEditSecurityNote({ title: v.title, body: v.body })}
        />
      </section>
  );
}
