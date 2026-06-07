import { Router, Request, Response } from 'express';
import { query } from '../config/database';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    const dbResult = await query('SELECT 1 as health_check');
    const dbLatency = Date.now() - startTime;

    res.status(200).json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: {
          status: dbResult.rows.length > 0 ? 'healthy' : 'unhealthy',
          latency: `${dbLatency}ms`,
        },
        api: {
          status: 'healthy',
        },
      },
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      services: {
        database: {
          status: 'unhealthy',
        },
        api: {
          status: 'healthy',
        },
      },
    });
  }
});

router.get('/ping', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'pong',
    timestamp: new Date().toISOString(),
  });
});

export default router;
