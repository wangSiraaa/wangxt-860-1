import React from 'react';

interface ProgressBarProps {
  progress: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, showLabel = true, size = 'md' }) => {
  const heightClass = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  }[size];

  const getColorClass = (p: number) => {
    if (p >= 100) return 'bg-green-500';
    if (p >= 70) return 'bg-blue-500';
    if (p >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="w-full">
      <div className={`w-full bg-gray-200 rounded-full ${heightClass} overflow-hidden`}>
        <div
          className={`${heightClass} rounded-full ${getColorClass(clampedProgress)} transition-all duration-500`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-gray-500 mt-1">{clampedProgress.toFixed(0)}%</span>
      )}
    </div>
  );
};

export default ProgressBar;
