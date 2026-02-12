import { Router, Response } from 'express';
import crypto from 'crypto';
import pool from '../db/pool';
import { AuthenticatedRequest } from '../types';

const router = Router();

const generateInviteCode = (): string => {
  return crypto.randomBytes(6).toString('base64url').slice(0, 8);
};

const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

const isValidOrgRole = (role: string): boolean => {
  return ['owner', 'admin', 'member'].includes(role);
};

// Create organization
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;
    const userId = req.userId;

    if (!name) {
      res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'Required fields: name'
      });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orgResult = await client.query(
        `INSERT INTO organizations (name, description, created_by)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name, description || null, userId]
      );

      const org = orgResult.rows[0];

      await client.query(
        `INSERT INTO org_members (org_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [org.id, userId]
      );

      await client.query('COMMIT');

      res.status(201).json(org);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create organization'
    });
  }
});

// Join organization by invite code (must be before /:id routes)
router.post('/join', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { code } = req.body;
    const userId = req.userId;

    if (!code) {
      res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'Required fields: code'
      });
      return;
    }

    const org = await pool.query(
      'SELECT id, name FROM organizations WHERE invite_code = $1',
      [code]
    );

    if (org.rows.length === 0) {
      res.status(404).json({
        code: 'INVALID_INVITE_CODE',
        message: 'Invalid or expired invite code'
      });
      return;
    }

    const orgId = org.rows[0].id;

    const result = await pool.query(
      `INSERT INTO org_members (org_id, user_id, role)
       VALUES ($1, $2, 'member')
       RETURNING *`,
      [orgId, userId]
    );

    res.status(201).json({
      message: 'Joined organization',
      org_id: orgId,
      org_name: org.rows[0].name,
      role: 'member',
      membership: result.rows[0]
    });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({
        code: 'MEMBER_EXISTS',
        message: 'You are already a member of this organization'
      });
      return;
    }
    console.error('Error joining organization:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to join organization'
    });
  }
});

// List organizations for current user
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    const result = await pool.query(
      `SELECT o.*, om.role as my_role
       FROM organizations o
       INNER JOIN org_members om ON o.id = om.org_id
       WHERE om.user_id = $1
       ORDER BY o.created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch organizations'
    });
  }
});

// Get organization by ID
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid organization ID format'
      });
      return;
    }

    const memberCheck = await pool.query(
      'SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (memberCheck.rows.length === 0) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You are not a member of this organization'
      });
      return;
    }

    const result = await pool.query(
      'SELECT * FROM organizations WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        code: 'ORG_NOT_FOUND',
        message: 'Organization not found'
      });
      return;
    }

    const org = result.rows[0];
    org.my_role = memberCheck.rows[0].role;

    res.json(org);
  } catch (error) {
    console.error('Error fetching organization:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch organization'
    });
  }
});

// Update organization
router.patch('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const userId = req.userId;

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid organization ID format'
      });
      return;
    }

    const memberCheck = await pool.query(
      'SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (memberCheck.rows.length === 0 || !['owner', 'admin'].includes(memberCheck.rows[0].role)) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Only owner or admin can update the organization'
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

    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
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
      `UPDATE organizations
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating organization:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to update organization'
    });
  }
});

// List members of an organization
router.get('/:id/members', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid organization ID format'
      });
      return;
    }

    const memberCheck = await pool.query(
      'SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (memberCheck.rows.length === 0) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You are not a member of this organization'
      });
      return;
    }

    const result = await pool.query(
      `SELECT om.id, om.role, om.created_at, u.id as user_id, u.name as user_name
       FROM org_members om
       INNER JOIN users u ON om.user_id = u.id
       WHERE om.org_id = $1
       ORDER BY om.created_at ASC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch organization members'
    });
  }
});

// Add member to organization
router.post('/:id/members', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { user_id, role } = req.body;
    const userId = req.userId;

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid organization ID format'
      });
      return;
    }

    if (!user_id || !role) {
      res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'Required fields: user_id, role'
      });
      return;
    }

    if (!isValidUUID(user_id)) {
      res.status(400).json({
        code: 'INVALID_USER_ID',
        message: 'Invalid user_id format'
      });
      return;
    }

    if (!isValidOrgRole(role)) {
      res.status(400).json({
        code: 'INVALID_ROLE',
        message: 'role must be one of: owner, admin, member'
      });
      return;
    }

    const memberCheck = await pool.query(
      'SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (memberCheck.rows.length === 0 || !['owner', 'admin'].includes(memberCheck.rows[0].role)) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Only owner or admin can add members'
      });
      return;
    }

    const result = await pool.query(
      `INSERT INTO org_members (org_id, user_id, role)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, user_id, role]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({
        code: 'MEMBER_EXISTS',
        message: 'User is already a member of this organization'
      });
      return;
    }
    if (error.code === '23503') {
      res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      });
      return;
    }
    console.error('Error adding member:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to add member'
    });
  }
});

// Generate invite code for organization
router.post('/:id/invite', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    if (!isValidUUID(id)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid organization ID format'
      });
      return;
    }

    const memberCheck = await pool.query(
      'SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (memberCheck.rows.length === 0 || !['owner', 'admin'].includes(memberCheck.rows[0].role)) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Only owner or admin can generate invite codes'
      });
      return;
    }

    const code = generateInviteCode();

    const result = await pool.query(
      `UPDATE organizations SET invite_code = $1 WHERE id = $2 RETURNING id, name, invite_code`,
      [code, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        code: 'ORG_NOT_FOUND',
        message: 'Organization not found'
      });
      return;
    }

    res.json({
      message: 'Invite code generated',
      invite_code: result.rows[0].invite_code,
      org_name: result.rows[0].name
    });
  } catch (error) {
    console.error('Error generating invite code:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to generate invite code'
    });
  }
});

// Remove member from organization
router.delete('/:id/members/:memberId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id, memberId } = req.params;
    const userId = req.userId;

    if (!isValidUUID(id) || !isValidUUID(memberId)) {
      res.status(400).json({
        code: 'INVALID_ID',
        message: 'Invalid ID format'
      });
      return;
    }

    const memberCheck = await pool.query(
      'SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2',
      [id, userId]
    );

    if (memberCheck.rows.length === 0 || !['owner', 'admin'].includes(memberCheck.rows[0].role)) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Only owner or admin can remove members'
      });
      return;
    }

    const targetMember = await pool.query(
      'SELECT * FROM org_members WHERE id = $1 AND org_id = $2',
      [memberId, id]
    );

    if (targetMember.rows.length === 0) {
      res.status(404).json({
        code: 'MEMBER_NOT_FOUND',
        message: 'Member not found'
      });
      return;
    }

    if (targetMember.rows[0].role === 'owner') {
      res.status(403).json({
        code: 'CANNOT_REMOVE_OWNER',
        message: 'Cannot remove the owner from the organization'
      });
      return;
    }

    await pool.query(
      'DELETE FROM org_members WHERE id = $1',
      [memberId]
    );

    res.json({ message: 'Member removed' });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to remove member'
    });
  }
});

export default router;
