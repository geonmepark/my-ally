'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useCookies } from 'react-cookie';
import { jwtDecode, JwtPayload } from 'jwt-decode';
import type { CookieNamesConfig } from '@/lib/tokenHandler';
import { TokenHandler } from '@/lib/client';
import { getAccessTokenCookieOptions, getRefreshTokenCookieOptions } from '@/utils/cookies';

export interface TokenType extends JwtPayload {
  adminUID: number;
  adminID: string;
  name: string;
  role: string;
  privileges: string[];
}

const REFRESH_BUFFER_MS = 60_000;

const useAuth = ({ actName, rftName }: CookieNamesConfig) => {
  const [cookies, setCookie, removeCookie] = useCookies([actName, rftName]);
  const [mounted, setMounted] = useState(false);
  const refreshingRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const accessToken = mounted ? cookies[actName] : undefined;
  const refreshToken = mounted ? cookies[rftName] : undefined;
  const decodedToken =
    mounted && accessToken ? jwtDecode<TokenType>(accessToken) : (null as TokenType | null);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      await TokenHandler.refreshAccessToken();
    } catch {
      /* onRefreshFail에서 쿠키 제거 */
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!decodedToken?.exp) return;
    const refreshIn = decodedToken.exp * 1000 - Date.now() - REFRESH_BUFFER_MS;
    if (refreshIn <= 0) {
      refresh();
      return;
    }
    const timer = setTimeout(refresh, refreshIn);
    return () => clearTimeout(timer);
  }, [decodedToken?.exp, refresh]);

  const login = (tokens: { accessToken: string; refreshToken: string }) => {
    setCookie(actName, tokens.accessToken, getAccessTokenCookieOptions());
    setCookie(rftName, tokens.refreshToken, getRefreshTokenCookieOptions());
  };

  const logoutFn = () => {
    removeCookie(actName, { path: '/' });
    removeCookie(rftName, { path: '/' });
  };

  return { accessToken, refreshToken, decodedToken, login, logout: logoutFn };
};

export default useAuth;
