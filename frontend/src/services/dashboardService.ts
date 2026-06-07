import api from './api';
import { ApiResponse, DashboardStats, Project, Milestone, User } from '@/types';

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const response = await api.get<ApiResponse<DashboardStats>>('/dashboard/stats');
  return response.data.data as DashboardStats;
};

export const getProjectBoard = async (): Promise<Project[]> => {
  const response = await api.get<ApiResponse<Project[]>>('/dashboard/projects');
  return response.data.data || [];
};

export const getMilestoneTimeline = async (): Promise<Milestone[]> => {
  const response = await api.get<ApiResponse<Milestone[]>>('/dashboard/milestones');
  return response.data.data || [];
};

export const getUsers = async (): Promise<User[]> => {
  const response = await api.get<ApiResponse<User[]>>('/dashboard/users');
  return response.data.data || [];
};
