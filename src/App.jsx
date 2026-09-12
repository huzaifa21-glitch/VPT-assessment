import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { FieldWorkersPage } from './pages/FieldWorkersPage';
import { HouseholdsPage } from './pages/HouseholdsPage';
import { HouseholdDetailPage } from './pages/HouseholdDetailPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/field-workers" element={<FieldWorkersPage />} />
          <Route path="/households" element={<HouseholdsPage />} />
          <Route path="/households/:id" element={<HouseholdDetailPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
