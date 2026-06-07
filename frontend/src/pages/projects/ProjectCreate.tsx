import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createProject } from '@/services/projectService';
import { getUsers } from '@/services/dashboardService';
import { handleApiError } from '@/services/api';
import { User } from '@/types';
import { useAuth } from '@/context/AuthContext';

const ProjectCreate: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    customer_name: '',
    description: '',
    status: 'planning',
    start_date: '',
    end_date: '',
    project_manager_id: '',
  });
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  useEffect(() => {
    if (!hasRole(['admin', 'manager'])) {
      navigate('/projects');
      return;
    }
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await createProject(formData);
      navigate('/projects');
    } catch (err: any) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate('/projects')}
          className="text-gray-500 hover:text-gray-700 mr-4"
        >
          ← 返回
        </button>
        <h1 className="text-2xl font-bold text-gray-900">新建项目</h1>
      </div>

      <div className="card p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">项目名称 *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="input"
                placeholder="请输入项目名称"
              />
            </div>
            <div>
              <label className="label">项目编码 *</label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleChange}
                required
                className="input"
                placeholder="请输入项目编码"
              />
            </div>
          </div>

          <div>
            <label className="label">客户名称 *</label>
            <input
              type="text"
              name="customer_name"
              value={formData.customer_name}
              onChange={handleChange}
              required
              className="input"
              placeholder="请输入客户名称"
            />
          </div>

          <div>
            <label className="label">项目描述</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="input"
              placeholder="请输入项目描述"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="label">项目状态</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="input"
              >
                <option value="planning">规划中</option>
                <option value="in_progress">进行中</option>
                <option value="completed">已完成</option>
                <option value="on_hold">已暂停</option>
                <option value="cancelled">已取消</option>
              </select>
            </div>
            <div>
              <label className="label">开始日期</label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                className="input"
              />
            </div>
            <div>
              <label className="label">结束日期</label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">项目经理</label>
            <select
              name="project_manager_id"
              value={formData.project_manager_id}
              onChange={handleChange}
              className="input"
            >
              <option value="">请选择项目经理</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.real_name} ({user.username})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/projects')}
              className="btn btn-secondary"
            >
              取消
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectCreate;
