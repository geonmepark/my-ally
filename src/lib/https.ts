import axios, { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import createAuthRefreshInterceptor from 'axios-auth-refresh';
import type { ApiError } from '@/types/common';

export interface TokenHandler {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string>;
  onRefreshFail?: () => void;
  headerName?: string;
  useBearer?: boolean;
  statusCodesToRefresh?: number[];
}

export function createProtectedApiClient(
  baseURL: string,
  tokenHandler: TokenHandler,
): AxiosInstance {
  const client = axios.create({ baseURL, timeout: 10_000 });

  const {
    getAccessToken,
    refreshAccessToken,
    onRefreshFail,
    headerName = 'Authorization',
    useBearer = true,
    statusCodesToRefresh = [401],
  } = tokenHandler;

  client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    let token = getAccessToken();
    const modifyConfig = { ...config };
    if (!token) {
      try {
        token = await refreshAccessToken();
      } catch {
        /* 401 safety net이 처리 */
      }
    }
    if (token && modifyConfig.headers) {
      modifyConfig.headers[headerName] = useBearer ? `Bearer ${token}` : token;
    }
    return modifyConfig;
  });

  createAuthRefreshInterceptor(
    client,
    async (failedReq) => {
      try {
        const newToken = await refreshAccessToken();
        failedReq.response.config.headers[headerName] = useBearer ? `Bearer ${newToken}` : newToken;
        return Promise.resolve();
      } catch (err) {
        onRefreshFail?.();
        return Promise.reject(err);
      }
    },
    { statusCodes: statusCodesToRefresh },
  );

  client.interceptors.response.use(
    (res: AxiosResponse) => res,
    (error: AxiosError) => {
      if (error.code === 'ECONNABORTED') {
        return Promise.reject({
          status: 0,
          code: 'TIMEOUT_ERROR',
          message: '요청이 제한 시간을 초과했습니다.',
        } satisfies ApiError);
      }
      if (!error.response) {
        return Promise.reject({
          status: 0,
          code: 'NETWORK_ERROR',
          message: '네트워크 오류가 발생했습니다.',
        } satisfies ApiError);
      }
      const status = error.response.status;
      const data = (error.response.data as Record<string, unknown>) ?? {};
      return Promise.reject({
        status,
        code: (data.code as string) || `HTTP_${status}`,
        message: (data.message as string) || '서버 오류가 발생했습니다.',
      } satisfies ApiError);
    },
  );

  return client;
}

export function createPublicApiClient(baseURL: string): AxiosInstance {
  const client = axios.create({ baseURL, timeout: 10_000 });

  client.interceptors.response.use(
    (res: AxiosResponse) => res,
    (error: AxiosError) => {
      if (error.code === 'ECONNABORTED') {
        return Promise.reject({
          status: 0,
          code: 'TIMEOUT_ERROR',
          message: '요청이 제한 시간을 초과했습니다.',
        } satisfies ApiError);
      }
      if (!error.response) {
        return Promise.reject({
          status: 0,
          code: 'NETWORK_ERROR',
          message: '네트워크 오류가 발생했습니다.',
        } satisfies ApiError);
      }
      const status = error.response.status;
      const data = (error.response.data as Record<string, unknown>) ?? {};
      return Promise.reject({
        status,
        code: (data.code as string) || `HTTP_${status}`,
        message: (data.message as string) || '서버 오류가 발생했습니다.',
      } satisfies ApiError);
    },
  );

  return client;
}
