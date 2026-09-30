import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import { AuthBrandMark } from '../pages/Auth/AuthShell';
import SplashPage from '../pages/Auth/SplashPage';
import LoginPage from '../pages/Auth/LoginPage';
import RegisterPage from '../pages/Auth/RegisterPage';
import CommandCenterPage from '../pages/CommandCenter/CommandCenterPage';
import LiveCamerasPage from '../pages/LiveCameras/LiveCamerasPage';
import IncidentDetailsPage from '../pages/Incidents/IncidentDetailsPage';
import MultiCameraTrackingPage from '../pages/MultiCameraTracking/MultiCameraTrackingPage';
import AnalyticsPage from '../pages/Analytics/AnalyticsPage';
import EmergencyResponsePage from '../pages/EmergencyResponse/EmergencyResponsePage';
import SettingsPage from '../pages/Settings/SettingsPage';
import { useAuthStore } from '../store/authStore';
import { loadConsoleSettings } from '../utils/settings';

/** Blocks the dashboard shell until a valid session exists. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-primary-container">
        <AuthBrandMark size="lg" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Keeps signed-in operators out of the auth screens. */
function PublicOnly({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (user) return <Navigate to={loadConsoleSettings().landing} replace />;
  return <>{children}</>;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public: auth flow (Splash → Login/Register → Dashboard) */}
        <Route path="/splash" element={<SplashPage />} />
        <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />

        {/* Protected: operator console */}
        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route path="/" element={<Navigate to="/splash" replace />} />
          <Route path="/command-center" element={<CommandCenterPage />} />
          <Route path="/cameras" element={<LiveCamerasPage />} />
          <Route path="/live-cameras" element={<LiveCamerasPage />} />
          <Route path="/incidents/:id" element={<IncidentDetailsPage />} />
          <Route path="/tracking" element={<MultiCameraTrackingPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/emergency" element={<EmergencyResponsePage />} />
          <Route path="/alerts" element={<EmergencyResponsePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/splash" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
