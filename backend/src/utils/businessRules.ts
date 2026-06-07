import { query } from '../config/database';

export interface ValidationResult {
  valid: boolean;
  message: string;
  invalidMilestones?: Array<{
    id: string;
    name: string;
    status: string;
  }>;
}

export const checkPredecessorMilestones = async (
  milestoneId: string
): Promise<ValidationResult> => {
  const result = await query(
    `SELECT 
      m.id, m.milestone_name, m.status
     FROM milestone_dependencies md
     JOIN milestones m ON md.predecessor_id = m.id
     WHERE md.milestone_id = $1`,
    [milestoneId]
  );

  if (result.rows.length === 0) {
    return { valid: true, message: '无前置里程碑依赖' };
  }

  const incompleteMilestones = result.rows.filter(
    (m) => m.status !== 'completed'
  );

  if (incompleteMilestones.length > 0) {
    return {
      valid: false,
      message: `存在 ${incompleteMilestones.length} 个前置里程碑未完成，无法进行验收`,
      invalidMilestones: incompleteMilestones.map((m) => ({
        id: m.id,
        name: m.milestone_name,
        status: m.status,
      })),
    };
  }

  return { valid: true, message: '所有前置里程碑均已完成' };
};

export const checkMilestoneCanAccept = async (
  milestoneId: string
): Promise<ValidationResult> => {
  const milestoneResult = await query(
    'SELECT id, milestone_name, status FROM milestones WHERE id = $1',
    [milestoneId]
  );

  if (milestoneResult.rows.length === 0) {
    return { valid: false, message: '里程碑不存在' };
  }

  const milestone = milestoneResult.rows[0];

  if (milestone.status === 'completed') {
    return { valid: false, message: '该里程碑已完成，无需重复验收' };
  }

  if (milestone.status === 'cancelled') {
    return { valid: false, message: '该里程碑已取消，无法验收' };
  }

  const predecessorCheck = await checkPredecessorMilestones(milestoneId);
  if (!predecessorCheck.valid) {
    return predecessorCheck;
  }

  return { valid: true, message: '里程碑可以进行验收' };
};

export const checkAcceptanceCanSubmit = async (
  acceptanceId: string
): Promise<ValidationResult> => {
  const acceptanceResult = await query(
    'SELECT id, milestone_id, status FROM acceptance_forms WHERE id = $1',
    [acceptanceId]
  );

  if (acceptanceResult.rows.length === 0) {
    return { valid: false, message: '验收单不存在' };
  }

  const acceptance = acceptanceResult.rows[0];

  if (acceptance.status !== 'draft') {
    return { valid: false, message: '只有草稿状态的验收单可以提交' };
  }

  if (acceptance.milestone_id) {
    const milestoneCheck = await checkMilestoneCanAccept(acceptance.milestone_id);
    if (!milestoneCheck.valid) {
      return milestoneCheck;
    }
  }

  return { valid: true, message: '验收单可以提交' };
};

export const getMilestoneChain = async (
  projectId: string
): Promise<Array<{
  id: string;
  name: string;
  status: string;
  sortOrder: number;
  predecessors: string[];
}>> => {
  const result = await query(
    `SELECT 
      m.id, m.milestone_name, m.status, m.sort_order,
      COALESCE(array_agg(md.predecessor_id) FILTER (WHERE md.predecessor_id IS NOT NULL), '{}') as predecessors
     FROM milestones m
     LEFT JOIN milestone_dependencies md ON m.id = md.milestone_id
     WHERE m.project_id = $1
     GROUP BY m.id, m.milestone_name, m.status, m.sort_order
     ORDER BY m.sort_order ASC`,
    [projectId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.milestone_name,
    status: row.status,
    sortOrder: row.sort_order,
    predecessors: row.predecessors,
  }));
};

export const calculateProjectProgress = async (
  projectId: string
): Promise<{
  totalMilestones: number;
  completedMilestones: number;
  progressPercentage: number;
  delayedMilestones: number;
}> => {
  const result = await query(
    `SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE status = 'delayed') as delayed
     FROM milestones 
     WHERE project_id = $1`,
    [projectId]
  );

  const row = result.rows[0];
  const total = parseInt(row.total) || 0;
  const completed = parseInt(row.completed) || 0;
  const delayed = parseInt(row.delayed) || 0;

  return {
    totalMilestones: total,
    completedMilestones: completed,
    progressPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    delayedMilestones: delayed,
  };
};
