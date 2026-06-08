import { Router, Request, Response } from 'express';
import { z } from 'zod';
import pool, { query } from '../config/database';
import { authenticateToken, requireManager, checkProjectPermission } from '../middleware/auth';
import { successResponse, errorResponse, paginatedResponse, notFoundResponse, forbiddenResponse } from '../utils/response';
import { validate, paginationSchema, idParamSchema, projectIdParamSchema } from '../utils/validation';
import { checkPredecessorMilestones, getMilestoneChain } from '../utils/businessRules';

const router = Router();

const milestoneSchema = z.object({
  project_id: z.string().uuid('项目ID格式不正确'),
  milestone_code: z.string().min(1, '里程碑编码不能为空'),
  milestone_name: z.string().min(1, '里程碑名称不能为空'),
  description: z.string().optional(),
  planned_date: z.string().min(1, '计划完成日期不能为空'),
  actual_date: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'delayed', 'cancelled']).default('pending'),
  sort_order: z.coerce.number().default(0),
  acceptance_criteria: z.string().optional(),
  predecessor_ids: z.array(z.string().uuid()).optional(),
});

router.use(authenticateToken);

router.get('/', async (req: Request, res: Response) => {
  try {
    const { page, pageSize } = validate(paginationSchema, req.query);
    const currentPage = page as number;
    const currentPageSize = pageSize as number;
    const { project_id, status } = req.query;
    const offset = (currentPage - 1) * currentPageSize;

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

    if (status) {
      whereConditions.push(`m.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM milestones m ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT 
        m.*,
        p.project_name,
        p.project_code,
        COALESCE(array_agg(md.predecessor_id) FILTER (WHERE md.predecessor_id IS NOT NULL), '{}') as predecessor_ids,
        u.real_name as creator_name
       FROM milestones m
       JOIN projects p ON m.project_id = p.id
       LEFT JOIN milestone_dependencies md ON m.id = md.milestone_id
       LEFT JOIN users u ON m.created_by = u.id
       ${whereClause}
       GROUP BY m.id, p.project_name, p.project_code, u.real_name
       ORDER BY m.sort_order ASC, m.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, currentPageSize, offset]
    );

    return paginatedResponse(res, result.rows, total, currentPage, currentPageSize);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '查询里程碑列表失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.get('/project/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = validate(projectIdParamSchema, req.params);

    const hasPermission = await checkProjectPermission(req, projectId);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    const chain = await getMilestoneChain(projectId);

    const milestonesResult = await query(
      `SELECT 
        m.*,
        COALESCE(array_agg(md.predecessor_id) FILTER (WHERE md.predecessor_id IS NOT NULL), '{}') as predecessor_ids,
        u.real_name as creator_name
       FROM milestones m
       LEFT JOIN milestone_dependencies md ON m.id = md.milestone_id
       LEFT JOIN users u ON m.created_by = u.id
       WHERE m.project_id = $1
       GROUP BY m.id, u.real_name
       ORDER BY m.sort_order ASC, m.created_at DESC`,
      [projectId]
    );

    const milestonesWithPredecessorInfo = milestonesResult.rows.map((m) => {
      const predecessorDetails = m.predecessor_ids.map((pid: string) => {
        const predecessor = chain.find((c) => c.id === pid);
        return {
          id: pid,
          name: predecessor?.name,
          status: predecessor?.status,
        };
      });
      return { ...m, predecessor_details: predecessorDetails };
    });

    return successResponse(res, {
      chain,
      milestones: milestonesWithPredecessorInfo,
    }, '获取项目里程碑成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '获取项目里程碑失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.post('/', requireManager, async (req: Request, res: Response) => {
  try {
    const { predecessor_ids, ...data } = validate(milestoneSchema, req.body);

    const hasPermission = await checkProjectPermission(req, data.project_id);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO milestones 
         (project_id, milestone_code, milestone_name, description, planned_date, 
          actual_date, status, sort_order, acceptance_criteria, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          data.project_id,
          data.milestone_code,
          data.milestone_name,
          data.description || null,
          data.planned_date,
          data.actual_date || null,
          data.status,
          data.sort_order,
          data.acceptance_criteria || null,
          req.user!.id,
        ]
      );

      const milestoneId = result.rows[0].id;

      if (predecessor_ids && predecessor_ids.length > 0) {
        for (const predecessorId of predecessor_ids) {
          if (predecessorId === milestoneId) continue;
          await client.query(
            `INSERT INTO milestone_dependencies (milestone_id, predecessor_id)
             VALUES ($1, $2)
             ON CONFLICT (milestone_id, predecessor_id) DO NOTHING`,
            [milestoneId, predecessorId]
          );
        }
      }

      await client.query('COMMIT');

      const milestoneWithDeps = await query(
        `SELECT m.*,
          COALESCE(array_agg(md.predecessor_id) FILTER (WHERE md.predecessor_id IS NOT NULL), '{}') as predecessor_ids
         FROM milestones m
         LEFT JOIN milestone_dependencies md ON m.id = md.milestone_id
         WHERE m.id = $1
         GROUP BY m.id`,
        [milestoneId]
      );

      return successResponse(res, milestoneWithDeps.rows[0], '里程碑创建成功', 201);
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
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return errorResponse(res, '里程碑编码已存在', 'DUPLICATE_CODE', 400);
    }
    return errorResponse(res, '创建里程碑失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
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
        COALESCE(array_agg(md.predecessor_id) FILTER (WHERE md.predecessor_id IS NOT NULL), '{}') as predecessor_ids,
        u.real_name as creator_name
       FROM milestones m
       JOIN projects p ON m.project_id = p.id
       LEFT JOIN milestone_dependencies md ON m.id = md.milestone_id
       LEFT JOIN users u ON m.created_by = u.id
       WHERE m.id = $1
       GROUP BY m.id, p.project_name, p.project_code, p.customer_name, u.real_name`,
      [id]
    );

    if (result.rows.length === 0) {
      return notFoundResponse(res, '里程碑');
    }

    const hasPermission = await checkProjectPermission(req, result.rows[0].project_id);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    const predecessorCheck = await checkPredecessorMilestones(id);

    return successResponse(res, {
      ...result.rows[0],
      predecessor_validation: predecessorCheck,
    }, '获取里程碑详情成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '获取里程碑详情失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.put('/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const { id } = validate(idParamSchema, req.params);
    const { predecessor_ids, ...data } = validate(milestoneSchema.partial(), req.body);

    const existing = await query(
      'SELECT id, project_id FROM milestones WHERE id = $1',
      [id]
    );
    if (existing.rows.length === 0) {
      return notFoundResponse(res, '里程碑');
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

      let milestoneResult;
      if (updateFields.length > 0) {
        updateParams.push(id);
        milestoneResult = await client.query(
          `UPDATE milestones SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
          updateParams
        );
      } else {
        milestoneResult = await client.query('SELECT * FROM milestones WHERE id = $1', [id]);
      }

      if (predecessor_ids !== undefined) {
        await client.query('DELETE FROM milestone_dependencies WHERE milestone_id = $1', [id]);

        for (const predecessorId of predecessor_ids) {
          if (predecessorId === id) continue;
          await client.query(
            `INSERT INTO milestone_dependencies (milestone_id, predecessor_id)
             VALUES ($1, $2)
             ON CONFLICT (milestone_id, predecessor_id) DO NOTHING`,
            [id, predecessorId]
          );
        }
      }

      await client.query('COMMIT');

      const milestoneWithDeps = await query(
        `SELECT m.*,
          COALESCE(array_agg(md.predecessor_id) FILTER (WHERE md.predecessor_id IS NOT NULL), '{}') as predecessor_ids
         FROM milestones m
         LEFT JOIN milestone_dependencies md ON m.id = md.milestone_id
         WHERE m.id = $1
         GROUP BY m.id`,
        [id]
      );

      return successResponse(res, milestoneWithDeps.rows[0], '里程碑更新成功');
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
    return errorResponse(res, '更新里程碑失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = validate(idParamSchema, req.params);
    const { status, actual_date } = validate(z.object({
      status: z.enum(['pending', 'in_progress', 'completed', 'delayed', 'cancelled']),
      actual_date: z.string().optional(),
    }), req.body);

    const existing = await query(
      'SELECT id, project_id, status FROM milestones WHERE id = $1',
      [id]
    );
    if (existing.rows.length === 0) {
      return notFoundResponse(res, '里程碑');
    }

    const hasPermission = await checkProjectPermission(req, existing.rows[0].project_id);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    if (status === 'completed') {
      const canAccept = await checkPredecessorMilestones(id);
      if (!canAccept.valid) {
        return errorResponse(res, canAccept.message, 'PREDECESSOR_NOT_COMPLETED', 400);
      }
    }

    const updateData: any = { status };
    if (status === 'completed' && actual_date) {
      updateData.actual_date = actual_date;
    }

    const result = await query(
      `UPDATE milestones 
       SET status = $1, actual_date = COALESCE($2, actual_date)
       WHERE id = $3 
       RETURNING *`,
      [status, actual_date || null, id]
    );

    return successResponse(res, result.rows[0], '里程碑状态更新成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '更新里程碑状态失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.delete('/:id', requireManager, async (req: Request, res: Response) => {
  try {
    const { id } = validate(idParamSchema, req.params);

    const existing = await query(
      'SELECT id, project_id FROM milestones WHERE id = $1',
      [id]
    );
    if (existing.rows.length === 0) {
      return notFoundResponse(res, '里程碑');
    }

    const hasPermission = await checkProjectPermission(req, existing.rows[0].project_id);
    if (!hasPermission) {
      return forbiddenResponse(res);
    }

    const result = await query('DELETE FROM milestones WHERE id = $1 RETURNING id', [id]);

    return successResponse(res, null, '里程碑删除成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '删除里程碑失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.get('/:id/predecessors/check', async (req: Request, res: Response) => {
  try {
    const { id } = validate(idParamSchema, req.params);

    const checkResult = await checkPredecessorMilestones(id);

    return successResponse(res, checkResult, '前置里程碑校验完成');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '校验前置里程碑失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

export default router;
