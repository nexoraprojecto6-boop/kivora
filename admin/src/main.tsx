import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App.js";
import { AuthProvider } from "./auth/AuthContext.js";
import { ToastProvider } from "./components/ui/Toast.js";
import "./styles/tokens.css";
import "./styles/admin.css";

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado.");

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
