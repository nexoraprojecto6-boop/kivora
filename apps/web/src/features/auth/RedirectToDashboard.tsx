import { useEffect } from "react";
import { DASHBOARD_URL, redirectTo } from "../../services/navigation.js";

/** Com sessão iniciada, passa para o dashboard (página própria, com CSS isolado do login). */
export function RedirectToDashboard() {
  useEffect(() => {
    redirectTo(DASHBOARD_URL);
  }, []);
  return null;
}
