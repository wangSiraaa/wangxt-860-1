import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Milestone, Project } from '@/types';
import { getMilestones, updateMilestoneStatus, deleteMilestone, checkMilestoneCanAccept } from '@/services/milestoneService';
import { getProjects } from '@/services/projectService';
import { handleApiError } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';

const MilestoneList: React.FC = () => {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [statusModal, setStatusModal] = useState<{ open: boolean; milestone: Milestone | null }>({
    open: false,
    milestone: null,
  });
  const [newStatus, setNewStatus] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; milestone: Milestone | null }>({
    open: false,
    milestone: null,
  });
  const [acceptCheck, setAcceptCheck] = useState<{ valid: boolean; message: string } | null>(null);
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
      const [milestonesData, projectsData] = await Promise.all([
        getMilestones(params),
        getProjects(),
      ]);
      setMilestones(milestonesData.data);
      setProjects(projectsData.data);
    } catch (error) {
      console.error('Failed to fetch milestones:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!statusModal.milestone || !newStatus) return;

    if (newStatus === 'completed') {
      const check = await checkMilestoneCanAccept(statusModal.milestone.id);
      if (!check.valid) {
        setAcceptCheck(check);
        return;
      }
    }

    try {
      await updateMilestoneStatus(statusModal.milestone.id, newStatus);
      setStatusModal({ open: false, milestone: null });
      setAcceptCheck(null);
      fetchData();
    } catch (error) {
      alert(handleApiError(error));
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.milestone) return;
    try {
      await deleteMilestone(deleteModal.milestone.id);
      setDeleteModal({ open: false, milestone: null });
      fetchData();
    } catch (error) {
      alert(handleApiError(error));
    }
  };

  const columns = [
    {
      key: 'sequence',
      label: '序号',
      width: '80px',
      render: (row: Milestone) => (
        <span className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium">
          {row.sequence}
        </span>
      ),
    },
    {
      key: 'name',
      label: '里程碑名称',
      render: (row: Milestone) => (
        <div>
          <p className="font-medium text-gray-900">{row.name}</p>
          <p className="text-sm text-gray-500">{row.project?.name || '-'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: '状态',
      width: '100px',
      render: (row: Milestone) => <StatusBadge status={row.status} type="milestone" />,
    },
    {
      key: 'planned_date',
      label: '计划日期',
      width: '120px',
    },
    {
      key: 'actual_date',
      label: '实际日期',
      width: '120px',
      render: (row: Milestone) => row.actual_date || '-',
    },
    {
      key: 'predecessors',
      label: '前置依赖',
      width: '150px',
      render: (row: Milestone) => {
        if (!row.predecessors || row.predecessors.length === 0) return '-';
        return row.predecessors.map((p) => p.name).join(', ');
      },
    },
    {
      key: 'actions',
      label: '操作',
      width: '200px',
      render: (row: Milestone) => (
        <div className="flex space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/milestones/${row.id}`);
            }}
            className="text-primary-600 hover:text-primary-800 text-sm"
          >
            查看
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setStatusModal({ open: true, milestone: row });
              setNewStatus(row.status);
              setAcceptCheck(null);
            }}
            className="text-green-600 hover:text-green-800 text-sm"
          >
            状态
          </button>
          {hasRole(['admin']) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteModal({ open: true, milestone: row });
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
        <h1 className="text-2xl font-bold text-gray-900">里程碑维护</h1>
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
            className="input w-[180px]"
          >
            <option value="">全部状态</option>
            <option value="pending">待开始</option>
            <option value="in_progress">进行中</option>
            <option value="completed">已完成</option>
            <option value="delayed">已延期</option>
            <option value="cancelled">已取消</option>
          </select>
          <button onClick={fetchData} className="btn btn-secondary">
            搜索
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={milestones}
        loading={loading}
        emptyMessage="暂无里程碑数据"
        rowLink={(row) => `/milestones/${row.id}`}
      />

      <Modal
        isOpen={statusModal.open}
        onClose={() => {
          setStatusModal({ open: false, milestone: null });
          setAcceptCheck(null);
        }}
        title="变更里程碑状态"
        footer={
          <>
            <button
              onClick={() => {
                setStatusModal({ open: false, milestone: null });
                setAcceptCheck(null);
              }}
              className="btn btn-secondary"
            >
              取消
            </button>
            <button
              onClick={handleStatusChange}
              className="btn btn-primary"
              disabled={newStatus === 'completed' && acceptCheck && !acceptCheck.valid}
            >
              确认
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {acceptCheck && !acceptCheck.valid && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              <p className="font-medium mb-1">⚠️ 无法完成验收</p>
              <p>{acceptCheck.message}</p>
            </div>
          )}
          <div>
            <label className="label">里程碑状态</label>
            <select
              value={newStatus}
              onChange={async (e) => {
                setNewStatus(e.target.value);
                if (e.target.value === 'completed' && statusModal.milestone) {
                  const check = await checkMilestoneCanAccept(statusModal.milestone.id);
                  setAcceptCheck(check);
                } else {
                  setAcceptCheck(null);
                }
              }}
              className="input"
            >
              <option value="pending">待开始</option>
              <option value="in_progress">进行中</option>
              <option value="completed">已完成</option>
              <option value="delayed">已延期</option>
              <option value="cancelled">已取消</option>
            </select>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, milestone: null })}
        title="确认删除"
        footer={
          <>
            <button
              onClick={() => setDeleteModal({ open: false, milestone: null })}
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
          确定要删除里程碑 <span className="font-semibold">{deleteModal.milestone?.name}</span> 吗？
          此操作不可撤销。
        </p>
      </Modal>
    </div>
  );
};

export default MilestoneList;
