import { Navigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

const STAFF_ROLES = [
  'SUPER_ADMIN',
  'SUB_ADMIN',
  'ORDER_MANAGER',
  'INVENTORY_MANAGER',
  'DELIVERY_MANAGER',
  'DELIVERY_RIDER',
  'ACCOUNTANT',
  'SUPPORT_MANAGER',
  'SUPPORT_AGENT',
  'DELIVERY_SUPPORT',
  'PAYMENT_SUPPORT',
  'REFUND_MANAGER',
  'AI_MANAGER',
];

export default function AdminRoute({ children }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!STAFF_ROLES.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
