export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'member';
  real_name: string;
  phone?: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  customer_name: string;
  description?: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  start_date?: string;
  end_date?: string;
  project_manager_id?: string;
  project_manager?: User;
  created_by: string;
  created_by_user?: User;
  created_at: string;
  updated_at: string;
  progress?: number;
  member_count?: number;
  milestone_count?: number;
  completed_milestone_count?: number;
}

export interface Milestone {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  planned_date?: string;
  actual_date?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed' | 'cancelled';
  sequence: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  predecessors?: Milestone[];
  successors?: Milestone[];
  project?: Project;
}

export interface Risk {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  level: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'mitigating' | 'resolved' | 'closed';
  mitigation_measure?: string;
  created_by: string;
  created_by_user?: User;
  created_at: string;
  updated_at: string;
  project?: Project;
}

export interface MeetingMinutes {
  id: string;
  project_id: string;
  title: string;
  meeting_date: string;
  location?: string;
  content: string;
  attendees?: string;
  attachment_path?: string;
  attachment_name?: string;
  created_by: string;
  created_by_user?: User;
  created_at: string;
  updated_at: string;
  project?: Project;
}

export interface AcceptanceForm {
  id: string;
  project_id: string;
  milestone_id: string;
  title: string;
  content: string;
  status: 'draft' | 'submitted' | 'accepted' | 'rejected';
  submitted_by?: string;
  submitted_by_user?: User;
  submitted_at?: string;
  reviewed_by?: string;
  reviewed_by_user?: User;
  reviewed_at?: string;
  review_comment?: string;
  attachment_path?: string;
  attachment_name?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  milestone?: Milestone;
  project?: Project;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  code?: string;
  data?: T;
  total?: number;
  page?: number;
  page_size?: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface DashboardStats {
  total_projects: number;
  in_progress_projects: number;
  completed_projects: number;
  total_milestones: number;
  completed_milestones: number;
  delayed_milestones: number;
  total_risks: number;
  high_risks: number;
  open_risks: number;
  pending_acceptances: number;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  user?: User;
}
