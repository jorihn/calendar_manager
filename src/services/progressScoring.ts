import pool from '../db/pool';

/**
 * Non-blocking "AI-assisted" scoring stub.
 *
 * This is intentionally resilient:
 * - If any error occurs, it logs and returns null.
 * - It does NOT block request flows.
 *
 * You can later replace `heuristicProgressScore` with a real LLM call.
 */
export async function evaluateAndPersistProgressScore(taskId: string): Promise<number | null> {
  try {
    const r = await pool.query(
      `SELECT id, progress_percent, progress_note, next_action, blocked_reason, dod, outcome, status
       FROM tasks
       WHERE id = $1`,
      [taskId]
    );

    if (r.rows.length === 0) return null;

    const t = r.rows[0];
    const score = heuristicProgressScore({
      progress_percent: t.progress_percent,
      progress_note: t.progress_note,
      next_action: t.next_action,
      blocked_reason: t.blocked_reason,
      dod: t.dod,
      outcome: t.outcome,
      status: t.status
    });

    if (score === null) return null;

    await pool.query(
      'UPDATE tasks SET progress_score = $1 WHERE id = $2',
      [score, taskId]
    );

    return score;
  } catch (err) {
    console.error('Progress scoring error:', err);
    return null;
  }
}

function heuristicProgressScore(input: {
  progress_percent: number | null;
  progress_note: string | null;
  next_action: string | null;
  blocked_reason: string | null;
  dod: string | null;
  outcome: string | null;
  status: string | null;
}): number | null {
  // If task is done, treat as complete.
  if (input.status === 'done') return 1;

  let score = 0;

  // Percent contributes most if present
  if (typeof input.progress_percent === 'number' && Number.isFinite(input.progress_percent)) {
    score += Math.max(0, Math.min(input.progress_percent / 100, 1)) * 0.6;
  }

  // Notes help
  if (input.progress_note && input.progress_note.trim().length >= 10) score += 0.15;

  // Next action is the best indicator of handoff quality
  if (input.next_action && input.next_action.trim().length >= 5) score += 0.2;

  // If blocked, score should not look high unless percent is high
  if (input.blocked_reason && input.blocked_reason.trim().length >= 5) score -= 0.15;

  // If DoD exists, and they wrote an outcome or note, small bonus
  if (input.dod && input.dod.trim().length > 0) {
    if ((input.outcome && input.outcome.trim().length > 0) || (input.progress_note && input.progress_note.trim().length > 0)) {
      score += 0.05;
    }
  }

  // Clamp
  score = Math.max(0, Math.min(score, 1));

  // Round to 2 decimals to match NUMERIC(3,2)
  return Math.round(score * 100) / 100;
}
