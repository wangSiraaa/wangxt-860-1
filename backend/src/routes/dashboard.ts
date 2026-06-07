import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { calculateProjectProgress } from '../utils/businessRules';

const router = Router();

router.use(authenticateToken);

router.get('/overview', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';

    const projectFilter = isAdmin
      ? ''
      : `WHERE p.project_manager_id = $1 OR EXISTS (
          SELECT 1 FROM project_members pm 
          WHERE pm.project_id = p.id AND pm.user_id = $1
        )`;
    const params = isAdmin ? [] : [userId];

    const projectsResult = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'planning') as planning,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'suspended') as suspended,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
       FROM projects p ${projectFilter}`,
      params
    );

    const milestonesResult = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE m.status = 'pending') as pending,
        COUNT(*) FILTER (WHERE m.status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE m.status = 'completed') as completed,
        COUNT(*) FILTER (WHERE m.status = 'delayed') as delayed,
        COUNT(*) FILTER (WHERE m.status = 'cancelled') as cancelled
       FROM milestones m
       JOIN projects p ON m.project_id = p.id
       ${isAdmin ? '' : `WHERE p.project_manager_id = $1 OR EXISTS (
          SELECT 1 FROM project_members pm 
          WHERE pm.project_id = p.id AND pm.user_id = $1
        )`}`,
      params
    );

    const risksResult = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE r.risk_level = 'low') as low,
        COUNT(*) FILTER (WHERE r.risk_level = 'medium') as medium,
        COUNT(*) FILTER (WHERE r.risk_level = 'high') as high,
        COUNT(*) FILTER (WHERE r.risk_level = 'critical') as critical,
        COUNT(*) FILTER (WHERE r.status = 'open') as open,
        COUNT(*) FILTER (WHERE r.status = 'resolved') as resolved,
        COUNT(*) FILTER (WHERE r.status = 'closed') as closed
       FROM risks r
       JOIN projects p ON r.project_id = p.id
       ${isAdmin ? '' : `WHERE p.project_manager_id = $1 OR EXISTS (
          SELECT 1 FROM project_members pm 
          WHERE pm.project_id = p.id AND pm.user_id = $1
        )`}`,
      params
    );

    const acceptanceResult = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE a.status = 'draft') as draft,
        COUNT(*) FILTER (WHERE a.status = 'submitted') as submitted,
        COUNT(*) FILTER (WHERE a.status = 'accepted') as accepted,
        COUNT(*) FILTER (WHERE a.status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE a.acceptance_result = 'passed') as passed,
        COUNT(*) FILTER (WHERE a.acceptance_result = 'failed') as failed,
        COUNT(*) FILTER (WHERE a.acceptance_result = 'partial') as partial
       FROM acceptance_forms a
       JOIN projects p ON a.project_id = p.id
       ${isAdmin ? '' : `WHERE p.project_manager_id = $1 OR EXISTS (
          SELECT 1 FROM project_members pm 
          WHERE pm.project_id = p.id AND pm.user_id = $1
        )`}`,
      params
    );

    const meetingsResult = await query(
      `SELECT COUNT(*) as total
       FROM meeting_minutes m
       JOIN projects p ON m.project_id = p.id
       ${isAdmin ? '' : `WHERE p.project_manager_id = $1 OR EXISTS (
          SELECT 1 FROM project_members pm 
          WHERE pm.project_id = p.id AND pm.user_id = $1
        )`}`,
      params
    );

    const upcomingMilestones = await query(
      `SELECT 
        m.*,
        p.project_name,
        p.project_code,
        p.customer_name
       FROM milestones m
       JOIN projects p ON m.project_id = p.id
       WHERE m.status IN ('pending', 'in_progress', 'delayed')
         AND m.planned_date >= CURRENT_DATE - INTERVAL '7 days'
         ${isAdmin ? '' : `AND (p.project_manager_id = $${params.length + 1} OR EXISTS (
            SELECT 1 FROM project_members pm 
            WHERE pm.project_id = p.id AND pm.user_id = $${params.length + 1}
          ))`}
       ORDER BY m.planned_date ASC
       LIMIT 10`,
      isAdmin ? [] : [...params, userId]
    );

    const highRisks = await query(
      `SELECT 
        r.*,
        p.project_name,
        p.project_code,
        owner.real_name as owner_name
       FROM risks r
       JOIN projects p ON r.project_id = p.id
       LEFT JOIN users owner ON r.owner_id = owner.id
       WHERE r.risk_level IN ('high', 'critical')
         AND r.status NOT IN ('resolved', 'closed')
         ${isAdmin ? '' : `AND (p.project_manager_id = $${params.length + 1} OR EXISTS (
            SELECT 1 FROM project_members pm 
            WHERE pm.project_id = p.id AND pm.user_id = $${params.length + 1}
          ))`}
       ORDER BY 
         CASE r.risk_level WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
         r.created_at DESC
       LIMIT 10`,
      isAdmin ? [] : [...params, userId]
    );

    const pendingAcceptances = await query(
      `SELECT 
        a.*,
        p.project_name,
        p.project_code,
        m.milestone_name,
        applicant.real_name as applicant_name
       FROM acceptance_forms a
       JOIN projects p ON a.project_id = p.id
       LEFT JOIN milestones m ON a.milestone_id = m.id
       LEFT JOIN users applicant ON a.applicant_id = applicant.id
       WHERE a.status IN ('submitted', 'reviewing')
         ${isAdmin ? '' : `AND (p.project_manager_id = $${params.length + 1} OR EXISTS (
            SELECT 1 FROM project_members pm 
            WHERE pm.project_id = p.id AND pm.user_id = $${params.length + 1}
          ))`}
       ORDER BY a.created_at DESC
       LIMIT 10`,
      isAdmin ? [] : [...params, userId]
    );

    return successResponse(res, {
      statistics: {
        projects: projectsResult.rows[0],
        milestones: milestonesResult.rows[0],
        risks: risksResult.rows[0],
        acceptance: acceptanceResult.rows[0],
        meetings: meetingsResult.rows[0],
      },
      upcoming_milestones: upcomingMilestones.rows,
      high_risks: highRisks.rows,
      pending_acceptances: pendingAcceptances.rows,
    }, '获取看板数据成功');
  } catch (error) {
    return errorResponse(res, '获取看板数据失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.get('/projects', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';

    const result = await query(
      `SELECT 
        p.*,
        u.real_name as manager_name,
        COUNT(DISTINCT m.id) as total_milestones,
        COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'completed') as completed_milestones,
        COUNT(DISTINCT r.id) as total_risks,
        COUNT(DISTINCT r.id) FILTER (WHERE r.risk_level IN ('high', 'critical') AND r.status NOT IN ('resolved', 'closed')) as active_high_risks,
        COUNT(DISTINCT a.id) as total_acceptance,
        COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'accepted') as accepted_count
       FROM projects p
       LEFT JOIN users u ON p.project_manager_id = u.id
       LEFT JOIN milestones m ON p.id = m.project_id
       LEFT JOIN risks r ON p.id = r.project_id
       LEFT JOIN acceptance_forms a ON p.id = a.project_id
       ${isAdmin ? '' : `WHERE p.project_manager_id = $1 OR EXISTS (
          SELECT 1 FROM project_members pm 
          WHERE pm.project_id = p.id AND pm.user_id = $1
        )`}
       GROUP BY p.id, u.real_name
       ORDER BY p.created_at DESC
       LIMIT 20`,
      isAdmin ? [] : [userId]
    );

    const projectsWithProgress = await Promise.all(
      result.rows.map(async (project) => {
        const progress = await calculateProjectProgress(project.id);
        return { ...project, ...progress };
      })
    );

    return successResponse(res, projectsWithProgress, '获取项目看板成功');
  } catch (error) {
    return errorResponse(res, '获取项目看板失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.get('/milestone-timeline', async (req: Request, res: Response) => {
  try {
    const { project_id } = req.query;
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'admin';

    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    if (project_id) {
      const hasPermission = await query(
        `SELECT 1 FROM projects p 
         WHERE p.id = $1 
           AND ($2 OR p.project_manager_id = $3 OR EXISTS (
             SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = $3
           ))`,
        [project_id, isAdmin, userId]
      );
      if (hasPermission.rows.length === 0) {
        return errorResponse(res, '权限不足', 'FORBIDDEN', 403);
      }
      whereConditions.push(`m.project_id = $${paramIndex}`);
      params.push(project_id);
      paramIndex++;
    } else if (!isAdmin) {
      whereConditions.push(`EXISTS (
        SELECT 1 FROM projects p 
        LEFT JOIN project_members pm ON p.id = pm.project_id
        WHERE p.id = m.project_id 
          AND (p.project_manager_id = $${paramIndex} OR pm.user_id = $${paramIndex})
      )`);
      params.push(userId);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT 
        m.*,
        p.project_name,
        p.project_code,
        COALESCE(array_agg(md.predecessor_id) FILTER (WHERE md.predecessor_id IS NOT NULL), '{}') as predecessor_ids
       FROM milestones m
       JOIN projects p ON m.project_id = p.id
       LEFT JOIN milestone_dependencies md ON m.id = md.milestone_id
       ${whereClause}
       GROUP BY m.id, p.project_name, p.project_code
       ORDER BY p.project_code, m.sort_order, m.planned_date`,
      params
    );

    return successResponse(res, result.rows, '获取里程碑时间线成功');
  } catch (error) {
    return errorResponse(res, '获取里程碑时间线失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.get('/users', async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'admin') {
      return errorResponse(res, '只有管理员可以查看所有用户', 'FORBIDDEN', 403);
    }

    const result = await query(
      `SELECT 
        u.id, u.username, u.email, u.real_name, u.role, 
        u.department, u.is_active, u.created_at,
        COUNT(DISTINCT p.id) as managed_projects,
        COUNT(DISTINCT pm.id) as member_projects,
        COUNT(DISTINCT r.id) as owned_risks
       FROM users u
       LEFT JOIN projects p ON u.id = p.project_manager_id
       LEFT JOIN project_members pm ON u.id = pm.user_id
       LEFT JOIN risks r ON u.id = r.owner_id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );

    return successResponse(res, result.rows, '获取用户列表成功');
  } catch (error) {
    return errorResponse(res, '获取用户列表失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

export default router;
