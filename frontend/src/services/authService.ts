import api from './api';
import { LoginRequest, LoginResponse, ApiResponse, User } from '@/types';

export const login = async (data: LoginRequest): Promise<LoginResponse> => {
  const response = await api.post<ApiResponse<LoginResponse>>('/auth/login', data);
  return response.data.data as LoginResponse;
};

export const getProfile = async (): Promise<User> => {
  const response = await api.get<ApiResponse<User>>('/auth/profile');
  return response.data.data as User;
};

export const logout = (): void => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const saveAuthData = (token: string, user: User): void => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
};

export const getAuthData = (): { token: string | null; user: User | null } => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  return { token, user };
};

export const isAuthenticated = (): boolean => {
  const { token } = getAuthData();
  return !!token;
};
