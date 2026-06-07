import api from './api';
import { ApiResponse, Project, ProjectMember } from '@/types';

export interface ProjectQueryParams {
  page?: number;
  page_size?: number;
  status?: string;
  keyword?: string;
  project_manager_id?: string;
}

export const getProjects = async (params?: ProjectQueryParams): Promise<{ data: Project[]; total: number }> => {
  const response = await api.get<ApiResponse<Project[]>>('/projects', { params });
  return {
    data: response.data.data || [],
    total: response.data.total || 0,
  };
};

export const getProject = async (id: string): Promise<Project> => {
  const response = await api.get<ApiResponse<Project>>(`/projects/${id}`);
  return response.data.data as Project;
};

export const createProject = async (data: Partial<Project>): Promise<Project> => {
  const response = await api.post<ApiResponse<Project>>('/projects', data);
  return response.data.data as Project;
};

export const updateProject = async (id: string, data: Partial<Project>): Promise<Project> => {
  const response = await api.put<ApiResponse<Project>>(`/projects/${id}`, data);
  return response.data.data as Project;
};

export const deleteProject = async (id: string): Promise<void> => {
  await api.delete(`/projects/${id}`);
};

export const updateProjectStatus = async (id: string, status: string): Promise<Project> => {
  const response = await api.patch<ApiResponse<Project>>(`/projects/${id}/status`, { status });
  return response.data.data as Project;
};

export const getProjectMembers = async (projectId: string): Promise<ProjectMember[]> => {
  const response = await api.get<ApiResponse<ProjectMember[]>>(`/projects/${projectId}/members`);
  return response.data.data || [];
};

export const addProjectMember = async (projectId: string, userId: string, role: string): Promise<ProjectMember> => {
  const response = await api.post<ApiResponse<ProjectMember>>(`/projects/${projectId}/members`, { user_id: userId, role });
  return response.data.data as ProjectMember;
};

export const removeProjectMember = async (projectId: string, memberId: string): Promise<void> => {
  await api.delete(`/projects/${projectId}/members/${memberId}`);
};
