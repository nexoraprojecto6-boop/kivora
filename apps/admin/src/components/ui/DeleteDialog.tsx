import { useState } from "react";
import { ApiError } from "../../lib/api.js";
import { errorText } from "../../lib/labels.js";
import { Modal } from "./Modal.js";

/**
 * Confirmação para apagar de vez (plano, método…). A ação não se desfaz.
 * Se a API responder "inUse" (já há dados ligados), mostra `inUseText` em vez de um erro genérico.
 */
export function DeleteDialog({
  title,
  name,
  description,
  inUseText,
  onConfirm,
  onClose,
}: {
  title: string;
  name: string;
  description?: React.ReactNode;
  inUseText: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors.some((f) => f.code === "inUse")) setError(inUseText);
      else setError(errorText(e instanceof ApiError ? e.code : "INTERNAL_ERROR"));
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
          <button className="btn btn--danger" onClick={() => void go()} disabled={busy || error === inUseText} type="button">
            {busy ? "A apagar…" : "Apagar definitivamente"}
          </button>
        </>
      }
    >
      <div className="modal__text">
        <p>Vai apagar <strong>{name}</strong>. Esta ação não se pode desfazer.</p>
        {description}
      </div>
      {error && <div className="alert alert--danger" role="alert">{error}</div>}
    </Modal>
  );
}
