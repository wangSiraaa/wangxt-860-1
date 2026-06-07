import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MeetingMinutes, Project } from '@/types';
import { getMeetings, deleteMeeting, downloadAttachment } from '@/services/meetingService';
import { getProjects } from '@/services/projectService';
import { handleApiError } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';

const MeetingList: React.FC = () => {
  const [meetings, setMeetings] = useState<MeetingMinutes[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState('');
  const [keywordFilter, setKeywordFilter] = useState('');
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; meeting: MeetingMinutes | null }>({
    open: false,
    meeting: null,
  });
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  useEffect(() => {
    fetchData();
  }, [projectFilter, keywordFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (projectFilter) params.project_id = projectFilter;
      if (keywordFilter) params.keyword = keywordFilter;
      const [meetingsData, projectsData] = await Promise.all([
        getMeetings(params),
        getProjects(),
      ]);
      setMeetings(meetingsData.data);
      setProjects(projectsData.data);
    } catch (error) {
      console.error('Failed to fetch meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.meeting) return;
    try {
      await deleteMeeting(deleteModal.meeting.id);
      setDeleteModal({ open: false, meeting: null });
      fetchData();
    } catch (error) {
      alert(handleApiError(error));
    }
  };

  const handleDownload = async (e: React.MouseEvent, meeting: MeetingMinutes) => {
    e.stopPropagation();
    try {
      await downloadAttachment(meeting.id);
    } catch (error) {
      alert(handleApiError(error));
    }
  };

  const columns = [
    {
      key: 'title',
      label: '会议主题',
      render: (row: MeetingMinutes) => (
        <div>
          <p className="font-medium text-gray-900">{row.title}</p>
          <p className="text-sm text-gray-500">{row.project?.name || '-'}</p>
        </div>
      ),
    },
    {
      key: 'meeting_date',
      label: '会议日期',
      width: '140px',
      render: (row: MeetingMinutes) => new Date(row.meeting_date).toLocaleDateString('zh-CN'),
    },
    {
      key: 'location',
      label: '会议地点',
      width: '140px',
      render: (row: MeetingMinutes) => row.location || '-',
    },
    {
      key: 'attendees',
      label: '参会人员',
      width: '180px',
      render: (row: MeetingMinutes) => row.attendees || '-',
    },
    {
      key: 'attachment',
      label: '附件',
      width: '100px',
      render: (row: MeetingMinutes) =>
        row.attachment_name ? (
          <button
            onClick={(e) => handleDownload(e, row)}
            className="text-primary-600 hover:text-primary-800 text-sm underline"
          >
            下载
          </button>
        ) : (
          '-'
        ),
    },
    {
      key: 'created_by',
      label: '创建人',
      width: '100px',
      render: (row: MeetingMinutes) => row.created_by_user?.real_name || '-',
    },
    {
      key: 'actions',
      label: '操作',
      width: '160px',
      render: (row: MeetingMinutes) => (
        <div className="flex space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/meetings/${row.id}`);
            }}
            className="text-primary-600 hover:text-primary-800 text-sm"
          >
            查看
          </button>
          {hasRole(['admin']) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteModal({ open: true, meeting: row });
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
        <h1 className="text-2xl font-bold text-gray-900">会议纪要</h1>
        <button
          onClick={() => navigate('/meetings/new')}
          className="btn btn-primary"
        >
          + 上传纪要
        </button>
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
          <input
            type="text"
            value={keywordFilter}
            onChange={(e) => setKeywordFilter(e.target.value)}
            placeholder="搜索会议主题或内容"
            className="input w-[240px]"
          />
          <button onClick={fetchData} className="btn btn-secondary">
            搜索
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={meetings}
        loading={loading}
        emptyMessage="暂无会议纪要"
        rowLink={(row) => `/meetings/${row.id}`}
      />

      <Modal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, meeting: null })}
        title="确认删除"
        footer={
          <>
            <button
              onClick={() => setDeleteModal({ open: false, meeting: null })}
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
          确定要删除会议纪要 <span className="font-semibold">{deleteModal.meeting?.title}</span> 吗？
          此操作不可撤销。
        </p>
      </Modal>
    </div>
  );
};

export default MeetingList;
