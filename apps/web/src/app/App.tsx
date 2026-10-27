import { Navigate, Route, Routes } from "react-router-dom";
import { WelcomePage } from "../features/welcome/WelcomePage.js";
import { LoginPage } from "../features/auth/LoginPage.js";
import { RegisterPage } from "../features/auth/RegisterPage.js";

/**
 * Páginas de acesso (login e registo). O dashboard é outra página (/app), com o seu próprio CSS.
 * A raiz (/) é a página de boas-vindas; qualquer outro endereço leva até ela. O login passa para o dashboard se houver sessão.
 */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
