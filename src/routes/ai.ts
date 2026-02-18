import { Router, Response } from 'express';
import pool from '../db/pool';
import { AuthenticatedRequest } from '../types';
import { generateSnapshot, generateVerboseSnapshot, getLatestSnapshot, refreshSnapshot } from '../services/snapshot';
import { recomputeAll } from '../services/scoring';

const router = Router();

const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// GET /ai/snapshot — Latest snapshot (compact, token-optimized)
router.get('/snapshot', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const cycleId = req.query.cycle_id as string | undefined;

    if (cycleId && !isValidUUID(cycleId)) {
      res.status(400).json({ code: 'INVALID_CYCLE_ID', message: 'Invalid cycle_id format' });
      return;
    }

    const snapshot = await getLatestSnapshot(userId, cycleId);
    res.json(snapshot);
  } catch (error) {
    console.error('Error fetching snapshot:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch snapshot' });
  }
});

// GET /ai/snapshot/verbose — Full key names (for debugging)
router.get('/snapshot/verbose', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const cycleId = req.query.cycle_id as string | undefined;

    const snapshot = await generateVerboseSnapshot(userId, cycleId);
    res.json(snapshot);
  } catch (error) {
    console.error('Error fetching verbose snapshot:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch verbose snapshot' });
  }
});

// POST /ai/snapshot/refresh — Force regenerate snapshot
router.post('/snapshot/refresh', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    await refreshSnapshot(userId);
    const snapshot = await getLatestSnapshot(userId);
    res.json({ message: 'Snapshot refreshed', snapshot });
  } catch (error) {
    console.error('Error refreshing snapshot:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to refresh snapshot' });
  }
});

// POST /ai/recompute — Full recompute all scores + snapshot
router.post('/recompute', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    await recomputeAll(userId);
    await refreshSnapshot(userId);

    res.json({ message: 'All scores recomputed and snapshot refreshed' });
  } catch (error) {
    console.error('Error recomputing:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to recompute scores' });
  }
});

// GET /ai/priorities — Top N tasks sorted by priority_score
router.get('/priorities', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await pool.query(
      `SELECT t.id, t.title as t, t.priority_score as ps, t.status, t.due_date as due, t.blocking,
              t.priority, t.category, t.kr_id,
              COALESCE(kr.risk_score, 0) as kr_r,
              COALESCE(kr.title, '') as kr_title
       FROM tasks t
       LEFT JOIN key_results kr ON t.kr_id = kr.id
       WHERE t.user_id = $1 AND t.status != 'done'
       ORDER BY t.priority_score DESC
       LIMIT $2`,
      [userId, limit]
    );

    res.json({ priorities: result.rows });
  } catch (error) {
    console.error('Error fetching priorities:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch priorities' });
  }
});

// GET /ai/risks — KRs sorted by risk_score DESC
router.get('/risks', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const threshold = parseFloat(req.query.threshold as string) || 0;
    const objectiveId = req.query.objective_id as string | undefined;
    const cycleId = req.query.cycle_id as string | undefined;
    const includeClosed = (req.query.include_closed as string | undefined) === 'true';

    if (objectiveId && !isValidUUID(objectiveId)) {
      res.status(400).json({ code: 'INVALID_OBJECTIVE_ID', message: 'Invalid objective_id format' });
      return;
    }

    if (cycleId && !isValidUUID(cycleId)) {
      res.status(400).json({ code: 'INVALID_CYCLE_ID', message: 'Invalid cycle_id format' });
      return;
    }

    let query = `SELECT kr.id, kr.title as t, kr.progress as p, kr.risk_score as r, kr.velocity as v,
                        kr.type, kr.target, kr.current,
                        o.id as oid, o.title as o_title,
                        o.cycle_id, c.status as cycle_status
                 FROM key_results kr
                 JOIN objectives o ON kr.objective_id = o.id
                 LEFT JOIN cycles c ON o.cycle_id = c.id
                 WHERE kr.user_id = $1 AND kr.risk_score >= $2`;

    const params: Array<string | number> = [userId, threshold];
    let paramCount = 3;

    // Default scope: only active objectives and active cycles (or objectives without cycle)
    if (!includeClosed) {
      query += ` AND o.status = 'active' AND (o.cycle_id IS NULL OR c.status = 'active')`;
    }

    if (objectiveId) {
      query += ` AND o.id = $${paramCount++}`;
      params.push(objectiveId);
    }

    if (cycleId) {
      query += ` AND o.cycle_id = $${paramCount++}`;
      params.push(cycleId);
    }

    query += ' ORDER BY kr.risk_score DESC';

    const result = await pool.query(query, params);

    res.json({ risks: result.rows });
  } catch (error) {
    console.error('Error fetching risks:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch risks' });
  }
});

// GET /ai/alignment-gaps — KRs without tasks, Objectives without KRs
router.get('/alignment-gaps', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    // Objectives without any KRs
    const orphanObjectives = await pool.query(
      `SELECT o.id, o.title
       FROM objectives o
       WHERE o.user_id = $1 AND o.status = 'active'
       AND NOT EXISTS (SELECT 1 FROM key_results kr WHERE kr.objective_id = o.id)`,
      [userId]
    );

    // KRs without any tasks
    const orphanKRs = await pool.query(
      `SELECT kr.id, kr.title, kr.objective_id, o.title as o_title
       FROM key_results kr
       LEFT JOIN objectives o ON kr.objective_id = o.id
       WHERE kr.user_id = $1
       AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.kr_id = kr.id)`,
      [userId]
    );

    // Tasks not linked to any KR or Objective
    const unlinkedTasks = await pool.query(
      `SELECT id, title, status, priority
       FROM tasks
       WHERE user_id = $1 AND kr_id IS NULL AND objective_id IS NULL AND status != 'done'`,
      [userId]
    );

    res.json({
      objectives_without_krs: orphanObjectives.rows,
      krs_without_tasks: orphanKRs.rows,
      unlinked_tasks: unlinkedTasks.rows
    });
  } catch (error) {
    console.error('Error fetching alignment gaps:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch alignment gaps' });
  }
});

// GET /ai/workload — Tasks grouped by status + count
router.get('/workload', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const result = await pool.query(
      `SELECT 
        status,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE blocking = true) as blocking_count,
        COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'done') as overdue_count,
        ROUND(AVG(priority_score)::numeric, 4) as avg_priority_score
       FROM tasks
       WHERE user_id = $1
       GROUP BY status
       ORDER BY 
         CASE status WHEN 'doing' THEN 1 WHEN 'todo' THEN 2 WHEN 'done' THEN 3 END`,
      [userId]
    );

    // Category breakdown
    const categoryBreakdown = await pool.query(
      `SELECT category, status, COUNT(*) as count
       FROM tasks
       WHERE user_id = $1 AND status != 'done'
       GROUP BY category, status
       ORDER BY category, status`,
      [userId]
    );

    res.json({
      by_status: result.rows,
      by_category: categoryBreakdown.rows
    });
  } catch (error) {
    console.error('Error fetching workload:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch workload' });
  }
});

// GET /ai/velocity-report — KR velocity trends
router.get('/velocity-report', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const result = await pool.query(
      `SELECT kr.id, kr.title as t, kr.progress as p, kr.risk_score as r, kr.velocity as v,
              kr.type, kr.target, kr.current, kr.importance_weight as w,
              o.id as oid, o.title as o_title
       FROM key_results kr
       LEFT JOIN objectives o ON kr.objective_id = o.id
       WHERE kr.user_id = $1 AND kr.velocity IS NOT NULL
       ORDER BY kr.velocity ASC`,
      [userId]
    );

    // Categorize by velocity
    const slowKRs = result.rows.filter(kr => parseFloat(kr.v) < 0.05);
    const onTrackKRs = result.rows.filter(kr => parseFloat(kr.v) >= 0.05 && parseFloat(kr.v) < 0.15);
    const fastKRs = result.rows.filter(kr => parseFloat(kr.v) >= 0.15);

    res.json({
      all: result.rows,
      slow: slowKRs,
      on_track: onTrackKRs,
      fast: fastKRs
    });
  } catch (error) {
    console.error('Error fetching velocity report:', error);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch velocity report' });
  }
});

export default router;
