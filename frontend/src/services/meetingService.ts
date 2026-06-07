import api from './api';
import { ApiResponse, MeetingMinutes } from '@/types';

export interface MeetingQueryParams {
  page?: number;
  page_size?: number;
  project_id?: string;
  keyword?: string;
}

export const getMeetings = async (params?: MeetingQueryParams): Promise<{ data: MeetingMinutes[]; total: number }> => {
  const response = await api.get<ApiResponse<MeetingMinutes[]>>('/meetings', { params });
  return {
    data: response.data.data || [],
    total: response.data.total || 0,
  };
};

export const getMeeting = async (id: string): Promise<MeetingMinutes> => {
  const response = await api.get<ApiResponse<MeetingMinutes>>(`/meetings/${id}`);
  return response.data.data as MeetingMinutes;
};

export const createMeeting = async (data: FormData): Promise<MeetingMinutes> => {
  const response = await api.post<ApiResponse<MeetingMinutes>>('/meetings', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data as MeetingMinutes;
};

export const updateMeeting = async (id: string, data: FormData): Promise<MeetingMinutes> => {
  const response = await api.put<ApiResponse<MeetingMinutes>>(`/meetings/${id}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data as MeetingMinutes;
};

export const deleteMeeting = async (id: string): Promise<void> => {
  await api.delete(`/meetings/${id}`);
};

export const downloadAttachment = async (id: string): Promise<void> => {
  const response = await api.get(`/meetings/${id}/download`, { responseType: 'blob' });
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
