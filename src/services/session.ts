// Ponto único de ligação ao backend. Troca só este ficheiro quando a API existir.
export type User = { name: string; email: string; avatar?: string };

// TODO backend: GET /api/auth/me
export async function getSession(): Promise<User> {
  return { name: "Utilizador", email: "user@kivora.ao" };
}

// TODO backend: POST /api/auth/logout
export async function logout(): Promise<void> {
  window.location.href = "/login";
}
