import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import CommandCenterPage from '../pages/CommandCenter/CommandCenterPage';
import LiveCamerasPage from '../pages/LiveCameras/LiveCamerasPage';
import { IncidentsPage } from '../pages/Incidents/IncidentsPage';
import IncidentDetailsPage from '../pages/Incidents/IncidentDetailsPage';
import AIVerificationPage from '../pages/AIVerification/AIVerificationPage';
import MultiCameraTrackingPage from '../pages/MultiCameraTracking/MultiCameraTrackingPage';
import CrowdIntelligencePage from '../pages/CrowdIntelligence/CrowdIntelligencePage';
import BaggageDetectionPage from '../pages/BaggageDetection/BaggageDetectionPage';
import AnalyticsPage from '../pages/Analytics/AnalyticsPage';
import EmergencyResponsePage from '../pages/EmergencyResponse/EmergencyResponsePage';
import ResourcesPage from '../pages/Resources/ResourcesPage';
import SettingsPage from '../pages/Settings/SettingsPage';

function NotFound() {
  return (
    <div className="card card-pad mx-auto flex max-w-md flex-col items-center py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-secondary">
        <span className="material-symbols-outlined text-2xl">explore_off</span>
      </span>
      <h1 className="section-title pt-4 text-[22px]">Page not found</h1>
      <p className="pt-1 font-body-md text-on-surface-variant">
        The requested console view doesn&apos;t exist or was moved.
      </p>
      <Link
        to="/command-center"
        className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-secondary px-4 py-2 font-label-caps text-on-secondary hover:bg-blue-700 transition"
      >
        <span className="material-symbols-outlined text-[16px]">dashboard</span>
        BACK TO COMMAND CENTER
      </Link>
    </div>
  );
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/command-center" replace />} />
          <Route path="/command-center" element={<CommandCenterPage />} />
          <Route path="/cameras" element={<LiveCamerasPage />} />
          <Route path="/live-cameras" element={<LiveCamerasPage />} />
          <Route path="/incidents" element={<IncidentsPage />} />
          <Route path="/map" element={<IncidentsPage />} />
          <Route path="/incidents/:id" element={<IncidentDetailsPage />} />
          <Route path="/ai-verification" element={<AIVerificationPage />} />
          <Route path="/tracking" element={<MultiCameraTrackingPage />} />
          <Route path="/crowd" element={<CrowdIntelligencePage />} />
          <Route path="/baggage" element={<BaggageDetectionPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/emergency" element={<EmergencyResponsePage />} />
          <Route path="/alerts" element={<EmergencyResponsePage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
