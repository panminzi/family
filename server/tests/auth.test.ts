import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

describe('auth routes', () => {
  it('registers a new user and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@x.com', password: 'secret123', displayName: '小明' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user.email).toBe('a@x.com');
  });

  it('rejects duplicate emails', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'b@x.com', password: 'secret123', displayName: '小红' });
    const dup = await request(app)
      .post('/api/auth/register')
      .send({ email: 'b@x.com', password: 'another', displayName: '小红2' });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('email_taken');
  });

  it('logs in with correct password', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'c@x.com', password: 'secret123', displayName: '小绿' });
    const ok = await request(app)
      .post('/api/auth/login')
      .send({ email: 'c@x.com', password: 'secret123' });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTypeOf('string');
  });

  it('rejects wrong password', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'd@x.com', password: 'secret123', displayName: 'D' });
    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: 'd@x.com', password: 'wrong' });
    expect(bad.status).toBe(401);
  });

  it('returns 401 on /me without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the user on /me with valid token', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'e@x.com', password: 'secret123', displayName: 'E' });
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('e@x.com');
  });

  it('rejects invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'secret123', displayName: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_failed');
  });
});
