import { Router, Response } from 'express';
import pool from '../db/pool';
import { AuthenticatedRequest } from '../types';

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
    const { title, description, category, objective_id, kr_id, estimate, priority, impact_note } = req.body;
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

    const result = await pool.query(
      `INSERT INTO tasks (user_id, title, description, category, objective_id, kr_id, estimate, priority, impact_note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        userId,
        title,
        description || null,
        category,
        objective_id || null,
        kr_id || null,
        estimate || null,
        priority || 'medium',
        impact_note || null
      ]
    );

    res.status(201).json(result.rows[0]);
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
    const { category, status, priority, objective_id, kr_id } = req.query;

    let query = 'SELECT * FROM tasks WHERE user_id = $1';
    const params: any[] = [userId];
    let paramCount = 2;

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

    query += ' ORDER BY created_at DESC';

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
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
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
    const { title, description, category, objective_id, kr_id, estimate, priority, impact_note, status } = req.body;
    const userId = req.userId;

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid task ID format'
      });
      return;
    }

    const existingTask = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
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

    if (status !== undefined) {
      if (!isValidTaskStatus(status)) {
        res.status(400).json({
          code: 'INVALID_STATUS',
          message: 'status must be one of: todo, doing, done'
        });
        return;
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
       WHERE id = $${paramCount++} AND user_id = $${paramCount}
       RETURNING *`,
      values
    );

    res.json(result.rows[0]);
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

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid task ID format'
      });
      return;
    }

    const result = await pool.query(
      `UPDATE tasks 
       SET status = 'done', completed_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
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
    console.error('Error completing task:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to complete task'
    });
  }
});

export default router;
