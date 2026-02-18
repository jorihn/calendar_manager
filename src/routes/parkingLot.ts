import { Router, Response } from 'express';
import pool from '../db/pool';
import { AuthenticatedRequest } from '../types';

const router = Router();

const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

const isValidPriority = (p: string): boolean => ['high', 'low'].includes(p);
const isValidStatus = (s: string): boolean => ['open', 'parked'].includes(s);

// Create parking lot item
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const ownerId = req.userId;
    const { item, description, context, priority, proposed_cycle, status } = req.body || {};

    if (!item) {
      res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'Required field: item'
      });
      return;
    }

    if (priority !== undefined && !isValidPriority(priority)) {
      res.status(400).json({
        code: 'INVALID_PRIORITY',
        message: 'priority must be one of: high, low'
      });
      return;
    }

    if (status !== undefined && !isValidStatus(status)) {
      res.status(400).json({
        code: 'INVALID_STATUS',
        message: 'status must be one of: open, parked'
      });
      return;
    }

    const result = await pool.query(
      `INSERT INTO parking_lot (owner_id, item, description, context, priority, proposed_cycle, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        ownerId,
        item,
        description || null,
        context || null,
        priority || 'low',
        proposed_cycle || null,
        status || 'open'
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating parking lot item:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create parking lot item'
    });
  }
});

// List parking lot items
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const ownerId = req.userId;
    const { status, priority } = req.query;

    let query = `SELECT * FROM parking_lot WHERE owner_id = $1`;
    const params: any[] = [ownerId];
    let pc = 2;

    if (status && isValidStatus(status as string)) {
      query += ` AND status = $${pc++}`;
      params.push(status);
    }

    if (priority && isValidPriority(priority as string)) {
      query += ` AND priority = $${pc++}`;
      params.push(priority);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching parking lot:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch parking lot'
    });
  }
});

// Get parking lot item by id
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const ownerId = req.userId;
    const { id } = req.params;

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid parking lot item ID format'
      });
      return;
    }

    const result = await pool.query(
      `SELECT * FROM parking_lot WHERE id = $1 AND owner_id = $2`,
      [id, ownerId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        code: 'ITEM_NOT_FOUND',
        message: 'Parking lot item not found'
      });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching parking lot item:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch parking lot item'
    });
  }
});

// Update parking lot item
router.patch('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const ownerId = req.userId;
    const { id } = req.params;
    const { item, description, context, priority, proposed_cycle, status } = req.body || {};

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid parking lot item ID format'
      });
      return;
    }

    const updates: string[] = [];
    const values: any[] = [];
    let pc = 1;

    if (item !== undefined) {
      updates.push(`item = $${pc++}`);
      values.push(item);
    }

    if (description !== undefined) {
      updates.push(`description = $${pc++}`);
      values.push(description);
    }

    if (context !== undefined) {
      updates.push(`context = $${pc++}`);
      values.push(context);
    }

    if (priority !== undefined) {
      if (!isValidPriority(priority)) {
        res.status(400).json({
          code: 'INVALID_PRIORITY',
          message: 'priority must be one of: high, low'
        });
        return;
      }
      updates.push(`priority = $${pc++}`);
      values.push(priority);
    }

    if (proposed_cycle !== undefined) {
      updates.push(`proposed_cycle = $${pc++}`);
      values.push(proposed_cycle);
    }

    if (status !== undefined) {
      if (!isValidStatus(status)) {
        res.status(400).json({
          code: 'INVALID_STATUS',
          message: 'status must be one of: open, parked'
        });
        return;
      }
      updates.push(`status = $${pc++}`);
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
    values.push(ownerId);

    const result = await pool.query(
      `UPDATE parking_lot
       SET ${updates.join(', ')}
       WHERE id = $${pc++} AND owner_id = $${pc}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        code: 'ITEM_NOT_FOUND',
        message: 'Parking lot item not found'
      });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating parking lot item:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update parking lot item'
    });
  }
});

export default router;
