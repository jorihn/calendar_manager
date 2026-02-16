import pool from '../db/pool';
import { refreshSnapshot } from './snapshot';

// Priority weight mapping
const PRIORITY_WEIGHTS: Record<string, number> = {
  critical: 1.0,
  high: 0.75,
  medium: 0.5,
  low: 0.25
};

/**
 * Compute KR progress based on type and child data.
 * - metric: parseFloat(current) / parseFloat(target)
 * - boolean: current === 'true' ? 1 : 0
 * - milestone: count(done_tasks) / count(total_tasks)
 * - If has child KRs: weighted average of children
 */
export async function computeKRProgress(krId: string): Promise<number> {
  const kr = await pool.query(
    'SELECT id, type, target, current, objective_id FROM key_results WHERE id = $1',
    [krId]
  );

  if (kr.rows.length === 0) return 0;

  const { type, target, current } = kr.rows[0];

  // Check for child KRs first
  const children = await pool.query(
    'SELECT id, progress, importance_weight FROM key_results WHERE parent_kr_id = $1',
    [krId]
  );

  let progress: number;

  if (children.rows.length > 0) {
    // Weighted average of children
    let totalWeight = 0;
    let weightedSum = 0;

    for (const child of children.rows) {
      const w = parseFloat(child.importance_weight) || 1;
      totalWeight += w;
      weightedSum += parseFloat(child.progress) * w;
    }

    progress = totalWeight > 0 ? weightedSum / totalWeight : 0;
  } else {
    // Leaf KR — compute based on type
    switch (type) {
      case 'metric': {
        const t = parseFloat(target);
        const c = parseFloat(current);
        if (!t || isNaN(t) || isNaN(c)) {
          progress = 0;
        } else {
          progress = Math.min(c / t, 1);
        }
        break;
      }
      case 'boolean': {
        progress = current === 'true' || current === '1' ? 1 : 0;
        break;
      }
      case 'milestone': {
        // Count tasks linked to this KR, factoring in outcome_score for quality-weighted progress
        const taskCounts = await pool.query(
          `SELECT 
            COUNT(*) as total_count,
            COUNT(*) FILTER (WHERE status = 'done') as done_count,
            COALESCE(SUM(CASE WHEN status = 'done' THEN COALESCE(outcome_score, 1) ELSE 0 END), 0) as weighted_done
           FROM tasks WHERE kr_id = $1`,
          [krId]
        );
        const { total_count, weighted_done } = taskCounts.rows[0];
        progress = parseInt(total_count) > 0
          ? parseFloat(weighted_done) / parseInt(total_count)
          : 0;
        break;
      }
      default:
        progress = 0;
    }
  }

  progress = Math.max(0, Math.min(progress, 1));

  // Update KR progress in DB
  await pool.query(
    'UPDATE key_results SET progress = $1 WHERE id = $2',
    [progress.toFixed(4), krId]
  );

  return progress;
}

/**
 * Compute Objective progress as weighted average of its KRs.
 */
export async function computeObjectiveProgress(objectiveId: string): Promise<number> {
  const krs = await pool.query(
    'SELECT id, progress, importance_weight FROM key_results WHERE objective_id = $1 AND parent_kr_id IS NULL',
    [objectiveId]
  );

  if (krs.rows.length === 0) {
    await pool.query(
      'UPDATE objectives SET progress = 0 WHERE id = $1',
      [objectiveId]
    );
    return 0;
  }

  let totalWeight = 0;
  let weightedSum = 0;

  for (const kr of krs.rows) {
    const w = parseFloat(kr.importance_weight) || 1;
    totalWeight += w;
    weightedSum += parseFloat(kr.progress) * w;
  }

  const progress = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const clamped = Math.max(0, Math.min(progress, 1));

  await pool.query(
    'UPDATE objectives SET progress = $1 WHERE id = $2',
    [clamped.toFixed(4), objectiveId]
  );

  return clamped;
}

/**
 * Compute risk score for a KR.
 * Formula: risk = (1 - progress) * (elapsed_time / total_time)
 * Uses the cycle dates if the KR's objective has a cycle, otherwise defaults to 0.5 elapsed.
 */
export async function computeRiskScore(krId: string): Promise<number> {
  const kr = await pool.query(
    `SELECT kr.id, kr.progress, kr.objective_id, o.cycle_id
     FROM key_results kr
     LEFT JOIN objectives o ON kr.objective_id = o.id
     WHERE kr.id = $1`,
    [krId]
  );

  if (kr.rows.length === 0) return 0;

  const { progress, cycle_id } = kr.rows[0];
  const prog = parseFloat(progress) || 0;

  let elapsedRatio = 0.5; // default if no cycle

  if (cycle_id) {
    const cycle = await pool.query(
      'SELECT start_date, end_date FROM cycles WHERE id = $1',
      [cycle_id]
    );

    if (cycle.rows.length > 0) {
      const start = new Date(cycle.rows[0].start_date).getTime();
      const end = new Date(cycle.rows[0].end_date).getTime();
      const now = Date.now();
      const totalDuration = end - start;

      if (totalDuration > 0) {
        elapsedRatio = Math.max(0, Math.min((now - start) / totalDuration, 1));
      }
    }
  }

  const risk = (1 - prog) * elapsedRatio;
  const clamped = Math.max(0, Math.min(risk, 1));

  await pool.query(
    'UPDATE key_results SET risk_score = $1 WHERE id = $2',
    [clamped.toFixed(4), krId]
  );

  return clamped;
}

/**
 * Compute objective risk score as max of its KRs' risk scores.
 */
export async function computeObjectiveRiskScore(objectiveId: string): Promise<number> {
  const result = await pool.query(
    'SELECT COALESCE(MAX(risk_score), 0) as max_risk FROM key_results WHERE objective_id = $1',
    [objectiveId]
  );

  const risk = parseFloat(result.rows[0].max_risk) || 0;

  await pool.query(
    'UPDATE objectives SET risk_score = $1 WHERE id = $2',
    [risk.toFixed(4), objectiveId]
  );

  return risk;
}

/**
 * Compute velocity for a KR (progress change per week).
 * Compares current progress with what it was ~7 days ago (approximated by confidence snapshots).
 * For MVP: velocity = progress / weeks_elapsed_in_cycle
 */
export async function computeVelocity(krId: string): Promise<number> {
  const kr = await pool.query(
    `SELECT kr.progress, kr.created_at, o.cycle_id
     FROM key_results kr
     LEFT JOIN objectives o ON kr.objective_id = o.id
     WHERE kr.id = $1`,
    [krId]
  );

  if (kr.rows.length === 0) return 0;

  const { progress, created_at, cycle_id } = kr.rows[0];
  const prog = parseFloat(progress) || 0;

  let startDate: Date;

  if (cycle_id) {
    const cycle = await pool.query(
      'SELECT start_date FROM cycles WHERE id = $1',
      [cycle_id]
    );
    startDate = cycle.rows.length > 0 ? new Date(cycle.rows[0].start_date) : new Date(created_at);
  } else {
    startDate = new Date(created_at);
  }

  const weeksElapsed = Math.max(
    (Date.now() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000),
    0.1 // avoid division by zero
  );

  const velocity = prog / weeksElapsed;

  await pool.query(
    'UPDATE key_results SET velocity = $1 WHERE id = $2',
    [velocity.toFixed(4), krId]
  );

  return velocity;
}

/**
 * Compute task priority score.
 * Factors: priority_weight + kr_risk bonus + deadline proximity bonus
 */
export async function computeTaskPriorityScore(taskId: string): Promise<number> {
  const task = await pool.query(
    'SELECT id, priority, kr_id, due_date FROM tasks WHERE id = $1',
    [taskId]
  );

  if (task.rows.length === 0) return 0;

  const { priority, kr_id, due_date } = task.rows[0];

  // Base score from priority
  let score = PRIORITY_WEIGHTS[priority] || 0.5;

  // Bonus from KR risk
  if (kr_id) {
    const kr = await pool.query(
      'SELECT risk_score FROM key_results WHERE id = $1',
      [kr_id]
    );

    if (kr.rows.length > 0) {
      const krRisk = parseFloat(kr.rows[0].risk_score) || 0;
      if (krRisk > 0.7) {
        score += 0.2; // high risk KR bonus
      } else if (krRisk > 0.4) {
        score += 0.1; // medium risk bonus
      }
    }
  }

  // Deadline proximity bonus
  if (due_date) {
    const daysUntilDue = (new Date(due_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    if (daysUntilDue < 0) {
      score += 0.3; // overdue
    } else if (daysUntilDue < 1) {
      score += 0.25; // due today
    } else if (daysUntilDue < 3) {
      score += 0.15; // due within 3 days
    } else if (daysUntilDue < 7) {
      score += 0.05; // due within a week
    }
  }

  const clamped = Math.max(0, Math.min(score, 1));

  await pool.query(
    'UPDATE tasks SET priority_score = $1 WHERE id = $2',
    [clamped.toFixed(4), taskId]
  );

  return clamped;
}

/**
 * Compute alignment depth for a task.
 * Task → KR → Parent KR → ... → Objective (count hops)
 */
export async function computeAlignmentDepth(taskId: string): Promise<number> {
  const task = await pool.query(
    'SELECT kr_id, objective_id FROM tasks WHERE id = $1',
    [taskId]
  );

  if (task.rows.length === 0) return 0;

  const { kr_id, objective_id } = task.rows[0];

  if (!kr_id && !objective_id) {
    await pool.query('UPDATE tasks SET alignment_depth = 0 WHERE id = $1', [taskId]);
    return 0;
  }

  let depth = 0;

  if (kr_id) {
    depth = 1; // task → KR
    // Walk up the KR hierarchy
    let currentKrId = kr_id;
    while (currentKrId) {
      const parent = await pool.query(
        'SELECT parent_kr_id FROM key_results WHERE id = $1',
        [currentKrId]
      );
      if (parent.rows.length === 0 || !parent.rows[0].parent_kr_id) break;
      currentKrId = parent.rows[0].parent_kr_id;
      depth++;
    }
    depth++; // KR → Objective
  } else if (objective_id) {
    depth = 1; // task → Objective (direct)
  }

  await pool.query('UPDATE tasks SET alignment_depth = $1 WHERE id = $2', [depth, taskId]);

  return depth;
}

/**
 * Full cascade recompute triggered by a KR change.
 * Recomputes: KR progress → parent KR progress (bubble up) → Objective progress → Risk → Velocity
 */
export async function cascadeFromKR(krId: string, refreshAtEnd = true): Promise<void> {
  const userResult = await pool.query(
    'SELECT user_id FROM key_results WHERE id = $1',
    [krId]
  );

  const snapshotUserId = userResult.rows.length > 0 ? userResult.rows[0].user_id : null;

  // 1. Compute this KR's progress
  await computeKRProgress(krId);

  // 2. Bubble up to parent KRs
  const kr = await pool.query(
    'SELECT parent_kr_id, objective_id FROM key_results WHERE id = $1',
    [krId]
  );

  if (kr.rows.length > 0) {
    const { parent_kr_id, objective_id } = kr.rows[0];

    if (parent_kr_id) {
      await cascadeFromKR(parent_kr_id, false); // recursive bubble up
    }

    // 3. Compute risk & velocity for this KR
    await computeRiskScore(krId);
    await computeVelocity(krId);

    // 4. Compute objective-level metrics
    if (objective_id) {
      await computeObjectiveProgress(objective_id);
      await computeObjectiveRiskScore(objective_id);
    }
  }

  // 5. Refresh AI snapshot after KR/objective metrics are updated
  if (refreshAtEnd && snapshotUserId) {
    await refreshSnapshot(snapshotUserId);
  }
}

/**
 * Full cascade recompute triggered by a Task change.
 * Recomputes: Task scores → KR cascade → Objective cascade
 */
export async function cascadeFromTask(taskId: string): Promise<void> {
  // 1. Compute task-level scores
  await computeTaskPriorityScore(taskId);
  await computeAlignmentDepth(taskId);

  // 2. If task is linked to a KR, cascade up
  const task = await pool.query(
    'SELECT kr_id, user_id FROM tasks WHERE id = $1',
    [taskId]
  );

  if (task.rows.length > 0) {
    if (task.rows[0].kr_id) {
      await cascadeFromKR(task.rows[0].kr_id);
    } else {
      // 3. Refresh AI snapshot for task-only changes not linked to any KR
      await refreshSnapshot(task.rows[0].user_id);
    }
  }
}

/**
 * Recompute all scores for a user (used for bulk refresh).
 */
export async function recomputeAll(userId: string): Promise<void> {
  // 1. All tasks (own + assigned + org)
  const tasks = await pool.query(
    `SELECT id FROM tasks WHERE (
      user_id = $1
      OR assignee_id = $1
      OR objective_id IN (
        SELECT id FROM objectives WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = $1)
      )
    )`,
    [userId]
  );

  for (const task of tasks.rows) {
    await computeTaskPriorityScore(task.id);
    await computeAlignmentDepth(task.id);
  }

  // 2. All leaf KRs (bottom-up, own + org)
  const leafKRs = await pool.query(
    `SELECT kr.id FROM key_results kr
     WHERE (
      kr.user_id = $1
      OR kr.objective_id IN (
        SELECT id FROM objectives WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = $1)
      )
     )
     AND NOT EXISTS (SELECT 1 FROM key_results child WHERE child.parent_kr_id = kr.id)
     ORDER BY kr.level DESC`,
    [userId]
  );

  for (const kr of leafKRs.rows) {
    await cascadeFromKR(kr.id);
  }

  // 3. All objectives (own + org)
  const objectives = await pool.query(
    `SELECT id FROM objectives WHERE (
      user_id = $1
      OR org_id IN (SELECT org_id FROM org_members WHERE user_id = $1)
    ) AND status = $2`,
    [userId, 'active']
  );

  for (const obj of objectives.rows) {
    await computeObjectiveProgress(obj.id);
    await computeObjectiveRiskScore(obj.id);
  }
}
