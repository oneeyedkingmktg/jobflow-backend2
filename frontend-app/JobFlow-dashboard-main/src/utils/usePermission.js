import { useAuth } from '../AuthContext';

// Returns the effective permission level for a category.
// Admin and master always get 'edit' — permissions only gate role=user accounts.
// Unknown category or missing key defaults to 'hide'.
export function usePermission(category) {
  const { user } = useAuth();
  if (!user) return 'hide';
  if (user.role === 'master' || user.role === 'admin') return 'edit';
  return user.permissions?.[category] ?? 'hide';
}
