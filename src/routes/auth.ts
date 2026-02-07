import { Router, Request, Response } from 'express';
import pool from '../db/pool';

const router = Router();

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, timezone } = req.body;

    if (!name) {
      res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'Required field: name'
      });
      return;
    }

    const userResult = await pool.query(
      `INSERT INTO users (name, timezone)
       VALUES ($1, $2)
       RETURNING id, name, timezone, created_at`,
      [name, timezone || 'UTC']
    );

    const user = userResult.rows[0];

    const tokenResult = await pool.query(
      `INSERT INTO agent_tokens (user_id, role)
       VALUES ($1, 'owner')
       RETURNING token, role, created_at`,
      [user.id]
    );

    const token = tokenResult.rows[0];

    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        timezone: user.timezone,
        created_at: user.created_at
      },
      token: token.token,
      role: token.role
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to register user'
    });
  }
});

router.post('/token', async (req: Request, res: Response): Promise<void> => {
  try {
    const { user_id, role } = req.body;

    if (!user_id) {
      res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'Required field: user_id'
      });
      return;
    }

    const userCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [user_id]
    );

    if (userCheck.rows.length === 0) {
      res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      });
      return;
    }

    const validRoles = ['owner', 'agent', 'manager'];
    const tokenRole = role && validRoles.includes(role) ? role : 'agent';

    const tokenResult = await pool.query(
      `INSERT INTO agent_tokens (user_id, role)
       VALUES ($1, $2)
       RETURNING token, role, created_at`,
      [user_id, tokenRole]
    );

    res.status(201).json(tokenResult.rows[0]);
  } catch (error) {
    console.error('Error creating token:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to create token'
    });
  }
});

export default router;
