import { Router, Response } from 'express';
import pool from '../db/pool';
import { AuthenticatedRequest } from '../types';
import { cascadeFromKR } from '../services/scoring';

const router = Router();

const isValidKRType = (type: string): boolean => {
  return ['metric', 'milestone', 'boolean'].includes(type);
};

const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { objective_id, title, type, target, current, confidence, parent_kr_id, importance_weight } = req.body;
    const userId = req.userId;

    if (!objective_id || !title || !type) {
      res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'Required fields: objective_id, title, type'
      });
      return;
    }

    if (!isValidUUID(objective_id)) {
      res.status(400).json({
        code: 'INVALID_OBJECTIVE_ID',
        message: 'Invalid objective_id format'
      });
      return;
    }

    if (!isValidKRType(type)) {
      res.status(400).json({
        code: 'INVALID_TYPE',
        message: 'type must be one of: metric, milestone, boolean'
      });
      return;
    }

    if (confidence !== undefined && (confidence < 0 || confidence > 1)) {
      res.status(400).json({
        code: 'INVALID_CONFIDENCE',
        message: 'confidence must be between 0 and 1'
      });
      return;
    }

    if (parent_kr_id !== undefined && parent_kr_id !== null && !isValidUUID(parent_kr_id)) {
      res.status(400).json({
        code: 'INVALID_PARENT_KR_ID',
        message: 'Invalid parent_kr_id format'
      });
      return;
    }

    // Compute hierarchy fields
    let rootKrId: string | null = null;
    let level = 0;

    if (parent_kr_id) {
      const parentKR = await pool.query(
        `SELECT id, root_kr_id, level FROM key_results WHERE id = $1 AND (
          user_id = $2
          OR objective_id IN (
            SELECT id FROM objectives WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = $2)
          )
        )`,
        [parent_kr_id, userId]
      );

      if (parentKR.rows.length === 0) {
        res.status(404).json({
          code: 'PARENT_KR_NOT_FOUND',
          message: 'Parent key result not found'
        });
        return;
      }

      rootKrId = parentKR.rows[0].root_kr_id || parentKR.rows[0].id;
      level = parentKR.rows[0].level + 1;
    }

    const result = await pool.query(
      `INSERT INTO key_results (user_id, objective_id, title, type, target, current, confidence, parent_kr_id, root_kr_id, level, importance_weight)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [userId, objective_id, title, type, target || null, current || null, confidence || null, parent_kr_id || null, rootKrId, level, importance_weight || 1]
    );

    const created = result.rows[0];
    await cascadeFromKR(created.id);

    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating key result:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create key result'
    });
  }
});

router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { objective_id } = req.query;

    let query = `SELECT * FROM key_results WHERE (
      user_id = $1
      OR objective_id IN (
        SELECT id FROM objectives WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = $1)
      )
    )`;
    const params: any[] = [userId];
    let paramCount = 2;

    if (objective_id) {
      query += ` AND objective_id = $${paramCount++}`;
      params.push(objective_id);
    }

    if (req.query.parent_kr_id) {
      query += ` AND parent_kr_id = $${paramCount++}`;
      params.push(req.query.parent_kr_id);
    }

    if (req.query.root_only === 'true') {
      query += ' AND parent_kr_id IS NULL';
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching key results:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch key results'
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
        message: 'Invalid key result ID format'
      });
      return;
    }

    const result = await pool.query(
      `SELECT * FROM key_results WHERE id = $1 AND (
        user_id = $2
        OR objective_id IN (
          SELECT id FROM objectives WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = $2)
        )
      )`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        code: 'KEY_RESULT_NOT_FOUND',
        message: 'Key result not found'
      });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching key result:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch key result'
    });
  }
});

router.patch('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, type, target, current, confidence, importance_weight } = req.body;
    const userId = req.userId;

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid key result ID format'
      });
      return;
    }

    const existingKR = await pool.query(
      `SELECT * FROM key_results WHERE id = $1 AND (
        user_id = $2
        OR objective_id IN (
          SELECT id FROM objectives WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = $2)
        )
      )`,
      [id, userId]
    );

    if (existingKR.rows.length === 0) {
      res.status(404).json({
        code: 'KEY_RESULT_NOT_FOUND',
        message: 'Key result not found'
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

    if (type !== undefined) {
      if (!isValidKRType(type)) {
        res.status(400).json({
          code: 'INVALID_TYPE',
          message: 'type must be one of: metric, milestone, boolean'
        });
        return;
      }
      updates.push(`type = $${paramCount++}`);
      values.push(type);
    }

    if (target !== undefined) {
      updates.push(`target = $${paramCount++}`);
      values.push(target);
    }

    if (current !== undefined) {
      updates.push(`current = $${paramCount++}`);
      values.push(current);
    }

    if (confidence !== undefined) {
      if (confidence < 0 || confidence > 1) {
        res.status(400).json({
          code: 'INVALID_CONFIDENCE',
          message: 'confidence must be between 0 and 1'
        });
        return;
      }
      updates.push(`confidence = $${paramCount++}`);
      values.push(confidence);
    }

    if (importance_weight !== undefined) {
      if (importance_weight < 0 || importance_weight > 1) {
        res.status(400).json({
          code: 'INVALID_IMPORTANCE_WEIGHT',
          message: 'importance_weight must be between 0 and 1'
        });
        return;
      }
      updates.push(`importance_weight = $${paramCount++}`);
      values.push(importance_weight);
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
      `UPDATE key_results 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount++} AND (
        user_id = $${paramCount}
        OR objective_id IN (
          SELECT id FROM objectives WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = $${paramCount})
        )
       )
       RETURNING *`,
      values
    );

    const updated = result.rows[0];
    await cascadeFromKR(updated.id);

    res.json(updated);
  } catch (error) {
    console.error('Error updating key result:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update key result'
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
        message: 'Invalid key result ID format'
      });
      return;
    }

    const result = await pool.query(
      `DELETE FROM key_results WHERE id = $1 AND (
        user_id = $2
        OR objective_id IN (
          SELECT id FROM objectives WHERE org_id IN (SELECT org_id FROM org_members WHERE user_id = $2)
        )
      ) RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        code: 'KEY_RESULT_NOT_FOUND',
        message: 'Key result not found'
      });
      return;
    }

    res.json({ message: 'Key result deleted', key_result: result.rows[0] });
  } catch (error) {
    console.error('Error deleting key result:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to delete key result'
    });
  }
});

export default router;
