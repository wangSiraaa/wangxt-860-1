import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  total?: number;
  page?: number;
  pageSize?: number;
}

export const successResponse = <T>(
  res: Response,
  data?: T,
  message: string = '操作成功',
  statusCode: number = 200
) => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
  };
  return res.status(statusCode).json(response);
};

export const errorResponse = (
  res: Response,
  message: string,
  error?: string,
  statusCode: number = 400
) => {
  const response: ApiResponse = {
    success: false,
    message,
    error,
  };
  return res.status(statusCode).json(response);
};

export const paginatedResponse = <T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  pageSize: number,
  message: string = '查询成功'
) => {
  const response: ApiResponse<T[]> = {
    success: true,
    message,
    data,
    total,
    page,
    pageSize,
  };
  return res.status(200).json(response);
};

export const notFoundResponse = (res: Response, resource: string = '资源') => {
  return errorResponse(res, `${resource}不存在`, 'NOT_FOUND', 404);
};

export const unauthorizedResponse = (res: Response, message: string = '未授权访问') => {
  return errorResponse(res, message, 'UNAUTHORIZED', 401);
};

export const forbiddenResponse = (res: Response, message: string = '权限不足') => {
  return errorResponse(res, message, 'FORBIDDEN', 403);
};
