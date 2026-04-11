import { CookieNamesConfig, createTokenHandler } from './tokenHandler';
import { createProtectedApiClient, createPublicApiClient } from './https';

export const BASE_URL = process.env.NEXT_PUBLIC_API_URL as string;
const API_VERSION = '/api/v1';

export const cookieNames: CookieNamesConfig = {
  actName: 'cmact',
  rftName: 'cmrft',
};

export const TokenHandler = createTokenHandler(
  `${BASE_URL + API_VERSION}/auth/admin/token/refresh`,
  cookieNames,
);

export const protectedClient = createProtectedApiClient(BASE_URL + API_VERSION, TokenHandler);
export const publicClient = createPublicApiClient(BASE_URL + API_VERSION);
