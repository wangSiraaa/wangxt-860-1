import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DashboardStats, Project, Milestone } from '@/types';
import { getDashboardStats, getProjectBoard, getMilestoneTimeline } from '@/services/dashboardService';
import StatusBadge from '@/components/StatusBadge';
import ProgressBar from '@/components/ProgressBar';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, projectsData, milestonesData] = await Promise.all([
          getDashboardStats(),
          getProjectBoard(),
          getMilestoneTimeline(),
        ]);
        setStats(statsData);
        setProjects(projectsData);
        setMilestones(milestonesData);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const statCards = stats ? [
    { label: '项目总数', value: stats.total_projects, icon: '📁', color: 'bg-blue-500' },
    { label: '进行中项目', value: stats.in_progress_projects, icon: '🔄', color: 'bg-green-500' },
    { label: '已完成项目', value: stats.completed_projects, icon: '✅', color: 'bg-purple-500' },
    { label: '里程碑总数', value: stats.total_milestones, icon: '🎯', color: 'bg-orange-500' },
    { label: '已完成里程碑', value: stats.completed_milestones, icon: '🎉', color: 'bg-teal-500' },
    { label: '延期里程碑', value: stats.delayed_milestones, icon: '⚠️', color: 'bg-red-500' },
    { label: '高风险项', value: stats.high_risks, icon: '🔥', color: 'bg-rose-500' },
    { label: '待验收', value: stats.pending_acceptances, icon: '📋', color: 'bg-amber-500' },
  ] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <div key={index} className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
              </div>
              <div className={`${card.color} w-12 h-12 rounded-full flex items-center justify-center text-2xl`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">项目概览</h3>
            <Link to="/projects" className="text-sm text-primary-600 hover:text-primary-700">
              查看全部 →
            </Link>
          </div>
          <div className="space-y-4">
            {projects.slice(0, 5).map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-900">{project.name}</p>
                    <p className="text-sm text-gray-500">{project.customer_name}</p>
                  </div>
                  <StatusBadge status={project.status} type="project" />
                </div>
                <ProgressBar progress={project.progress || 0} showLabel={true} size="sm" />
              </Link>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">里程碑时间线</h3>
            <Link to="/milestones" className="text-sm text-primary-600 hover:text-primary-700">
              查看全部 →
            </Link>
          </div>
          <div className="space-y-4">
            {milestones.slice(0, 5).map((milestone) => (
              <Link
                key={milestone.id}
                to={`/milestones/${milestone.id}`}
                className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-900">{milestone.name}</p>
                    <p className="text-sm text-gray-500">{milestone.project?.name}</p>
                  </div>
                  <StatusBadge status={milestone.status} type="milestone" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    计划日期: {milestone.planned_date || '未设置'}
                  </span>
                  <span className="text-gray-400">#{milestone.sequence}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">快速入口</h3>
          <div className="space-y-3">
            <Link
              to="/projects/create"
              className="flex items-center p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <span className="text-2xl mr-3">➕</span>
              <div>
                <p className="font-medium text-gray-900">新建项目</p>
                <p className="text-sm text-gray-500">创建新项目档案</p>
              </div>
            </Link>
            <Link
              to="/milestones"
              className="flex items-center p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              <span className="text-2xl mr-3">🎯</span>
              <div>
                <p className="font-medium text-gray-900">里程碑维护</p>
                <p className="text-sm text-gray-500">管理项目里程碑</p>
              </div>
            </Link>
            <Link
              to="/acceptance"
              className="flex items-center p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <span className="text-2xl mr-3">✅</span>
              <div>
                <p className="font-medium text-gray-900">验收管理</p>
                <p className="text-sm text-gray-500">处理验收申请</p>
              </div>
            </Link>
          </div>
        </div>

        <div className="card p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">项目进度统计</h3>
          <div className="space-y-4">
            {projects.slice(0, 3).map((project) => (
              <div key={project.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">{project.name}</span>
                  <span className="text-sm text-gray-500">
                    {project.completed_milestone_count || 0}/{project.milestone_count || 0} 里程碑
                  </span>
                </div>
                <ProgressBar progress={project.progress || 0} showLabel={true} size="md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
