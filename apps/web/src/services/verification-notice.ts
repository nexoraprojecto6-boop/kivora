/**
 * Aviso «Conta em verificação»: a página /verify marca que os documentos acabaram de ser enviados
 * e o painel (/app, mesma origem) mostra o modal uma vez. Usa sessionStorage; se não estiver disponível, não faz nada.
 */
const KEY = "kivora:verification-submitted";

export function markVerificationSubmitted(): void {
  try {
    window.sessionStorage.setItem(KEY, "1");
  } catch {
    // armazenamento indisponível: o painel continua a mostrar a faixa «Conta a verificar»
  }
}

export function hasVerificationNotice(): boolean {
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function clearVerificationNotice(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignora
  }
}
