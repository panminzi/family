import { Router } from 'express';
import { z } from 'zod';
import { AuthedRequest, HttpError, requireAuth } from '../middleware/auth';
import { getPrisma } from '../utils/prisma';
import { RELATION_TYPES } from '../services/relations';

const router = Router();
router.use(requireAuth);

async function assertOwnsSpace(userId: string, spaceId: string): Promise<void> {
  const prisma = getPrisma();
  const sp = await prisma.familySpace.findUnique({ where: { id: spaceId } });
  if (!sp || sp.ownerId !== userId) throw new HttpError(404, 'space_not_found');
}

async function assertSpaceOwnsMembers(spaceId: string, ids: string[]): Promise<void> {
  const prisma = getPrisma();
  const list = await prisma.familyMember.findMany({
    where: { id: { in: ids } },
    select: { id: true, spaceId: true },
  });
  if (list.length !== ids.length) throw new HttpError(404, 'member_not_found');
  for (const m of list) if (m.spaceId !== spaceId) throw new HttpError(404, 'member_not_found');
}

const createSchema = z.object({
  spaceId: z.string().min(1),
  fromMemberId: z.string().min(1),
  toMemberId: z.string().min(1),
  relationType: z.enum(RELATION_TYPES as [string, ...string[]]),
  addressTerm: z.string().min(1).max(20),
  coAddressTerms: z.array(z.string().min(1).max(20)).max(8).optional(),
  intimacy: z.number().min(0).max(1).optional(),
  status: z.enum(['active', 'deceased', 'estranged']).optional(),
  notes: z.string().max(500).optional(),
});

const updateSchema = createSchema.partial().extend({
  spaceId: z.string().min(1),
});

router.get('/space/:spaceId', async (req: AuthedRequest, res, next) => {
  try {
    await assertOwnsSpace(req.userId!, req.params.spaceId);
    const prisma = getPrisma();
    const list = await prisma.relation.findMany({
      where: { spaceId: req.params.spaceId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(list.map(serializeRelation));
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req: AuthedRequest, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    await assertOwnsSpace(req.userId!, body.spaceId);
    if (body.fromMemberId === body.toMemberId) throw new HttpError(400, 'self_loop_not_allowed');
    await assertSpaceOwnsMembers(body.spaceId, [body.fromMemberId, body.toMemberId]);
    const prisma = getPrisma();
    const rel = await prisma.relation.create({
      data: {
        spaceId: body.spaceId,
        fromMemberId: body.fromMemberId,
        toMemberId: body.toMemberId,
        relationType: body.relationType,
        addressTerm: body.addressTerm,
        coAddressTerms: body.coAddressTerms ? JSON.stringify(body.coAddressTerms) : null,
        intimacy: body.intimacy ?? 0.7,
        status: body.status ?? 'active',
        notes: body.notes ?? null,
      },
    });
    res.status(201).json(serializeRelation(rel));
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req: AuthedRequest, res, next) => {
  try {
    const body = updateSchema.parse(req.body);
    await assertOwnsSpace(req.userId!, body.spaceId);
    const prisma = getPrisma();
    const existing = await prisma.relation.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.spaceId !== body.spaceId) throw new HttpError(404, 'relation_not_found');
    const data: any = {};
    if (body.relationType !== undefined) data.relationType = body.relationType;
    if (body.addressTerm !== undefined) data.addressTerm = body.addressTerm;
    if (body.coAddressTerms !== undefined) data.coAddressTerms = JSON.stringify(body.coAddressTerms);
    if (body.intimacy !== undefined) data.intimacy = body.intimacy;
    if (body.status !== undefined) data.status = body.status;
    if (body.notes !== undefined) data.notes = body.notes;
    const updated = await prisma.relation.update({ where: { id: req.params.id }, data });
    res.json(serializeRelation(updated));
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req: AuthedRequest, res, next) => {
  try {
    const prisma = getPrisma();
    const existing = await prisma.relation.findUnique({
      where: { id: req.params.id },
      include: { space: true },
    });
    if (!existing || existing.space.ownerId !== req.userId) throw new HttpError(404, 'relation_not_found');
    await prisma.relation.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

function serializeRelation(r: any): any {
  let co: string[] = [];
  if (r.coAddressTerms) {
    try {
      const parsed = JSON.parse(r.coAddressTerms);
      if (Array.isArray(parsed)) co = parsed.filter((x: any) => typeof x === 'string');
    } catch {
      /* ignore */
    }
  }
  return { ...r, coAddressTerms: co };
}

export default router;
