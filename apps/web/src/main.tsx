import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App.js";
import { AuthProvider } from "./features/auth/AuthContext.js";
import { I18nProvider } from "./i18n/I18nProvider.js";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/access.css";

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado.");

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  </StrictMode>,
);
