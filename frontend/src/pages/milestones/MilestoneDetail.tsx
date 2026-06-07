import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Milestone } from '@/types';
import { getMilestone, updateMilestone } from '@/services/milestoneService';
import { getProjects } from '@/services/projectService';
import { handleApiError } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import StatusBadge from '@/components/StatusBadge';

const MilestoneDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [allMilestones, setAllMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<Milestone> & { predecessors?: string[] }>({});

  useEffect(() => {
    if (!id) return;
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [milestoneData, allMilestonesData] = await Promise.all([
        getMilestone(id!),
        getMilestone(),
      ]);
      setMilestone(milestoneData);
      setAllMilestones(allMilestonesData.data.filter((m) => m.id !== id && m.project_id === milestoneData.project_id));
    } catch (error) {
      console.error('Failed to fetch milestone:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await updateMilestone(id!, editData);
      setEditMode(false);
      fetchData();
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

  if (!milestone) {
    return <div className="text-center py-12 text-gray-500">里程碑不存在</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/milestones')}
            className="text-gray-500 hover:text-gray-700 mr-4"
          >
            ← 返回
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{milestone.name}</h1>
            <p className="text-gray-500">
              {milestone.project?.name || '-'} · #{milestone.sequence}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <StatusBadge status={milestone.status} type="milestone" />
          {hasRole(['admin', 'manager']) && !editMode && (
            <button
              onClick={() => {
                setEditData({
                  ...milestone,
                  predecessors: milestone.predecessors?.map((p) => p.id) || [],
                });
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
          <h3 className="text-lg font-semibold mb-4">编辑里程碑</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">里程碑名称</label>
                <input
                  type="text"
                  value={editData.name || ''}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">序号</label>
                <input
                  type="number"
                  value={editData.sequence || ''}
                  onChange={(e) => setEditData({ ...editData, sequence: parseInt(e.target.value) })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">计划日期</label>
                <input
                  type="date"
                  value={editData.planned_date || ''}
                  onChange={(e) => setEditData({ ...editData, planned_date: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">实际日期</label>
                <input
                  type="date"
                  value={editData.actual_date || ''}
                  onChange={(e) => setEditData({ ...editData, actual_date: e.target.value })}
                  className="input"
                />
              </div>
            </div>
            <div>
              <label className="label">里程碑描述</label>
              <textarea
                value={editData.description || ''}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                rows={3}
                className="input"
              />
            </div>
            <div>
              <label className="label">前置依赖里程碑</label>
              <select
                multiple
                value={editData.predecessors || []}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, (option) => option.value);
                  setEditData({ ...editData, predecessors: values });
                }}
                className="input h-32"
              >
                {allMilestones
                  .filter((m) => m.sequence < (milestone.sequence || 999))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      #{m.sequence} {m.name}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">按住 Ctrl/Cmd 可多选</p>
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

      {!editMode && (
        <div className="card p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <p className="text-sm text-gray-500">所属项目</p>
              <p className="text-lg font-medium text-gray-900 mt-1">
                {milestone.project?.name || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">计划日期</p>
              <p className="text-lg font-medium text-gray-900 mt-1">
                {milestone.planned_date || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">实际日期</p>
              <p className="text-lg font-medium text-gray-900 mt-1">
                {milestone.actual_date || '-'}
              </p>
            </div>
          </div>

          {milestone.description && (
            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-2">里程碑描述</p>
              <p className="text-gray-700">{milestone.description}</p>
            </div>
          )}

          {milestone.predecessors && milestone.predecessors.length > 0 && (
            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-2">前置依赖</p>
              <div className="flex flex-wrap gap-2">
                {milestone.predecessors.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700"
                  >
                    #{p.sequence} {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {milestone.successors && milestone.successors.length > 0 && (
            <div>
              <p className="text-sm text-gray-500 mb-2">后续依赖</p>
              <div className="flex flex-wrap gap-2">
                {milestone.successors.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-700"
                  >
                    #{s.sequence} {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MilestoneDetail;
