import { useState } from "react";
import { ApiError } from "../../lib/api.js";
import { errorText } from "../../lib/labels.js";
import { Modal } from "./Modal.js";

/**
 * Confirmação de uma decisão (aprovar, rejeitar, banir…) com nota/motivo.
 * `noteRequired` bate com a API: rejeições exigem motivo de 3 a 500 caracteres.
 */
export function DecisionDialog({
  title,
  description,
  confirmLabel,
  tone = "primary",
  noteLabel = "Nota",
  noteRequired = false,
  noteHidden = false,
  onConfirm,
  onClose,
}: {
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger" | "success";
  noteLabel?: string;
  noteRequired?: boolean;
  noteHidden?: boolean;
  onConfirm: (note: string) => Promise<void>;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooShort = noteRequired && note.trim().length < 3;

  async function go() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(note.trim());
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? errorText(e.code) : errorText("INTERNAL_ERROR"));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={title}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose} disabled={busy} type="button">Cancelar</button>
          <button className={`btn btn--${tone}`} onClick={go} disabled={busy || tooShort} type="button">
            {busy ? "A processar…" : confirmLabel}
          </button>
        </>
      }
    >
      {description && <div className="modal__text">{description}</div>}
      {!noteHidden && (
        <label className="field">
          <span className="field__label">{noteLabel}{noteRequired ? " (obrigatório)" : " (opcional)"}</span>
          <textarea className="input" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      )}
      {error && <div className="alert alert--danger" role="alert">{error}</div>}
    </Modal>
  );
}
