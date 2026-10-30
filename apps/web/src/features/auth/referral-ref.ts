/**
 * Código de convite vindo do link (?ref=). Guarda-se só durante a sessão do separador, para sobreviver à ida
 * login ↔ registo. É só uma indicação: quem decide se vale é o servidor (código inválido é ignorado).
 */
const KEY = "kivora.ref";
const FORMAT = /^[A-HJ-NP-Za-hj-np-z2-9]{8}$/;

export function rememberRef(search: string): void {
  const value = new URLSearchParams(search).get("ref")?.trim();
  if (!value || !FORMAT.test(value)) return;
  try {
    window.sessionStorage.setItem(KEY, value.toUpperCase());
  } catch {
    // sem armazenamento: o código só vale nesta página
  }
}

export function currentRef(search: string): string | undefined {
  rememberRef(search);
  try {
    return window.sessionStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function clearRef(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // nada a limpar
  }
}
