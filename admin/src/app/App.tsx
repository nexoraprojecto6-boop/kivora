import { Navigate, Route, Routes } from "react-router-dom";
import { AdminOnly, RequireStaff } from "../auth/RequireStaff.js";
import { LoginPage } from "../auth/LoginPage.js";
import { Layout } from "../components/Layout.js";
import { AgreementsPage } from "../pages/AgreementsPage.js";
import { AuditPage } from "../pages/AuditPage.js";
import { DashboardPage } from "../pages/DashboardPage.js";
import { DepositsPage } from "../pages/DepositsPage.js";
import { MethodsPage } from "../pages/MethodsPage.js";
import { PlansPage } from "../pages/PlansPage.js";
import { SubscriptionsPage } from "../pages/SubscriptionsPage.js";
import { SupportPage } from "../pages/SupportPage.js";
import { UserDetailPage } from "../pages/UserDetailPage.js";
import { UsersPage } from "../pages/UsersPage.js";
import { VerificationsPage } from "../pages/VerificationsPage.js";
import { WithdrawalsPage } from "../pages/WithdrawalsPage.js";

const admin = (el: React.ReactNode) => <AdminOnly>{el}</AdminOnly>;

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireStaff />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="depositos" element={admin(<DepositsPage />)} />
          <Route path="levantamentos" element={admin(<WithdrawalsPage />)} />
          <Route path="verificacoes" element={admin(<VerificationsPage />)} />
          <Route path="subscricoes" element={admin(<SubscriptionsPage />)} />
          <Route path="utilizadores" element={<UsersPage />} />
          <Route path="utilizadores/:id" element={<UserDetailPage />} />
          <Route path="planos" element={admin(<PlansPage />)} />
          <Route path="metodos" element={admin(<MethodsPage />)} />
          <Route path="acordos" element={admin(<AgreementsPage />)} />
          <Route path="suporte" element={<SupportPage />} />
          <Route path="auditoria" element={admin(<AuditPage />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
