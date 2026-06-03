import { Router } from 'express';
import { z } from 'zod';
import { AuthedRequest, HttpError, requireAuth } from '../middleware/auth';
import { getPrisma } from '../utils/prisma';

const router = Router();
router.use(requireAuth);

async function assertOwnsSpace(userId: string, spaceId: string): Promise<void> {
  const prisma = getPrisma();
  const sp = await prisma.familySpace.findUnique({ where: { id: spaceId } });
  if (!sp || sp.ownerId !== userId) throw new HttpError(404, 'space_not_found');
}

const createSchema = z.object({
  spaceId: z.string().min(1),
  kind: z.enum(['birthday', 'anniversary']),
  memberId: z.string().min(1).optional(),
  // 公历: "MM-DD" or "YYYY-MM-DD"; 农历: "L-MM-DD"
  dateRule: z
    .string()
    .regex(/^(L-)?(\d{4}-)?\d{1,2}-\d{1,2}$/, 'invalid_date_rule'),
  title: z.string().min(1).max(60),
  notes: z.string().max(500).optional(),
});

router.get('/space/:spaceId', async (req: AuthedRequest, res, next) => {
  try {
    await assertOwnsSpace(req.userId!, req.params.spaceId);
    const prisma = getPrisma();
    const list = await prisma.familyEvent.findMany({
      where: { spaceId: req.params.spaceId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req: AuthedRequest, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    await assertOwnsSpace(req.userId!, body.spaceId);
    const prisma = getPrisma();
    if (body.memberId) {
      const m = await prisma.familyMember.findUnique({ where: { id: body.memberId } });
      if (!m || m.spaceId !== body.spaceId) throw new HttpError(404, 'member_not_found');
    }
    const ev = await prisma.familyEvent.create({
      data: {
        spaceId: body.spaceId,
        kind: body.kind,
        memberId: body.memberId ?? null,
        dateRule: body.dateRule,
        title: body.title,
        notes: body.notes ?? null,
      },
    });
    res.status(201).json(ev);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req: AuthedRequest, res, next) => {
  try {
    const prisma = getPrisma();
    const ev = await prisma.familyEvent.findUnique({
      where: { id: req.params.id },
      include: { space: true },
    });
    if (!ev || ev.space.ownerId !== req.userId) throw new HttpError(404, 'event_not_found');
    await prisma.familyEvent.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
