// Dinner-session service: starts/continues meal sessions and persists turns.
// Encapsulated here so both the HTTP router and the cron scheduler share logic.

import { getAiService, PersonalityProfile } from './ai';
import { getPrisma } from '../utils/prisma';

export type MealType = 'breakfast' | 'lunch' | 'dinner';

export function parsePersonality(s: string | null | undefined): PersonalityProfile | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as PersonalityProfile;
  } catch {
    return null;
  }
}

export interface StartDinnerOpts {
  spaceId: string;
  mealType: MealType;
  rounds?: number;
}

export async function startDinnerSession(opts: StartDinnerOpts): Promise<{
  sessionId: string;
  turns: Array<{ id: string; speaker: string; content: string; sequence: number }>;
}> {
  const prisma = getPrisma();
  const space = await prisma.familySpace.findUnique({
    where: { id: opts.spaceId },
    include: { members: true },
  });
  if (!space) throw new Error('space_not_found');
  if (space.members.length === 0) throw new Error('no_members');

  const session = await prisma.dinnerSession.create({
    data: { spaceId: opts.spaceId, mealType: opts.mealType },
  });

  const ai = getAiService();
  const turns = await ai.generateDialogue({
    mealType: opts.mealType,
    members: space.members.map((m: any) => ({
      id: m.id,
      name: m.name,
      relation: m.relation,
      personality: parsePersonality(m.personality),
    })),
    history: [],
    rounds: opts.rounds ?? 6,
  });

  const created: Array<{ id: string; speaker: string; content: string; sequence: number }> = [];
  let seq = 0;
  for (const t of turns) {
    seq += 1;
    const cm = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        memberId: t.memberId,
        role: 'member',
        speaker: t.speaker,
        content: t.content,
        sequence: seq,
      },
    });
    created.push({ id: cm.id, speaker: cm.speaker, content: cm.content, sequence: cm.sequence });
  }
  return { sessionId: session.id, turns: created };
}

export interface UserMessageOpts {
  sessionId: string;
  spaceId: string;
  userDisplayName: string;
  content: string;
  replyRounds?: number;
}

export async function sendUserMessage(opts: UserMessageOpts): Promise<{
  userTurn: { id: string; sequence: number };
  aiTurns: Array<{ id: string; speaker: string; content: string; sequence: number }>;
}> {
  const prisma = getPrisma();
  const session = await prisma.dinnerSession.findUnique({
    where: { id: opts.sessionId },
    include: { space: { include: { members: true } }, messages: true },
  });
  if (!session || session.spaceId !== opts.spaceId) throw new Error('session_not_found');

  const last = session.messages.reduce((a: number, m: any) => (m.sequence > a ? m.sequence : a), 0);
  const userMsg = await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      memberId: null,
      role: 'user',
      speaker: opts.userDisplayName,
      content: opts.content,
      sequence: last + 1,
    },
  });

  const history = session.messages
    .sort((a: any, b: any) => a.sequence - b.sequence)
    .map((m: any) => ({ speaker: m.speaker, content: m.content }));

  const ai = getAiService();
  const replies = await ai.generateDialogue({
    mealType: session.mealType as MealType,
    members: session.space.members.map((m: any) => ({
      id: m.id,
      name: m.name,
      relation: m.relation,
      personality: parsePersonality(m.personality),
    })),
    history,
    userTurn: { content: opts.content },
    rounds: opts.replyRounds ?? 2,
  });

  const aiTurns: Array<{ id: string; speaker: string; content: string; sequence: number }> = [];
  let seq = userMsg.sequence;
  for (const t of replies) {
    seq += 1;
    const cm = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        memberId: t.memberId,
        role: 'member',
        speaker: t.speaker,
        content: t.content,
        sequence: seq,
      },
    });
    aiTurns.push({ id: cm.id, speaker: cm.speaker, content: cm.content, sequence: cm.sequence });
  }

  return {
    userTurn: { id: userMsg.id, sequence: userMsg.sequence },
    aiTurns,
  };
}

export async function endSession(sessionId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.dinnerSession.update({
    where: { id: sessionId },
    data: { endedAt: new Date() },
  });
}
