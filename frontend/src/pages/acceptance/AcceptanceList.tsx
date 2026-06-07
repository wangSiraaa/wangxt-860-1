import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AcceptanceForm, Project, Milestone } from '@/types';
import { getAcceptances, deleteAcceptance, submitAcceptance, reviewAcceptance, downloadAttachment } from '@/services/acceptanceService';
import { checkMilestoneCanAccept } from '@/services/milestoneService';
import { getProjects } from '@/services/projectService';
import { handleApiError } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';

const AcceptanceList: React.FC = () => {
  const [acceptances, setAcceptances] = useState<AcceptanceForm[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [submitModal, setSubmitModal] = useState<{ open: boolean; acceptance: AcceptanceForm | null }>({
    open: false,
    acceptance: null,
  });
  const [reviewModal, setReviewModal] = useState<{ open: boolean; acceptance: AcceptanceForm | null }>({
    open: false,
    acceptance: null,
  });
  const [reviewStatus, setReviewStatus] = useState<'accepted' | 'rejected'>('accepted');
  const [reviewComment, setReviewComment] = useState('');
  const [acceptCheck, setAcceptCheck] = useState<{ valid: boolean; message: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; acceptance: AcceptanceForm | null }>({
    open: false,
    acceptance: null,
  });
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  useEffect(() => {
    fetchData();
  }, [projectFilter, statusFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (projectFilter) params.project_id = projectFilter;
      if (statusFilter) params.status = statusFilter;
      const [acceptancesData, projectsData] = await Promise.all([
        getAcceptances(params),
        getProjects(),
      ]);
      setAcceptances(acceptancesData.data);
      setProjects(projectsData.data);
    } catch (error) {
      console.error('Failed to fetch acceptances:', error);
    } finally {
      setLoading(false);
    }
  };

  const openSubmitModal = async (acceptance: AcceptanceForm) => {
    setAcceptCheck(null);
    if (acceptance.milestone_id) {
      const check = await checkMilestoneCanAccept(acceptance.milestone_id);
      setAcceptCheck(check);
    }
    setSubmitModal({ open: true, acceptance });
  };

  const handleSubmit = async () => {
    if (!submitModal.acceptance) return;
    try {
      await submitAcceptance(submitModal.acceptance.id);
      setSubmitModal({ open: false, acceptance: null });
      setAcceptCheck(null);
      fetchData();
    } catch (error) {
      alert(handleApiError(error));
    }
  };

  const handleReview = async () => {
    if (!reviewModal.acceptance) return;
    try {
      await reviewAcceptance(reviewModal.acceptance.id, reviewStatus, reviewComment);
      setReviewModal({ open: false, acceptance: null });
      setReviewComment('');
      fetchData();
    } catch (error) {
      alert(handleApiError(error));
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.acceptance) return;
    try {
      await deleteAcceptance(deleteModal.acceptance.id);
      setDeleteModal({ open: false, acceptance: null });
      fetchData();
    } catch (error) {
      alert(handleApiError(error));
    }
  };

  const handleDownload = async (e: React.MouseEvent, acceptance: AcceptanceForm) => {
    e.stopPropagation();
    try {
      await downloadAttachment(acceptance.id);
    } catch (error) {
      alert(handleApiError(error));
    }
  };

  const columns = [
    {
      key: 'title',
      label: '验收标题',
      render: (row: AcceptanceForm) => (
        <div>
          <p className="font-medium text-gray-900">{row.title}</p>
          <p className="text-sm text-gray-500">{row.project?.name || '-'}</p>
        </div>
      ),
    },
    {
      key: 'milestone',
      label: '关联里程碑',
      width: '160px',
      render: (row: AcceptanceForm) => row.milestone?.name || '-',
    },
    {
      key: 'status',
      label: '状态',
      width: '100px',
      render: (row: AcceptanceForm) => <StatusBadge status={row.status} type="acceptance" />,
    },
    {
      key: 'submitted_by',
      label: '提交人',
      width: '100px',
      render: (row: AcceptanceForm) => row.submitted_by_user?.real_name || '-',
    },
    {
      key: 'submitted_at',
      label: '提交时间',
      width: '180px',
      render: (row: AcceptanceForm) =>
        row.submitted_at ? new Date(row.submitted_at).toLocaleString('zh-CN') : '-',
    },
    {
      key: 'attachment',
      label: '附件',
      width: '80px',
      render: (row: AcceptanceForm) =>
        row.attachment_name ? (
          <button
            onClick={(e) => handleDownload(e, row)}
            className="text-primary-600 hover:text-primary-800 text-sm underline"
          >
            下载
          </button>
        ) : (
          '-'
        ),
    },
    {
      key: 'actions',
      label: '操作',
      width: '280px',
      render: (row: AcceptanceForm) => (
        <div className="flex space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/acceptance/${row.id}`);
            }}
            className="text-primary-600 hover:text-primary-800 text-sm"
          >
            查看
          </button>
          {row.status === 'draft' && hasRole(['admin', 'manager']) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openSubmitModal(row);
              }}
              className="text-green-600 hover:text-green-800 text-sm"
            >
              提交
            </button>
          )}
          {row.status === 'submitted' && hasRole(['admin']) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setReviewModal({ open: true, acceptance: row });
                setReviewStatus('accepted');
                setReviewComment('');
              }}
              className="text-purple-600 hover:text-purple-800 text-sm"
            >
              审核
            </button>
          )}
          {hasRole(['admin']) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteModal({ open: true, acceptance: row });
              }}
              className="text-red-600 hover:text-red-800 text-sm"
            >
              删除
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">验收管理</h1>
        <button
          onClick={() => navigate('/acceptance/new')}
          className="btn btn-primary"
        >
          + 新建验收
        </button>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap gap-4">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="input w-[240px]"
          >
            <option value="">全部项目</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-[140px]"
          >
            <option value="">全部状态</option>
            <option value="draft">草稿</option>
            <option value="submitted">待审核</option>
            <option value="accepted">已通过</option>
            <option value="rejected">已拒绝</option>
          </select>
          <button onClick={fetchData} className="btn btn-secondary">
            搜索
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={acceptances}
        loading={loading}
        emptyMessage="暂无验收数据"
        rowLink={(row) => `/acceptance/${row.id}`}
      />

      <Modal
        isOpen={submitModal.open}
        onClose={() => {
          setSubmitModal({ open: false, acceptance: null });
          setAcceptCheck(null);
        }}
        title="提交验收"
        footer={
          <>
            <button
              onClick={() => {
                setSubmitModal({ open: false, acceptance: null });
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
            确定要提交验收 <span className="font-semibold">{submitModal.acceptance?.title}</span> 吗？
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
        isOpen={reviewModal.open}
        onClose={() => setReviewModal({ open: false, acceptance: null })}
        title="审核验收"
        footer={
          <>
            <button
              onClick={() => setReviewModal({ open: false, acceptance: null })}
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
            审核验收单：<span className="font-semibold">{reviewModal.acceptance?.title}</span>
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

      <Modal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, acceptance: null })}
        title="确认删除"
        footer={
          <>
            <button
              onClick={() => setDeleteModal({ open: false, acceptance: null })}
              className="btn btn-secondary"
            >
              取消
            </button>
            <button onClick={handleDelete} className="btn btn-danger">
              确认删除
            </button>
          </>
        }
      >
        <p className="text-gray-600">
          确定要删除验收单 <span className="font-semibold">{deleteModal.acceptance?.title}</span> 吗？
          此操作不可撤销。
        </p>
      </Modal>
    </div>
  );
};

export default AcceptanceList;
