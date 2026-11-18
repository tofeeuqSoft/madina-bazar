import useAuthStore from '../../store/authStore';
import { can } from '../../utils/permissions';

export default function RequirePerm({ perms = [], children }) {
  const { user } = useAuthStore();
  if (!can(user, ...perms)) {
    return (
      <div className="text-center py-16">
        <h1 className="text-xl font-bold mb-2">Access denied</h1>
        <p className="text-sm text-gray-500">You do not have permission to perform this action.</p>
        <p className="text-xs text-gray-400 mt-1">Required: {perms.join(', ')}</p>
      </div>
    );
  }
  return children;
}
