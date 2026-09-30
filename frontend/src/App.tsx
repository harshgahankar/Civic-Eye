import AppRoutes from './routes/AppRoutes';
import { useRealtime } from './hooks/useRealtime';

export default function App() {
  useRealtime();
  return <AppRoutes />;
}
