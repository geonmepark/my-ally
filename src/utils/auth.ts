import { Cookies } from 'react-cookie';
import { cookieNames } from '@/lib/client';

export function logout() {
  const cookies = new Cookies();
  cookies.remove(cookieNames.actName, { path: '/' });
  cookies.remove(cookieNames.rftName, { path: '/' });
  window.location.href = '/login';
}
