import api from './api';
import { ApiResponse, AcceptanceForm } from '@/types';

export interface AcceptanceQueryParams {
  page?: number;
  page_size?: number;
  project_id?: string;
  milestone_id?: string;
  status?: string;
}

export const getAcceptances = async (params?: AcceptanceQueryParams): Promise<{ data: AcceptanceForm[]; total: number }> => {
  const response = await api.get<ApiResponse<AcceptanceForm[]>>('/acceptance', { params });
  return {
    data: response.data.data || [],
    total: response.data.total || 0,
  };
};

export const getAcceptance = async (id: string): Promise<AcceptanceForm> => {
  const response = await api.get<ApiResponse<AcceptanceForm>>(`/acceptance/${id}`);
  return response.data.data as AcceptanceForm;
};

export const createAcceptance = async (data: FormData): Promise<AcceptanceForm> => {
  const response = await api.post<ApiResponse<AcceptanceForm>>('/acceptance', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data as AcceptanceForm;
};

export const updateAcceptance = async (id: string, data: FormData): Promise<AcceptanceForm> => {
  const response = await api.put<ApiResponse<AcceptanceForm>>(`/acceptance/${id}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data as AcceptanceForm;
};

export const deleteAcceptance = async (id: string): Promise<void> => {
  await api.delete(`/acceptance/${id}`);
};

export const submitAcceptance = async (id: string): Promise<AcceptanceForm> => {
  const response = await api.patch<ApiResponse<AcceptanceForm>>(`/acceptance/${id}/submit`);
  return response.data.data as AcceptanceForm;
};

export const reviewAcceptance = async (id: string, status: string, review_comment?: string): Promise<AcceptanceForm> => {
  const response = await api.patch<ApiResponse<AcceptanceForm>>(`/acceptance/${id}/review`, {
    status,
    review_comment,
  });
  return response.data.data as AcceptanceForm;
};

export const downloadAttachment = async (id: string): Promise<void> => {
  const response = await api.get(`/acceptance/${id}/download`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  const contentDisposition = response.headers['content-disposition'];
  const filename = contentDisposition?.split('filename=')[1]?.replace(/"/g, '') || 'attachment';
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
