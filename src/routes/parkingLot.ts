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

async function canEditParkingLotItem(userId: string, itemId: string): Promise<boolean> {
  // Owner can edit; org admins/owners can edit org-scoped items
  const r = await pool.query(
    `SELECT pl.owner_id, pl.org_id
     FROM parking_lot pl
     WHERE pl.id = $1 AND pl.deleted_at IS NULL`,
    [itemId]
  );
  if (r.rows.length === 0) return false;

  const { owner_id, org_id } = r.rows[0];
  if (owner_id === userId) return true;

  if (org_id) {
    const m = await pool.query(
      `SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2`,
      [org_id, userId]
    );
    if (m.rows.length > 0 && (m.rows[0].role === 'owner' || m.rows[0].role === 'admin')) return true;
  }

  return false;
}

// Create parking lot item
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const ownerId = req.userId as string;
    const { item, description, context, priority, proposed_cycle, status, org_id } = req.body || {};

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

    // If org_id is provided, ensure user is a member of that org
    if (org_id !== undefined && org_id !== null) {
      if (!isValidUUID(org_id)) {
        res.status(400).json({
          code: 'INVALID_ORG_ID',
          message: 'Invalid org_id format'
        });
        return;
      }

      const member = await pool.query(
        `SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2`,
        [org_id, ownerId]
      );
      if (member.rows.length === 0) {
        res.status(403).json({
          code: 'FORBIDDEN',
          message: 'You must be a member of the organization to add org parking lot items'
        });
        return;
      }
    }

    const result = await pool.query(
      `INSERT INTO parking_lot (owner_id, org_id, item, description, context, priority, proposed_cycle, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        ownerId,
        org_id || null,
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
    const ownerId = req.userId as string;
    const { status, priority } = req.query;

    let query = `SELECT * FROM parking_lot 
                 WHERE deleted_at IS NULL AND (
                   owner_id = $1
                   OR org_id IN (SELECT org_id FROM org_members WHERE user_id = $1)
                 )`;
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
    const ownerId = req.userId as string;
    const { id } = req.params;

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid parking lot item ID format'
      });
      return;
    }

    const result = await pool.query(
      `SELECT * FROM parking_lot 
       WHERE id = $1
         AND deleted_at IS NULL
         AND (
           owner_id = $2
           OR org_id IN (SELECT org_id FROM org_members WHERE user_id = $2)
         )`,
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
    const ownerId = req.userId as string;
    const { id } = req.params;
    const { item, description, context, priority, proposed_cycle, status, org_id } = req.body || {};

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid parking lot item ID format'
      });
      return;
    }

    // Permission check: owner or org admin/owner
    const canEdit = await canEditParkingLotItem(ownerId, id);
    if (!canEdit) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You do not have permission to modify this parking lot item'
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

    if (org_id !== undefined) {
      if (org_id !== null && !isValidUUID(org_id)) {
        res.status(400).json({
          code: 'INVALID_ORG_ID',
          message: 'Invalid org_id format'
        });
        return;
      }
      updates.push(`org_id = $${pc++}`);
      values.push(org_id);
    }

    if (updates.length === 0) {
      res.status(400).json({
        code: 'NO_UPDATES',
        message: 'No valid fields provided for update'
      });
      return;
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE parking_lot
       SET ${updates.join(', ')}
       WHERE id = $${pc++} AND deleted_at IS NULL
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

// Soft delete parking lot item
router.delete('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { id } = req.params;

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid parking lot item ID format'
      });
      return;
    }

    const canEdit = await canEditParkingLotItem(userId, id);
    if (!canEdit) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You do not have permission to delete this parking lot item'
      });
      return;
    }

    const result = await pool.query(
      `UPDATE parking_lot
       SET deleted_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        code: 'ITEM_NOT_FOUND',
        message: 'Parking lot item not found'
      });
      return;
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting parking lot item:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to delete parking lot item'
    });
  }
});

export default router;
