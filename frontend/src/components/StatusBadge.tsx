import React from 'react';

interface StatusBadgeProps {
  status: string;
  type?: 'project' | 'milestone' | 'risk' | 'acceptance';
}

const statusConfig: Record<string, Record<string, { label: string; className: string }>> = {
  project: {
    planning: { label: '规划中', className: 'bg-gray-100 text-gray-800' },
    in_progress: { label: '进行中', className: 'bg-blue-100 text-blue-800' },
    completed: { label: '已完成', className: 'bg-green-100 text-green-800' },
    on_hold: { label: '已暂停', className: 'bg-yellow-100 text-yellow-800' },
    cancelled: { label: '已取消', className: 'bg-red-100 text-red-800' },
  },
  milestone: {
    pending: { label: '待开始', className: 'bg-gray-100 text-gray-800' },
    in_progress: { label: '进行中', className: 'bg-blue-100 text-blue-800' },
    completed: { label: '已完成', className: 'bg-green-100 text-green-800' },
    delayed: { label: '已延期', className: 'bg-red-100 text-red-800' },
    cancelled: { label: '已取消', className: 'bg-gray-100 text-gray-600' },
  },
  risk: {
    open: { label: '未解决', className: 'bg-red-100 text-red-800' },
    mitigating: { label: '缓解中', className: 'bg-yellow-100 text-yellow-800' },
    resolved: { label: '已解决', className: 'bg-green-100 text-green-800' },
    closed: { label: '已关闭', className: 'bg-gray-100 text-gray-600' },
  },
  acceptance: {
    draft: { label: '草稿', className: 'bg-gray-100 text-gray-800' },
    submitted: { label: '待审核', className: 'bg-blue-100 text-blue-800' },
    accepted: { label: '已通过', className: 'bg-green-100 text-green-800' },
    rejected: { label: '已驳回', className: 'bg-red-100 text-red-800' },
  },
};

const levelConfig: Record<string, { label: string; className: string }> = {
  low: { label: '低', className: 'bg-green-100 text-green-800' },
  medium: { label: '中', className: 'bg-yellow-100 text-yellow-800' },
  high: { label: '高', className: 'bg-orange-100 text-orange-800' },
  critical: { label: '致命', className: 'bg-red-100 text-red-800' },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'project' }) => {
  if (type === 'risk' && ['low', 'medium', 'high', 'critical'].includes(status)) {
    const config = levelConfig[status];
    return <span className={`badge ${config.className}`}>{config.label}</span>;
  }

  const config = statusConfig[type]?.[status];
  if (!config) {
    return <span className="badge bg-gray-100 text-gray-600">{status}</span>;
  }

  return <span className={`badge ${config.className}`}>{config.label}</span>;
};

export default StatusBadge;
