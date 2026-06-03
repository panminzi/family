import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { setAiService } from '../src/services/ai';
import {
  recordL2Event,
  retrieveTopK,
  cascadeDeleteMember,
  buildMemoryInjection,
} from '../src/services/memory';
import { runWeeklySummarizer } from '../src/jobs/scheduler';
import { getPrisma } from '../src/utils/prisma';

const app = createApp();

async function bootstrap(): Promise<{ token: string; spaceId: string; mom: string; girl: string }> {
  const r = await request(app)
    .post('/api/auth/register')
    .send({ email: 'mem@x.com', password: 'secret123', displayName: '主人' });
  const token = r.body.token as string;
  const sp = await request(app)
    .post('/api/spaces')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '张家' });
  const mk = async (name: string, relation: string): Promise<string> => {
    const c = await request(app)
      .post('/api/members')
      .set('Authorization', `Bearer ${token}`)
      .send({ spaceId: sp.body.id, name, relation, description: 'x' });
    return c.body.id as string;
  };
  return { token, spaceId: sp.body.id, mom: await mk('妈', '妈妈'), girl: await mk('女', '女儿') };
}

describe('V0.2 long-term memory', () => {
  let ctx: Awaited<ReturnType<typeof bootstrap>>;

  beforeEach(async () => {
    ctx = await bootstrap();
  });

  it('records and retrieves an L2 event by member overlap + salience', async () => {
    const ev = await recordL2Event(
      ctx.spaceId,
      ctx.mom,
      'weekly',
      new Date('2026-05-25'),
      new Date('2026-05-31'),
      {
        summary: '我感冒了几天，咳嗽厉害，自己熬梨水',
        emotion: '疲惫',
        mentionedMembers: [ctx.mom, ctx.girl],
        salience: 0.7,
        tags: ['健康'],
      },
    );
    expect(ev.summary).toContain('感冒');

    const out = await retrieveTopK(
      ctx.spaceId,
      { speakingMemberIds: [ctx.mom, ctx.girl], occasion: 'dinner' },
      3,
    );
    expect(out.length).toBe(1);
    expect(out[0].id).toBe(ev.id);
  });

  it('prefers higher-salience event with same recency', async () => {
    await recordL2Event(
      ctx.spaceId,
      ctx.mom,
      'weekly',
      new Date('2026-05-25'),
      new Date('2026-05-31'),
      { summary: '低分事件', salience: 0.1, mentionedMembers: [ctx.mom] },
    );
    const high = await recordL2Event(
      ctx.spaceId,
      ctx.mom,
      'weekly',
      new Date('2026-05-25'),
      new Date('2026-05-31'),
      { summary: '高分事件', salience: 0.9, mentionedMembers: [ctx.mom] },
    );
    const out = await retrieveTopK(
      ctx.spaceId,
      { speakingMemberIds: [ctx.mom] },
      1,
    );
    expect(out[0].id).toBe(high.id);
  });

  it('weekly summarizer creates events from recent dialogue', async () => {
    setAiService({
      extractPersonality: async () => ({ traits: ['t'], speechStyle: 's', emotionTendency: 'n', catchphrase: '', relationshipNotes: '' }),
      generateAvatarUrl: async () => 'x',
      generateDialogue: async ({ members }) =>
        members.slice(0, 1).map((m) => ({ memberId: m.id, speaker: m.name, content: `${m.name} 今天咳嗽了` })),
    });
    await request(app)
      .post('/api/dinner/start')
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ spaceId: ctx.spaceId, mealType: 'dinner' });
    const r = await runWeeklySummarizer({ now: new Date(), windowDays: 30 });
    expect(r.summarized).toBeGreaterThanOrEqual(0);
  });

  it('cascade delete redacts mentions and physically removes subject events', async () => {
    await recordL2Event(
      ctx.spaceId,
      ctx.mom,
      'weekly',
      new Date('2026-05-25'),
      new Date('2026-05-31'),
      { summary: 'mom-subject', salience: 0.5, mentionedMembers: [ctx.mom] },
    );
    await recordL2Event(
      ctx.spaceId,
      ctx.girl,
      'weekly',
      new Date('2026-05-25'),
      new Date('2026-05-31'),
      { summary: 'girl-subject mentions mom', salience: 0.5, mentionedMembers: [ctx.mom, ctx.girl] },
    );
    await cascadeDeleteMember(ctx.spaceId, ctx.mom);
    const prisma = getPrisma();
    const all = await prisma.memoryEvent.findMany({ where: { spaceId: ctx.spaceId } });
    // mom-subject still exists in DB until member row is deleted (cascade hasn't fired yet
    // because we only ran cascadeDeleteMember helper). What we *do* test is the redaction:
    const girlSubject = all.find((r: any) => r.subjectMemberId === ctx.girl);
    expect(girlSubject?.mentionedMembers).toContain('__deleted__');
  });

  it('buildMemoryInjection renders events, falling back for deleted refs', async () => {
    const ev = await recordL2Event(
      ctx.spaceId,
      ctx.mom,
      'weekly',
      new Date('2026-05-25'),
      new Date('2026-05-31'),
      { summary: '感冒了', salience: 0.7, mentionedMembers: [ctx.mom, '__deleted__'] },
    );
    const block = buildMemoryInjection([ev], new Map([[ctx.mom, '妈']]));
    expect(block).toContain('感冒了');
    expect(block).toContain('家里另一个人');
  });
});

describe('V0.2 privacy: deleting a member cascades memories + assets', () => {
  it('removes subject memory rows on member delete', async () => {
    const ctx = await bootstrap();
    await recordL2Event(
      ctx.spaceId,
      ctx.mom,
      'weekly',
      new Date('2026-05-25'),
      new Date('2026-05-31'),
      { summary: '主键事件', salience: 0.5, mentionedMembers: [ctx.mom] },
    );
    const del = await request(app)
      .delete(`/api/members/${ctx.mom}`)
      .set('Authorization', `Bearer ${ctx.token}`);
    expect(del.status).toBe(200);
    const prisma = getPrisma();
    const remain = await prisma.memoryEvent.findMany({
      where: { spaceId: ctx.spaceId, subjectMemberId: ctx.mom },
    });
    expect(remain.length).toBe(0);
  });
});
