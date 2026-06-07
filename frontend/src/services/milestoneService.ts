import api from './api';
import { ApiResponse, Milestone } from '@/types';

export interface MilestoneQueryParams {
  page?: number;
  page_size?: number;
  project_id?: string;
  status?: string;
}

export const getMilestones = async (params?: MilestoneQueryParams): Promise<{ data: Milestone[]; total: number }> => {
  const response = await api.get<ApiResponse<Milestone[]>>('/milestones', { params });
  return {
    data: response.data.data || [],
    total: response.data.total || 0,
  };
};

export const getMilestone = async (id: string): Promise<Milestone> => {
  const response = await api.get<ApiResponse<Milestone>>(`/milestones/${id}`);
  return response.data.data as Milestone;
};

export const getProjectMilestones = async (projectId: string): Promise<Milestone[]> => {
  const response = await api.get<ApiResponse<Milestone[]>>(`/milestones`, { params: { project_id: projectId } });
  return response.data.data || [];
};

export const createMilestone = async (data: Partial<Milestone> & { predecessors?: string[] }): Promise<Milestone> => {
  const response = await api.post<ApiResponse<Milestone>>('/milestones', data);
  return response.data.data as Milestone;
};

export const updateMilestone = async (id: string, data: Partial<Milestone> & { predecessors?: string[] }): Promise<Milestone> => {
  const response = await api.put<ApiResponse<Milestone>>(`/milestones/${id}`, data);
  return response.data.data as Milestone;
};

export const deleteMilestone = async (id: string): Promise<void> => {
  await api.delete(`/milestones/${id}`);
};

export const updateMilestoneStatus = async (id: string, status: string): Promise<Milestone> => {
  const response = await api.patch<ApiResponse<Milestone>>(`/milestones/${id}/status`, { status });
  return response.data.data as Milestone;
};

export const checkMilestoneCanAccept = async (id: string): Promise<{ valid: boolean; message: string }> => {
  const response = await api.get<ApiResponse<{ valid: boolean; message: string }>>(`/milestones/${id}/can-accept`);
  return response.data.data as { valid: boolean; message: string };
};
