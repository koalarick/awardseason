import { Router, Response } from 'express';
import { ScoringService, calculateOddsMultiplier } from '../services/scoring.service';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { PoolService } from '../services/pool.service';
import { PrismaClient } from '@prisma/client';
import { buildFallbackNameMap, resolveSubmissionName } from '../utils/submission-name';

const router = Router();
const scoringService = new ScoringService();
const poolService = new PoolService();
const prisma = new PrismaClient();

// Get all scores for a pool (leaderboard)
router.get('/pool/:poolId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { poolId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Verify user is a member
    await poolService.getPoolById(poolId, userId, userRole);

    const scores = await scoringService.calculateScores(poolId);
    res.json(scores);
  } catch (error: any) {
    res.status(403).json({ error: error.message });
  }
});

// Get user's score for a pool
router.get('/pool/:poolId/user/:userId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { poolId, userId } = req.params;
    const currentUserId = req.user!.id;
    const currentUserRole = req.user!.role;

    // Verify current user is a member
    await poolService.getPoolById(poolId, currentUserId, currentUserRole);

    // Allow users to view their own score or pool owner to view any score
    const isOwner = await poolService.isPoolOwner(poolId, currentUserId);
    const isSuperuser = currentUserRole === 'SUPERUSER';
    if (userId !== currentUserId && !isOwner && !isSuperuser) {
      res.status(403).json({ error: 'Not authorized to view this score' });
      return;
    }

    const score = await scoringService.getUserScore(poolId, userId);
    res.json(score);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// Get global pool standings (public, top 10) - ranked by possible points
router.get('/global/standings', async (req: AuthRequest, res: Response) => {
  try {
    const currentYear = new Date().getFullYear().toString();
    const globalPool = await prisma.pool.findFirst({
      where: {
        name: `Global Oscars Pool ${currentYear}`,
        year: currentYear,
        isPublic: true,
      },
      include: {
        settings: true,
        members: {
          select: {
            userId: true,
            submissionName: true,
            joinedAt: true,
          },
        },
      },
    });

    if (!globalPool || !globalPool.settings) {
      res.json({ 
        pool: null,
        standings: [],
        totalMembers: 0,
      });
      return;
    }

    // Get all categories for this year
    const allCategories = await prisma.category.findMany({
      where: { year: currentYear },
    });

    // Get all winners announced for global pool
    const winners = await prisma.actualWinner.findMany({
      where: { poolId: globalPool.id },
      select: {
        categoryId: true,
        nomineeId: true,
      },
    });

    // Create a map of categoryId -> winner nomineeId
    const winnerMap = new Map<string, string>();
    winners.forEach(winner => {
      const baseCategoryId = winner.categoryId.replace(/-\d{4}$/, '');
      winnerMap.set(baseCategoryId, winner.nomineeId);
    });

    // Get all predictions for the global pool
    const predictions = await prisma.prediction.findMany({
      where: { poolId: globalPool.id },
    });

    // Group predictions by userId
    const predictionsByUser = new Map<string, typeof predictions>();
    predictions.forEach(pred => {
      if (!predictionsByUser.has(pred.userId)) {
        predictionsByUser.set(pred.userId, []);
      }
      predictionsByUser.get(pred.userId)!.push(pred);
    });

    // Only show completed submissions on the public leaderboard
    const totalCategories = allCategories.length;
    const completedMembers = globalPool.members.filter((member) => {
      const userPredictions = predictionsByUser.get(member.userId) || [];
      return userPredictions.length === totalCategories;
    });

    // Get member count (completed submissions only)
    const memberCount = completedMembers.length;

    const settings = globalPool.settings;
    const categoryPoints = settings.categoryPoints as Record<string, number>;
    const multiplierEnabled = settings.oddsMultiplierEnabled;
    const multiplierFormula = settings.oddsMultiplierFormula || 'linear';

    // Calculate possible points for each completed user
    const userStandings: Array<{
      userId: string;
      submissionName: string;
      currentScore: number;
      possiblePoints: number;
      correctCount: number;
    }> = [];

    const fallbackNameMap = buildFallbackNameMap(globalPool.members);

    for (const member of completedMembers) {
      const fallbackName = fallbackNameMap.get(member.userId) || 'Ballot';
      const submissionName = resolveSubmissionName(member.submissionName, fallbackName);
      const userPredictions = predictionsByUser.get(member.userId) || [];
      let currentScore = 0;
      let possiblePoints = 0;
      let correctCount = 0;

      // Process each category
      for (const category of allCategories) {
        const baseCategoryId = category.id.replace(/-\d{4}$/, '');
        const basePoints = categoryPoints[baseCategoryId] || category.defaultPoints || 10;
        const userPrediction = userPredictions.find(p => p.categoryId === baseCategoryId);
        const winnerNomineeId = winnerMap.get(baseCategoryId);

        if (winnerNomineeId) {
          // Winner has been announced
          if (userPrediction) {
            if (userPrediction.nomineeId === winnerNomineeId) {
              // User predicted correctly - count actual points earned
              const odds = userPrediction.oddsPercentage;
              let multiplier = 1.0;
              if (multiplierEnabled && odds !== null && odds > 0) {
                multiplier = calculateOddsMultiplier(odds, multiplierFormula);
              }
              const earnedPoints = basePoints * multiplier;
              currentScore += earnedPoints;
              possiblePoints += earnedPoints; // Already earned, counts toward possible
              correctCount += 1;
            }
            // If user predicted incorrectly, don't count anything (can't get those points)
          }
        } else {
          // No winner announced yet
          if (userPrediction) {
            // User has a prediction - count maximum possible points
            // Use the odds from their prediction to calculate what they'd get if correct
            const odds = userPrediction.oddsPercentage;
            let multiplier = 1.0;
            if (multiplierEnabled && odds !== null && odds > 0) {
              multiplier = calculateOddsMultiplier(odds, multiplierFormula);
            }
            possiblePoints += basePoints * multiplier;
          }
          // If user doesn't have a prediction, don't count (they can't get those points)
        }
      }

      userStandings.push({
        userId: member.userId,
        submissionName,
        currentScore,
        possiblePoints,
        correctCount,
      });
    }

    // Sort by possible points (descending), then by current score
    userStandings.sort((a, b) => {
      if (b.possiblePoints !== a.possiblePoints) {
        return b.possiblePoints - a.possiblePoints;
      }
      return b.currentScore - a.currentScore;
    });

    // Get top 10
    const topStandings = userStandings.slice(0, 10).map((standing, index) => ({
      rank: index + 1,
      userId: standing.userId,
      submissionName: standing.submissionName,
      currentScore: standing.currentScore,
      possiblePoints: standing.possiblePoints,
      correctCount: standing.correctCount,
    }));

    res.json({
      pool: {
        id: globalPool.id,
        year: globalPool.year,
      },
      standings: topStandings,
      totalMembers: memberCount,
      totalCategories: allCategories.length,
    });
  } catch (error: any) {
    // Return empty response instead of error for public endpoint
    res.json({ 
      pool: null,
      standings: [],
      totalMembers: 0,
    });
  }
});

export default router;
