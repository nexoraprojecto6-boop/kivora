import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "../features/auth/LoginPage.js";
import { RegisterPage } from "../features/auth/RegisterPage.js";

/**
 * Páginas de acesso (login e registo). O dashboard é outra página (/app), com o seu próprio CSS.
 * Qualquer outro endereço leva ao login, que por sua vez passa para o dashboard se houver sessão.
 */
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
