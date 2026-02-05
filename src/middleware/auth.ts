import { Response, NextFunction } from 'express';
import pool from '../db/pool';
import { AuthenticatedRequest } from '../types';

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        code: 'MISSING_TOKEN',
        message: 'Authorization header with Bearer token is required'
      });
      return;
    }

    const token = authHeader.substring(7);

    const result = await pool.query(
      'SELECT user_id, role FROM agent_tokens WHERE token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      });
      return;
    }

    req.userId = result.rows[0].user_id;
    req.userRole = result.rows[0].role;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      code: 'AUTH_ERROR',
      message: 'Internal authentication error'
    });
  }
}
