import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pool, { query } from '../config/database';
import { authenticateToken, checkProjectPermission } from '../middleware/auth';
import { successResponse, errorResponse, paginatedResponse, notFoundResponse, forbiddenResponse } from '../utils/response';
import { validate, paginationSchema, idParamSchema } from '../utils/validation';

const router = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  },
});

const meetingSchema = z.object({
  project_id: z.string().uuid('项目ID格式不正确'),
  meeting_title: z.string().min(1, '会议标题不能为空'),
  meeting_type: z.string().optional(),
  meeting_date: z.string().min(1, '会议时间不能为空'),
  location: z.string().optional(),
  duration: z.coerce.number().optional(),
  host_id: z.string().uuid('主持人ID格式不正确').optional(),
  content: z.string().optional(),
  decisions: z.string().optional(),
  action_items: z.string().optional(),
  attendee_ids: z.array(z.string().uuid()).optional(),
});

router.use(authenticateToken);

router.get('/', async (req: Request, res: Response) => {
  try {
    const { page, pageSize } = validate(paginationSchema, req.query);
    const { project_id, meeting_type, start_date, end_date } = req.query;
    const offset = (page - 1) * pageSize;

    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (project_id) {
      const hasPermission = await checkProjectPermission(req, project_id as string);
      if (!hasPermission) {
        return forbiddenResponse(res);
      }
      whereConditions.push(`m.project_id = $${paramIndex}`);
      params.push(project_id);
      paramIndex++;
    } else if (req.user!.role !== 'admin') {
      whereConditions.push(`EXISTS (
        SELECT 1 FROM projects p 
        LEFT JOIN project_members pm ON p.id = pm.project_id
        WHERE p.id = m.project_id 
        AND (p.project_manager_id = $${paramIndex} OR pm.user_id = $${paramIndex})
      )`);
      params.push(req.user!.id);
      paramIndex++;
    }

    if (meeting_type) {
      whereConditions.push(`m.meeting_type = $${paramIndex}`);
      params.push(meeting_type);
      paramIndex++;
    }

    if (start_date) {
      whereConditions.push(`m.meeting_date >= $${paramIndex}`);
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      whereConditions.push(`m.meeting_date <= $${paramIndex}`);
      params.push(end_date);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM meeting_minutes m ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT 
        m.*,
        p.project_name,
        p.project_code,
        host.real_name as host_name,
        u.real_name as creator_name,
        COALESCE(array_agg(att.user_id) FILTER (WHERE att.user_id IS NOT NULL), '{}') as attendee_ids
       FROM meeting_minutes m
       JOIN projects p ON m.project_id = p.id
       LEFT JOIN users host ON m.host_id = host.id
       LEFT JOIN users u ON m.created_by = u.id
       LEFT JOIN meeting_attendees att ON m.id = att.meeting_id
       ${whereClause}
       GROUP BY m.id, p.project_name, p.project_code, host.real_name, u.real_name
       ORDER BY m.meeting_date DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageSize, offset]
    );

    return paginatedResponse(res, result.rows, total, page, pageSize);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '查询会议列表失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const body = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body;
    const { attendee_ids, ...data } = validate(meetingSchema, body);

    const hasPermission = await checkProjectPermission(req, data.project_id);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const fileData = req.file ? {
        file_path: req.file.path,
        file_name: req.file.originalname,
      } : {};

      const result = await client.query(
        `INSERT INTO meeting_minutes 
         (project_id, meeting_title, meeting_type, meeting_date, location, duration, 
          host_id, content, decisions, action_items, file_path, file_name, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          data.project_id,
          data.meeting_title,
          data.meeting_type || null,
          data.meeting_date,
          data.location || null,
          data.duration || null,
          data.host_id || null,
          data.content || null,
          data.decisions || null,
          data.action_items || null,
          (fileData as any).file_path || null,
          (fileData as any).file_name || null,
          req.user!.id,
        ]
      );

      const meetingId = result.rows[0].id;

      if (attendee_ids && attendee_ids.length > 0) {
        for (const userId of attendee_ids) {
          await client.query(
            `INSERT INTO meeting_attendees (meeting_id, user_id, attended)
             VALUES ($1, $2, true)
             ON CONFLICT (meeting_id, user_id) DO NOTHING`,
            [meetingId, userId]
          );
        }
      }

      await client.query('COMMIT');

      const meetingWithAttendees = await query(
        `SELECT m.*,
          COALESCE(array_agg(att.user_id) FILTER (WHERE att.user_id IS NOT NULL), '{}') as attendee_ids
         FROM meeting_minutes m
         LEFT JOIN meeting_attendees att ON m.id = att.meeting_id
         WHERE m.id = $1
         GROUP BY m.id`,
        [meetingId]
      );

      return successResponse(res, meetingWithAttendees.rows[0], '会议纪要上传成功', 201);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '上传会议纪要失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = validate(idParamSchema, req.params);

    const result = await query(
      `SELECT 
        m.*,
        p.project_name,
        p.project_code,
        p.customer_name,
        host.real_name as host_name,
        host.username as host_username,
        u.real_name as creator_name,
        COALESCE(json_agg(
          json_build_object(
            'id', att.user_id,
            'name', att_user.real_name,
            'username', att_user.username,
            'attended', att.attended
          )
        ) FILTER (WHERE att.user_id IS NOT NULL), '[]') as attendees
       FROM meeting_minutes m
       JOIN projects p ON m.project_id = p.id
       LEFT JOIN users host ON m.host_id = host.id
       LEFT JOIN users u ON m.created_by = u.id
       LEFT JOIN meeting_attendees att ON m.id = att.meeting_id
       LEFT JOIN users att_user ON att.user_id = att_user.id
       WHERE m.id = $1
       GROUP BY m.id, p.project_name, p.project_code, p.customer_name, host.real_name, host.username, u.real_name`,
      [id]
    );

    if (result.rows.length === 0) {
      return notFoundResponse(res, '会议纪要');
    }

    const hasPermission = await checkProjectPermission(req, result.rows[0].project_id);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    return successResponse(res, result.rows[0], '获取会议详情成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '获取会议详情失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.put('/:id', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { id } = validate(idParamSchema, req.params);
    const body = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body;
    const { attendee_ids, ...data } = validate(meetingSchema.partial(), body);

    const existing = await query(
      'SELECT id, project_id, file_path FROM meeting_minutes WHERE id = $1',
      [id]
    );
    if (existing.rows.length === 0) {
      return notFoundResponse(res, '会议纪要');
    }

    const projectId = data.project_id || existing.rows[0].project_id;
    const hasPermission = await checkProjectPermission(req, projectId);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const updateFields: string[] = [];
      const updateParams: any[] = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          updateFields.push(`${key} = $${paramIndex}`);
          updateParams.push(value);
          paramIndex++;
        }
      }

      if (req.file) {
        if (existing.rows[0].file_path && fs.existsSync(existing.rows[0].file_path)) {
          fs.unlinkSync(existing.rows[0].file_path);
        }
        updateFields.push(`file_path = $${paramIndex}`);
        updateParams.push(req.file.path);
        paramIndex++;
        updateFields.push(`file_name = $${paramIndex}`);
        updateParams.push(req.file.originalname);
        paramIndex++;
      }

      let meetingResult;
      if (updateFields.length > 0) {
        updateParams.push(id);
        meetingResult = await client.query(
          `UPDATE meeting_minutes SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
          updateParams
        );
      } else {
        meetingResult = await client.query('SELECT * FROM meeting_minutes WHERE id = $1', [id]);
      }

      if (attendee_ids !== undefined) {
        await client.query('DELETE FROM meeting_attendees WHERE meeting_id = $1', [id]);

        for (const userId of attendee_ids) {
          await client.query(
            `INSERT INTO meeting_attendees (meeting_id, user_id, attended)
             VALUES ($1, $2, true)
             ON CONFLICT (meeting_id, user_id) DO NOTHING`,
            [id, userId]
          );
        }
      }

      await client.query('COMMIT');

      const meetingWithAttendees = await query(
        `SELECT m.*,
          COALESCE(array_agg(att.user_id) FILTER (WHERE att.user_id IS NOT NULL), '{}') as attendee_ids
         FROM meeting_minutes m
         LEFT JOIN meeting_attendees att ON m.id = att.meeting_id
         WHERE m.id = $1
         GROUP BY m.id`,
        [id]
      );

      return successResponse(res, meetingWithAttendees.rows[0], '会议纪要更新成功');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '更新会议纪要失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = validate(idParamSchema, req.params);

    const existing = await query(
      'SELECT id, project_id, file_path FROM meeting_minutes WHERE id = $1',
      [id]
    );
    if (existing.rows.length === 0) {
      return notFoundResponse(res, '会议纪要');
    }

    const hasPermission = await checkProjectPermission(req, existing.rows[0].project_id);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    if (existing.rows[0].file_path && fs.existsSync(existing.rows[0].file_path)) {
      fs.unlinkSync(existing.rows[0].file_path);
    }

    await query('DELETE FROM meeting_minutes WHERE id = $1', [id]);

    return successResponse(res, null, '会议纪要删除成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '删除会议纪要失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.get('/download/:id', async (req: Request, res: Response) => {
  try {
    const { id } = validate(idParamSchema, req.params);

    const result = await query(
      'SELECT id, project_id, file_path, file_name FROM meeting_minutes WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return notFoundResponse(res, '会议纪要');
    }

    const hasPermission = await checkProjectPermission(req, result.rows[0].project_id);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    const filePath = result.rows[0].file_path;
    const fileName = result.rows[0].file_name;

    if (!filePath || !fs.existsSync(filePath)) {
      return notFoundResponse(res, '附件文件');
    }

    res.download(filePath, fileName);
  } catch (error) {
    return errorResponse(res, '下载附件失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

export default router;
