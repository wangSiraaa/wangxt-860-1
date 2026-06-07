import api from './api';
import { ApiResponse, Risk } from '@/types';

export interface RiskQueryParams {
  page?: number;
  page_size?: number;
  project_id?: string;
  level?: string;
  status?: string;
}

export const getRisks = async (params?: RiskQueryParams): Promise<{ data: Risk[]; total: number }> => {
  const response = await api.get<ApiResponse<Risk[]>>('/risks', { params });
  return {
    data: response.data.data || [],
    total: response.data.total || 0,
  };
};

export const getRisk = async (id: string): Promise<Risk> => {
  const response = await api.get<ApiResponse<Risk>>(`/risks/${id}`);
  return response.data.data as Risk;
};

export const createRisk = async (data: Partial<Risk>): Promise<Risk> => {
  const response = await api.post<ApiResponse<Risk>>('/risks', data);
  return response.data.data as Risk;
};

export const updateRisk = async (id: string, data: Partial<Risk>): Promise<Risk> => {
  const response = await api.put<ApiResponse<Risk>>(`/risks/${id}`, data);
  return response.data.data as Risk;
};

export const deleteRisk = async (id: string): Promise<void> => {
  await api.delete(`/risks/${id}`);
};

export const updateRiskStatus = async (id: string, status: string): Promise<Risk> => {
  const response = await api.patch<ApiResponse<Risk>>(`/risks/${id}/status`, { status });
  return response.data.data as Risk;
};
