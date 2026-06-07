import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database';
import { authenticateToken, requireManager, checkProjectPermission } from '../middleware/auth';
import { successResponse, errorResponse, paginatedResponse, notFoundResponse, forbiddenResponse } from '../utils/response';
import { validate, paginationSchema, idParamSchema } from '../utils/validation';

const router = Router();

const riskSchema = z.object({
  project_id: z.string().uuid('项目ID格式不正确'),
  risk_code: z.string().min(1, '风险编码不能为空'),
  risk_title: z.string().min(1, '风险标题不能为空'),
  description: z.string().optional(),
  risk_level: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  probability: z.enum(['low', 'medium', 'high']).default('medium'),
  impact: z.enum(['low', 'medium', 'high']).default('medium'),
  mitigation_measure: z.string().optional(),
  owner_id: z.string().uuid('负责人ID格式不正确').optional(),
  status: z.enum(['open', 'monitoring', 'mitigated', 'resolved', 'closed']).default('open'),
  identified_date: z.string().optional(),
  resolved_date: z.string().optional(),
});

router.use(authenticateToken);

router.get('/', async (req: Request, res: Response) => {
  try {
    const { page, pageSize } = validate(paginationSchema, req.query);
    const { project_id, status, risk_level } = req.query;
    const offset = (page - 1) * pageSize;

    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (project_id) {
      const hasPermission = await checkProjectPermission(req, project_id as string);
      if (!hasPermission) {
        return forbiddenResponse(res);
      }
      whereConditions.push(`r.project_id = $${paramIndex}`);
      params.push(project_id);
      paramIndex++;
    } else if (req.user!.role !== 'admin') {
      whereConditions.push(`EXISTS (
        SELECT 1 FROM projects p 
        LEFT JOIN project_members pm ON p.id = pm.project_id
        WHERE p.id = r.project_id 
        AND (p.project_manager_id = $${paramIndex} OR pm.user_id = $${paramIndex})
      )`);
      params.push(req.user!.id);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`r.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (risk_level) {
      whereConditions.push(`r.risk_level = $${paramIndex}`);
      params.push(risk_level);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM risks r ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT 
        r.*,
        p.project_name,
        p.project_code,
        owner.real_name as owner_name,
        u.real_name as creator_name
       FROM risks r
       JOIN projects p ON r.project_id = p.id
       LEFT JOIN users owner ON r.owner_id = owner.id
       LEFT JOIN users u ON r.created_by = u.id
       ${whereClause}
       ORDER BY 
         CASE r.risk_level 
           WHEN 'critical' THEN 1 
           WHEN 'high' THEN 2 
           WHEN 'medium' THEN 3 
           WHEN 'low' THEN 4 
         END,
         r.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageSize, offset]
    );

    return paginatedResponse(res, result.rows, total, page, pageSize);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '查询风险列表失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const data = validate(riskSchema, req.body);

    const hasPermission = await checkProjectPermission(req, data.project_id);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    const result = await query(
      `INSERT INTO risks 
       (project_id, risk_code, risk_title, description, risk_level, probability, 
        impact, mitigation_measure, owner_id, status, identified_date, resolved_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        data.project_id,
        data.risk_code,
        data.risk_title,
        data.description || null,
        data.risk_level,
        data.probability,
        data.impact,
        data.mitigation_measure || null,
        data.owner_id || null,
        data.status,
        data.identified_date || null,
        data.resolved_date || null,
        req.user!.id,
      ]
    );

    return successResponse(res, result.rows[0], '风险登记成功', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return errorResponse(res, '风险编码已存在', 'DUPLICATE_CODE', 400);
    }
    return errorResponse(res, '登记风险失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = validate(idParamSchema, req.params);

    const result = await query(
      `SELECT 
        r.*,
        p.project_name,
        p.project_code,
        p.customer_name,
        owner.real_name as owner_name,
        owner.username as owner_username,
        u.real_name as creator_name
       FROM risks r
       JOIN projects p ON r.project_id = p.id
       LEFT JOIN users owner ON r.owner_id = owner.id
       LEFT JOIN users u ON r.created_by = u.id
       WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return notFoundResponse(res, '风险项');
    }

    const hasPermission = await checkProjectPermission(req, result.rows[0].project_id);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    return successResponse(res, result.rows[0], '获取风险详情成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '获取风险详情失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = validate(idParamSchema, req.params);
    const data = validate(riskSchema.partial(), req.body);

    const existing = await query(
      'SELECT id, project_id FROM risks WHERE id = $1',
      [id]
    );
    if (existing.rows.length === 0) {
      return notFoundResponse(res, '风险项');
    }

    const projectId = data.project_id || existing.rows[0].project_id;
    const hasPermission = await checkProjectPermission(req, projectId);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

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

    updateParams.push(id);

    const result = await query(
      `UPDATE risks SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      updateParams
    );

    return successResponse(res, result.rows[0], '风险更新成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '更新风险失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = validate(idParamSchema, req.params);
    const { status, resolved_date } = validate(z.object({
      status: z.enum(['open', 'monitoring', 'mitigated', 'resolved', 'closed']),
      resolved_date: z.string().optional(),
    }), req.body);

    const existing = await query(
      'SELECT id, project_id FROM risks WHERE id = $1',
      [id]
    );
    if (existing.rows.length === 0) {
      return notFoundResponse(res, '风险项');
    }

    const hasPermission = await checkProjectPermission(req, existing.rows[0].project_id);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    const result = await query(
      `UPDATE risks 
       SET status = $1, resolved_date = COALESCE($2, resolved_date)
       WHERE id = $3 
       RETURNING *`,
      [status, resolved_date || null, id]
    );

    return successResponse(res, result.rows[0], '风险状态更新成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '更新风险状态失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.delete('/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const { id } = validate(idParamSchema, req.params);

    const existing = await query(
      'SELECT id, project_id FROM risks WHERE id = $1',
      [id]
    );
    if (existing.rows.length === 0) {
      return notFoundResponse(res, '风险项');
    }

    const hasPermission = await checkProjectPermission(req, existing.rows[0].project_id);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    await query('DELETE FROM risks WHERE id = $1', [id]);

    return successResponse(res, null, '风险删除成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '删除风险失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

export default router;
