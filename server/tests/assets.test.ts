import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { setAiService } from '../src/services/ai';

const app = createApp();

async function bootstrap(): Promise<{ token: string; spaceId: string; memberId: string }> {
  const r = await request(app)
    .post('/api/auth/register')
    .send({ email: 'asset@x.com', password: 'secret123', displayName: '主人' });
  const token = r.body.token as string;
  const sp = await request(app)
    .post('/api/spaces')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '王家' });
  const m = await request(app)
    .post('/api/members')
    .set('Authorization', `Bearer ${token}`)
    .send({ spaceId: sp.body.id, name: '老王', relation: '爸爸', description: '幽默' });
  // generate personality so avatar/asset can run.
  await request(app)
    .post(`/api/members/${m.body.id}/personality`)
    .set('Authorization', `Bearer ${token}`)
    .send({});
  return { token, spaceId: sp.body.id, memberId: m.body.id };
}

describe('V0.2 generated assets', () => {
  let ctx: Awaited<ReturnType<typeof bootstrap>>;

  beforeEach(async () => {
    ctx = await bootstrap();
  });

  it('generates an avatar via stub and persists it', async () => {
    const res = await request(app)
      .post(`/api/assets/member/${ctx.memberId}/generate`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ assetType: 'avatar' });
    expect(res.status).toBe(201);
    expect(res.body.assetType).toBe('avatar');
    expect(res.body.imageUrl).toContain('placehold.co');

    const list = await request(app)
      .get(`/api/assets/member/${ctx.memberId}`)
      .set('Authorization', `Bearer ${ctx.token}`);
    expect(list.body.length).toBe(1);
  });

  it('upserts the same assetType on regeneration', async () => {
    await request(app)
      .post(`/api/assets/member/${ctx.memberId}/generate`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ assetType: 'avatar' });
    await request(app)
      .post(`/api/assets/member/${ctx.memberId}/generate`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ assetType: 'avatar' });
    const list = await request(app)
      .get(`/api/assets/member/${ctx.memberId}`)
      .set('Authorization', `Bearer ${ctx.token}`);
    expect(list.body.filter((a: any) => a.assetType === 'avatar').length).toBe(1);
  });

  it('passes reference image to generateAsset on emoji generation after avatar', async () => {
    let captured: any = null;
    setAiService({
      extractPersonality: async () => ({ traits: ['t'], speechStyle: 's', emotionTendency: 'n', catchphrase: '', relationshipNotes: '' }),
      generateAvatarUrl: async () => 'https://placehold.co/x',
      generateDialogue: async () => [],
      generateAsset: async (input) => {
        captured = input;
        return { imageUrl: '/uploads/x.png', isPlaceholder: false, prompt: 'p', service: 'mock' };
      },
    });
    await request(app)
      .post(`/api/assets/member/${ctx.memberId}/generate`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ assetType: 'avatar' });
    captured = null;
    await request(app)
      .post(`/api/assets/member/${ctx.memberId}/generate`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ assetType: 'emoji_happy' });
    expect(captured.assetType).toBe('emoji_happy');
    expect(captured.referenceImageUrl).toBe('/uploads/x.png');
    expect(captured.seed).toBeTypeOf('number');
  });

  it('falls back to placeholder when service throws', async () => {
    setAiService({
      extractPersonality: async () => ({ traits: ['t'], speechStyle: 's', emotionTendency: 'n', catchphrase: '', relationshipNotes: '' }),
      generateAvatarUrl: async () => 'https://placehold.co/x',
      generateDialogue: async () => [],
      generateAsset: async () => {
        throw new Error('upstream_500');
      },
    });
    const res = await request(app)
      .post(`/api/assets/member/${ctx.memberId}/generate`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ assetType: 'avatar' });
    expect(res.status).toBe(500);
  });

  it('rejects generation before personality is extracted', async () => {
    const sp = await request(app)
      .post('/api/spaces')
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ name: '李家' });
    const m = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ spaceId: sp.body.id, name: '李大', relation: '叔叔', description: 'x' });
    const res = await request(app)
      .post(`/api/assets/member/${m.body.id}/generate`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ assetType: 'avatar' });
    expect(res.status).toBe(400);
  });
});
