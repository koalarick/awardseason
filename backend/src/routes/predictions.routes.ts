import { Router, Response } from 'express';
import { PredictionService } from '../services/prediction.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();
const predictionService = new PredictionService();

// Create or update prediction
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { poolId, categoryId, nomineeId } = req.body;
    const userId = req.user!.id;

    if (!poolId || !categoryId || !nomineeId) {
      res.status(400).json({ error: 'Pool ID, category ID, and nominee ID are required' });
      return;
    }

    const prediction = await predictionService.createOrUpdatePrediction(
      userId,
      poolId,
      categoryId,
      nomineeId,
    );

    res.json(prediction);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get user's predictions for a pool
router.get('/pool/:poolId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { poolId } = req.params;
    const userId = req.user!.id;

    const predictions = await predictionService.getUserPredictions(userId, poolId);
    res.json(predictions);
  } catch (error: any) {
    res.status(403).json({ error: error.message });
  }
});

// Get all predictions for a pool (for leaderboard/display)
router.get('/pool/:poolId/all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { poolId } = req.params;
    const userId = req.user!.id;

    const predictions = await predictionService.getAllPoolPredictions(poolId, userId);
    res.json(predictions);
  } catch (error: any) {
    res.status(403).json({ error: error.message });
  }
});

// Delete a prediction
router.delete('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { poolId, categoryId } = req.body;
    const userId = req.user!.id;

    if (!poolId || !categoryId) {
      res.status(400).json({ error: 'Pool ID and category ID are required' });
      return;
    }

    await predictionService.deletePrediction(userId, poolId, categoryId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete all predictions for a user in a pool
router.delete('/all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { poolId } = req.body;
    const userId = req.user!.id;

    if (!poolId) {
      res.status(400).json({ error: 'Pool ID is required' });
      return;
    }

    await predictionService.deleteAllPredictions(userId, poolId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update odds for an existing prediction if current odds are better
router.patch('/upgrade-odds', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { poolId, categoryId } = req.body;
    const userId = req.user!.id;

    if (!poolId || !categoryId) {
      res.status(400).json({ error: 'Pool ID and category ID are required' });
      return;
    }

    const result = await predictionService.updateOddsIfBetter(userId, poolId, categoryId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get user's completed submissions from other pools
router.get('/other-pools/:poolId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { poolId } = req.params;
    const userId = req.user!.id;

    const submissions = await predictionService.getUserOtherPoolSubmissions(userId, poolId);
    res.json(submissions);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Copy predictions from one pool to another
router.post('/copy-from-pool', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { targetPoolId, sourcePoolId } = req.body;
    const userId = req.user!.id;

    if (!targetPoolId || !sourcePoolId) {
      res.status(400).json({ error: 'Target pool ID and source pool ID are required' });
      return;
    }

    const result = await predictionService.copyPredictionsFromPool(
      userId,
      targetPoolId,
      sourcePoolId,
    );
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
