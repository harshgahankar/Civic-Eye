import AppRoutes from './routes/AppRoutes';
import { useRealtime } from './hooks/useRealtime';
import { useLiveAlerts } from './hooks/useLiveAlerts';

export default function App() {
  useRealtime();
  useLiveAlerts();
  return <AppRoutes />;
}
