import jwt from 'jsonwebtoken';
import { loadConfig } from '../config';

const cfg = loadConfig();

export interface JwtPayload {
  sub: string; // user id
  email: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, cfg.jwtSecret, { expiresIn: cfg.jwtExpiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, cfg.jwtSecret) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}
