import { Router, Response } from 'express';
import pool from '../db/pool';
import { AuthenticatedRequest } from '../types';
import { isValidTimestamp, isValidSlotType, isValidUUID } from '../utils/validation';

const router = Router();

router.post('/slots', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, start_time, end_time, type } = req.body;
    const userId = req.userId;

    if (!title || !start_time || !end_time || !type) {
      res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'Required fields: title, start_time, end_time, type'
      });
      return;
    }

    if (!isValidTimestamp(start_time) || !isValidTimestamp(end_time)) {
      res.status(400).json({
        code: 'INVALID_TIMESTAMP',
        message: 'start_time and end_time must be valid ISO 8601 timestamps'
      });
      return;
    }

    if (!isValidSlotType(type)) {
      res.status(400).json({
        code: 'INVALID_TYPE',
        message: 'type must be one of: work, meeting, focus, personal'
      });
      return;
    }

    const startDate = new Date(start_time);
    const endDate = new Date(end_time);

    if (startDate >= endDate) {
      res.status(400).json({
        code: 'INVALID_TIME_RANGE',
        message: 'start_time must be before end_time'
      });
      return;
    }

    const overlapCheck = await pool.query(
      `SELECT id FROM calendar_slots 
       WHERE user_id = $1 
       AND status = 'active'
       AND (
         (start_time < $3 AND end_time > $2)
       )`,
      [userId, start_time, end_time]
    );

    if (overlapCheck.rows.length > 0) {
      res.status(409).json({
        code: 'TIME_CONFLICT',
        message: 'This time slot overlaps with an existing active slot',
        details: { conflicting_slot_id: overlapCheck.rows[0].id }
      });
      return;
    }

    const result = await pool.query(
      `INSERT INTO calendar_slots (user_id, title, start_time, end_time, type, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING *`,
      [userId, title, start_time, end_time, type]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating slot:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create calendar slot'
    });
  }
});

router.put('/slots/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, start_time, end_time, type, status } = req.body;
    const userId = req.userId;

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid slot ID format'
      });
      return;
    }

    const existingSlot = await pool.query(
      'SELECT * FROM calendar_slots WHERE id = $1',
      [id]
    );

    if (existingSlot.rows.length === 0) {
      res.status(404).json({
        code: 'SLOT_NOT_FOUND',
        message: 'Calendar slot not found'
      });
      return;
    }

    if (existingSlot.rows[0].user_id !== userId) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You do not have permission to modify this slot'
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

    if (start_time !== undefined) {
      if (!isValidTimestamp(start_time)) {
        res.status(400).json({
          code: 'INVALID_TIMESTAMP',
          message: 'start_time must be a valid ISO 8601 timestamp'
        });
        return;
      }
      updates.push(`start_time = $${paramCount++}`);
      values.push(start_time);
    }

    if (end_time !== undefined) {
      if (!isValidTimestamp(end_time)) {
        res.status(400).json({
          code: 'INVALID_TIMESTAMP',
          message: 'end_time must be a valid ISO 8601 timestamp'
        });
        return;
      }
      updates.push(`end_time = $${paramCount++}`);
      values.push(end_time);
    }

    if (type !== undefined) {
      if (!isValidSlotType(type)) {
        res.status(400).json({
          code: 'INVALID_TYPE',
          message: 'type must be one of: work, meeting, focus, personal'
        });
        return;
      }
      updates.push(`type = $${paramCount++}`);
      values.push(type);
    }

    if (status !== undefined) {
      if (!['active', 'cancelled', 'done'].includes(status)) {
        res.status(400).json({
          code: 'INVALID_STATUS',
          message: 'status must be one of: active, cancelled, done'
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

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const finalStartTime = start_time || existingSlot.rows[0].start_time;
    const finalEndTime = end_time || existingSlot.rows[0].end_time;

    if (new Date(finalStartTime) >= new Date(finalEndTime)) {
      res.status(400).json({
        code: 'INVALID_TIME_RANGE',
        message: 'start_time must be before end_time'
      });
      return;
    }

    if (start_time || end_time) {
      const overlapCheck = await pool.query(
        `SELECT id FROM calendar_slots 
         WHERE user_id = $1 
         AND status = 'active'
         AND id != $2
         AND (
           (start_time < $4 AND end_time > $3)
         )`,
        [userId, id, finalStartTime, finalEndTime]
      );

      if (overlapCheck.rows.length > 0) {
        res.status(409).json({
          code: 'TIME_CONFLICT',
          message: 'Updated time slot overlaps with an existing active slot',
          details: { conflicting_slot_id: overlapCheck.rows[0].id }
        });
        return;
      }
    }

    const result = await pool.query(
      `UPDATE calendar_slots 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating slot:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update calendar slot'
    });
  }
});

router.get('/slots', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    const result = await pool.query(
      `SELECT 
        id,
        user_id,
        title,
        start_time,
        end_time,
        type,
        status,
        created_at,
        updated_at,
        to_char(start_time AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI:SS') as start_time_local,
        to_char(end_time AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI:SS') as end_time_local
       FROM calendar_slots 
       WHERE user_id = $1 AND status = 'active'
       ORDER BY start_time ASC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching slots:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch calendar slots'
    });
  }
});

router.get('/availability', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const { from, to } = req.query;

    if (!from || !to) {
      res.status(400).json({
        code: 'MISSING_PARAMETERS',
        message: 'Required query parameters: from, to'
      });
      return;
    }

    if (!isValidTimestamp(from as string) || !isValidTimestamp(to as string)) {
      res.status(400).json({
        code: 'INVALID_TIMESTAMP',
        message: 'from and to must be valid ISO 8601 timestamps'
      });
      return;
    }

    const fromDate = new Date(from as string);
    const toDate = new Date(to as string);

    if (fromDate >= toDate) {
      res.status(400).json({
        code: 'INVALID_TIME_RANGE',
        message: 'from must be before to'
      });
      return;
    }

    const busySlots = await pool.query(
      `SELECT start_time, end_time FROM calendar_slots 
       WHERE user_id = $1 
       AND status = 'active'
       AND (
         (start_time < $3 AND end_time > $2)
       )
       ORDER BY start_time ASC`,
      [userId, from, to]
    );

    const busy = busySlots.rows.map(slot => ({
      start: slot.start_time,
      end: slot.end_time
    }));

    const free: Array<{ start: Date; end: Date }> = [];
    let currentTime = fromDate;

    for (const busySlot of busy) {
      const busyStart = new Date(busySlot.start);
      const busyEnd = new Date(busySlot.end);

      if (currentTime < busyStart) {
        free.push({
          start: currentTime,
          end: busyStart
        });
      }

      currentTime = busyEnd > currentTime ? busyEnd : currentTime;
    }

    if (currentTime < toDate) {
      free.push({
        start: currentTime,
        end: toDate
      });
    }

    res.json({ busy, free });
  } catch (error) {
    console.error('Error calculating availability:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to calculate availability'
    });
  }
});

export default router;
