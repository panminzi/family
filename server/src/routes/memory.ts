import { Router } from 'express';
import { z } from 'zod';
import { AuthedRequest, HttpError, requireAuth } from '../middleware/auth';
import { getPrisma } from '../utils/prisma';
import { retrieveTopK, summarizeWindow } from '../services/memory';

const router = Router();
router.use(requireAuth);

async function assertOwnsSpace(userId: string, spaceId: string): Promise<void> {
  const prisma = getPrisma();
  const sp = await prisma.familySpace.findUnique({ where: { id: spaceId } });
  if (!sp || sp.ownerId !== userId) throw new HttpError(404, 'space_not_found');
}

router.get('/space/:spaceId', async (req: AuthedRequest, res, next) => {
  try {
    await assertOwnsSpace(req.userId!, req.params.spaceId);
    const prisma = getPrisma();
    const list = await prisma.memoryEvent.findMany({
      where: { spaceId: req.params.spaceId },
      orderBy: { periodEnd: 'desc' },
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

const summarizeSchema = z.object({
  spaceId: z.string().min(1),
  subjectMemberId: z.string().min(1),
  scope: z.enum(['weekly', 'monthly']).optional(),
  // Optional explicit window; defaults to last 7 days for weekly.
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
});

router.post('/summarize', async (req: AuthedRequest, res, next) => {
  try {
    const body = summarizeSchema.parse(req.body);
    await assertOwnsSpace(req.userId!, body.spaceId);
    const prisma = getPrisma();
    const m = await prisma.familyMember.findUnique({ where: { id: body.subjectMemberId } });
    if (!m || m.spaceId !== body.spaceId) throw new HttpError(404, 'member_not_found');
    const scope = body.scope ?? 'weekly';
    const end = body.periodEnd ? new Date(body.periodEnd) : new Date();
    const start = body.periodStart
      ? new Date(body.periodStart)
      : new Date(end.getTime() - (scope === 'weekly' ? 7 : 30) * 24 * 3600 * 1000);
    const out = await summarizeWindow({
      spaceId: body.spaceId,
      subjectMemberId: body.subjectMemberId,
      scope,
      periodStart: start,
      periodEnd: end,
    });
    res.json({ events: out });
  } catch (e) {
    next(e);
  }
});

const retrieveSchema = z.object({
  spaceId: z.string().min(1),
  speakingMemberIds: z.array(z.string().min(1)).min(1),
  occasion: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  k: z.number().int().min(1).max(10).optional(),
});

router.post('/retrieve', async (req: AuthedRequest, res, next) => {
  try {
    const body = retrieveSchema.parse(req.body);
    await assertOwnsSpace(req.userId!, body.spaceId);
    const out = await retrieveTopK(
      body.spaceId,
      {
        speakingMemberIds: body.speakingMemberIds,
        occasion: body.occasion,
        keywords: body.keywords,
      },
      body.k ?? 3,
    );
    res.json({ events: out });
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req: AuthedRequest, res, next) => {
  try {
    const prisma = getPrisma();
    const ev = await prisma.memoryEvent.findUnique({
      where: { id: req.params.id },
      include: { subjectMember: { include: { space: true } } },
    });
    if (!ev || ev.subjectMember.space.ownerId !== req.userId)
      throw new HttpError(404, 'memory_not_found');
    await prisma.memoryEvent.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
