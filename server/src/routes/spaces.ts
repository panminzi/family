import { Router } from 'express';
import { z } from 'zod';
import { AuthedRequest, HttpError, requireAuth } from '../middleware/auth';
import { getPrisma } from '../utils/prisma';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(40),
  locale: z.string().max(20).optional(),
  region: z.enum(['north', 'south']).optional(),
});
const updateSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  locale: z.string().max(20).optional(),
  region: z.enum(['north', 'south']).optional(),
});

router.use(requireAuth);

router.get('/', async (req: AuthedRequest, res, next) => {
  try {
    const prisma = getPrisma();
    const spaces = await prisma.familySpace.findMany({
      where: { ownerId: req.userId! },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { members: true } } },
    });
    res.json(spaces);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req: AuthedRequest, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const prisma = getPrisma();
    const space = await prisma.familySpace.create({
      data: {
        name: body.name,
        ownerId: req.userId!,
        ...(body.locale ? { locale: body.locale } : {}),
        ...(body.region ? { region: body.region } : {}),
      },
    });
    res.status(201).json(space);
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req: AuthedRequest, res, next) => {
  try {
    const prisma = getPrisma();
    const space = await prisma.familySpace.findUnique({
      where: { id: req.params.id },
      include: { members: true },
    });
    if (!space || space.ownerId !== req.userId) throw new HttpError(404, 'not_found');
    res.json(space);
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req: AuthedRequest, res, next) => {
  try {
    const body = updateSchema.parse(req.body);
    const prisma = getPrisma();
    const existing = await prisma.familySpace.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.ownerId !== req.userId) throw new HttpError(404, 'not_found');
    const updated = await prisma.familySpace.update({
      where: { id: req.params.id },
      data: body,
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req: AuthedRequest, res, next) => {
  try {
    const prisma = getPrisma();
    const existing = await prisma.familySpace.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.ownerId !== req.userId) throw new HttpError(404, 'not_found');
    await prisma.familySpace.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
