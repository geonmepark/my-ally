import axios from 'axios';
import { Cookies } from 'react-cookie';
import type { TokenHandler } from './https';
import { getAccessTokenCookieOptions, getRefreshTokenCookieOptions } from '@/utils/cookies';

export interface CookieNamesConfig {
  actName: string;
  rftName: string;
}

export const createTokenHandler = (
  refreshUrl: string,
  { actName, rftName }: CookieNamesConfig,
): TokenHandler => {
  return {
    getAccessToken: () => new Cookies().get(actName) || null,

    refreshAccessToken: async () => {
      const cookies = new Cookies();
      const rf = cookies.get(rftName);
      if (!rf) throw new Error('No refresh token in cookies');

      const res = await axios.post(refreshUrl, { refreshToken: rf }, { timeout: 10_000 });
      const { accessToken, refreshToken: newRf } = res.data.data;

      cookies.set(actName, accessToken, getAccessTokenCookieOptions());
      cookies.set(rftName, newRf, getRefreshTokenCookieOptions());

      return accessToken;
    },

    onRefreshFail: () => {
      const c = new Cookies();
      c.remove(actName, { path: '/' });
      c.remove(rftName, { path: '/' });
    },
  };
};
