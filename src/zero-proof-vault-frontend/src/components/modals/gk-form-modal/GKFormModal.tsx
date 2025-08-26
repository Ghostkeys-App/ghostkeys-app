import React from "react";
import GKModal from "../gk-modal/GKModal.tsx";

export type GKField =
  | { name: string; label: string; placeholder?: string; type?: "text" | "password"; required?: boolean; autoComplete?: string; defaultValue?: string }
  | { name: string; label: string; placeholder?: string; type: "textarea"; required?: boolean; defaultValue?: string };

type Props = {
  open: boolean;
  title: string;
  description?: string;
  fields: GKField[];
  okLabel?: string;
  cancelLabel?: string;
  width?: "sm" | "md" | "lg";
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => void;
  extraActions?: React.ReactNode; // not a requirement to pass, made just for profile!
};

export default function GKFormModal({
  open,
  title,
  description,
  fields,
  okLabel = "Save",
  cancelLabel = "Cancel",
  width = "md",
  onClose,
  onSubmit,
  extraActions
}: Props) {
  const formRef = React.useRef<HTMLFormElement>(null);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const form = formRef.current!;
    const fd = new FormData(form);
    const values: Record<string, string> = {};
    fields.forEach((f) => {
      values[f.name] = String(fd.get(f.name) ?? "");
    });
    onSubmit(values);
  };

  return (
    <GKModal
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      width={width}
      initialFocusSelector="input, textarea"
      actions={
        <>
          {extraActions}
          <button className="gk-btn ghost" type="button" onClick={onClose}>
            {cancelLabel}
          </button>
          <button className="gk-btn primary" type="submit" form="gk-form-id">
            {okLabel}
          </button>
        </>
      }
    >
      <form id="gk-form-id" ref={formRef} onSubmit={submit} className="gk-form">
        {fields.map((f) => (
          <label key={f.name} className="gk-field">
            <span>{f.label}{(f as any).required ? " *" : ""}</span>
            {"type" in f && f.type === "textarea" ? (
              <textarea
                name={f.name}
                placeholder={f.placeholder}
                required={(f as any).required}
                defaultValue={(f as any).defaultValue}
                rows={6}
              />
            ) : (
              <input
                name={f.name}
                placeholder={f.placeholder}
                type={(f as any).type || "text"}
                required={(f as any).required}
                autoComplete={(f as any).autoComplete}
                defaultValue={(f as any).defaultValue}
              />
            )}
          </label>
        ))}
        {/* hidden submit to enable Enter key in inputs */}
        <button type="submit" style={{ display: "none" }} />
      </form>
    </GKModal>
  );
}
