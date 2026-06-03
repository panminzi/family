import { Router } from 'express';
import { z } from 'zod';
import { AuthedRequest, HttpError, requireAuth } from '../middleware/auth';
import { getPrisma } from '../utils/prisma';
import { getAiService, PersonalityProfile } from '../services/ai';

const router = Router();
router.use(requireAuth);

async function loadOwnedMember(userId: string, memberId: string): Promise<any> {
  const prisma = getPrisma();
  const m = await prisma.familyMember.findUnique({
    where: { id: memberId },
    include: { space: true, assets: true },
  });
  if (!m || m.space.ownerId !== userId) throw new HttpError(404, 'member_not_found');
  return m;
}

function parsePersonality(s: string | null): PersonalityProfile | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as PersonalityProfile;
  } catch {
    return null;
  }
}

const generateSchema = z.object({
  assetType: z.string().min(1).max(40),
  emotion: z.string().max(20).optional(),
  size: z.string().max(20).optional(),
});

router.post('/member/:id/generate', async (req: AuthedRequest, res, next) => {
  try {
    const member = await loadOwnedMember(req.userId!, req.params.id);
    const body = generateSchema.parse(req.body ?? {});
    const personality = parsePersonality(member.personality);
    if (!personality) throw new HttpError(400, 'personality_required');

    const prisma = getPrisma();
    let seed = member.seed as number | null;
    if (seed === null) {
      seed = Math.floor(Math.random() * 1_000_000_000);
      await prisma.familyMember.update({ where: { id: member.id }, data: { seed } });
    }

    const referenceAvatar = member.assets.find((a: any) => a.assetType === 'avatar');

    const ai = getAiService();
    let result;
    if (typeof ai.generateAsset === 'function') {
      result = await ai.generateAsset({
        name: member.name,
        relation: member.relation,
        personality,
        assetType: body.assetType,
        emotion: body.emotion,
        referenceImageUrl: referenceAvatar?.imageUrl ?? null,
        seed,
        size: body.size,
      });
    } else {
      const url = await ai.generateAvatarUrl({
        name: member.name,
        relation: member.relation,
        personality,
      });
      result = {
        imageUrl: url,
        isPlaceholder: url.startsWith('https://placehold.co/'),
        prompt: 'legacy:generateAvatarUrl',
        service: 'legacy',
      };
    }

    const upserted = await prisma.generatedAsset.upsert({
      where: { memberId_assetType: { memberId: member.id, assetType: body.assetType } },
      update: {
        imageUrl: result.imageUrl,
        isPlaceholder: result.isPlaceholder,
        prompt: result.prompt,
        seed,
        service: result.service,
        cost: result.cost ?? null,
      },
      create: {
        memberId: member.id,
        assetType: body.assetType,
        imageUrl: result.imageUrl,
        isPlaceholder: result.isPlaceholder,
        prompt: result.prompt,
        seed,
        service: result.service,
        cost: result.cost ?? null,
      },
    });

    if (body.assetType === 'avatar') {
      await prisma.familyMember.update({
        where: { id: member.id },
        data: { avatarUrl: result.imageUrl },
      });
    }

    res.status(201).json(upserted);
  } catch (e) {
    next(e);
  }
});

router.get('/member/:id', async (req: AuthedRequest, res, next) => {
  try {
    const m = await loadOwnedMember(req.userId!, req.params.id);
    res.json(m.assets);
  } catch (e) {
    next(e);
  }
});

router.delete('/:assetId', async (req: AuthedRequest, res, next) => {
  try {
    const prisma = getPrisma();
    const a = await prisma.generatedAsset.findUnique({
      where: { id: req.params.assetId },
      include: { member: { include: { space: true } } },
    });
    if (!a || a.member.space.ownerId !== req.userId) throw new HttpError(404, 'asset_not_found');
    await prisma.generatedAsset.delete({ where: { id: req.params.assetId } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
