import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Project, Milestone, Risk, MeetingMinutes, AcceptanceForm, ProjectMember, User } from '@/types';
import { getProject, updateProject, getProjectMembers, addProjectMember, removeProjectMember } from '@/services/projectService';
import { getProjectMilestones } from '@/services/milestoneService';
import { getRisks } from '@/services/riskService';
import { getMeetings } from '@/services/meetingService';
import { getAcceptances } from '@/services/acceptanceService';
import { getUsers } from '@/services/dashboardService';
import { handleApiError } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import ProgressBar from '@/components/ProgressBar';
import Modal from '@/components/Modal';

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole, user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [meetings, setMeetings] = useState<MeetingMinutes[]>([]);
  const [acceptances, setAcceptances] = useState<AcceptanceForm[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<Project>>({});
  const [memberModal, setMemberModal] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('member');

  useEffect(() => {
    if (!id) return;
    fetchAllData();
  }, [id]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [projectData, milestonesData, risksData, meetingsData, acceptancesData, membersData, usersData] =
        await Promise.all([
          getProject(id!),
          getProjectMilestones(id!),
          getRisks({ project_id: id! }),
          getMeetings({ project_id: id! }),
          getAcceptances({ project_id: id! }),
          getProjectMembers(id!),
          getUsers(),
        ]);
      setProject(projectData);
      setMilestones(milestonesData.data);
      setRisks(risksData.data);
      setMeetings(meetingsData.data);
      setAcceptances(acceptancesData.data);
      setMembers(membersData);
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to fetch project data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await updateProject(id!, editData);
      setEditMode(false);
      fetchAllData();
    } catch (error) {
      alert(handleApiError(error));
    }
  };

  const handleAddMember = async () => {
    if (!newUserId) return;
    try {
      await addProjectMember(id!, newUserId, newMemberRole);
      setMemberModal(false);
      setNewUserId('');
      fetchAllData();
    } catch (error) {
      alert(handleApiError(error));
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('确定要移除该成员吗？')) return;
    try {
      await removeProjectMember(id!, memberId);
      fetchAllData();
    } catch (error) {
      alert(handleApiError(error));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!project) {
    return <div className="text-center py-12 text-gray-500">项目不存在</div>;
  }

  const tabs = [
    { key: 'overview', label: '概览' },
    { key: 'milestones', label: `里程碑 (${milestones.length})` },
    { key: 'risks', label: `风险项 (${risks.length})` },
    { key: 'meetings', label: `会议纪要 (${meetings.length})` },
    { key: 'acceptance', label: `验收单 (${acceptances.length})` },
    { key: 'members', label: `团队成员 (${members.length})` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/projects')}
            className="text-gray-500 hover:text-gray-700 mr-4"
          >
            ← 返回
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-gray-500">
              {project.code} · {project.customer_name}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <StatusBadge status={project.status} type="project" />
          {hasRole(['admin', 'manager']) && !editMode && (
            <button
              onClick={() => {
                setEditData(project);
                setEditMode(true);
              }}
              className="btn btn-secondary"
            >
              编辑
            </button>
          )}
        </div>
      </div>

      {editMode && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">编辑项目信息</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">项目名称</label>
              <input
                type="text"
                value={editData.name || ''}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">客户名称</label>
              <input
                type="text"
                value={editData.customer_name || ''}
                onChange={(e) => setEditData({ ...editData, customer_name: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">开始日期</label>
              <input
                type="date"
                value={editData.start_date || ''}
                onChange={(e) => setEditData({ ...editData, start_date: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">结束日期</label>
              <input
                type="date"
                value={editData.end_date || ''}
                onChange={(e) => setEditData({ ...editData, end_date: e.target.value })}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label">项目描述</label>
            <textarea
              value={editData.description || ''}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              rows={3}
              className="input"
            />
          </div>
          <div className="flex justify-end space-x-3 mt-4">
            <button onClick={() => setEditMode(false)} className="btn btn-secondary">
              取消
            </button>
            <button onClick={handleSave} className="btn btn-primary">
              保存
            </button>
          </div>
        </div>
      )}

      {!editMode && (
        <div className="card p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500">项目进度</p>
              <div className="mt-2">
                <ProgressBar progress={project.progress || 0} showLabel={true} size="md" />
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500">里程碑</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {project.completed_milestone_count || 0}/{project.milestone_count || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">项目经理</p>
              <p className="text-lg font-medium text-gray-900 mt-1">
                {project.project_manager?.real_name || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">项目周期</p>
              <p className="text-sm text-gray-900 mt-1">
                {project.start_date || '-'} ~ {project.end_date || '-'}
              </p>
            </div>
          </div>
          {project.description && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500 mb-2">项目描述</p>
              <p className="text-gray-700">{project.description}</p>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-lg font-semibold mb-4">里程碑进度</h4>
                <div className="space-y-3">
                  {milestones.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <span className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium mr-3">
                          {m.sequence}
                        </span>
                        <div>
                          <p className="font-medium">{m.name}</p>
                          <p className="text-sm text-gray-500">{m.planned_date}</p>
                        </div>
                      </div>
                      <StatusBadge status={m.status} type="milestone" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'milestones' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-semibold">里程碑列表</h4>
                <Link to="/milestones" className="text-primary-600 hover:text-primary-700 text-sm">
                  管理里程碑 →
                </Link>
              </div>
              <div className="space-y-3">
                {milestones.map((m) => (
                  <Link
                    key={m.id}
                    to={`/milestones/${m.id}`}
                    className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{m.name}</p>
                        <p className="text-sm text-gray-500">
                          计划: {m.planned_date || '未设置'}
                          {m.actual_date && ` · 实际: ${m.actual_date}`}
                        </p>
                      </div>
                      <StatusBadge status={m.status} type="milestone" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'risks' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-semibold">风险登记</h4>
                <Link to="/risks" className="text-primary-600 hover:text-primary-700 text-sm">
                  管理风险 →
                </Link>
              </div>
              <div className="space-y-3">
                {risks.map((r) => (
                  <Link
                    key={r.id}
                    to={`/risks/${r.id}`}
                    className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{r.title}</p>
                        <p className="text-sm text-gray-500 line-clamp-1">{r.description}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <StatusBadge status={r.level} type="risk" />
                        <StatusBadge status={r.status} type="risk" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'meetings' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-semibold">会议纪要</h4>
                <Link to="/meetings" className="text-primary-600 hover:text-primary-700 text-sm">
                  管理纪要 →
                </Link>
              </div>
              <div className="space-y-3">
                {meetings.map((m) => (
                  <Link
                    key={m.id}
                    to={`/meetings/${m.id}`}
                    className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{m.title}</p>
                        <p className="text-sm text-gray-500">
                          {m.meeting_date} · {m.location || '无地点'}
                        </p>
                      </div>
                      {m.attachment_path && (
                        <span className="text-xs text-primary-600">📎 有附件</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'acceptance' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-semibold">验收单</h4>
                <Link to="/acceptance" className="text-primary-600 hover:text-primary-700 text-sm">
                  管理验收 →
                </Link>
              </div>
              <div className="space-y-3">
                {acceptances.map((a) => (
                  <Link
                    key={a.id}
                    to={`/acceptance/${a.id}`}
                    className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{a.title}</p>
                        <p className="text-sm text-gray-500">
                          里程碑: {a.milestone?.name || '-'}
                        </p>
                      </div>
                      <StatusBadge status={a.status} type="acceptance" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-semibold">团队成员</h4>
                {hasRole(['admin', 'manager']) && (
                  <button onClick={() => setMemberModal(true)} className="btn btn-primary btn-sm">
                    + 添加成员
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-medium mr-3">
                        {member.user?.real_name?.[0] || '?'}
                      </div>
                      <div>
                        <p className="font-medium">{member.user?.real_name}</p>
                        <p className="text-sm text-gray-500">
                          {member.user?.email} · {member.role === 'manager' ? '项目经理' : '项目成员'}
                        </p>
                      </div>
                    </div>
                    {hasRole(['admin', 'manager']) && user?.id !== member.user_id && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        移除
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={memberModal}
        onClose={() => setMemberModal(false)}
        title="添加项目成员"
        footer={
          <>
            <button onClick={() => setMemberModal(false)} className="btn btn-secondary">
              取消
            </button>
            <button onClick={handleAddMember} className="btn btn-primary">
              添加
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">选择用户</label>
            <select
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              className="input"
            >
              <option value="">请选择用户</option>
              {users
                .filter((u) => !members.some((m) => m.user_id === u.id))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.real_name} ({u.username})
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="label">角色</label>
            <select
              value={newMemberRole}
              onChange={(e) => setNewMemberRole(e.target.value)}
              className="input"
            >
              <option value="member">项目成员</option>
              <option value="manager">项目经理</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProjectDetail;
