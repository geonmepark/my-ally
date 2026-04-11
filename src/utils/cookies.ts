import type { CookieSetOptions } from 'universal-cookie';

export const getCookieOptions = (): CookieSetOptions => ({
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24,
});

export const getAccessTokenCookieOptions = (): CookieSetOptions => ({
  ...getCookieOptions(),
  maxAge: 60 * 10,
});

export const getRefreshTokenCookieOptions = (): CookieSetOptions => ({
  ...getCookieOptions(),
  maxAge: 60 * 60 * 24 * 7,
});
