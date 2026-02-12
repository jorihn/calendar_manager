import { Router, Response } from 'express';
import pool from '../db/pool';
import { AuthenticatedRequest } from '../types';

const router = Router();

const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

const isValidStatus = (status: string): boolean => {
  return ['active', 'done', 'cancelled'].includes(status);
};

// Create initiative
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { kr_id, title, description, assignee_id } = req.body;
    const userId = req.userId;

    if (!kr_id || !title) {
      res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'Required fields: kr_id, title'
      });
      return;
    }

    if (!isValidUUID(kr_id)) {
      res.status(400).json({
        code: 'INVALID_KR_ID',
        message: 'Invalid kr_id format'
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

    const krCheck = await pool.query(
      `SELECT id FROM key_results WHERE id = $1 AND (
        user_id = $2
        OR objective_id IN (
          SELECT id FROM objectives WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = $2)
        )
      )`,
      [kr_id, userId]
    );

    if (krCheck.rows.length === 0) {
      res.status(404).json({
        code: 'KEY_RESULT_NOT_FOUND',
        message: 'Key result not found'
      });
      return;
    }

    const result = await pool.query(
      `INSERT INTO initiatives (user_id, kr_id, title, description, assignee_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, kr_id, title, description || null, assignee_id || userId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating initiative:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create initiative'
    });
  }
});

// List initiatives
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { kr_id, status } = req.query;

    const { assignee_id: qAssignee } = req.query as any;

    let query = `SELECT * FROM initiatives WHERE (
      user_id = $1
      OR assignee_id = $1
      OR kr_id IN (
        SELECT kr.id FROM key_results kr
        JOIN objectives o ON kr.objective_id = o.id
        WHERE o.org_id IN (SELECT org_id FROM org_members WHERE user_id = $1)
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

    if (kr_id) {
      query += ` AND kr_id = $${paramCount++}`;
      params.push(kr_id);
    }

    if (status) {
      query += ` AND status = $${paramCount++}`;
      params.push(status);
    } else {
      query += ` AND status = 'active'`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching initiatives:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch initiatives'
    });
  }
});

// Get initiative by ID
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid initiative ID format'
      });
      return;
    }

    const result = await pool.query(
      `SELECT * FROM initiatives WHERE id = $1 AND (
        user_id = $2
        OR assignee_id = $2
        OR kr_id IN (
          SELECT kr.id FROM key_results kr
          JOIN objectives o ON kr.objective_id = o.id
          WHERE o.org_id IN (SELECT org_id FROM org_members WHERE user_id = $2)
        )
      )`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        code: 'INITIATIVE_NOT_FOUND',
        message: 'Initiative not found'
      });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching initiative:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch initiative'
    });
  }
});

// Update initiative
router.patch('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, status, assignee_id: newAssignee } = req.body;
    const userId = req.userId;

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid initiative ID format'
      });
      return;
    }

    const existing = await pool.query(
      `SELECT * FROM initiatives WHERE id = $1 AND (
        user_id = $2
        OR assignee_id = $2
        OR kr_id IN (
          SELECT kr.id FROM key_results kr
          JOIN objectives o ON kr.objective_id = o.id
          WHERE o.org_id IN (SELECT org_id FROM org_members WHERE user_id = $2)
        )
      )`,
      [id, userId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({
        code: 'INITIATIVE_NOT_FOUND',
        message: 'Initiative not found'
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

    if (status !== undefined) {
      if (!isValidStatus(status)) {
        res.status(400).json({
          code: 'INVALID_STATUS',
          message: 'status must be one of: active, done, cancelled'
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
      `UPDATE initiatives
       SET ${updates.join(', ')}
       WHERE id = $${paramCount++} AND (
        user_id = $${paramCount}
        OR assignee_id = $${paramCount}
        OR kr_id IN (
          SELECT kr.id FROM key_results kr
          JOIN objectives o ON kr.objective_id = o.id
          WHERE o.org_id IN (SELECT org_id FROM org_members WHERE user_id = $${paramCount})
        )
       )
       RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating initiative:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update initiative'
    });
  }
});

// Soft delete initiative (set status to cancelled)
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid initiative ID format'
      });
      return;
    }

    const result = await pool.query(
      `UPDATE initiatives
       SET status = 'cancelled'
       WHERE id = $1 AND (
        user_id = $2
        OR assignee_id = $2
        OR kr_id IN (
          SELECT kr.id FROM key_results kr
          JOIN objectives o ON kr.objective_id = o.id
          WHERE o.org_id IN (SELECT org_id FROM org_members WHERE user_id = $2)
        )
       )
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        code: 'INITIATIVE_NOT_FOUND',
        message: 'Initiative not found'
      });
      return;
    }

    res.json({ message: 'Initiative cancelled', initiative: result.rows[0] });
  } catch (error) {
    console.error('Error cancelling initiative:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to cancel initiative'
    });
  }
});

export default router;
