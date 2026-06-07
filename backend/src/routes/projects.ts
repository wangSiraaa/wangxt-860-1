import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database';
import { authenticateToken, requireManager, checkProjectPermission } from '../middleware/auth';
import { successResponse, errorResponse, paginatedResponse, notFoundResponse, forbiddenResponse } from '../utils/response';
import { validate, paginationSchema, idParamSchema } from '../utils/validation';
import { calculateProjectProgress } from '../utils/businessRules';

const router = Router();

const projectSchema = z.object({
  project_code: z.string().min(1, '项目编码不能为空'),
  project_name: z.string().min(1, '项目名称不能为空'),
  customer_name: z.string().min(1, '客户名称不能为空'),
  customer_contact: z.string().optional(),
  customer_phone: z.string().optional(),
  project_manager_id: z.string().uuid('项目经理ID格式不正确').optional(),
  description: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  status: z.enum(['planning', 'in_progress', 'suspended', 'completed', 'cancelled']).default('planning'),
  total_budget: z.coerce.number().optional(),
});

const projectQuerySchema = paginationSchema.extend({
  status: z.string().optional(),
  keyword: z.string().optional(),
  manager_id: z.string().optional(),
});

router.use(authenticateToken);

router.get('/', async (req: Request, res: Response) => {
  try {
    const { page, pageSize, status, keyword, manager_id } = validate(projectQuerySchema, req.query);
    const offset = (page - 1) * pageSize;

    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (req.user!.role !== 'admin') {
      whereConditions.push(`(p.project_manager_id = $${paramIndex} OR EXISTS (
        SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $${paramIndex}
      ))`);
      params.push(req.user!.id);
      paramIndex++;
    }

    if (status) {
      whereConditions.push(`p.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (keyword) {
      whereConditions.push(`(p.project_name ILIKE $${paramIndex} OR p.project_code ILIKE $${paramIndex} OR p.customer_name ILIKE $${paramIndex})`);
      params.push(`%${keyword}%`);
      paramIndex++;
    }

    if (manager_id) {
      whereConditions.push(`p.project_manager_id = $${paramIndex}`);
      params.push(manager_id);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM projects p ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT 
        p.*,
        u.real_name as manager_name,
        u.username as manager_username
       FROM projects p
       LEFT JOIN users u ON p.project_manager_id = u.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageSize, offset]
    );

    const projects = await Promise.all(
      result.rows.map(async (project) => {
        const progress = await calculateProjectProgress(project.id);
        return { ...project, ...progress };
      })
    );

    return paginatedResponse(res, projects, total, page, pageSize);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '查询项目列表失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.post('/', requireManager, async (req: Request, res: Response) => {
  try {
    const data = validate(projectSchema, req.body);

    const result = await query(
      `INSERT INTO projects 
       (project_code, project_name, customer_name, customer_contact, customer_phone, 
        project_manager_id, description, start_date, end_date, status, total_budget, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        data.project_code,
        data.project_name,
        data.customer_name,
        data.customer_contact || null,
        data.customer_phone || null,
        data.project_manager_id || null,
        data.description || null,
        data.start_date || null,
        data.end_date || null,
        data.status,
        data.total_budget || null,
        req.user!.id,
      ]
    );

    return successResponse(res, result.rows[0], '项目创建成功', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return errorResponse(res, '项目编码已存在', 'DUPLICATE_CODE', 400);
    }
    return errorResponse(res, '创建项目失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = validate(idParamSchema, req.params);

    const hasPermission = await checkProjectPermission(req, id);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    const result = await query(
      `SELECT 
        p.*,
        u.real_name as manager_name,
        u.username as manager_username,
        creator.real_name as creator_name
       FROM projects p
       LEFT JOIN users u ON p.project_manager_id = u.id
       LEFT JOIN users creator ON p.created_by = creator.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return notFoundResponse(res, '项目');
    }

    const progress = await calculateProjectProgress(id);
    const project = { ...result.rows[0], ...progress };

    return successResponse(res, project, '获取项目详情成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '获取项目详情失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.put('/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const { id } = validate(idParamSchema, req.params);
    const data = validate(projectSchema.partial(), req.body);

    const hasPermission = await checkProjectPermission(req, id);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    const existing = await query('SELECT id FROM projects WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return notFoundResponse(res, '项目');
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
      `UPDATE projects SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      updateParams
    );

    return successResponse(res, result.rows[0], '项目更新成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return errorResponse(res, '项目编码已存在', 'DUPLICATE_CODE', 400);
    }
    return errorResponse(res, '更新项目失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = validate(idParamSchema, req.params);
    const { status } = validate(z.object({
      status: z.enum(['planning', 'in_progress', 'suspended', 'completed', 'cancelled']),
    }), req.body);

    const hasPermission = await checkProjectPermission(req, id);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    const result = await query(
      'UPDATE projects SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return notFoundResponse(res, '项目');
    }

    return successResponse(res, result.rows[0], '项目状态更新成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '更新项目状态失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.delete('/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const { id } = validate(idParamSchema, req.params);

    if (req.user!.role !== 'admin') {
      const hasPermission = await checkProjectPermission(req, id);
      if (!hasPermission) {
        return forbiddenResponse(res);
      }
    }

    const result = await query('DELETE FROM projects WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return notFoundResponse(res, '项目');
    }

    return successResponse(res, null, '项目删除成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '删除项目失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.get('/:id/members', async (req: Request, res: Response) => {
  try {
    const { id } = validate(idParamSchema, req.params);

    const hasPermission = await checkProjectPermission(req, id);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    const result = await query(
      `SELECT 
        pm.*,
        u.real_name,
        u.username,
        u.email,
        u.department
       FROM project_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1
       ORDER BY pm.joined_at DESC`,
      [id]
    );

    return successResponse(res, result.rows, '获取项目成员成功');
  } catch (error) {
    return errorResponse(res, '获取项目成员失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.post('/:id/members', requireManager, async (req: Request, res: Response) => {
  try {
    const { id } = validate(idParamSchema, req.params);
    const { user_id, role } = validate(z.object({
      user_id: z.string().uuid('用户ID格式不正确'),
      role: z.string().min(1, '角色不能为空'),
    }), req.body);

    const hasPermission = await checkProjectPermission(req, id);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    const result = await query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = $3
       RETURNING *`,
      [id, user_id, role]
    );

    return successResponse(res, result.rows[0], '项目成员添加成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '添加项目成员失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

export default router;
