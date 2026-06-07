import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { validate } from '../utils/validation';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'milestone-super-secret-key-2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

const loginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = validate(loginSchema, req.body);

    const result = await query(
      'SELECT id, username, email, password_hash, role, real_name, is_active FROM users WHERE username = $1 OR email = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, '用户名或密码错误', 'INVALID_CREDENTIALS', 401);
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return errorResponse(res, '账户已被禁用', 'ACCOUNT_DISABLED', 401);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return errorResponse(res, '用户名或密码错误', 'INVALID_CREDENTIALS', 401);
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return successResponse(res, {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        realName: user.real_name,
      },
    }, '登录成功');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, '参数验证失败', error.errors[0].message, 400);
    }
    return errorResponse(res, '登录失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  return successResponse(res, null, '登出成功');
});

router.get('/profile', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT id, username, email, role, real_name, phone, department, created_at FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      return errorResponse(res, '用户不存在', 'NOT_FOUND', 404);
    }

    return successResponse(res, result.rows[0], '获取用户信息成功');
  } catch (error) {
    return errorResponse(res, '获取用户信息失败', error instanceof Error ? error.message : 'UNKNOWN_ERROR', 500);
  }
});

export default router;
