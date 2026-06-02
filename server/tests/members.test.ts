import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { setAiService } from '../src/services/ai';

const app = createApp();

async function bootstrap(): Promise<{ token: string; spaceId: string }> {
  const r = await request(app)
    .post('/api/auth/register')
    .send({ email: 'm@x.com', password: 'secret123', displayName: 'M' });
  const token = r.body.token as string;
  const sp = await request(app)
    .post('/api/spaces')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '王家' });
  return { token, spaceId: sp.body.id as string };
}

describe('family members + AI', () => {
  let token = '';
  let spaceId = '';

  beforeEach(async () => {
    const ctx = await bootstrap();
    token = ctx.token;
    spaceId = ctx.spaceId;
  });

  it('creates and lists members', async () => {
    const c = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ spaceId, name: '老王', relation: '爸爸', description: '幽默爱开玩笑' });
    expect(c.status).toBe(201);
    const list = await request(app)
      .get(`/api/members/space/${spaceId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].name).toBe('老王');
  });

  it('rejects creating members in someone else’s space', async () => {
    const other = await request(app)
      .post('/api/auth/register')
      .send({ email: 'o@x.com', password: 'secret123', displayName: 'O' });
    const otherToken = other.body.token as string;
    const c = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ spaceId, name: 'X', relation: '父', description: 'desc' });
    expect(c.status).toBe(404);
  });

  it('generates personality via AI service (default stub)', async () => {
    const m = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ spaceId, name: '王妈', relation: '妈妈', description: '温柔耐心' });
    const res = await request(app)
      .post(`/api/members/${m.body.id}/personality`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.personality).toBeTruthy();
    expect(res.body.personality.traits).toContain('温柔');
  });

  it('generates avatar after personality', async () => {
    const m = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ spaceId, name: '小王', relation: '儿子', description: '阳光乐观' });
    await request(app)
      .post(`/api/members/${m.body.id}/personality`)
      .set('Authorization', `Bearer ${token}`);
    const av = await request(app)
      .post(`/api/members/${m.body.id}/avatar`)
      .set('Authorization', `Bearer ${token}`);
    expect(av.status).toBe(200);
    expect(av.body.avatarUrl).toMatch(/^https?:\/\//);
  });

  it('avatar requires personality first', async () => {
    const m = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ spaceId, name: 'NoBio', relation: '伯', description: 'x' });
    const av = await request(app)
      .post(`/api/members/${m.body.id}/avatar`)
      .set('Authorization', `Bearer ${token}`);
    expect(av.status).toBe(400);
  });

  it('uses injected AI service when set (verifies extraction call shape)', async () => {
    const extract = vi.fn(async () => ({
      traits: ['假',  '注入'],
      speechStyle: '正式',
      emotionTendency: '中性',
      catchphrase: '注入测试',
      relationshipNotes: '',
    }));
    const avatarFn = vi.fn(async () => 'https://example.com/avatar.png');
    setAiService({
      extractPersonality: extract,
      generateAvatarUrl: avatarFn,
      generateDialogue: async () => [],
    });

    const m = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ spaceId, name: 'Inj', relation: '叔', description: 'desc' });
    await request(app)
      .post(`/api/members/${m.body.id}/personality`)
      .set('Authorization', `Bearer ${token}`);

    expect(extract).toHaveBeenCalledOnce();
    const arg = extract.mock.calls[0][0];
    expect(arg.name).toBe('Inj');
    expect(arg.relation).toBe('叔');
  });

  it('deletes a member and cascades materials', async () => {
    const m = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ spaceId, name: 'D', relation: '叔', description: 'desc' });
    await request(app)
      .post(`/api/members/${m.body.id}/materials/text`)
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'text', textBody: '一段描述' });
    const del = await request(app)
      .delete(`/api/members/${m.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
    const get = await request(app)
      .get(`/api/members/${m.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(404);
  });

  it('uploads a text material', async () => {
    const m = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ spaceId, name: 'T', relation: '叔', description: 'desc' });
    const up = await request(app)
      .post(`/api/members/${m.body.id}/materials/text`)
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'dialogue', textBody: '今天饭真香' });
    expect(up.status).toBe(201);
    expect(up.body.kind).toBe('dialogue');
  });
});
