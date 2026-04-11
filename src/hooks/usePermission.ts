'use client';

import useAuth from '@/hooks/useAuthToken';
import { cookieNames } from '@/lib/client';

export function usePermission() {
  const { decodedToken } = useAuth(cookieNames);
  const userPrivileges = decodedToken?.privileges || [];
  const userRole = decodedToken?.role;

  return {
    privileges: userPrivileges,
    role: userRole,
    hasPrivilege: (required: string) => userPrivileges.includes(required),
    hasAllPrivileges: (required: string[]) => required.every((p) => userPrivileges.includes(p)),
    hasAnyPrivilege: (required: string[]) => required.some((p) => userPrivileges.includes(p)),
    isSuper: userRole === 'SUPER',
    isAdmin: userRole === 'ADMIN',
  };
}
