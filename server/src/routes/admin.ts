import { Router } from 'express';
import { z } from 'zod';
import { AuthedRequest, requireAuth } from '../middleware/auth';
import { runMealTrigger } from '../jobs/scheduler';

const router = Router();
router.use(requireAuth);

const schema = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner']),
});

// Manual meal trigger — useful for debugging / demos.
// Authentication required so anyone with a valid token can fire it for their own
// runs; the scheduler internals still scope each session to the proper space.
router.post('/trigger-meal', async (req: AuthedRequest, res, next) => {
  try {
    const body = schema.parse(req.body);
    const result = await runMealTrigger({ mealType: body.mealType });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default router;
