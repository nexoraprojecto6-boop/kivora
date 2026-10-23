/** O dashboard é uma página própria (CSS isolado do login), por isso a passagem entre os dois é uma navegação completa. */
export const DASHBOARD_URL = "/app/";
export const LOGIN_URL = "/login";

export function redirectTo(url: string): void {
  window.location.replace(url);
}
