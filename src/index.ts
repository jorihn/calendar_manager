import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import calendarRoutes from './routes/calendar';
import authRoutes from './routes/auth';
import objectivesRoutes from './routes/objectives';
import keyResultsRoutes from './routes/keyResults';
import tasksRoutes from './routes/tasks';
import { authenticateToken } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/server-info', (req, res) => {
  const networkInterfaces = os.networkInterfaces();
  let ip = 'localhost';
  
  for (const name of Object.keys(networkInterfaces)) {
    const nets = networkInterfaces[name];
    if (nets) {
      for (const net of nets) {
        if (net.family === 'IPv4' && !net.internal) {
          ip = net.address;
          break;
        }
      }
    }
  }
  
  res.json({ ip, port: PORT });
});

app.get('/api/docs', (req, res) => {
  const docPath = path.join(__dirname, '../API_DOCUMENTATION.md');
  try {
    const content = fs.readFileSync(docPath, 'utf-8');
    res.type('text/markdown').send(content);
  } catch (error) {
    res.status(404).json({ code: 'DOC_NOT_FOUND', message: 'API documentation not found' });
  }
});

app.use('/auth', authRoutes);
app.use('/calendar', authenticateToken, calendarRoutes);
app.use('/objectives', authenticateToken, objectivesRoutes);
app.use('/key-results', authenticateToken, keyResultsRoutes);
app.use('/tasks', authenticateToken, tasksRoutes);

app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Calendar Manager API running on port ${PORT}`);
  console.log(`Server listening on 0.0.0.0:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
