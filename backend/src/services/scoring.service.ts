import { PrismaClient } from '@prisma/client';
import { buildFallbackNameMap, resolveSubmissionName } from '../utils/submission-name';

const prisma = new PrismaClient();

export function calculateOddsMultiplier(oddsPercentage: number, formula: string): number {
  if (!oddsPercentage || oddsPercentage <= 0 || oddsPercentage > 100) {
    return 1.0;
  }

  const oddsDecimal = oddsPercentage / 100;

  switch (formula) {
    case 'inverse':
      return Math.max(1.0, 100 / oddsPercentage);
    case 'sqrt':
      return 1 + Math.sqrt(1 - oddsDecimal);
    case 'log':
      return 1 + Math.log(100 / oddsPercentage);
    case 'linear':
    default:
      return 2 - oddsDecimal;
  }
}

export class ScoringService {
  async calculateScores(poolId: string) {
    // Get pool settings
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
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

    if (!pool || !pool.settings) {
      throw new Error('Pool or settings not found');
    }

    const settings = pool.settings;
    const categoryPoints = settings.categoryPoints as Record<string, number>;
    const multiplierEnabled = settings.oddsMultiplierEnabled;
    const multiplierFormula = settings.oddsMultiplierFormula || 'linear';

    // Get global winners for this year (from global pool)
    const globalPool = await prisma.pool.findFirst({
      where: {
        name: `Global Oscars Pool ${pool.year}`,
        year: pool.year,
        isPublic: true,
      },
    });

    let globalWinners: Array<{ categoryId: string; nomineeId: string }> = [];
    if (globalPool) {
      const globalWinnersData = await prisma.actualWinner.findMany({
        where: { poolId: globalPool.id },
        select: {
          categoryId: true,
          nomineeId: true,
        },
      });
      globalWinners = globalWinnersData;
    }

    // Use global winners (all pools use the same global winners for a given year)
    const winnersToUse = globalWinners;

    // Get all predictions for the pool
    const predictions = await prisma.prediction.findMany({
      where: { poolId },
    });

    // Calculate scores for each user
    const userScores: Record<
      string,
      {
        userId: string;
        submissionName: string;
        totalScore: number;
        correctCount: number;
        breakdown: Array<{
          categoryId: string;
          categoryName: string;
          points: number;
          multiplier: number;
          adjustedPoints: number;
          odds: number | null;
          correct: boolean;
        }>;
      }
    > = {};

    const fallbackNameMap = buildFallbackNameMap(pool.members);

    // Initialize user scores with submission names
    for (const member of pool.members) {
      const fallbackName = fallbackNameMap.get(member.userId) || 'Ballot';
      const submissionName = resolveSubmissionName(member.submissionName, fallbackName);

      userScores[member.userId] = {
        userId: member.userId,
        submissionName,
        totalScore: 0,
        correctCount: 0,
        breakdown: [],
      };
    }

    // Process each category
    for (const winner of winnersToUse) {
      // Normalize categoryId (remove year suffix if present) for comparison
      // winner.categoryId might be base ID (e.g., "best-picture") or full ID (e.g., "best-picture-2026")
      // Always normalize to ensure consistent comparison
      const winnerCategoryId = winner.categoryId.replace(/-\d{4}$/, '');

      const basePoints = categoryPoints[winnerCategoryId] || 0;
      // Filter predictions that match the normalized category ID
      const categoryPredictions = predictions.filter((p) => p.categoryId === winnerCategoryId);

      for (const prediction of categoryPredictions) {
        const isCorrect = prediction.nomineeId === winner.nomineeId;
        let multiplier = 1.0;
        let adjustedPoints = basePoints;
        // Use odds stored in prediction (at time of selection)
        const odds = prediction.oddsPercentage;

        if (isCorrect) {
          if (multiplierEnabled && odds !== null && odds > 0) {
            multiplier = calculateOddsMultiplier(odds, multiplierFormula);
            adjustedPoints = basePoints * multiplier;
          }

          userScores[prediction.userId].totalScore += adjustedPoints;
          userScores[prediction.userId].correctCount += 1;
        }

        // Add to breakdown (only if there's a winner for this category)
        userScores[prediction.userId].breakdown.push({
          categoryId: winner.categoryId,
          categoryName: '', // Will be filled from nominees data
          points: basePoints,
          multiplier,
          adjustedPoints: isCorrect ? adjustedPoints : 0,
          odds,
          correct: isCorrect,
        });
      }
    }

    // Convert to array and sort by score
    const scores = Object.values(userScores).sort((a, b) => b.totalScore - a.totalScore);

    return {
      poolId,
      scores,
      totalCategories: winnersToUse.length,
    };
  }

  async getUserScore(poolId: string, userId: string) {
    const allScores = await this.calculateScores(poolId);
    const userScore = allScores.scores.find((s) => s.userId === userId);

    if (!userScore) {
      throw new Error('User score not found');
    }

    return userScore;
  }
}
