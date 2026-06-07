import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';

const JWT_SECRET = process.env.JWT_SECRET || 'milestone-super-secret-key-2024';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'member';
  realName?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : null;

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: '未提供认证令牌' 
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const result = await query(
      'SELECT id, username, email, role, real_name FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: '用户不存在或已被禁用' 
      });
    }

    const user = result.rows[0];
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      realName: user.real_name,
    };

    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: '认证令牌无效或已过期' 
    });
  }
};

export const requireRole = (roles: Array<'admin' | 'manager' | 'member'>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: '请先登录' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: '权限不足，无法执行此操作' 
      });
    }

    next();
  };
};

export const requireAdmin = requireRole(['admin']);
export const requireManager = requireRole(['admin', 'manager']);

export const checkProjectPermission = async (
  req: Request,
  projectId: string,
  allowedRoles: Array<'admin' | 'manager' | 'member'> = ['admin', 'manager', 'member']
): Promise<boolean> => {
  if (!req.user) return false;
  
  if (req.user.role === 'admin') return true;
  
  if (req.user.role === 'manager') {
    const result = await query(
      'SELECT id FROM projects WHERE id = $1 AND project_manager_id = $2',
      [projectId, req.user.id]
    );
    if (result.rows.length > 0) return true;
  }
  
  const memberResult = await query(
    'SELECT id FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, req.user.id]
  );
  
  return memberResult.rows.length > 0 && allowedRoles.includes(req.user.role);
};
