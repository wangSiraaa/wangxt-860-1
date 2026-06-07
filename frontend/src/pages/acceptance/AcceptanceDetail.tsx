import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AcceptanceForm, Project, Milestone } from '@/types';
import {
  getAcceptance,
  updateAcceptance,
  createAcceptance,
  submitAcceptance,
  reviewAcceptance,
  downloadAttachment,
} from '@/services/acceptanceService';
import { checkMilestoneCanAccept } from '@/services/milestoneService';
import { getProjects } from '@/services/projectService';
import { getProjectMilestones } from '@/services/milestoneService';
import { handleApiError } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';

const AcceptanceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [acceptance, setAcceptance] = useState<AcceptanceForm | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<AcceptanceForm>>({});
  const [editFile, setEditFile] = useState<File | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [newAcceptance, setNewAcceptance] = useState<Partial<AcceptanceForm>>({
    status: 'draft',
  });
  const [newFile, setNewFile] = useState<File | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [submitModal, setSubmitModal] = useState(false);
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<'accepted' | 'rejected'>('accepted');
  const [reviewComment, setReviewComment] = useState('');
  const [acceptCheck, setAcceptCheck] = useState<{ valid: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchData();
    if (id === 'new') {
      setCreateModal(true);
    }
  }, [id]);

  useEffect(() => {
    if (selectedProjectId) {
      fetchMilestones(selectedProjectId);
    } else {
      setMilestones([]);
    }
  }, [selectedProjectId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const projectsData = await getProjects();
      setProjects(projectsData.data);

      if (id && id !== 'new') {
        const acceptanceData = await getAcceptance(id);
        setAcceptance(acceptanceData);
        if (acceptanceData.project_id) {
          setSelectedProjectId(acceptanceData.project_id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMilestones = async (projectId: string) => {
    try {
      const milestonesData = await getProjectMilestones(projectId);
      setMilestones(milestonesData);
    } catch (error) {
      console.error('Failed to fetch milestones:', error);
    }
  };

  const handleSave = async () => {
    if (!id || id === 'new') return;
    try {
      const formData = new FormData();
      if (editData.project_id) formData.append('project_id', editData.project_id);
      if (editData.milestone_id) formData.append('milestone_id', editData.milestone_id);
      if (editData.title) formData.append('title', editData.title);
      if (editData.content) formData.append('content', editData.content);
      if (editFile) formData.append('attachment', editFile);

      await updateAcceptance(id, formData);
      setEditMode(false);
      setEditFile(null);
      fetchData();
    } catch (error) {
      alert(handleApiError(error));
    }
  };

  const handleCreate = async () => {
    try {
      const formData = new FormData();
      if (newAcceptance.project_id) formData.append('project_id', newAcceptance.project_id);
      if (newAcceptance.milestone_id) formData.append('milestone_id', newAcceptance.milestone_id);
      if (newAcceptance.title) formData.append('title', newAcceptance.title);
      if (newAcceptance.content) formData.append('content', newAcceptance.content);
      if (newFile) formData.append('attachment', newFile);

      await createAcceptance(formData);
      setCreateModal(false);
      setNewFile(null);
      navigate('/acceptance');
    } catch (error) {
      alert(handleApiError(error));
    }
  };

  const openSubmitModal = async () => {
    if (!acceptance) return;
    setAcceptCheck(null);
    if (acceptance.milestone_id) {
      const check = await checkMilestoneCanAccept(acceptance.milestone_id);
      setAcceptCheck(check);
    }
    setSubmitModal(true);
  };

  const handleSubmit = async () => {
    if (!acceptance) return;
    try {
      await submitAcceptance(acceptance.id);
      setSubmitModal(false);
      setAcceptCheck(null);
      fetchData();
    } catch (error) {
      alert(handleApiError(error));
    }
  };

  const handleReview = async () => {
    if (!acceptance) return;
    try {
      await reviewAcceptance(acceptance.id, reviewStatus, reviewComment);
      setReviewModal(false);
      setReviewComment('');
      fetchData();
    } catch (error) {
      alert(handleApiError(error));
    }
  };

  const handleDownload = async () => {
    if (!acceptance) return;
    try {
      await downloadAttachment(acceptance.id);
    } catch (error) {
      alert(handleApiError(error));
    }
  };

  if (loading && id !== 'new') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (id !== 'new' && !acceptance) {
    return <div className="text-center py-12 text-gray-500">验收单不存在</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/acceptance')}
            className="text-gray-500 hover:text-gray-700 mr-4"
          >
            ← 返回
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {id === 'new' ? '新建验收' : acceptance?.title}
            </h1>
            {id !== 'new' && (
              <p className="text-gray-500">{acceptance?.project?.name || '-'}</p>
            )}
          </div>
        </div>
        {id !== 'new' && acceptance && (
          <div className="flex items-center space-x-3">
            <StatusBadge status={acceptance.status} type="acceptance" />
            {acceptance.attachment_name && (
              <button onClick={handleDownload} className="btn btn-secondary">
                下载附件
              </button>
            )}
            {acceptance.status === 'draft' && hasRole(['admin', 'manager']) && !editMode && (
              <button
                onClick={() => {
                  setEditData(acceptance);
                  setEditMode(true);
                }}
                className="btn btn-secondary"
              >
                编辑
              </button>
            )}
            {acceptance.status === 'draft' && hasRole(['admin', 'manager']) && (
              <button onClick={openSubmitModal} className="btn btn-primary">
                提交验收
              </button>
            )}
            {acceptance.status === 'submitted' && hasRole(['admin']) && (
              <button
                onClick={() => {
                  setReviewStatus('accepted');
                  setReviewComment('');
                  setReviewModal(true);
                }}
                className="btn btn-primary"
              >
                审核
              </button>
            )}
          </div>
        )}
      </div>

      {id !== 'new' && editMode && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">编辑验收单</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">所属项目 *</label>
                <select
                  value={editData.project_id || ''}
                  onChange={(e) => {
                    setEditData({ ...editData, project_id: e.target.value });
                    setSelectedProjectId(e.target.value);
                  }}
                  className="input"
                >
                  <option value="">请选择项目</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">关联里程碑</label>
                <select
                  value={editData.milestone_id || ''}
                  onChange={(e) => setEditData({ ...editData, milestone_id: e.target.value })}
                  className="input"
                >
                  <option value="">请选择里程碑</option>
                  {milestones.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">验收标题 *</label>
              <input
                type="text"
                value={editData.title || ''}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">验收内容 *</label>
              <textarea
                value={editData.content || ''}
                onChange={(e) => setEditData({ ...editData, content: e.target.value })}
                rows={6}
                className="input"
              />
            </div>
            <div>
              <label className="label">附件文件</label>
              <input
                type="file"
                onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                className="input"
              />
              {editFile && <p className="text-sm text-gray-500 mt-1">已选择: {editFile.name}</p>}
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setEditMode(false);
                  setEditFile(null);
                }}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button onClick={handleSave} className="btn btn-primary">
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {id !== 'new' && !editMode && acceptance && (
        <div className="card p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <p className="text-sm text-gray-500">所属项目</p>
              <p className="text-lg font-medium text-gray-900 mt-1">
                {acceptance.project?.name || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">关联里程碑</p>
              <p className="text-lg font-medium text-gray-900 mt-1">
                {acceptance.milestone?.name || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">创建人</p>
              <p className="text-lg font-medium text-gray-900 mt-1">
                {acceptance.created_by_user?.real_name || '-'}
              </p>
            </div>
          </div>

          {acceptance.submitted_by_user && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-sm text-gray-500">提交人</p>
                <p className="text-gray-900 mt-1">
                  {acceptance.submitted_by_user?.real_name || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">提交时间</p>
                <p className="text-gray-900 mt-1">
                  {acceptance.submitted_at
                    ? new Date(acceptance.submitted_at).toLocaleString('zh-CN')
                    : '-'}
                </p>
              </div>
            </div>
            </div>
          )}

          {acceptance.reviewed_by_user && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-sm text-gray-500">审核人</p>
                <p className="text-gray-900 mt-1">
                  {acceptance.reviewed_by_user?.real_name || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">审核时间</p>
                <p className="text-gray-900 mt-1">
                  {acceptance.reviewed_at
                    ? new Date(acceptance.reviewed_at).toLocaleString('zh-CN')
                    : '-'}
                </p>
              </div>
            </div>
          )}

          {acceptance.review_comment && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-2">审核意见</p>
              <p className="text-gray-700">{acceptance.review_comment}</p>
            </div>
          )}

          {acceptance.attachment_name && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-2">附件</p>
              <button onClick={handleDownload} className="text-primary-600 hover:text-primary-800 underline">
                {acceptance.attachment_name}
              </button>
            </div>
          )}

          <div>
            <p className="text-sm text-gray-500 mb-2">验收内容</p>
            <div className="text-gray-700 whitespace-pre-wrap">{acceptance.content}</div>
          </div>
        </div>
      )}

      <Modal
        isOpen={createModal}
        onClose={() => {
          setCreateModal(false);
          setNewFile(null);
          navigate('/acceptance');
        }}
        title="新建验收"
        footer={
          <>
            <button
              onClick={() => {
                setCreateModal(false);
                setNewFile(null);
                navigate('/acceptance');
              }}
              className="btn btn-secondary"
            >
              取消
            </button>
            <button onClick={handleCreate} className="btn btn-primary">
              保存
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">所属项目 *</label>
              <select
                value={newAcceptance.project_id || ''}
                onChange={(e) => {
                  setNewAcceptance({ ...newAcceptance, project_id: e.target.value });
                  setSelectedProjectId(e.target.value);
                }}
                className="input"
              >
                <option value="">请选择项目</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">关联里程碑</label>
              <select
                value={newAcceptance.milestone_id || ''}
                onChange={(e) =>
                  setNewAcceptance({ ...newAcceptance, milestone_id: e.target.value })
                }
                className="input"
              >
                <option value="">请选择里程碑</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">验收标题 *</label>
            <input
              type="text"
              value={newAcceptance.title || ''}
              onChange={(e) =>
                setNewAcceptance({ ...newAcceptance, title: e.target.value })
              }
              className="input"
              placeholder="请输入验收标题"
            />
          </div>
          <div>
            <label className="label">验收内容 *</label>
            <textarea
              value={newAcceptance.content || ''}
              onChange={(e) =>
                setNewAcceptance({ ...newAcceptance, content: e.target.value })
              }
              rows={4}
              className="input"
              placeholder="请输入验收内容"
            />
          </div>
          <div>
            <label className="label">附件文件</label>
            <input
              type="file"
              onChange={(e) => setNewFile(e.target.files?.[0] || null)}
              className="input"
            />
            {newFile && <p className="text-sm text-gray-500 mt-1">已选择: {newFile.name}</p>}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={submitModal}
        onClose={() => {
          setSubmitModal(false);
          setAcceptCheck(null);
        }}
        title="提交验收"
        footer={
          <>
            <button
              onClick={() => {
                setSubmitModal(false);
                setAcceptCheck(null);
              }}
              className="btn btn-secondary"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              className="btn btn-primary"
              disabled={acceptCheck !== null && !acceptCheck.valid}
            >
              确认提交
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            确定要提交验收 <span className="font-semibold">{acceptance?.title}</span> 吗？
          </p>
          {acceptCheck && !acceptCheck.valid && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 font-medium">⚠️ 无法提交验收</p>
              <p className="text-red-600 text-sm mt-1">{acceptCheck.message}</p>
            </div>
          )}
          {acceptCheck && acceptCheck.valid && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 font-medium">✅ 前置检查通过</p>
              <p className="text-green-600 text-sm mt-1">{acceptCheck.message}</p>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={reviewModal}
        onClose={() => setReviewModal(false)}
        title="审核验收"
        footer={
          <>
            <button
              onClick={() => setReviewModal(false)}
              className="btn btn-secondary"
            >
              取消
            </button>
            <button onClick={handleReview} className="btn btn-primary">
              确认审核
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-600">
          审核验收单：<span className="font-semibold">{acceptance?.title}</span>
        </p>
          <div>
            <label className="label">审核结果</label>
            <select
              value={reviewStatus}
              onChange={(e) => setReviewStatus(e.target.value as 'accepted' | 'rejected')}
              className="input"
            >
              <option value="accepted">通过</option>
              <option value="rejected">拒绝</option>
            </select>
          </div>
          <div>
            <label className="label">审核意见</label>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={3}
              className="input"
              placeholder="请输入审核意见"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AcceptanceDetail;
