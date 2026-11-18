import { Navigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

const ALLOWED = ['DELIVERY_RIDER', 'SUPER_ADMIN', 'DELIVERY_MANAGER', 'SUB_ADMIN'];

export default function RiderRoute({ children }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!ALLOWED.includes(user?.role)) return <Navigate to="/" replace />;
  return children;
}
