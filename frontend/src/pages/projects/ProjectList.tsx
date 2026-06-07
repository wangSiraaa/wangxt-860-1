import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Project } from '@/types';
import { getProjects, deleteProject, updateProjectStatus } from '@/services/projectService';
import { handleApiError } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import ProgressBar from '@/components/ProgressBar';
import Modal from '@/components/Modal';

const ProjectList: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; project: Project | null }>({
    open: false,
    project: null,
  });
  const [statusModal, setStatusModal] = useState<{ open: boolean; project: Project | null }>({
    open: false,
    project: null,
  });
  const [newStatus, setNewStatus] = useState('');
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  useEffect(() => {
    fetchProjects();
  }, [statusFilter, keyword]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (keyword) params.keyword = keyword;
      const { data } = await getProjects(params);
      setProjects(data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.project) return;
    try {
      await deleteProject(deleteModal.project.id);
      setDeleteModal({ open: false, project: null });
      fetchProjects();
    } catch (error) {
      alert(handleApiError(error));
    }
  };

  const handleStatusChange = async () => {
    if (!statusModal.project || !newStatus) return;
    try {
      await updateProjectStatus(statusModal.project.id, newStatus);
      setStatusModal({ open: false, project: null });
      fetchProjects();
    } catch (error) {
      alert(handleApiError(error));
    }
  };

  const columns = [
    {
      key: 'code',
      label: '项目编码',
      width: '120px',
    },
    {
      key: 'name',
      label: '项目名称',
      render: (row: Project) => (
        <div>
          <p className="font-medium text-gray-900">{row.name}</p>
          <p className="text-sm text-gray-500">{row.customer_name}</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: '状态',
      width: '100px',
      render: (row: Project) => <StatusBadge status={row.status} type="project" />,
    },
    {
      key: 'progress',
      label: '进度',
      width: '150px',
      render: (row: Project) => <ProgressBar progress={row.progress || 0} showLabel={true} size="sm" />,
    },
    {
      key: 'start_date',
      label: '开始日期',
      width: '120px',
    },
    {
      key: 'end_date',
      label: '结束日期',
      width: '120px',
    },
    {
      key: 'project_manager',
      label: '项目经理',
      width: '120px',
      render: (row: Project) => row.project_manager?.real_name || '-',
    },
    {
      key: 'actions',
      label: '操作',
      width: '200px',
      render: (row: Project) => (
        <div className="flex space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/projects/${row.id}`);
            }}
            className="text-primary-600 hover:text-primary-800 text-sm"
          >
            查看
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setStatusModal({ open: true, project: row });
              setNewStatus(row.status);
            }}
            className="text-green-600 hover:text-green-800 text-sm"
          >
            状态
          </button>
          {hasRole(['admin']) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteModal({ open: true, project: row });
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
        <h1 className="text-2xl font-bold text-gray-900">项目建档</h1>
        {hasRole(['admin', 'manager']) && (
          <Link to="/projects/create" className="btn btn-primary">
            + 新建项目
          </Link>
        )}
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="搜索项目名称、客户名称..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="input"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-[180px]"
          >
            <option value="">全部状态</option>
            <option value="planning">规划中</option>
            <option value="in_progress">进行中</option>
            <option value="completed">已完成</option>
            <option value="on_hold">已暂停</option>
            <option value="cancelled">已取消</option>
          </select>
          <button onClick={fetchProjects} className="btn btn-secondary">
            搜索
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={projects}
        loading={loading}
        emptyMessage="暂无项目数据"
        rowLink={(row) => `/projects/${row.id}`}
      />

      <Modal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, project: null })}
        title="确认删除"
        footer={
          <>
            <button
              onClick={() => setDeleteModal({ open: false, project: null })}
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
          确定要删除项目 <span className="font-semibold">{deleteModal.project?.name}</span> 吗？
          此操作不可撤销。
        </p>
      </Modal>

      <Modal
        isOpen={statusModal.open}
        onClose={() => setStatusModal({ open: false, project: null })}
        title="变更项目状态"
        footer={
          <>
            <button
              onClick={() => setStatusModal({ open: false, project: null })}
              className="btn btn-secondary"
            >
              取消
            </button>
            <button onClick={handleStatusChange} className="btn btn-primary">
              确认
            </button>
          </>
        }
      >
        <div>
          <label className="label">项目状态</label>
          <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="input">
            <option value="planning">规划中</option>
            <option value="in_progress">进行中</option>
            <option value="completed">已完成</option>
            <option value="on_hold">已暂停</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
      </Modal>
    </div>
  );
};

export default ProjectList;
