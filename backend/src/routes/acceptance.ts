import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pool, { query } from '../config/database';
import { authenticateToken, requireManager, checkProjectPermission } from '../middleware/auth';
import { successResponse, errorResponse, paginatedResponse, notFoundResponse, forbiddenResponse } from '../utils/response';
import { validate, paginationSchema, idParamSchema } from '../utils/validation';
import { checkAcceptanceCanSubmit, checkMilestoneCanAccept } from '../utils/businessRules';

const router = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads/acceptance';
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
});

const acceptanceSchema = z.object({
  project_id: z.string().uuid('项目ID格式不正确'),
  milestone_id: z.string().uuid('里程碑ID格式不正确').optional(),
  acceptance_code: z.string().min(1, '验收单编码不能为空'),
  acceptance_title: z.string().min(1, '验收标题不能为空'),
  description: z.string().optional(),
  acceptance_content: z.string().optional(),
  acceptance_result: z.enum(['passed', 'failed', 'partial']).optional(),
  status: z.enum(['draft', 'submitted', 'reviewing', 'accepted', 'rejected', 'cancelled']).default('draft'),
  reviewer_id: z.string().uuid('审核人ID格式不正确').optional(),
  review_opinion: z.string().optional(),
});

router.use(authenticateToken);

router.get('/', async (req: Request, res: Response) => {
  try {
    const { page, pageSize } = validate(paginationSchema, req.query);
    const currentPage = page as number;
    const currentPageSize = pageSize as number;
    const { project_id, milestone_id, status } = req.query;
    const offset = (currentPage - 1) * currentPageSize;

    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (project_id) {
      const hasPermission = await checkProjectPermission(req, project_id as string);
      if (!hasPermission) {
        return forbiddenResponse(res);
      }
      whereConditions.push(`a.project_id = $${paramIndex}`);
      params.push(project_id);
      paramIndex++;
    } else if (req.user!.role !== 'admin') {
      whereConditions.push(`EXISTS (
        SELECT 1 FROM projects p 
        LEFT JOIN project_members pm ON p.id = pm.project_id
        WHERE p.id = a.project_id 
        AND (p.project_manager_id = $${paramIndex} OR pm.user_id = $${paramIndex})
      )`);
      params.push(req.user!.id);
      paramIndex++;
    }

    if (milestone_id) {
      whereConditions.push(`a.milestone_id = $${paramIndex}`);
      params.push(milestone_id);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`a.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM acceptance_forms a ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT 
        a.*,
        p.project_name,
        p.project_code,
        m.milestone_name,
        m.milestone_code,
        applicant.real_name as applicant_name,
        reviewer.real_name as reviewer_name,
        u.real_name as creator_name
       FROM acceptance_forms a
       JOIN projects p ON a.project_id = p.id
       LEFT JOIN milestones m ON a.milestone_id = m.id
       LEFT JOIN users applicant ON a.applicant_id = applicant.id
       LEFT JOIN users reviewer ON a.reviewer_id = reviewer.id
       LEFT JOIN users u ON a.created_by = u.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, currentPageSize, offset]
    );

    return paginatedResponse(res, result.rows, total, currentPage, currentPageSize);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '查询验收单列表失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.post('/', upload.array('attachments', 10), async (req: Request, res: Response) => {
  try {
    const body = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body;
    const data = validate(acceptanceSchema, body);

    const hasPermission = await checkProjectPermission(req, data.project_id);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    if (data.milestone_id) {
      const milestoneCheck = await query(
        'SELECT id, status FROM milestones WHERE id = $1',
        [data.milestone_id]
      );
      if (milestoneCheck.rows.length === 0) {
        return errorResponse(res, '关联的里程碑不存在', 'MILESTONE_NOT_FOUND', 400);
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO acceptance_forms 
         (project_id, milestone_id, acceptance_code, acceptance_title, description, 
          acceptance_content, acceptance_result, status, applicant_id, reviewer_id, review_opinion, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          data.project_id,
          data.milestone_id || null,
          data.acceptance_code,
          data.acceptance_title,
          data.description || null,
          data.acceptance_content || null,
          data.acceptance_result || null,
          data.status,
          req.user!.id,
          data.reviewer_id || null,
          data.review_opinion || null,
          req.user!.id,
        ]
      );

      const acceptanceId = result.rows[0].id;

      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
          await client.query(
            `INSERT INTO acceptance_attachments 
             (acceptance_id, file_path, file_name, file_size, uploaded_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [acceptanceId, file.path, file.originalname, file.size, req.user!.id]
          );
        }
      }

      await client.query('COMMIT');

      const acceptanceWithAttachments = await query(
        `SELECT a.*,
          COALESCE(json_agg(
            json_build_object(
              'id', att.id,
              'file_name', att.file_name,
              'file_size', att.file_size,
              'uploaded_at', att.uploaded_at
            )
          ) FILTER (WHERE att.id IS NOT NULL), '[]') as attachments
         FROM acceptance_forms a
         LEFT JOIN acceptance_attachments att ON a.id = att.acceptance_id
         WHERE a.id = $1
         GROUP BY a.id`,
        [acceptanceId]
      );

      return successResponse(res, acceptanceWithAttachments.rows[0], '验收单创建成功', 201);
    } catch (error) {
      await client.query('ROLLBACK');
      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }
      }
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return errorResponse(res, '验收单编码已存在', 'DUPLICATE_CODE', 400);
    }
    return errorResponse(res, '创建验收单失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = validate(idParamSchema, req.params);

    const result = await query(
      `SELECT 
        a.*,
        p.project_name,
        p.project_code,
        p.customer_name,
        m.milestone_name,
        m.milestone_code,
        m.status as milestone_status,
        applicant.real_name as applicant_name,
        applicant.username as applicant_username,
        reviewer.real_name as reviewer_name,
        reviewer.username as reviewer_username,
        u.real_name as creator_name,
        COALESCE(json_agg(
          json_build_object(
            'id', att.id,
            'file_name', att.file_name,
            'file_size', att.file_size,
            'uploaded_at', att.uploaded_at,
            'uploaded_by', uploader.real_name
          )
        ) FILTER (WHERE att.id IS NOT NULL), '[]') as attachments
       FROM acceptance_forms a
       JOIN projects p ON a.project_id = p.id
       LEFT JOIN milestones m ON a.milestone_id = m.id
       LEFT JOIN users applicant ON a.applicant_id = applicant.id
       LEFT JOIN users reviewer ON a.reviewer_id = reviewer.id
       LEFT JOIN users u ON a.created_by = u.id
       LEFT JOIN acceptance_attachments att ON a.id = att.acceptance_id
       LEFT JOIN users uploader ON att.uploaded_by = uploader.id
       WHERE a.id = $1
       GROUP BY a.id, p.project_name, p.project_code, p.customer_name, 
                m.milestone_name, m.milestone_code, m.status,
                applicant.real_name, applicant.username,
                reviewer.real_name, reviewer.username,
                u.real_name`,
      [id]
    );

    if (result.rows.length === 0) {
      return notFoundResponse(res, '验收单');
    }

    const hasPermission = await checkProjectPermission(req, result.rows[0].project_id);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    const acceptance = result.rows[0];
    let predecessorValidation = null;
    if (acceptance.milestone_id) {
      predecessorValidation = await checkMilestoneCanAccept(acceptance.milestone_id);
    }

    return successResponse(res, {
      ...acceptance,
      predecessor_validation: predecessorValidation,
    }, '获取验收单详情成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '获取验收单详情失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.post('/:id/submit', async (req: Request, res: Response) => {
  try {
    const { id } = validate(idParamSchema, req.params);

    const existing = await query(
      'SELECT id, project_id, milestone_id, status FROM acceptance_forms WHERE id = $1',
      [id]
    );
    if (existing.rows.length === 0) {
      return notFoundResponse(res, '验收单');
    }

    const hasPermission = await checkProjectPermission(req, existing.rows[0].project_id);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    const canSubmit = await checkAcceptanceCanSubmit(id);
    if (!canSubmit.valid) {
      return errorResponse(res, canSubmit.message, 'PREDECESSOR_NOT_COMPLETED', 400);
    }

    const result = await query(
      `UPDATE acceptance_forms 
       SET status = 'submitted', submit_date = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'draft'
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, '验收单状态不允许提交', 'INVALID_STATUS', 400);
    }

    return successResponse(res, result.rows[0], '验收单提交成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '提交验收单失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.post('/:id/review', requireManager, async (req: Request, res: Response) => {
  try {
    const { id } = validate(idParamSchema, req.params);
    const { status, acceptance_result, review_opinion } = validate(z.object({
      status: z.enum(['accepted', 'rejected']),
      acceptance_result: z.enum(['passed', 'failed', 'partial']).optional(),
      review_opinion: z.string().optional(),
    }), req.body);

    const existing = await query(
      'SELECT id, project_id, milestone_id, status FROM acceptance_forms WHERE id = $1',
      [id]
    );
    if (existing.rows.length === 0) {
      return notFoundResponse(res, '验收单');
    }

    const hasPermission = await checkProjectPermission(req, existing.rows[0].project_id);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    if (existing.rows[0].status !== 'submitted' && existing.rows[0].status !== 'reviewing') {
      return errorResponse(res, '只有已提交或审核中的验收单可以审核', 'INVALID_STATUS', 400);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const updateData: any = {
        status,
        review_opinion: review_opinion || null,
        reviewer_id: req.user!.id,
      };

      if (status === 'accepted') {
        updateData.acceptance_result = acceptance_result || 'passed';
        updateData.accept_date = new Date();
      }

      const result = await client.query(
        `UPDATE acceptance_forms 
         SET status = $1, acceptance_result = COALESCE($2, acceptance_result), 
             review_opinion = COALESCE($3, review_opinion), 
             reviewer_id = $4, accept_date = COALESCE($5, accept_date)
         WHERE id = $6
         RETURNING *`,
        [
          updateData.status,
          updateData.acceptance_result,
          updateData.review_opinion,
          updateData.reviewer_id,
          updateData.accept_date || null,
          id,
        ]
      );

      if (status === 'accepted' && existing.rows[0].milestone_id) {
        await client.query(
          `UPDATE milestones 
           SET status = 'completed', actual_date = CURRENT_DATE
           WHERE id = $1 AND status != 'completed'`,
          [existing.rows[0].milestone_id]
        );
      }

      await client.query('COMMIT');

      return successResponse(res, result.rows[0], 
        status === 'accepted' ? '验收通过成功' : '验收驳回成功'
      );
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
    return errorResponse(res, '审核验收单失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = validate(idParamSchema, req.params);
    const { status } = validate(z.object({
      status: z.enum(['draft', 'submitted', 'reviewing', 'accepted', 'rejected', 'cancelled']),
    }), req.body);

    const existing = await query(
      'SELECT id, project_id FROM acceptance_forms WHERE id = $1',
      [id]
    );
    if (existing.rows.length === 0) {
      return notFoundResponse(res, '验收单');
    }

    const hasPermission = await checkProjectPermission(req, existing.rows[0].project_id);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    const result = await query(
      'UPDATE acceptance_forms SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    return successResponse(res, result.rows[0], '验收单状态更新成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '更新验收单状态失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.get('/attachment/:id/download', async (req: Request, res: Response) => {
  try {
    const { id } = validate(idParamSchema, req.params);

    const result = await query(
      `SELECT att.acceptance_id, att.file_path, att.file_name, a.project_id
       FROM acceptance_attachments att
       JOIN acceptance_forms a ON att.acceptance_id = a.id
       WHERE att.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return notFoundResponse(res, '附件');
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

router.delete('/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const { id } = validate(idParamSchema, req.params);

    const existing = await query(
      'SELECT id, project_id FROM acceptance_forms WHERE id = $1',
      [id]
    );
    if (existing.rows.length === 0) {
      return notFoundResponse(res, '验收单');
    }

    const hasPermission = await checkProjectPermission(req, existing.rows[0].project_id);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    const attachments = await query(
      'SELECT file_path FROM acceptance_attachments WHERE acceptance_id = $1',
      [id]
    );
    for (const att of attachments.rows) {
      if (att.file_path && fs.existsSync(att.file_path)) {
        fs.unlinkSync(att.file_path);
      }
    }

    await query('DELETE FROM acceptance_forms WHERE id = $1', [id]);

    return successResponse(res, null, '验收单删除成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '删除验收单失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

export default router;
