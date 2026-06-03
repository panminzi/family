// Dinner-session service: starts/continues meal sessions and persists turns.
// V0.2 integrates relations, long-term memory, and trigger context into the
// dialogue prompt.

import { getAiService, PersonalityProfile } from './ai';
import { getPrisma } from '../utils/prisma';
import { buildRelationPromptBlock, loadRelationsForSpace } from './relations';
import { buildMemoryInjection, getRecentTurns, retrieveTopK } from './memory';
import { detectForSpace, logTriggerFire, TriggerHit } from './triggers';

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
  weather?: 'rain' | 'snow' | 'clear';
  now?: Date;
}

interface PromptBundle {
  systemPrompt: string;
  memoryBlock: string;
  sceneInjection: string;
  openingHook: string;
  props: string[];
  triggerInfo: { primary: TriggerHit | null; overlays: TriggerHit[] };
}

async function buildPromptBundle(spaceId: string, opts: StartDinnerOpts): Promise<PromptBundle> {
  const prisma = getPrisma();
  const detection = await detectForSpace(spaceId, opts.mealType, opts.now ?? new Date(), opts.weather ?? 'clear');
  const space = await prisma.familySpace.findUnique({
    where: { id: spaceId },
    include: { members: true },
  });
  if (!space) {
    return {
      systemPrompt: '',
      memoryBlock: '',
      sceneInjection: '',
      openingHook: '',
      props: [],
      triggerInfo: detection,
    };
  }

  const relations = await loadRelationsForSpace(spaceId);
  const speakingIds = space.members.map((m: any) => m.id);

  const occasion =
    detection.primary?.triggerId.startsWith('holiday_') ||
    detection.primary?.triggerId === 'family_birthday'
      ? detection.primary.triggerId
      : opts.mealType;

  const memEvents = await retrieveTopK(
    spaceId,
    { speakingMemberIds: speakingIds, occasion },
    3,
  );
  const memberById = new Map<string, string>(space.members.map((m: any) => [m.id, m.name]));
  const memoryBlock = buildMemoryInjection(memEvents, memberById);

  const relationsBlock =
    space.members.length > 0
      ? buildRelationPromptBlock(space.members[0].id, space.members, relations)
      : '';

  const sysParts: string[] = [];
  if (relationsBlock) sysParts.push(relationsBlock);
  sysParts.push('永远不要混淆家庭成员之间的关系或称谓。永远不要凭空捏造历史事件——只能引用【长期记忆】里出现过的内容。');

  let sceneInjection = '';
  let openingHook = '';
  let props: string[] = [];
  if (detection.primary) {
    sceneInjection = detection.primary.promptInjection;
    openingHook = detection.primary.openingHook;
    props = detection.primary.props;
  }
  for (const o of detection.overlays) {
    sceneInjection = sceneInjection ? `${sceneInjection}\n${o.promptInjection}` : o.promptInjection;
    props = props.concat(o.props);
  }

  return {
    systemPrompt: sysParts.join('\n\n'),
    memoryBlock,
    sceneInjection,
    openingHook,
    props,
    triggerInfo: detection,
  };
}

export async function startDinnerSession(opts: StartDinnerOpts): Promise<{
  sessionId: string;
  turns: Array<{ id: string; speaker: string; content: string; sequence: number }>;
  trigger?: { triggerId: string; sceneId: string } | null;
  overlays?: Array<{ triggerId: string; sceneId: string }>;
}> {
  const prisma = getPrisma();
  const space = await prisma.familySpace.findUnique({
    where: { id: opts.spaceId },
    include: { members: true },
  });
  if (!space) throw new Error('space_not_found');
  if (space.members.length === 0) throw new Error('no_members');

  const bundle = await buildPromptBundle(opts.spaceId, opts);

  const triggerInfoStr = JSON.stringify({
    primary: bundle.triggerInfo.primary
      ? { triggerId: bundle.triggerInfo.primary.triggerId, sceneId: bundle.triggerInfo.primary.sceneId }
      : null,
    overlays: bundle.triggerInfo.overlays.map((o) => ({ triggerId: o.triggerId, sceneId: o.sceneId })),
  });
  const session = await prisma.dinnerSession.create({
    data: { spaceId: opts.spaceId, mealType: opts.mealType, triggerInfo: triggerInfoStr },
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
    systemPrompt: bundle.systemPrompt || undefined,
    memoryBlock: bundle.memoryBlock || undefined,
    sceneInjection: bundle.sceneInjection || undefined,
    openingHook: bundle.openingHook || undefined,
    props: bundle.props.length ? bundle.props : undefined,
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

  if (bundle.triggerInfo.primary) {
    await logTriggerFire(opts.spaceId, bundle.triggerInfo.primary, opts.mealType);
  }
  for (const o of bundle.triggerInfo.overlays) {
    await logTriggerFire(opts.spaceId, o, opts.mealType);
  }

  return {
    sessionId: session.id,
    turns: created,
    trigger: bundle.triggerInfo.primary
      ? {
          triggerId: bundle.triggerInfo.primary.triggerId,
          sceneId: bundle.triggerInfo.primary.sceneId,
        }
      : null,
    overlays: bundle.triggerInfo.overlays.map((o) => ({
      triggerId: o.triggerId,
      sceneId: o.sceneId,
    })),
  };
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

  const recent = await getRecentTurns(session.spaceId, 10);
  const history = recent.map((m) => ({ speaker: m.speaker, content: m.content }));

  const speakingIds = session.space.members.map((m: any) => m.id);
  const memEvents = await retrieveTopK(session.spaceId, {
    speakingMemberIds: speakingIds,
    keywords: opts.content.split(/\s+/).filter(Boolean).slice(0, 5),
  });
  const memberById = new Map<string, string>(session.space.members.map((m: any) => [m.id, m.name]));
  const memoryBlock = buildMemoryInjection(memEvents, memberById);

  const relations = await loadRelationsForSpace(session.spaceId);
  const sysBlock =
    session.space.members.length > 0
      ? buildRelationPromptBlock(session.space.members[0].id, session.space.members, relations)
      : '';

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
    systemPrompt: sysBlock || undefined,
    memoryBlock: memoryBlock || undefined,
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
