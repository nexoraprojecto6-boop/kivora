import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App.js"
import { AuthProvider } from "../features/auth/AuthContext.js"
import { I18nProvider } from "../i18n/I18nProvider.js"
import "./index.css"
import "./demo.css"

const root = document.getElementById("root")
if (!root) throw new Error("Elemento #root não encontrado.")

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </I18nProvider>
  </StrictMode>,
)
