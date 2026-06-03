import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

async function bootstrap(): Promise<{ token: string; spaceId: string; mom: string; dad: string; girl: string }> {
  const r = await request(app)
    .post('/api/auth/register')
    .send({ email: 'rel@x.com', password: 'secret123', displayName: '主人' });
  const token = r.body.token as string;
  const sp = await request(app)
    .post('/api/spaces')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '张家', region: 'south' });
  const spaceId = sp.body.id as string;
  const mk = async (name: string, relation: string, description: string): Promise<string> => {
    const c = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ spaceId, name, relation, description });
    return c.body.id as string;
  };
  const dad = await mk('张爸爸', '爸爸', '幽默爱讲冷笑话');
  const mom = await mk('张妈妈', '妈妈', '温柔爱操心');
  const girl = await mk('张妞妞', '女儿', '阳光爱学习');
  return { token, spaceId, mom, dad, girl };
}

describe('V0.2 relations API', () => {
  let ctx: Awaited<ReturnType<typeof bootstrap>>;

  beforeEach(async () => {
    ctx = await bootstrap();
  });

  it('creates a directional relation with main + alt addresses', async () => {
    const res = await request(app)
      .post('/api/relations')
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        spaceId: ctx.spaceId,
        fromMemberId: ctx.mom,
        toMemberId: ctx.girl,
        relationType: 'parent_of',
        addressTerm: '宝贝',
        coAddressTerms: ['闺女', '妞妞'],
        intimacy: 0.9,
      });
    expect(res.status).toBe(201);
    expect(res.body.addressTerm).toBe('宝贝');
    expect(res.body.coAddressTerms).toEqual(['闺女', '妞妞']);
  });

  it('rejects relations across spaces', async () => {
    const r2 = await request(app)
      .post('/api/auth/register')
      .send({ email: 'b@x.com', password: 'secret123', displayName: 'B' });
    const sp2 = await request(app)
      .post('/api/spaces')
      .set('Authorization', `Bearer ${r2.body.token}`)
      .send({ name: '李家' });
    const m2 = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${r2.body.token}`)
      .send({ spaceId: sp2.body.id, name: '李叔', relation: '叔叔', description: 'x' });

    const res = await request(app)
      .post('/api/relations')
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        spaceId: ctx.spaceId,
        fromMemberId: ctx.mom,
        toMemberId: m2.body.id,
        relationType: 'sibling_of',
        addressTerm: '哥',
      });
    expect([400, 404]).toContain(res.status);
  });

  it('lists all relations and supports delete', async () => {
    await request(app)
      .post('/api/relations')
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        spaceId: ctx.spaceId,
        fromMemberId: ctx.mom,
        toMemberId: ctx.dad,
        relationType: 'spouse_of',
        addressTerm: '老张',
      });
    const list = await request(app)
      .get(`/api/relations/space/${ctx.spaceId}`)
      .set('Authorization', `Bearer ${ctx.token}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);
    const del = await request(app)
      .delete(`/api/relations/${list.body[0].id}`)
      .set('Authorization', `Bearer ${ctx.token}`);
    expect(del.status).toBe(200);
  });

  it('rejects self-loop', async () => {
    const res = await request(app)
      .post('/api/relations')
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({
        spaceId: ctx.spaceId,
        fromMemberId: ctx.mom,
        toMemberId: ctx.mom,
        relationType: 'spouse_of',
        addressTerm: '我',
      });
    expect(res.status).toBe(400);
  });
});

describe('V0.2 relation prompt block', () => {
  it('builds a hard-constraint block for a member', async () => {
    const { buildRelationPromptBlock } = await import('../src/services/relations');
    const members = [
      { id: 'a', name: '妈', relation: '妈妈' },
      { id: 'b', name: '女', relation: '女儿' },
    ];
    const relations = [
      {
        id: '1',
        fromMemberId: 'a',
        toMemberId: 'b',
        relationType: 'parent_of' as const,
        addressTerm: '宝贝',
        coAddressTerms: ['闺女'],
        intimacy: 0.9,
        status: 'active' as const,
        notes: null,
      },
      {
        id: '2',
        fromMemberId: 'b',
        toMemberId: 'a',
        relationType: 'child_of' as const,
        addressTerm: '妈',
        coAddressTerms: [],
        intimacy: 0.9,
        status: 'active' as const,
        notes: null,
      },
    ];
    const block = buildRelationPromptBlock('a', members, relations);
    expect(block).toContain('当对方是 女');
    expect(block).toContain('「宝贝」');
    expect(block).toContain('备选「闺女」');
    expect(block).toContain('反向关系');
    expect(block).toContain('女 会称呼你为「妈」');
  });
});
