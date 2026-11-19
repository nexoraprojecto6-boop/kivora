/** Marca (por separador) que a sessão acabou de começar, para o painel mostrar as boas-vindas uma vez. */
export const WELCOME_KEY = "kivora:welcome"

export function markWelcome(): void {
  try {
    window.sessionStorage.setItem(WELCOME_KEY, "1")
  } catch {
    // armazenamento indisponível: simplesmente não há ecrã de boas-vindas
  }
}
