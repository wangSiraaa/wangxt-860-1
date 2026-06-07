import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MeetingMinutes, Project } from '@/types';
import { getMeeting, updateMeeting, createMeeting, downloadAttachment } from '@/services/meetingService';
import { getProjects } from '@/services/projectService';
import { handleApiError } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import Modal from '@/components/Modal';

const MeetingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [meeting, setMeeting] = useState<MeetingMinutes | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<MeetingMinutes>>({});
  const [editFile, setEditFile] = useState<File | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [newMeeting, setNewMeeting] = useState<Partial<MeetingMinutes>>({});
  const [newFile, setNewFile] = useState<File | null>(null);

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
        const meetingData = await getMeeting(id);
        setMeeting(meetingData);
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
      const formData = new FormData();
      if (editData.project_id) formData.append('project_id', editData.project_id);
      if (editData.title) formData.append('title', editData.title);
      if (editData.meeting_date) formData.append('meeting_date', editData.meeting_date);
      if (editData.location) formData.append('location', editData.location);
      if (editData.content) formData.append('content', editData.content);
      if (editData.attendees) formData.append('attendees', editData.attendees);
      if (editFile) formData.append('attachment', editFile);

      await updateMeeting(id, formData);
      setEditMode(false);
      setEditFile(null);
      fetchData();
    } catch (error) {
      alert(handleApiError(error));
    }
  };

  const handleCreate = async () => {
    try {
      const formData = new FormData();
      if (newMeeting.project_id) formData.append('project_id', newMeeting.project_id);
      if (newMeeting.title) formData.append('title', newMeeting.title);
      if (newMeeting.meeting_date) formData.append('meeting_date', newMeeting.meeting_date);
      if (newMeeting.location) formData.append('location', newMeeting.location);
      if (newMeeting.content) formData.append('content', newMeeting.content);
      if (newMeeting.attendees) formData.append('attendees', newMeeting.attendees);
      if (newFile) formData.append('attachment', newFile);

      await createMeeting(formData);
      setCreateModal(false);
      setNewFile(null);
      navigate('/meetings');
    } catch (error) {
      alert(handleApiError(error));
    }
  };

  const handleDownload = async () => {
    if (!meeting) return;
    try {
      await downloadAttachment(meeting.id);
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

  if (id !== 'new' && !meeting) {
    return <div className="text-center py-12 text-gray-500">会议纪要不存在</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/meetings')}
            className="text-gray-500 hover:text-gray-700 mr-4"
          >
            ← 返回
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {id === 'new' ? '上传会议纪要' : meeting?.title}
            </h1>
            {id !== 'new' && (
              <p className="text-gray-500">{meeting?.project?.name || '-'}</p>
            )}
          </div>
        </div>
        {id !== 'new' && (
          <div className="flex items-center space-x-3">
            {meeting?.attachment_name && (
              <button onClick={handleDownload} className="btn btn-secondary">
                下载附件
              </button>
            )}
            {hasRole(['admin', 'manager']) && !editMode && (
              <button
                onClick={() => {
                  setEditData(meeting || {});
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
          <h3 className="text-lg font-semibold mb-4">编辑会议纪要</h3>
          <div className="space-y-4">
            <div>
              <label className="label">所属项目 *</label>
              <select
                value={editData.project_id || ''}
                onChange={(e) => setEditData({ ...editData, project_id: e.target.value })}
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
              <label className="label">会议主题 *</label>
              <input
                type="text"
                value={editData.title || ''}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                className="input"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">会议日期 *</label>
                <input
                  type="date"
                  value={editData.meeting_date ? editData.meeting_date.split('T')[0] : ''}
                  onChange={(e) => setEditData({ ...editData, meeting_date: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">会议地点</label>
                <input
                  type="text"
                  value={editData.location || ''}
                  onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                  className="input"
                />
              </div>
            </div>
            <div>
              <label className="label">参会人员</label>
              <input
                type="text"
                value={editData.attendees || ''}
                onChange={(e) => setEditData({ ...editData, attendees: e.target.value })}
                className="input"
                placeholder="请输入参会人员，用逗号分隔"
              />
            </div>
            <div>
              <label className="label">会议内容 *</label>
              <textarea
                value={editData.content || ''}
                onChange={(e) => setEditData({ ...editData, content: e.target.value })}
                rows={6}
                className="input"
              />
            </div>
            <div>
              <label className="label">附件文件</label>
              <input
                type="file"
                onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                className="input"
              />
              {editFile && <p className="text-sm text-gray-500 mt-1">已选择: {editFile.name}</p>}
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setEditMode(false);
                  setEditFile(null);
                }}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button onClick={handleSave} className="btn btn-primary">
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {id !== 'new' && !editMode && meeting && (
        <div className="card p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <p className="text-sm text-gray-500">所属项目</p>
              <p className="text-lg font-medium text-gray-900 mt-1">{meeting.project?.name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">会议日期</p>
              <p className="text-lg font-medium text-gray-900 mt-1">
                {new Date(meeting.meeting_date).toLocaleDateString('zh-CN')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">会议地点</p>
              <p className="text-lg font-medium text-gray-900 mt-1">{meeting.location || '-'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-sm text-gray-500">参会人员</p>
              <p className="text-gray-900 mt-1">{meeting.attendees || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">创建人</p>
              <p className="text-gray-900 mt-1">{meeting.created_by_user?.real_name || '-'}</p>
            </div>
          </div>

          {meeting.attachment_name && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-2">附件</p>
              <button onClick={handleDownload} className="text-primary-600 hover:text-primary-800 underline">
                {meeting.attachment_name}
              </button>
            </div>
          )}

          <div>
            <p className="text-sm text-gray-500 mb-2">会议内容</p>
            <div className="text-gray-700 whitespace-pre-wrap">{meeting.content}</div>
          </div>
        </div>
      )}

      <Modal
        isOpen={createModal}
        onClose={() => {
          setCreateModal(false);
          setNewFile(null);
          navigate('/meetings');
        }}
        title="上传会议纪要"
        footer={
          <>
            <button
              onClick={() => {
                setCreateModal(false);
                setNewFile(null);
                navigate('/meetings');
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
              value={newMeeting.project_id || ''}
              onChange={(e) => setNewMeeting({ ...newMeeting, project_id: e.target.value })}
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
            <label className="label">会议主题 *</label>
            <input
              type="text"
              value={newMeeting.title || ''}
              onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
              className="input"
              placeholder="请输入会议主题"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">会议日期 *</label>
              <input
                type="date"
                value={newMeeting.meeting_date ? newMeeting.meeting_date.split('T')[0] : ''}
                onChange={(e) => setNewMeeting({ ...newMeeting, meeting_date: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">会议地点</label>
              <input
                type="text"
                value={newMeeting.location || ''}
                onChange={(e) => setNewMeeting({ ...newMeeting, location: e.target.value })}
                className="input"
                placeholder="请输入会议地点"
              />
            </div>
          </div>
          <div>
            <label className="label">参会人员</label>
            <input
              type="text"
              value={newMeeting.attendees || ''}
              onChange={(e) => setNewMeeting({ ...newMeeting, attendees: e.target.value })}
              className="input"
              placeholder="请输入参会人员，用逗号分隔"
            />
          </div>
          <div>
            <label className="label">会议内容 *</label>
            <textarea
              value={newMeeting.content || ''}
              onChange={(e) => setNewMeeting({ ...newMeeting, content: e.target.value })}
              rows={4}
              className="input"
              placeholder="请输入会议内容"
            />
          </div>
          <div>
            <label className="label">附件文件</label>
            <input
              type="file"
              onChange={(e) => setNewFile(e.target.files?.[0] || null)}
              className="input"
            />
            {newFile && <p className="text-sm text-gray-500 mt-1">已选择: {newFile.name}</p>}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MeetingDetail;
