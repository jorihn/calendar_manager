import { Router, Response } from 'express';
import pool from '../db/pool';
import { AuthenticatedRequest } from '../types';

const router = Router();

const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

const isValidCycleType = (type: string): boolean => {
  return ['week', 'month', 'quarter', 'year'].includes(type);
};

const isValidDate = (date: string): boolean => {
  return !isNaN(Date.parse(date));
};

// Create cycle
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, type, start_date, end_date, org_id } = req.body;
    const userId = req.userId;

    if (!name || !type || !start_date || !end_date) {
      res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'Required fields: name, type, start_date, end_date'
      });
      return;
    }

    if (!isValidCycleType(type)) {
      res.status(400).json({
        code: 'INVALID_TYPE',
        message: 'type must be one of: week, month, quarter, year'
      });
      return;
    }

    if (!isValidDate(start_date) || !isValidDate(end_date)) {
      res.status(400).json({
        code: 'INVALID_DATE',
        message: 'start_date and end_date must be valid dates (YYYY-MM-DD)'
      });
      return;
    }

    if (new Date(start_date) >= new Date(end_date)) {
      res.status(400).json({
        code: 'INVALID_DATE_RANGE',
        message: 'start_date must be before end_date'
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

    const result = await pool.query(
      `INSERT INTO cycles (user_id, org_id, name, type, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, org_id || null, name, type, start_date, end_date]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating cycle:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create cycle'
    });
  }
});

// List cycles
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { type, status, org_id } = req.query;

    let query = 'SELECT * FROM cycles WHERE user_id = $1';
    const params: any[] = [userId];
    let paramCount = 2;

    if (type) {
      query += ` AND type = $${paramCount++}`;
      params.push(type);
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

    query += ' ORDER BY start_date DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching cycles:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch cycles'
    });
  }
});

// Get cycle by ID
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid cycle ID format'
      });
      return;
    }

    const result = await pool.query(
      'SELECT * FROM cycles WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        code: 'CYCLE_NOT_FOUND',
        message: 'Cycle not found'
      });
      return;
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching cycle:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch cycle'
    });
  }
});

// Update cycle
router.patch('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, type, start_date, end_date } = req.body;
    const userId = req.userId;

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid cycle ID format'
      });
      return;
    }

    const existing = await pool.query(
      'SELECT * FROM cycles WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({
        code: 'CYCLE_NOT_FOUND',
        message: 'Cycle not found'
      });
      return;
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }

    if (type !== undefined) {
      if (!isValidCycleType(type)) {
        res.status(400).json({
          code: 'INVALID_TYPE',
          message: 'type must be one of: week, month, quarter, year'
        });
        return;
      }
      updates.push(`type = $${paramCount++}`);
      values.push(type);
    }

    if (start_date !== undefined) {
      if (!isValidDate(start_date)) {
        res.status(400).json({
          code: 'INVALID_DATE',
          message: 'start_date must be a valid date'
        });
        return;
      }
      updates.push(`start_date = $${paramCount++}`);
      values.push(start_date);
    }

    if (end_date !== undefined) {
      if (!isValidDate(end_date)) {
        res.status(400).json({
          code: 'INVALID_DATE',
          message: 'end_date must be a valid date'
        });
        return;
      }
      updates.push(`end_date = $${paramCount++}`);
      values.push(end_date);
    }

    if (updates.length === 0) {
      res.status(400).json({
        code: 'NO_UPDATES',
        message: 'No valid fields provided for update'
      });
      return;
    }

    const finalStartDate = start_date || existing.rows[0].start_date;
    const finalEndDate = end_date || existing.rows[0].end_date;

    if (new Date(finalStartDate) >= new Date(finalEndDate)) {
      res.status(400).json({
        code: 'INVALID_DATE_RANGE',
        message: 'start_date must be before end_date'
      });
      return;
    }

    values.push(id);
    values.push(userId);

    const result = await pool.query(
      `UPDATE cycles
       SET ${updates.join(', ')}
       WHERE id = $${paramCount++} AND user_id = $${paramCount}
       RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating cycle:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update cycle'
    });
  }
});

// Close cycle
router.post('/:id/close', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid cycle ID format'
      });
      return;
    }

    const result = await pool.query(
      `UPDATE cycles
       SET status = 'closed'
       WHERE id = $1 AND user_id = $2 AND status = 'active'
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        code: 'CYCLE_NOT_FOUND',
        message: 'Cycle not found or already closed'
      });
      return;
    }

    res.json({ message: 'Cycle closed', cycle: result.rows[0] });
  } catch (error) {
    console.error('Error closing cycle:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to close cycle'
    });
  }
});

export default router;
