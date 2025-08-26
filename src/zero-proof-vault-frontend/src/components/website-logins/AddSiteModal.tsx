import React from "react";
import GKModal from "../new-design/GKModal.tsx";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void; // returns the chosen/typed name
};

const PRESETS: Array<{ label: string; icon: string }> = [
  { label: "Google",   icon: "/google.png" },
  { label: "GitHub",   icon: "/github.jpeg" },
  { label: "AWS",      icon: "/aws.png" },
  { label: "Dropbox",  icon: "/dropbox.png" },
  { label: "Facebook", icon: "/facebook.png" },
  { label: "X",        icon: "/twitter.png" }, // use your X/Twitter asset
];

export default function AddSiteModal({ open, onClose, onCreate }: Props) {
  const [name, setName] = React.useState("");
  const [picked, setPicked] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) { setName(""); setPicked(null); }
  }, [open]);

  function choose(label: string) {
    setPicked(label);
    setName(label);
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const n = name.trim();
    if (!n) return;
    onCreate(n);
    onClose();
  }

  return (
      <GKModal
          open={open}
          onClose={onClose}
          title="Add website"
          description="Pick a popular site or type your own."
          width="sm"
          actions={
            <>
              <button className="gk-btn ghost" type="button" onClick={onClose}>Cancel</button>
              <button className="gk-btn primary" type="submit" form="add-site-form" disabled={!name.trim()}>Create</button>
            </>
          }
      >
        <form id="add-site-form" onSubmit={submit} className="gk-form gk-site-picker">
          <div className="site-preset-grid" role="listbox" aria-label="Preset websites">
            {PRESETS.map(p => (
                <button
                    key={p.label}
                    type="button"
                    role="option"
                    aria-selected={picked === p.label}
                    className={`preset-chip ${picked === p.label ? "is-active" : ""}`}
                    onClick={() => choose(p.label)}
                    title={p.label}
                >
                  <img src={p.icon} alt="" aria-hidden="true" />
                  <span>{p.label}</span>
                </button>
            ))}
          </div>

          <label className="gk-field">
            <span>Website name *</span>
            <input
                name="site"
                placeholder="e.g. Google"
                value={name}
                onChange={(e) => { setName(e.target.value); if (picked) setPicked(null); }}
                required
                autoFocus
            />
          </label>
        </form>
      </GKModal>
  );
}
