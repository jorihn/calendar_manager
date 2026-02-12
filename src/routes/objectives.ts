import { Router, Response } from 'express';
import pool from '../db/pool';
import { AuthenticatedRequest } from '../types';

const router = Router();

const isValidObjectiveType = (type: string): boolean => {
  return ['work', 'personal'].includes(type);
};

const isValidHorizon = (horizon: string): boolean => {
  return ['week', 'month', 'quarter', 'year'].includes(horizon);
};

const isValidStatus = (status: string): boolean => {
  return ['active', 'archived'].includes(status);
};

const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, description, type, horizon, success_def, org_id, cycle_id } = req.body;
    const userId = req.userId;

    if (!title || !type || !horizon) {
      res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'Required fields: title, type, horizon'
      });
      return;
    }

    if (!isValidObjectiveType(type)) {
      res.status(400).json({
        code: 'INVALID_TYPE',
        message: 'type must be one of: work, personal'
      });
      return;
    }

    if (!isValidHorizon(horizon)) {
      res.status(400).json({
        code: 'INVALID_HORIZON',
        message: 'horizon must be one of: week, month, quarter, year'
      });
      return;
    }

    if (org_id && !isValidUUID(org_id)) {
      res.status(400).json({
        code: 'INVALID_ORG_ID',
        message: 'Invalid org_id format'
      });
      return;
    }

    if (cycle_id && !isValidUUID(cycle_id)) {
      res.status(400).json({
        code: 'INVALID_CYCLE_ID',
        message: 'Invalid cycle_id format'
      });
      return;
    }

    const result = await pool.query(
      `INSERT INTO objectives (user_id, title, description, type, horizon, success_def, org_id, cycle_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [userId, title, description || null, type, horizon, success_def || null, org_id || null, cycle_id || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating objective:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create objective'
    });
  }
});

router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { type, horizon, status, org_id, cycle_id } = req.query;

    let query = 'SELECT * FROM objectives WHERE user_id = $1';
    const params: any[] = [userId];
    let paramCount = 2;

    if (type) {
      query += ` AND type = $${paramCount++}`;
      params.push(type);
    }

    if (horizon) {
      query += ` AND horizon = $${paramCount++}`;
      params.push(horizon);
    }

    if (status) {
      query += ` AND status = $${paramCount++}`;
      params.push(status);
    } else {
      query += ` AND status = 'active'`;
    }

    if (org_id) {
      query += ` AND org_id = $${paramCount++}`;
      params.push(org_id);
    }

    if (cycle_id) {
      query += ` AND cycle_id = $${paramCount++}`;
      params.push(cycle_id);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching objectives:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch objectives'
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
        message: 'Invalid objective ID format'
      });
      return;
    }

    const result = await pool.query(
      'SELECT * FROM objectives WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        code: 'OBJECTIVE_NOT_FOUND',
        message: 'Objective not found'
      });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching objective:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch objective'
    });
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, type, horizon, success_def, status, org_id, cycle_id } = req.body;
    const userId = req.userId;

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid objective ID format'
      });
      return;
    }

    const existingObjective = await pool.query(
      'SELECT * FROM objectives WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existingObjective.rows.length === 0) {
      res.status(404).json({
        code: 'OBJECTIVE_NOT_FOUND',
        message: 'Objective not found'
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

    if (type !== undefined) {
      if (!isValidObjectiveType(type)) {
        res.status(400).json({
          code: 'INVALID_TYPE',
          message: 'type must be one of: work, personal'
        });
        return;
      }
      updates.push(`type = $${paramCount++}`);
      values.push(type);
    }

    if (horizon !== undefined) {
      if (!isValidHorizon(horizon)) {
        res.status(400).json({
          code: 'INVALID_HORIZON',
          message: 'horizon must be one of: week, month, quarter, year'
        });
        return;
      }
      updates.push(`horizon = $${paramCount++}`);
      values.push(horizon);
    }

    if (success_def !== undefined) {
      updates.push(`success_def = $${paramCount++}`);
      values.push(success_def);
    }

    if (org_id !== undefined) {
      if (org_id !== null && !isValidUUID(org_id)) {
        res.status(400).json({
          code: 'INVALID_ORG_ID',
          message: 'Invalid org_id format'
        });
        return;
      }
      updates.push(`org_id = $${paramCount++}`);
      values.push(org_id);
    }

    if (cycle_id !== undefined) {
      if (cycle_id !== null && !isValidUUID(cycle_id)) {
        res.status(400).json({
          code: 'INVALID_CYCLE_ID',
          message: 'Invalid cycle_id format'
        });
        return;
      }
      updates.push(`cycle_id = $${paramCount++}`);
      values.push(cycle_id);
    }

    if (status !== undefined) {
      if (!isValidStatus(status)) {
        res.status(400).json({
          code: 'INVALID_STATUS',
          message: 'status must be one of: active, archived'
        });
        return;
      }
      updates.push(`status = $${paramCount++}`);
      values.push(status);
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
      `UPDATE objectives 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount++} AND user_id = $${paramCount}
       RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating objective:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update objective'
    });
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid objective ID format'
      });
      return;
    }

    const result = await pool.query(
      `UPDATE objectives 
       SET status = 'archived'
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        code: 'OBJECTIVE_NOT_FOUND',
        message: 'Objective not found'
      });
      return;
    }

    res.json({ message: 'Objective archived', objective: result.rows[0] });
  } catch (error) {
    console.error('Error archiving objective:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to archive objective'
    });
  }
});

export default router;
