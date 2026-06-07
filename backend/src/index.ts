import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';

import { query } from './config/database';
import authRoutes from './routes/auth';
import healthRoutes from './routes/health';
import projectRoutes from './routes/projects';
import milestoneRoutes from './routes/milestones';
import riskRoutes from './routes/risks';
import meetingRoutes from './routes/meetings';
import acceptanceRoutes from './routes/acceptance';
import dashboardRoutes from './routes/dashboard';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/milestones', milestoneRoutes);
app.use('/api/risks', riskRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/acceptance', acceptanceRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    code: 'NOT_FOUND'
  });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    code: 'INTERNAL_ERROR',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const startServer = async () => {
  try {
    await query('SELECT NOW()');
    console.log('✓ Database connection established');
    
    app.listen(PORT, () => {
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`✓ Health check: http://localhost:${PORT}/api/health`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('✗ Failed to connect to database:', error);
    process.exit(1);
  }
};

startServer();
