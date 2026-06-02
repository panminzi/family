import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';
import { AuthedRequest, HttpError, requireAuth } from '../middleware/auth';
import { getPrisma } from '../utils/prisma';
import { getAiService, PersonalityProfile } from '../services/ai';
import { loadConfig } from '../config';

const router = Router();
const cfg = loadConfig();

// Per-space upload directory.
fs.mkdirSync(cfg.uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, cfg.uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, safe);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const createSchema = z.object({
  spaceId: z.string().min(1),
  name: z.string().min(1).max(40),
  relation: z.string().min(1).max(20),
  description: z.string().min(1).max(2000),
});

const updateSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  relation: z.string().min(1).max(20).optional(),
  description: z.string().min(1).max(2000).optional(),
});

router.use(requireAuth);

async function assertOwnsSpace(userId: string, spaceId: string): Promise<void> {
  const prisma = getPrisma();
  const sp = await prisma.familySpace.findUnique({ where: { id: spaceId } });
  if (!sp || sp.ownerId !== userId) throw new HttpError(404, 'space_not_found');
}

async function loadOwnedMember(userId: string, memberId: string): Promise<any> {
  const prisma = getPrisma();
  const m = await prisma.familyMember.findUnique({
    where: { id: memberId },
    include: { space: true, materials: true },
  });
  if (!m || m.space.ownerId !== userId) throw new HttpError(404, 'member_not_found');
  return m;
}

router.get('/space/:spaceId', async (req: AuthedRequest, res, next) => {
  try {
    await assertOwnsSpace(req.userId!, req.params.spaceId);
    const prisma = getPrisma();
    const list = await prisma.familyMember.findMany({
      where: { spaceId: req.params.spaceId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(list.map(serializeMember));
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req: AuthedRequest, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    await assertOwnsSpace(req.userId!, body.spaceId);
    const prisma = getPrisma();
    const m = await prisma.familyMember.create({
      data: {
        spaceId: body.spaceId,
        name: body.name,
        relation: body.relation,
        description: body.description,
      },
    });
    res.status(201).json(serializeMember(m));
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req: AuthedRequest, res, next) => {
  try {
    const m = await loadOwnedMember(req.userId!, req.params.id);
    res.json(serializeMember(m));
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req: AuthedRequest, res, next) => {
  try {
    await loadOwnedMember(req.userId!, req.params.id);
    const body = updateSchema.parse(req.body);
    const prisma = getPrisma();
    const updated = await prisma.familyMember.update({
      where: { id: req.params.id },
      data: body,
    });
    res.json(serializeMember(updated));
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req: AuthedRequest, res, next) => {
  try {
    await loadOwnedMember(req.userId!, req.params.id);
    const prisma = getPrisma();
    await prisma.familyMember.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ----- materials (uploads) -----

router.post('/:id/materials/photo', upload.single('file'), async (req: AuthedRequest, res, next) => {
  try {
    await loadOwnedMember(req.userId!, req.params.id);
    if (!req.file) throw new HttpError(400, 'file_required');
    const prisma = getPrisma();
    const mat = await prisma.material.create({
      data: { memberId: req.params.id, kind: 'photo', filePath: req.file.filename },
    });
    res.status(201).json(mat);
  } catch (e) {
    next(e);
  }
});

const textSchema = z.object({
  kind: z.enum(['text', 'dialogue']),
  textBody: z.string().min(1).max(20000),
});

router.post('/:id/materials/text', async (req: AuthedRequest, res, next) => {
  try {
    await loadOwnedMember(req.userId!, req.params.id);
    const body = textSchema.parse(req.body);
    const prisma = getPrisma();
    const mat = await prisma.material.create({
      data: { memberId: req.params.id, kind: body.kind, textBody: body.textBody },
    });
    res.status(201).json(mat);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id/materials/:materialId', async (req: AuthedRequest, res, next) => {
  try {
    await loadOwnedMember(req.userId!, req.params.id);
    const prisma = getPrisma();
    const mat = await prisma.material.findUnique({ where: { id: req.params.materialId } });
    if (!mat || mat.memberId !== req.params.id) throw new HttpError(404, 'material_not_found');
    if (mat.filePath) {
      const p = path.join(cfg.uploadsDir, mat.filePath);
      try {
        fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
    await prisma.material.delete({ where: { id: req.params.materialId } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ----- AI: personality + avatar -----

router.post('/:id/personality', async (req: AuthedRequest, res, next) => {
  try {
    const m = await loadOwnedMember(req.userId!, req.params.id);
    const extraTexts: string[] = m.materials
      .filter((mat: any) => mat.kind !== 'photo' && mat.textBody)
      .map((mat: any) => mat.textBody as string);
    const ai = getAiService();
    const profile = await ai.extractPersonality({
      name: m.name,
      relation: m.relation,
      description: m.description,
      extraTexts,
    });
    const prisma = getPrisma();
    const updated = await prisma.familyMember.update({
      where: { id: req.params.id },
      data: { personality: JSON.stringify(profile) },
    });
    res.json(serializeMember(updated));
  } catch (e) {
    next(e);
  }
});

router.post('/:id/avatar', async (req: AuthedRequest, res, next) => {
  try {
    const m = await loadOwnedMember(req.userId!, req.params.id);
    const personality = parsePersonality(m.personality);
    if (!personality) throw new HttpError(400, 'personality_required');
    const ai = getAiService();
    const url = await ai.generateAvatarUrl({
      name: m.name,
      relation: m.relation,
      personality,
    });
    const prisma = getPrisma();
    const updated = await prisma.familyMember.update({
      where: { id: req.params.id },
      data: { avatarUrl: url },
    });
    res.json(serializeMember(updated));
  } catch (e) {
    next(e);
  }
});

function parsePersonality(s: string | null): PersonalityProfile | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as PersonalityProfile;
  } catch {
    return null;
  }
}

function serializeMember(m: any): any {
  return {
    ...m,
    personality: parsePersonality(m.personality ?? null),
  };
}

export default router;
