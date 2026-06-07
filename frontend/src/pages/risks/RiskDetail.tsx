import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Risk, Project } from '@/types';
import { getRisk, updateRisk, createRisk } from '@/services/riskService';
import { getProjects } from '@/services/projectService';
import { handleApiError } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';

const RiskDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [risk, setRisk] = useState<Risk | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<Risk>>({});
  const [createModal, setCreateModal] = useState(false);
  const [newRisk, setNewRisk] = useState<Partial<Risk>>({
    level: 'medium',
    status: 'open',
  });

  useEffect(() => {
    fetchData();
    if (id === 'new') {
      setCreateModal(true);
    }
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const projectsData = await getProjects();
      setProjects(projectsData.data);

      if (id && id !== 'new') {
        const riskData = await getRisk(id);
        setRisk(riskData);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id || id === 'new') return;
    try {
      await updateRisk(id, editData);
      setEditMode(false);
      fetchData();
    } catch (error) {
      alert(handleApiError(error));
    }
  };

  const handleCreate = async () => {
    try {
      await createRisk(newRisk);
      setCreateModal(false);
      navigate('/risks');
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

  if (id !== 'new' && !risk) {
    return <div className="text-center py-12 text-gray-500">风险不存在</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/risks')}
            className="text-gray-500 hover:text-gray-700 mr-4"
          >
            ← 返回
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {id === 'new' ? '新增风险' : risk?.title}
            </h1>
            {id !== 'new' && (
              <p className="text-gray-500">{risk?.project?.name || '-'}</p>
            )}
          </div>
        </div>
        {id !== 'new' && (
          <div className="flex items-center space-x-3">
            <StatusBadge status={risk?.level || ''} type="risk" />
            <StatusBadge status={risk?.status || ''} type="risk" />
            {hasRole(['admin', 'manager']) && !editMode && (
              <button
                onClick={() => {
                  setEditData(risk || {});
                  setEditMode(true);
                }}
                className="btn btn-secondary"
              >
                编辑
              </button>
            )}
          </div>
        )}
      </div>

      {id !== 'new' && editMode && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">编辑风险</h3>
          <div className="space-y-4">
            <div>
              <label className="label">风险标题</label>
              <input
                type="text"
                value={editData.title || ''}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                className="input"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">风险等级</label>
                <select
                  value={editData.level || ''}
                  onChange={(e) => setEditData({ ...editData, level: e.target.value as any })}
                  className="input"
                >
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                  <option value="critical">致命</option>
                </select>
              </div>
              <div>
                <label className="label">处理状态</label>
                <select
                  value={editData.status || ''}
                  onChange={(e) => setEditData({ ...editData, status: e.target.value as any })}
                  className="input"
                >
                  <option value="open">未解决</option>
                  <option value="mitigating">缓解中</option>
                  <option value="resolved">已解决</option>
                  <option value="closed">已关闭</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">风险描述</label>
              <textarea
                value={editData.description || ''}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                rows={3}
                className="input"
              />
            </div>
            <div>
              <label className="label">缓解措施</label>
              <textarea
                value={editData.mitigation_measure || ''}
                onChange={(e) => setEditData({ ...editData, mitigation_measure: e.target.value })}
                rows={3}
                className="input"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setEditMode(false)} className="btn btn-secondary">
                取消
              </button>
              <button onClick={handleSave} className="btn btn-primary">
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {id !== 'new' && !editMode && risk && (
        <div className="card p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <p className="text-sm text-gray-500">所属项目</p>
              <p className="text-lg font-medium text-gray-900 mt-1">{risk.project?.name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">登记人</p>
              <p className="text-lg font-medium text-gray-900 mt-1">
                {risk.created_by_user?.real_name || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">登记时间</p>
              <p className="text-sm font-medium text-gray-900 mt-1">
                {new Date(risk.created_at).toLocaleString('zh-CN')}
              </p>
            </div>
          </div>

          {risk.description && (
            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-2">风险描述</p>
              <p className="text-gray-700">{risk.description}</p>
            </div>
          )}

          {risk.mitigation_measure && (
            <div>
              <p className="text-sm text-gray-500 mb-2">缓解措施</p>
              <p className="text-gray-700">{risk.mitigation_measure}</p>
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={createModal}
        onClose={() => {
          setCreateModal(false);
          navigate('/risks');
        }}
        title="新增风险"
        footer={
          <>
            <button
              onClick={() => {
                setCreateModal(false);
                navigate('/risks');
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
          <div>
            <label className="label">所属项目 *</label>
            <select
              value={newRisk.project_id || ''}
              onChange={(e) => setNewRisk({ ...newRisk, project_id: e.target.value })}
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
            <label className="label">风险标题 *</label>
            <input
              type="text"
              value={newRisk.title || ''}
              onChange={(e) => setNewRisk({ ...newRisk, title: e.target.value })}
              className="input"
              placeholder="请输入风险标题"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">风险等级</label>
              <select
                value={newRisk.level || ''}
                onChange={(e) => setNewRisk({ ...newRisk, level: e.target.value as any })}
                className="input"
              >
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
                <option value="critical">致命</option>
              </select>
            </div>
            <div>
              <label className="label">处理状态</label>
              <select
                value={newRisk.status || ''}
                onChange={(e) => setNewRisk({ ...newRisk, status: e.target.value as any })}
                className="input"
              >
                <option value="open">未解决</option>
                <option value="mitigating">缓解中</option>
                <option value="resolved">已解决</option>
                <option value="closed">已关闭</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">风险描述</label>
            <textarea
              value={newRisk.description || ''}
              onChange={(e) => setNewRisk({ ...newRisk, description: e.target.value })}
              rows={3}
              className="input"
              placeholder="请描述风险详情"
            />
          </div>
          <div>
            <label className="label">缓解措施</label>
            <textarea
              value={newRisk.mitigation_measure || ''}
              onChange={(e) => setNewRisk({ ...newRisk, mitigation_measure: e.target.value })}
              rows={3}
              className="input"
              placeholder="请输入风险缓解措施"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default RiskDetail;
