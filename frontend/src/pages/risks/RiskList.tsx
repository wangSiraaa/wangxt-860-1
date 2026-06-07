import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Risk, Project } from '@/types';
import { getRisks, updateRiskStatus, deleteRisk } from '@/services/riskService';
import { getProjects } from '@/services/projectService';
import { handleApiError } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';

const RiskList: React.FC = () => {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [statusModal, setStatusModal] = useState<{ open: boolean; risk: Risk | null }>({
    open: false,
    risk: null,
  });
  const [newStatus, setNewStatus] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; risk: Risk | null }>({
    open: false,
    risk: null,
  });
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  useEffect(() => {
    fetchData();
  }, [projectFilter, levelFilter, statusFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (projectFilter) params.project_id = projectFilter;
      if (levelFilter) params.level = levelFilter;
      if (statusFilter) params.status = statusFilter;
      const [risksData, projectsData] = await Promise.all([
        getRisks(params),
        getProjects(),
      ]);
      setRisks(risksData.data);
      setProjects(projectsData.data);
    } catch (error) {
      console.error('Failed to fetch risks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!statusModal.risk || !newStatus) return;
    try {
      await updateRiskStatus(statusModal.risk.id, newStatus);
      setStatusModal({ open: false, risk: null });
      fetchData();
    } catch (error) {
      alert(handleApiError(error));
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.risk) return;
    try {
      await deleteRisk(deleteModal.risk.id);
      setDeleteModal({ open: false, risk: null });
      fetchData();
    } catch (error) {
      alert(handleApiError(error));
    }
  };

  const columns = [
    {
      key: 'title',
      label: '风险标题',
      render: (row: Risk) => (
        <div>
          <p className="font-medium text-gray-900">{row.title}</p>
          <p className="text-sm text-gray-500">{row.project?.name || '-'}</p>
        </div>
      ),
    },
    {
      key: 'level',
      label: '风险等级',
      width: '100px',
      render: (row: Risk) => <StatusBadge status={row.level} type="risk" />,
    },
    {
      key: 'status',
      label: '处理状态',
      width: '100px',
      render: (row: Risk) => <StatusBadge status={row.status} type="risk" />,
    },
    {
      key: 'created_by',
      label: '登记人',
      width: '120px',
      render: (row: Risk) => row.created_by_user?.real_name || '-',
    },
    {
      key: 'created_at',
      label: '登记时间',
      width: '180px',
      render: (row: Risk) => new Date(row.created_at).toLocaleString('zh-CN'),
    },
    {
      key: 'actions',
      label: '操作',
      width: '200px',
      render: (row: Risk) => (
        <div className="flex space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/risks/${row.id}`);
            }}
            className="text-primary-600 hover:text-primary-800 text-sm"
          >
            查看
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setStatusModal({ open: true, risk: row });
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
                setDeleteModal({ open: true, risk: row });
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
        <h1 className="text-2xl font-bold text-gray-900">风险登记</h1>
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
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="input w-[140px]"
          >
            <option value="">全部等级</option>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
            <option value="critical">致命</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-[140px]"
          >
            <option value="">全部状态</option>
            <option value="open">未解决</option>
            <option value="mitigating">缓解中</option>
            <option value="resolved">已解决</option>
            <option value="closed">已关闭</option>
          </select>
          <button onClick={fetchData} className="btn btn-secondary">
            搜索
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={risks}
        loading={loading}
        emptyMessage="暂无风险数据"
        rowLink={(row) => `/risks/${row.id}`}
      />

      <Modal
        isOpen={statusModal.open}
        onClose={() => setStatusModal({ open: false, risk: null })}
        title="变更风险状态"
        footer={
          <>
            <button
              onClick={() => setStatusModal({ open: false, risk: null })}
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
          <label className="label">风险状态</label>
          <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="input">
            <option value="open">未解决</option>
            <option value="mitigating">缓解中</option>
            <option value="resolved">已解决</option>
            <option value="closed">已关闭</option>
          </select>
        </div>
      </Modal>

      <Modal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, risk: null })}
        title="确认删除"
        footer={
          <>
            <button
              onClick={() => setDeleteModal({ open: false, risk: null })}
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
          确定要删除风险 <span className="font-semibold">{deleteModal.risk?.title}</span> 吗？
          此操作不可撤销。
        </p>
      </Modal>
    </div>
  );
};

export default RiskList;
