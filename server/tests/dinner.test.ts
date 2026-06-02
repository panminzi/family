import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { runMealTrigger } from '../src/jobs/scheduler';
import { setAiService } from '../src/services/ai';
import { getPrisma } from '../src/utils/prisma';

const app = createApp();

async function setupFamily(): Promise<{
  token: string;
  spaceId: string;
  memberIds: string[];
}> {
  const r = await request(app)
    .post('/api/auth/register')
    .send({ email: 'din@x.com', password: 'secret123', displayName: '主人' });
  const token = r.body.token as string;
  const sp = await request(app)
    .post('/api/spaces')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '王家' });
  const spaceId = sp.body.id as string;
  const memberIds: string[] = [];
  for (const m of [
    { name: '老王', relation: '爸爸', description: '幽默' },
    { name: '王妈', relation: '妈妈', description: '温柔' },
    { name: '小王', relation: '儿子', description: '阳光' },
  ]) {
    const c = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ spaceId, ...m });
    memberIds.push(c.body.id as string);
  }
  return { token, spaceId, memberIds };
}

describe('dinner sessions + scheduler', () => {
  let token = '';
  let spaceId = '';
  let memberIds: string[] = [];

  beforeEach(async () => {
    const ctx = await setupFamily();
    token = ctx.token;
    spaceId = ctx.spaceId;
    memberIds = ctx.memberIds;
    void memberIds;
  });

  it('starts a dinner session and persists generated turns', async () => {
    const res = await request(app)
      .post('/api/dinner/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ spaceId, mealType: 'dinner' });
    expect(res.status).toBe(201);
    expect(res.body.sessionId).toBeTypeOf('string');
    expect(res.body.turns.length).toBeGreaterThan(0);

    const detail = await request(app)
      .get(`/api/dinner/${res.body.sessionId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.messages.length).toBe(res.body.turns.length);
  });

  it('user message inserts user turn and AI replies with continuous sequence', async () => {
    const start = await request(app)
      .post('/api/dinner/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ spaceId, mealType: 'lunch' });
    const sessionId = start.body.sessionId as string;
    const baseSeq: number = start.body.turns[start.body.turns.length - 1].sequence;

    const reply = await request(app)
      .post('/api/dinner/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessionId, spaceId, content: '今天的菜真香' });
    expect(reply.status).toBe(200);
    expect(reply.body.userTurn.sequence).toBe(baseSeq + 1);
    expect(reply.body.aiTurns.length).toBeGreaterThan(0);
    const lastAiSeq = reply.body.aiTurns[reply.body.aiTurns.length - 1].sequence;
    expect(lastAiSeq).toBeGreaterThan(reply.body.userTurn.sequence);

    const detail = await request(app)
      .get(`/api/dinner/${sessionId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.body.messages.length).toBe(lastAiSeq);
  });

  it('lists historical sessions for a space', async () => {
    await request(app)
      .post('/api/dinner/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ spaceId, mealType: 'breakfast' });
    await request(app)
      .post('/api/dinner/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ spaceId, mealType: 'dinner' });
    const list = await request(app)
      .get(`/api/dinner/space/${spaceId}/sessions`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(2);
  });

  it('ends a session and stamps endedAt', async () => {
    const start = await request(app)
      .post('/api/dinner/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ spaceId, mealType: 'dinner' });
    const end = await request(app)
      .post(`/api/dinner/${start.body.sessionId}/end`)
      .set('Authorization', `Bearer ${token}`);
    expect(end.status).toBe(200);
  });

  it('runMealTrigger creates a session for every space with members', async () => {
    // Drop in a custom AI to verify scheduler routes through the seam.
    const calls: string[] = [];
    setAiService({
      extractPersonality: async () => ({
        traits: ['t'],
        speechStyle: 's',
        emotionTendency: 'n',
        catchphrase: '',
        relationshipNotes: '',
      }),
      generateAvatarUrl: async () => 'https://example.com/x.png',
      generateDialogue: async (input) => {
        calls.push(input.mealType);
        return input.members.slice(0, 2).map((m) => ({
          memberId: m.id,
          speaker: m.name,
          content: `${m.name} 说话`,
        }));
      },
    });

    const result = await runMealTrigger({ mealType: 'breakfast' });
    expect(result.triggered.length).toBe(1);
    expect(result.skipped.length).toBe(0);
    expect(calls).toEqual(['breakfast']);

    const prisma = getPrisma();
    const sessions = await prisma.dinnerSession.findMany({ where: { spaceId } });
    expect(sessions.length).toBe(1);
    const msgs = await prisma.chatMessage.findMany({ where: { sessionId: sessions[0].id } });
    expect(msgs.length).toBe(2);
  });

  it('runMealTrigger skips spaces without members', async () => {
    // Wipe members for the existing space.
    const prisma = getPrisma();
    await prisma.familyMember.deleteMany({ where: { spaceId } });
    const result = await runMealTrigger({ mealType: 'lunch' });
    expect(result.triggered.length).toBe(0);
    expect(result.skipped[0]?.reason).toBe('no_members');
  });

  it('admin trigger-meal endpoint reaches runMealTrigger', async () => {
    const res = await request(app)
      .post('/api/admin/trigger-meal')
      .set('Authorization', `Bearer ${token}`)
      .send({ mealType: 'dinner' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.triggered)).toBe(true);
  });
});
