import express from 'express';
import dotenv from 'dotenv';
import calendarRoutes from './routes/calendar';
import { authenticateToken } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/calendar', authenticateToken, calendarRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Calendar Manager API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
