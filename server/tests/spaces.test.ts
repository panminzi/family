import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

async function registerUser(email: string): Promise<string> {
  const r = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'secret123', displayName: 'Tester' });
  return r.body.token as string;
}

describe('family spaces', () => {
  let token = '';

  beforeEach(async () => {
    token = await registerUser('owner@x.com');
  });

  it('creates and lists family spaces', async () => {
    const created = await request(app)
      .post('/api/spaces')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '王家' });
    expect(created.status).toBe(201);
    expect(created.body.id).toBeTypeOf('string');

    const list = await request(app)
      .get('/api/spaces')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].name).toBe('王家');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/spaces').send({ name: 'X' });
    expect(res.status).toBe(401);
  });

  it('isolates spaces per owner', async () => {
    const tokenA = token;
    const tokenB = await registerUser('other@x.com');
    await request(app)
      .post('/api/spaces')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'A家' });
    await request(app)
      .post('/api/spaces')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'B家' });
    const aList = await request(app)
      .get('/api/spaces')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(aList.body).toHaveLength(1);
    expect(aList.body[0].name).toBe('A家');
  });

  it('updates and deletes a space', async () => {
    const created = await request(app)
      .post('/api/spaces')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X' });
    const id = created.body.id as string;
    const upd = await request(app)
      .put(`/api/spaces/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Y' });
    expect(upd.status).toBe(200);
    expect(upd.body.name).toBe('Y');
    const del = await request(app)
      .delete(`/api/spaces/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
    const list = await request(app)
      .get('/api/spaces')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body).toHaveLength(0);
  });

  it('returns 404 for someone else’s space', async () => {
    const created = await request(app)
      .post('/api/spaces')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X' });
    const tokenB = await registerUser('other2@x.com');
    const get = await request(app)
      .get(`/api/spaces/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(get.status).toBe(404);
  });
});
