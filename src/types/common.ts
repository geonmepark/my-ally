export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
}

export interface PaginationDataProps {
  totalCount: number;
  currentPage: number;
  totalPages: number;
}

export interface PaginationApiResponse<T, K extends string = 'items'> {
  success: boolean;
  statusCode: number;
  message: string;
  data: PaginationDataProps & Record<K, T[]>;
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}
