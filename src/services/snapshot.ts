import pool from '../db/pool';

interface SnapshotObjective {
  id: string;
  t: string;       // title
  p: number;       // progress
  r: number;       // risk_score
  type: string;
  horizon: string;
}

interface SnapshotKR {
  id: string;
  oid: string;     // objective_id
  t: string;       // title
  p: number;       // progress
  r: number;       // risk_score
  v: number | null; // velocity
  type: string;
  target: string | null;
  current: string | null;
  days_left: number | null;
  task_count: number;
  done_count: number;
}

interface SnapshotTask {
  id: string;
  t: string;       // title
  ps: number;      // priority_score
  kr_r: number;    // parent KR risk
  status: string;
  due: string | null;
  blocking: boolean;
}

interface Snapshot {
  ts: string;                    // timestamp
  c: {                           // cycle
    id: string | null;
    name: string | null;
    type: string | null;
    elapsed: number | null;
  } | null;
  o: SnapshotObjective[];        // objectives
  k: SnapshotKR[];               // key results
  risky: { id: string; t: string; r: number; gap: number }[];
  blocked: { id: string; t: string }[];
  stats: {
    total_tasks: number;
    todo: number;
    doing: number;
    done: number;
    overdue: number;
    unlinked_tasks: number;
  };
  priorities: SnapshotTask[];    // top 10 priority tasks
}

/**
 * Generate a flat, LLM-optimized snapshot for a user.
 * Optionally scoped to a specific cycle.
 */
export async function generateSnapshot(userId: string, cycleId?: string): Promise<Snapshot> {
  const now = new Date();

  // Cycle info
  let cycleInfo: Snapshot['c'] = null;
  if (cycleId) {
    const cycle = await pool.query(
      'SELECT id, name, type, start_date, end_date FROM cycles WHERE id = $1 AND user_id = $2',
      [cycleId, userId]
    );
    if (cycle.rows.length > 0) {
      const { id, name, type, start_date, end_date } = cycle.rows[0];
      const start = new Date(start_date).getTime();
      const end = new Date(end_date).getTime();
      const total = end - start;
      const elapsed = total > 0 ? Math.max(0, Math.min((now.getTime() - start) / total, 1)) : 0;
      cycleInfo = { id, name, type, elapsed: parseFloat(elapsed.toFixed(4)) };
    }
  }

  // Objectives
  let objQuery = 'SELECT id, title, progress, risk_score, type, horizon FROM objectives WHERE user_id = $1 AND status = $2';
  const objParams: any[] = [userId, 'active'];
  if (cycleId) {
    objQuery += ' AND cycle_id = $3';
    objParams.push(cycleId);
  }
  objQuery += ' ORDER BY risk_score DESC';

  const objectives = await pool.query(objQuery, objParams);
  const snapshotObjectives: SnapshotObjective[] = objectives.rows.map(o => ({
    id: o.id,
    t: o.title,
    p: parseFloat(o.progress) || 0,
    r: parseFloat(o.risk_score) || 0,
    type: o.type,
    horizon: o.horizon
  }));

  // Key Results
  const objectiveIds = objectives.rows.map(o => o.id);
  let snapshotKRs: SnapshotKR[] = [];
  let riskyKRs: Snapshot['risky'] = [];

  if (objectiveIds.length > 0) {
    const krs = await pool.query(
      `SELECT kr.id, kr.objective_id, kr.title, kr.progress, kr.risk_score, kr.velocity,
              kr.type, kr.target, kr.current,
              o.cycle_id
       FROM key_results kr
       LEFT JOIN objectives o ON kr.objective_id = o.id
       WHERE kr.user_id = $1 AND kr.objective_id = ANY($2)
       ORDER BY kr.risk_score DESC`,
      [userId, objectiveIds]
    );

    for (const kr of krs.rows) {
      // Compute days_left from cycle
      let daysLeft: number | null = null;
      if (kr.cycle_id) {
        const cycle = await pool.query(
          'SELECT end_date FROM cycles WHERE id = $1',
          [kr.cycle_id]
        );
        if (cycle.rows.length > 0) {
          daysLeft = Math.max(0, Math.ceil(
            (new Date(cycle.rows[0].end_date).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
          ));
        }
      }

      // Task counts for this KR
      const taskCounts = await pool.query(
        `SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'done') as done
         FROM tasks WHERE kr_id = $1`,
        [kr.id]
      );

      const taskCount = parseInt(taskCounts.rows[0].total) || 0;
      const doneCount = parseInt(taskCounts.rows[0].done) || 0;
      const prog = parseFloat(kr.progress) || 0;
      const risk = parseFloat(kr.risk_score) || 0;

      snapshotKRs.push({
        id: kr.id,
        oid: kr.objective_id,
        t: kr.title,
        p: prog,
        r: risk,
        v: kr.velocity ? parseFloat(kr.velocity) : null,
        type: kr.type,
        target: kr.target,
        current: kr.current,
        days_left: daysLeft,
        task_count: taskCount,
        done_count: doneCount
      });

      if (risk > 0.5) {
        riskyKRs.push({
          id: kr.id,
          t: kr.title,
          r: risk,
          gap: parseFloat((1 - prog).toFixed(4))
        });
      }
    }
  }

  // Tasks stats
  const taskStats = await pool.query(
    `SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'todo') as todo,
      COUNT(*) FILTER (WHERE status = 'doing') as doing,
      COUNT(*) FILTER (WHERE status = 'done') as done,
      COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'done') as overdue,
      COUNT(*) FILTER (WHERE kr_id IS NULL AND objective_id IS NULL) as unlinked
     FROM tasks WHERE user_id = $1`,
    [userId]
  );

  const stats = taskStats.rows[0];

  // Blocked tasks
  const blockedTasks = await pool.query(
    `SELECT id, title FROM tasks WHERE user_id = $1 AND blocking = true AND status != 'done'`,
    [userId]
  );

  // Top priority tasks (not done)
  const priorityTasks = await pool.query(
    `SELECT t.id, t.title, t.priority_score, t.status, t.due_date, t.blocking, t.kr_id,
            COALESCE(kr.risk_score, 0) as kr_risk
     FROM tasks t
     LEFT JOIN key_results kr ON t.kr_id = kr.id
     WHERE t.user_id = $1 AND t.status != 'done'
     ORDER BY t.priority_score DESC
     LIMIT 10`,
    [userId]
  );

  const snapshotPriorities: SnapshotTask[] = priorityTasks.rows.map(t => ({
    id: t.id,
    t: t.title,
    ps: parseFloat(t.priority_score) || 0,
    kr_r: parseFloat(t.kr_risk) || 0,
    status: t.status,
    due: t.due_date ? new Date(t.due_date).toISOString() : null,
    blocking: t.blocking
  }));

  const snapshot: Snapshot = {
    ts: now.toISOString(),
    c: cycleInfo,
    o: snapshotObjectives,
    k: snapshotKRs,
    risky: riskyKRs,
    blocked: blockedTasks.rows.map(t => ({ id: t.id, t: t.title })),
    stats: {
      total_tasks: parseInt(stats.total) || 0,
      todo: parseInt(stats.todo) || 0,
      doing: parseInt(stats.doing) || 0,
      done: parseInt(stats.done) || 0,
      overdue: parseInt(stats.overdue) || 0,
      unlinked_tasks: parseInt(stats.unlinked) || 0
    },
    priorities: snapshotPriorities
  };

  // Save snapshot to DB
  await pool.query(
    `INSERT INTO ai_snapshots (user_id, cycle_id, snapshot)
     VALUES ($1, $2, $3)`,
    [userId, cycleId || null, JSON.stringify(snapshot)]
  );

  return snapshot;
}

/**
 * Generate verbose snapshot with full key names (for debugging).
 */
export async function generateVerboseSnapshot(userId: string, cycleId?: string): Promise<any> {
  const compact = await generateSnapshot(userId, cycleId);

  return {
    timestamp: compact.ts,
    cycle: compact.c ? {
      id: compact.c.id,
      name: compact.c.name,
      type: compact.c.type,
      elapsed_ratio: compact.c.elapsed
    } : null,
    objectives: compact.o.map(o => ({
      id: o.id,
      title: o.t,
      progress: o.p,
      risk_score: o.r,
      type: o.type,
      horizon: o.horizon
    })),
    key_results: compact.k.map(k => ({
      id: k.id,
      objective_id: k.oid,
      title: k.t,
      progress: k.p,
      risk_score: k.r,
      velocity: k.v,
      type: k.type,
      target: k.target,
      current: k.current,
      days_left: k.days_left,
      task_count: k.task_count,
      done_count: k.done_count
    })),
    risky_key_results: compact.risky.map(r => ({
      id: r.id,
      title: r.t,
      risk_score: r.r,
      progress_gap: r.gap
    })),
    blocked_tasks: compact.blocked.map(b => ({
      id: b.id,
      title: b.t
    })),
    stats: compact.stats,
    top_priorities: compact.priorities.map(p => ({
      id: p.id,
      title: p.t,
      priority_score: p.ps,
      kr_risk: p.kr_r,
      status: p.status,
      due_date: p.due,
      blocking: p.blocking
    }))
  };
}

/**
 * Get the latest cached snapshot, or generate a new one.
 */
export async function getLatestSnapshot(userId: string, cycleId?: string): Promise<any> {
  let query = 'SELECT snapshot, created_at FROM ai_snapshots WHERE user_id = $1';
  const params: any[] = [userId];

  if (cycleId) {
    query += ' AND cycle_id = $2';
    params.push(cycleId);
  } else {
    query += ' AND cycle_id IS NULL';
  }

  query += ' ORDER BY created_at DESC LIMIT 1';

  const result = await pool.query(query, params);

  if (result.rows.length > 0) {
    return result.rows[0].snapshot;
  }

  // No snapshot exists, generate one
  return await generateSnapshot(userId, cycleId);
}

/**
 * Refresh snapshot for a user (called after scoring cascade).
 */
export async function refreshSnapshot(userId: string): Promise<void> {
  // Generate snapshot for the user (no specific cycle = global view)
  await generateSnapshot(userId);

  // Also refresh for any active cycles
  const activeCycles = await pool.query(
    "SELECT id FROM cycles WHERE user_id = $1 AND status = 'active'",
    [userId]
  );

  for (const cycle of activeCycles.rows) {
    await generateSnapshot(userId, cycle.id);
  }
}
