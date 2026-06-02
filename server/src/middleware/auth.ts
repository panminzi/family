import { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../utils/jwt';

export interface AuthedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const auth = req.header('authorization') ?? req.header('Authorization');
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const token = auth.slice(7).trim();
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'invalid_token' });
    return;
  }
  req.userId = payload.sub;
  req.userEmail = payload.email;
  next();
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const e = err as { status?: number; message?: string; issues?: unknown; name?: string };
  // Map Zod validation errors to 400.
  if (e?.name === 'ZodError' || Array.isArray((e as { issues?: unknown }).issues)) {
    res.status(400).json({ error: 'validation_failed', issues: (e as { issues?: unknown }).issues });
    return;
  }
  const status = e.status ?? 500;
  res.status(status).json({
    error: e.message ?? 'internal_error',
    ...(e.issues ? { issues: e.issues } : {}),
  });
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
