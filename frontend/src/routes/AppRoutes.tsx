import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
