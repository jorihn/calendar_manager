import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userRole?: string;
}

export interface CalendarSlot {
  id: string;
  user_id: string;
  title: string;
  start_time: Date;
  end_time: Date;
  type: 'work' | 'meeting' | 'focus' | 'personal';
  status: 'active' | 'cancelled';
  created_at: Date;
  updated_at: Date;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}
