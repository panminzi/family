import { Router } from 'express';
import { z } from 'zod';
import { AuthedRequest, HttpError, requireAuth } from '../middleware/auth';
import { getPrisma } from '../utils/prisma';
import { endSession, sendUserMessage, startDinnerSession } from '../services/dinner';

const router = Router();

router.use(requireAuth);

async function assertOwnsSpace(userId: string, spaceId: string): Promise<any> {
  const prisma = getPrisma();
  const sp = await prisma.familySpace.findUnique({ where: { id: spaceId } });
  if (!sp || sp.ownerId !== userId) throw new HttpError(404, 'space_not_found');
  return sp;
}

async function assertOwnsSession(userId: string, sessionId: string): Promise<any> {
  const prisma = getPrisma();
  const s = await prisma.dinnerSession.findUnique({
    where: { id: sessionId },
    include: { space: true },
  });
  if (!s || s.space.ownerId !== userId) throw new HttpError(404, 'session_not_found');
  return s;
}

const startSchema = z.object({
  spaceId: z.string().min(1),
  mealType: z.enum(['breakfast', 'lunch', 'dinner']),
});

router.post('/start', async (req: AuthedRequest, res, next) => {
  try {
    const body = startSchema.parse(req.body);
    await assertOwnsSpace(req.userId!, body.spaceId);
    const result = await startDinnerSession({
      spaceId: body.spaceId,
      mealType: body.mealType,
    });
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
});

const messageSchema = z.object({
  sessionId: z.string().min(1),
  spaceId: z.string().min(1),
  content: z.string().min(1).max(500),
});

router.post('/message', async (req: AuthedRequest, res, next) => {
  try {
    const body = messageSchema.parse(req.body);
    await assertOwnsSpace(req.userId!, body.spaceId);
    const session = await assertOwnsSession(req.userId!, body.sessionId);
    const prisma = getPrisma();
    const me = await prisma.user.findUnique({ where: { id: req.userId! } });
    const result = await sendUserMessage({
      sessionId: session.id,
      spaceId: body.spaceId,
      userDisplayName: me?.displayName ?? '我',
      content: body.content,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.post('/:sessionId/end', async (req: AuthedRequest, res, next) => {
  try {
    const session = await assertOwnsSession(req.userId!, req.params.sessionId);
    await endSession(session.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.get('/space/:spaceId/sessions', async (req: AuthedRequest, res, next) => {
  try {
    await assertOwnsSpace(req.userId!, req.params.spaceId);
    const prisma = getPrisma();
    const list = await prisma.dinnerSession.findMany({
      where: { spaceId: req.params.spaceId },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

router.get('/:sessionId', async (req: AuthedRequest, res, next) => {
  try {
    const session = await assertOwnsSession(req.userId!, req.params.sessionId);
    const prisma = getPrisma();
    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { sequence: 'asc' },
    });
    res.json({ session, messages });
  } catch (e) {
    next(e);
  }
});

export default router;
