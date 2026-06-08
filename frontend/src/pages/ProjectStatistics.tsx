import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ProjectStatistics as ProjectStatsType,
  ProjectRiskStatus,
  MilestoneStatusSummary,
  RiskLevelSummary,
} from '@/types';
import { getProjectStatistics, StatisticsQueryParams } from '@/services/dashboardService';
import StatusBadge from '@/components/StatusBadge';

const riskLevelColors: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
  none: 'bg-gray-400',
};

const riskLevelLabels: Record<string, string> = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低',
  none: '无风险',
};

const milestoneStatusLabels: Record<string, string> = {
  pending: '待开始',
  in_progress: '进行中',
  completed: '已完成',
  delayed: '已延期',
  cancelled: '已取消',
};

const milestoneStatusColors: Record<string, string> = {
  pending: 'bg-gray-500',
  in_progress: 'bg-blue-500',
  completed: 'bg-green-500',
  delayed: 'bg-red-500',
  cancelled: 'bg-gray-400',
};

const ProjectStatistics: React.FC = () => {
  const [statistics, setStatistics] = useState<ProjectStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [customerFilter, setCustomerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [riskLevelFilter, setRiskLevelFilter] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<MilestoneStatusSummary | null>(null);
  const [selectedRisk, setSelectedRisk] = useState<RiskLevelSummary | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStatistics();
  }, [customerFilter, statusFilter, riskLevelFilter]);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const params: StatisticsQueryParams = {};
      if (customerFilter) params.customer_name = customerFilter;
      if (statusFilter) params.status = statusFilter;
      if (riskLevelFilter) params.risk_level = riskLevelFilter;
      const data = await getProjectStatistics(params);
      setStatistics(data);
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  const handleMilestoneClick = (projectId: string, milestoneId: string) => {
    navigate(`/milestones/${milestoneId}`);
  };

  const handleRiskClick = (projectId: string, riskId: string) => {
    navigate(`/risks/${riskId}`);
  };

  const clearFilters = () => {
    setCustomerFilter('');
    setStatusFilter('');
    setRiskLevelFilter('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const totalMilestones = statistics?.by_status.reduce((sum, s) => sum + s.count, 0) || 0;
  const totalRisks = statistics?.by_risk_level.reduce((sum, r) => sum + r.count, 0) || 0;
  const atRiskProjects = statistics?.project_risk_status.filter(
    (p) => p.risk_level === 'high' || p.risk_level === 'critical'
  ).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">项目统计面板</h1>
        <button onClick={clearFilters} className="btn btn-secondary text-sm">
          重置筛选
        </button>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col">
            <label className="label">客户</label>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="input w-[240px]"
            >
              <option value="">全部客户</option>
              {statistics?.customers.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="label">里程碑阶段</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input w-[160px]"
            >
              <option value="">全部阶段</option>
              <option value="pending">待开始</option>
              <option value="in_progress">进行中</option>
              <option value="completed">已完成</option>
              <option value="delayed">已延期</option>
              <option value="cancelled">已取消</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label className="label">风险等级</label>
            <select
              value={riskLevelFilter}
              onChange={(e) => setRiskLevelFilter(e.target.value)}
              className="input w-[160px]"
            >
              <option value="">全部风险</option>
              <option value="critical">严重</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </div>
          <button onClick={fetchStatistics} className="btn btn-primary">
            查询
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6 hover:shadow-lg transition-shadow cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">里程碑总数</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{totalMilestones}</p>
            </div>
            <div className="bg-blue-500 w-12 h-12 rounded-full flex items-center justify-center text-2xl">
              🎯
            </div>
          </div>
        </div>
        <div className="card p-6 hover:shadow-lg transition-shadow cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">进行中里程碑</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {statistics?.by_status.find((s) => s.status === 'in_progress')?.count || 0}
              </p>
            </div>
            <div className="bg-green-500 w-12 h-12 rounded-full flex items-center justify-center text-2xl">
              🔄
            </div>
          </div>
        </div>
        <div className="card p-6 hover:shadow-lg transition-shadow cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">延期里程碑</p>
              <p className="text-3xl font-bold text-red-600 mt-1">
                {statistics?.by_status.find((s) => s.status === 'delayed')?.count || 0}
              </p>
            </div>
            <div className="bg-red-500 w-12 h-12 rounded-full flex items-center justify-center text-2xl">
              ⚠️
            </div>
          </div>
        </div>
        <div className="card p-6 hover:shadow-lg transition-shadow cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">高风险项目</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">{atRiskProjects}</p>
            </div>
            <div className="bg-orange-500 w-12 h-12 rounded-full flex items-center justify-center text-2xl">
              🔥
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">按里程碑阶段统计</h3>
            <span className="text-sm text-gray-500">点击查看明细</span>
          </div>
          <div className="space-y-3">
            {statistics?.by_status.map((status) => (
              <div
                key={status.status}
                className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => setSelectedStatus(selectedStatus?.status === status.status ? null : status)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${milestoneStatusColors[status.status] || 'bg-gray-400'}`}></div>
                    <span className="font-medium text-gray-900">
                      {milestoneStatusLabels[status.status] || status.status}
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-gray-700">{status.count}</span>
                </div>
                {selectedStatus?.status === status.status && status.milestones.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                    {status.milestones.map((milestone) => (
                      <div
                        key={milestone.id}
                        className="flex items-center justify-between p-2 rounded hover:bg-white transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMilestoneClick(milestone.project_id, milestone.id);
                        }}
                      >
                        <div>
                          <p className="font-medium text-gray-800">{milestone.name}</p>
                          <p className="text-sm text-gray-500">
                            {milestone.customer_name} - {milestone.project_name}
                          </p>
                        </div>
                        <span className="text-sm text-primary-600">查看 →</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">按风险等级统计</h3>
            <span className="text-sm text-gray-500">点击查看明细</span>
          </div>
          <div className="space-y-3">
            {statistics?.by_risk_level.map((risk) => (
              <div
                key={risk.risk_level}
                className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => setSelectedRisk(selectedRisk?.risk_level === risk.risk_level ? null : risk)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${riskLevelColors[risk.risk_level] || 'bg-gray-400'}`}></div>
                    <span className="font-medium text-gray-900">
                      {riskLevelLabels[risk.risk_level] || risk.risk_level}风险
                    </span>
                  </div>
                  <span className="text-2xl font-bold text-gray-700">{risk.count}</span>
                </div>
                {selectedRisk?.risk_level === risk.risk_level && risk.risks.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                    {risk.risks.map((riskItem) => (
                      <div
                        key={riskItem.id}
                        className="flex items-center justify-between p-2 rounded hover:bg-white transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRiskClick(riskItem.project_id, riskItem.id);
                        }}
                      >
                        <div>
                          <p className="font-medium text-gray-800">{riskItem.title}</p>
                          <p className="text-sm text-gray-500">
                            {riskItem.customer_name} - {riskItem.project_name}
                          </p>
                        </div>
                        <span className="text-sm text-primary-600">查看 →</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {totalRisks === 0 && (
              <p className="text-gray-500 text-center py-4">暂无活跃风险项</p>
            )}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">项目风险状态</h3>
          <span className="text-sm text-gray-500">点击卡片跳转项目详情</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {statistics?.project_risk_status.map((project: ProjectRiskStatus) => (
            <div
              key={project.project_id}
              className="p-4 bg-gray-50 rounded-lg hover:shadow-lg transition-all cursor-pointer border-2 border-transparent hover:border-primary-200"
              onClick={() => handleCardClick(project.project_id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 truncate">{project.project_name}</p>
                  <p className="text-sm text-gray-500 truncate">{project.customer_name}</p>
                </div>
                <div
                  className={`w-4 h-4 rounded-full ${riskLevelColors[project.risk_level] || 'bg-gray-400'}`}
                  title={`风险等级: ${riskLevelLabels[project.risk_level] || project.risk_level}`}
                ></div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">项目状态</span>
                  <StatusBadge status={project.project_status} type="project" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">风险等级</span>
                  <span
                    className={`font-medium ${
                      project.risk_level === 'critical' || project.risk_level === 'high'
                        ? 'text-red-600'
                        : project.risk_level === 'medium'
                        ? 'text-yellow-600'
                        : 'text-gray-600'
                    }`}
                  >
                    {riskLevelLabels[project.risk_level] || project.risk_level}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">活跃风险</span>
                  <span className="font-medium text-gray-700">{project.active_risks_count} 项</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">里程碑进度</span>
                  <span className="font-medium text-gray-700">
                    {project.completed_milestones}/{project.total_milestones}
                    {project.total_milestones > 0 && (
                      <span className="text-gray-500 ml-1">
                        ({Math.round((project.completed_milestones / project.total_milestones) * 100)}%)
                      </span>
                    )}
                  </span>
                </div>
                {project.delayed_milestones > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">延期里程碑</span>
                    <span className="font-medium text-red-600">{project.delayed_milestones} 个</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">按客户统计</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600">客户名称</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">项目名称</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">总数</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">待开始</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">进行中</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">已完成</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">延期</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">最高风险</th>
              </tr>
            </thead>
            <tbody>
              {statistics?.by_customer.map((row, index) => (
                <tr
                  key={index}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleCardClick(row.project_id)}
                >
                  <td className="py-3 px-4 text-gray-900">{row.customer_name}</td>
                  <td className="py-3 px-4 text-gray-900 font-medium">{row.project_name}</td>
                  <td className="py-3 px-4 text-center text-gray-700">{row.total_milestones}</td>
                  <td className="py-3 px-4 text-center text-gray-500">{row.pending_milestones}</td>
                  <td className="py-3 px-4 text-center text-blue-600">{row.in_progress_milestones}</td>
                  <td className="py-3 px-4 text-center text-green-600">{row.completed_milestones}</td>
                  <td className="py-3 px-4 text-center text-red-600">{row.delayed_milestones}</td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        row.highest_risk_level === 'critical' || row.highest_risk_level === 'high'
                          ? 'bg-red-100 text-red-800'
                          : row.highest_risk_level === 'medium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : row.highest_risk_level === 'low'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {riskLevelLabels[row.highest_risk_level] || row.highest_risk_level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProjectStatistics;
