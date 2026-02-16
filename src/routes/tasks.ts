import { Router, Response } from 'express';
import pool from '../db/pool';
import { AuthenticatedRequest } from '../types';
import { cascadeFromTask } from '../services/scoring';

const router = Router();

const isValidCategory = (category: string): boolean => {
  return ['work', 'personal'].includes(category);
};

const isValidPriority = (priority: string): boolean => {
  return ['low', 'medium', 'high', 'critical'].includes(priority);
};

const isValidTaskStatus = (status: string): boolean => {
  return ['todo', 'doing', 'done'].includes(status);
};

const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, description, category, objective_id, kr_id, initiative_id, estimate, priority, impact_note, due_date, blocking, assignee_id, dod, outcome } = req.body;
    const userId = req.userId;

    if (!title || !category) {
      res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'Required fields: title, category'
      });
      return;
    }

    if (!isValidCategory(category)) {
      res.status(400).json({
        code: 'INVALID_CATEGORY',
        message: 'category must be one of: work, personal'
      });
      return;
    }

    if (priority && !isValidPriority(priority)) {
      res.status(400).json({
        code: 'INVALID_PRIORITY',
        message: 'priority must be one of: low, medium, high, critical'
      });
      return;
    }

    if (objective_id && !isValidUUID(objective_id)) {
      res.status(400).json({
        code: 'INVALID_OBJECTIVE_ID',
        message: 'Invalid objective_id format'
      });
      return;
    }

    if (kr_id && !isValidUUID(kr_id)) {
      res.status(400).json({
        code: 'INVALID_KR_ID',
        message: 'Invalid kr_id format'
      });
      return;
    }

    if (initiative_id && !isValidUUID(initiative_id)) {
      res.status(400).json({
        code: 'INVALID_INITIATIVE_ID',
        message: 'Invalid initiative_id format'
      });
      return;
    }

    if (assignee_id && !isValidUUID(assignee_id)) {
      res.status(400).json({
        code: 'INVALID_ASSIGNEE_ID',
        message: 'Invalid assignee_id format'
      });
      return;
    }

    // Compute root_kr_id from kr_id hierarchy
    let rootKrId: string | null = null;
    if (kr_id) {
      const krResult = await pool.query(
        'SELECT root_kr_id, id FROM key_results WHERE id = $1',
        [kr_id]
      );
      if (krResult.rows.length > 0) {
        rootKrId = krResult.rows[0].root_kr_id || krResult.rows[0].id;
      }
    }

    const result = await pool.query(
      `INSERT INTO tasks (user_id, title, description, category, objective_id, kr_id, initiative_id, estimate, priority, impact_note, due_date, root_kr_id, blocking, assignee_id, dod, outcome)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        userId,
        title,
        description || null,
        category,
        objective_id || null,
        kr_id || null,
        initiative_id || null,
        estimate || null,
        priority || 'medium',
        impact_note || null,
        due_date || null,
        rootKrId,
        blocking || false,
        assignee_id || userId,
        dod || null,
        outcome || null
      ]
    );

    const created = result.rows[0];
    // Trigger scoring cascade
    cascadeFromTask(created.id).catch(err => console.error('Scoring error (task create):', err));

    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create task'
    });
  }
});

router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { category, status, priority, objective_id, kr_id, initiative_id, blocking, assignee_id: qAssignee } = req.query;

    let query = `SELECT * FROM tasks WHERE (
      user_id = $1
      OR assignee_id = $1
      OR objective_id IN (
        SELECT id FROM objectives WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = $1)
      )
    )`;
    const params: any[] = [userId];
    let paramCount = 2;

    if (qAssignee === 'me') {
      query += ` AND assignee_id = $1`;
    } else if (qAssignee && isValidUUID(qAssignee as string)) {
      query += ` AND assignee_id = $${paramCount++}`;
      params.push(qAssignee);
    }

    if (category) {
      query += ` AND category = $${paramCount++}`;
      params.push(category);
    }

    if (status) {
      query += ` AND status = $${paramCount++}`;
      params.push(status);
    }

    if (priority) {
      query += ` AND priority = $${paramCount++}`;
      params.push(priority);
    }

    if (objective_id) {
      query += ` AND objective_id = $${paramCount++}`;
      params.push(objective_id);
    }

    if (kr_id) {
      query += ` AND kr_id = $${paramCount++}`;
      params.push(kr_id);
    }

    if (initiative_id) {
      query += ` AND initiative_id = $${paramCount++}`;
      params.push(initiative_id);
    }

    if (blocking === 'true') {
      query += ' AND blocking = true';
    }

    query += ' ORDER BY priority_score DESC, created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch tasks'
    });
  }
});

// Get my assigned work with full hierarchy context (must be before /:id)
router.get('/my-work/assigned', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { status } = req.query;

    let statusFilter = `AND t.status != 'done'`;
    if (status) {
      statusFilter = `AND t.status = $2`;
    }

    const params: any[] = [userId];
    if (status) params.push(status);

    const result = await pool.query(
      `SELECT
        t.*,
        kr.title as kr_title,
        kr.progress as kr_progress,
        kr.risk_score as kr_risk_score,
        o.title as objective_title,
        o.progress as objective_progress,
        o.type as objective_type,
        i.title as initiative_title,
        u_creator.name as created_by_name
      FROM tasks t
      LEFT JOIN key_results kr ON t.kr_id = kr.id
      LEFT JOIN objectives o ON t.objective_id = o.id
      LEFT JOIN initiatives i ON t.initiative_id = i.id
      LEFT JOIN users u_creator ON t.user_id = u_creator.id
      WHERE t.assignee_id = $1 ${statusFilter}
      ORDER BY t.priority_score DESC, t.due_date ASC NULLS LAST, t.created_at DESC`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching assigned work:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch assigned work'
    });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid task ID format'
      });
      return;
    }

    const result = await pool.query(
      `SELECT * FROM tasks WHERE id = $1 AND (
        user_id = $2
        OR assignee_id = $2
        OR objective_id IN (
          SELECT id FROM objectives WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = $2)
        )
      )`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        code: 'TASK_NOT_FOUND',
        message: 'Task not found'
      });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch task'
    });
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, category, objective_id, kr_id, initiative_id, estimate, priority, impact_note, status, due_date, blocking, assignee_id: newAssignee, dod, outcome, outcome_score, dod_review_status, dod_review_note, dod_confirmed } = req.body;
    const userId = req.userId;

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid task ID format'
      });
      return;
    }

    const existingTask = await pool.query(
      `SELECT * FROM tasks WHERE id = $1 AND (
        user_id = $2
        OR assignee_id = $2
        OR objective_id IN (
          SELECT id FROM objectives WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = $2)
        )
      )`,
      [id, userId]
    );

    if (existingTask.rows.length === 0) {
      res.status(404).json({
        code: 'TASK_NOT_FOUND',
        message: 'Task not found'
      });
      return;
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }

    if (category !== undefined) {
      if (!isValidCategory(category)) {
        res.status(400).json({
          code: 'INVALID_CATEGORY',
          message: 'category must be one of: work, personal'
        });
        return;
      }
      updates.push(`category = $${paramCount++}`);
      values.push(category);
    }

    if (objective_id !== undefined) {
      if (objective_id !== null && !isValidUUID(objective_id)) {
        res.status(400).json({
          code: 'INVALID_OBJECTIVE_ID',
          message: 'Invalid objective_id format'
        });
        return;
      }
      updates.push(`objective_id = $${paramCount++}`);
      values.push(objective_id);
    }

    if (kr_id !== undefined) {
      if (kr_id !== null && !isValidUUID(kr_id)) {
        res.status(400).json({
          code: 'INVALID_KR_ID',
          message: 'Invalid kr_id format'
        });
        return;
      }
      updates.push(`kr_id = $${paramCount++}`);
      values.push(kr_id);
    }

    if (estimate !== undefined) {
      updates.push(`estimate = $${paramCount++}`);
      values.push(estimate);
    }

    if (priority !== undefined) {
      if (!isValidPriority(priority)) {
        res.status(400).json({
          code: 'INVALID_PRIORITY',
          message: 'priority must be one of: low, medium, high, critical'
        });
        return;
      }
      updates.push(`priority = $${paramCount++}`);
      values.push(priority);
    }

    if (impact_note !== undefined) {
      updates.push(`impact_note = $${paramCount++}`);
      values.push(impact_note);
    }

    if (initiative_id !== undefined) {
      if (initiative_id !== null && !isValidUUID(initiative_id)) {
        res.status(400).json({
          code: 'INVALID_INITIATIVE_ID',
          message: 'Invalid initiative_id format'
        });
        return;
      }
      updates.push(`initiative_id = $${paramCount++}`);
      values.push(initiative_id);
    }

    if (due_date !== undefined) {
      updates.push(`due_date = $${paramCount++}`);
      values.push(due_date);
    }

    if (blocking !== undefined) {
      updates.push(`blocking = $${paramCount++}`);
      values.push(blocking);
    }

    if (newAssignee !== undefined) {
      if (newAssignee !== null && !isValidUUID(newAssignee)) {
        res.status(400).json({
          code: 'INVALID_ASSIGNEE_ID',
          message: 'Invalid assignee_id format'
        });
        return;
      }
      updates.push(`assignee_id = $${paramCount++}`);
      values.push(newAssignee);
    }

    if (dod !== undefined) {
      updates.push(`dod = $${paramCount++}`);
      values.push(dod);
    }

    if (outcome !== undefined) {
      updates.push(`outcome = $${paramCount++}`);
      values.push(outcome);
    }

    if (outcome_score !== undefined) {
      const score = parseFloat(outcome_score);
      if (isNaN(score) || score < 0 || score > 1) {
        res.status(400).json({
          code: 'INVALID_OUTCOME_SCORE',
          message: 'outcome_score must be a number between 0 and 1'
        });
        return;
      }
      updates.push(`outcome_score = $${paramCount++}`);
      values.push(score);
    }

    if (dod_review_status !== undefined) {
      if (!['passed', 'needs_revision', 'partial'].includes(dod_review_status)) {
        res.status(400).json({
          code: 'INVALID_DOD_REVIEW_STATUS',
          message: 'dod_review_status must be one of: passed, needs_revision, partial'
        });
        return;
      }
      updates.push(`dod_review_status = $${paramCount++}`);
      values.push(dod_review_status);
    }

    if (dod_review_note !== undefined) {
      updates.push(`dod_review_note = $${paramCount++}`);
      values.push(dod_review_note);
    }

    if (status !== undefined) {
      if (!isValidTaskStatus(status)) {
        res.status(400).json({
          code: 'INVALID_STATUS',
          message: 'status must be one of: todo, doing, done'
        });
        return;
      }

      // DoD Gate: if task has DoD and status is being set to done, require confirmation
      if (status === 'done') {
        const currentTask = existingTask.rows[0];
        if (currentTask.dod && !dod_confirmed) {
          res.status(400).json({
            code: 'DOD_NOT_CONFIRMED',
            message: 'Task has Definition of Done criteria. Please confirm completion by sending dod_confirmed: true',
            dod: currentTask.dod
          });
          return;
        }
      }

      updates.push(`status = $${paramCount++}`);
      values.push(status);

      if (status === 'done') {
        updates.push(`completed_at = CURRENT_TIMESTAMP`);
      }
    }

    if (updates.length === 0) {
      res.status(400).json({
        code: 'NO_UPDATES',
        message: 'No valid fields provided for update'
      });
      return;
    }

    values.push(id);
    values.push(userId);

    const result = await pool.query(
      `UPDATE tasks 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount++} AND (
        user_id = $${paramCount}
        OR assignee_id = $${paramCount}
        OR objective_id IN (
          SELECT id FROM objectives WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = $${paramCount})
        )
       )
       RETURNING *`,
      values
    );

    const updated = result.rows[0];
    // Trigger scoring cascade
    cascadeFromTask(updated.id).catch(err => console.error('Scoring error (task update):', err));

    res.json(updated);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update task'
    });
  }
});

router.post('/:id/complete', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const { dod_confirmed, outcome_score } = req.body || {};

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid task ID format'
      });
      return;
    }

    // Fetch task first to check DoD gate
    const existingTask = await pool.query(
      `SELECT * FROM tasks WHERE id = $1 AND (
        user_id = $2
        OR assignee_id = $2
        OR objective_id IN (
          SELECT id FROM objectives WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = $2)
        )
      )`,
      [id, userId]
    );

    if (existingTask.rows.length === 0) {
      res.status(404).json({
        code: 'TASK_NOT_FOUND',
        message: 'Task not found'
      });
      return;
    }

    const task = existingTask.rows[0];

    // DoD Gate: if task has DoD, require explicit confirmation
    if (task.dod && !dod_confirmed) {
      res.status(400).json({
        code: 'DOD_NOT_CONFIRMED',
        message: 'Task has Definition of Done criteria. Please review and confirm by sending dod_confirmed: true',
        dod: task.dod
      });
      return;
    }

    // Build update query with optional outcome_score
    let updateSql = `UPDATE tasks SET status = 'done', completed_at = CURRENT_TIMESTAMP`;
    const params: any[] = [id, userId];

    if (outcome_score !== undefined) {
      const score = parseFloat(outcome_score);
      if (isNaN(score) || score < 0 || score > 1) {
        res.status(400).json({
          code: 'INVALID_OUTCOME_SCORE',
          message: 'outcome_score must be a number between 0 and 1'
        });
        return;
      }
      updateSql += `, outcome_score = $3`;
      params.push(score);
    }

    updateSql += ` WHERE id = $1 AND (
      user_id = $2
      OR assignee_id = $2
      OR objective_id IN (
        SELECT id FROM objectives WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = $2)
      )
    ) RETURNING *`;

    const result = await pool.query(updateSql, params);

    const completed = result.rows[0];
    // Trigger scoring cascade
    cascadeFromTask(completed.id).catch(err => console.error('Scoring error (task complete):', err));

    res.json(completed);
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to complete task'
    });
  }
});

export default router;
