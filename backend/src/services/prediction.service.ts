import { PrismaClient } from '@prisma/client';
import { OddsService } from './odds.service';
import { PoolService } from './pool.service';

const prisma = new PrismaClient();
const oddsService = new OddsService();
const poolService = new PoolService();

export class PredictionService {
  async createOrUpdatePrediction(
    userId: string,
    poolId: string,
    categoryId: string,
    nomineeId: string
  ) {
    // Verify user is a member of the pool
    const membership = await prisma.poolMember.findUnique({
      where: {
        poolId_userId: {
          poolId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new Error('Not a member of this pool');
    }

    // Get pool to determine year for full category ID
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      select: { year: true },
    });

    if (!pool) {
      throw new Error('Pool not found');
    }

    // Check if a global winner has been set for this category
    const globalPool = await prisma.pool.findFirst({
      where: {
        name: `Global Oscars Pool ${pool.year}`,
        year: pool.year,
        isPublic: true,
      },
    });

    if (globalPool) {
      // Normalize categoryId for comparison (handle both base and full IDs)
      const normalizedCategoryId = categoryId.replace(/-\d{4}$/, '');
      
      // Check if any winner exists for this category (could be stored as base or full ID)
      const globalWinner = await prisma.actualWinner.findFirst({
        where: {
          poolId: globalPool.id,
          OR: [
            { categoryId: normalizedCategoryId },
            { categoryId: `${normalizedCategoryId}-${pool.year}` },
          ],
        },
      });

      if (globalWinner) {
        throw new Error('Cannot change prediction: winner has already been announced for this category');
      }
    }

    // Get odds at current time - use full category ID (with year)
    const fullCategoryId = `${categoryId}-${pool.year}`;
    const currentOdds = await oddsService.getCurrentOdds(fullCategoryId, nomineeId);

    // Create or update prediction, storing the odds at creation time
    const existingPrediction = await prisma.prediction.findUnique({
      where: {
        poolId_userId_categoryId: {
          poolId,
          userId,
          categoryId,
        },
      },
    });

    // Try to use Prisma normally first, but handle the case where Prisma Client hasn't been regenerated
    let prediction;
    try {
      const updateData: any = {
        nomineeId,
        oddsPercentage: currentOdds,
        updatedAt: new Date(),
      };
      
      const createData: any = {
        poolId,
        userId,
        categoryId,
        nomineeId,
        oddsPercentage: currentOdds,
      };
      
      // Try to include originalOddsPercentage - will fail if Prisma Client not regenerated
      if (existingPrediction) {
        // If switching to a different nominee, reset originalOddsPercentage to current odds
        // Only preserve originalOddsPercentage if it's the same nominee (odds upgrade scenario)
        if (existingPrediction.nomineeId === nomineeId) {
          // Same nominee - preserve originalOddsPercentage if it exists, otherwise set to current
          updateData.originalOddsPercentage = existingPrediction.originalOddsPercentage ?? currentOdds;
        } else {
          // Different nominee - reset originalOddsPercentage to current odds (new selection)
          updateData.originalOddsPercentage = currentOdds;
        }
      } else {
        createData.originalOddsPercentage = currentOdds;
      }
      
      prediction = existingPrediction
        ? await prisma.prediction.update({
            where: {
              poolId_userId_categoryId: {
                poolId,
                userId,
                categoryId,
              },
            },
            data: updateData,
          })
        : await prisma.prediction.create({
            data: createData,
          });
    } catch (error: any) {
      // If error is about unknown field, use raw SQL as fallback
      if (error.message?.includes('originalOddsPercentage') || error.message?.includes('original_odds_percentage')) {
        console.warn('Prisma Client not regenerated, using raw SQL fallback');
        
        if (existingPrediction) {
          // If switching to a different nominee, reset original_odds_percentage to current odds
          // Only preserve original_odds_percentage if it's the same nominee (odds upgrade scenario)
          if (existingPrediction.nomineeId === nomineeId) {
            // Same nominee - preserve original_odds_percentage if it exists, otherwise set to current
            await prisma.$executeRaw`
              UPDATE predictions 
              SET nominee_id = ${nomineeId},
                  odds_percentage = ${currentOdds},
                  original_odds_percentage = COALESCE(original_odds_percentage, ${currentOdds}),
                  updated_at = NOW()
              WHERE pool_id = ${poolId}
                AND user_id = ${userId}
                AND category_id = ${categoryId}
            `;
          } else {
            // Different nominee - reset original_odds_percentage to current odds (new selection)
            await prisma.$executeRaw`
              UPDATE predictions 
              SET nominee_id = ${nomineeId},
                  odds_percentage = ${currentOdds},
                  original_odds_percentage = ${currentOdds},
                  updated_at = NOW()
              WHERE pool_id = ${poolId}
                AND user_id = ${userId}
                AND category_id = ${categoryId}
            `;
          }
        } else {
          await prisma.$executeRaw`
            INSERT INTO predictions (id, pool_id, user_id, category_id, nominee_id, odds_percentage, original_odds_percentage, created_at, updated_at)
            VALUES (gen_random_uuid()::text, ${poolId}, ${userId}, ${categoryId}, ${nomineeId}, ${currentOdds}, ${currentOdds}, NOW(), NOW())
            ON CONFLICT (pool_id, user_id, category_id) 
            DO UPDATE SET 
              nominee_id = EXCLUDED.nominee_id,
              odds_percentage = EXCLUDED.odds_percentage,
              original_odds_percentage = COALESCE(predictions.original_odds_percentage, EXCLUDED.original_odds_percentage),
              updated_at = NOW()
          `;
        }
        
        // Fetch the prediction
        prediction = await prisma.prediction.findUnique({
          where: {
            poolId_userId_categoryId: {
              poolId,
              userId,
              categoryId,
            },
          },
        });
      } else {
        // Re-throw if it's a different error
        throw error;
      }
    }
    
    if (!prediction) {
      throw new Error('Failed to create or update prediction');
    }

    return {
      ...prediction,
      currentOdds,
    };
  }

  async getUserPredictions(userId: string, poolId: string) {
    // Verify user is a member
    const membership = await prisma.poolMember.findUnique({
      where: {
        poolId_userId: {
          poolId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new Error('Not a member of this pool');
    }

    const predictions = await prisma.prediction.findMany({
      where: {
        poolId,
        userId,
      },
    });

    return predictions;
  }

  async getAllPoolPredictions(poolId: string, userId: string) {
    // Verify user is a member
    const membership = await prisma.poolMember.findUnique({
      where: {
        poolId_userId: {
          poolId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new Error('Not a member of this pool');
    }

    const predictions = await prisma.prediction.findMany({
      where: {
        poolId,
      },
      include: {
        user: {
          select: {
            id: true,
            // Exclude email for privacy
          },
        },
      },
    });

    return predictions;
  }

  async deletePrediction(userId: string, poolId: string, categoryId: string) {
    // Verify user is a member of the pool
    const membership = await prisma.poolMember.findUnique({
      where: {
        poolId_userId: {
          poolId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new Error('Not a member of this pool');
    }

    // Delete the prediction
    await prisma.prediction.delete({
      where: {
        poolId_userId_categoryId: {
          poolId,
          userId,
          categoryId,
        },
      },
    });

    return { success: true };
  }

  async deleteAllPredictions(userId: string, poolId: string) {
    // Verify user is a member of the pool
    const membership = await prisma.poolMember.findUnique({
      where: {
        poolId_userId: {
          poolId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new Error('Not a member of this pool');
    }

    // Get pool to find its year
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      select: { year: true },
    });

    if (!pool) {
      throw new Error('Pool not found');
    }

    // Get global winners for this year (from global pool)
    const globalPool = await prisma.pool.findFirst({
      where: {
        name: `Global Oscars Pool ${pool.year}`,
        year: pool.year,
        isPublic: true,
      },
    });

    let announcedCategoryIds: string[] = [];
    if (globalPool) {
      const globalWinners = await prisma.actualWinner.findMany({
        where: { poolId: globalPool.id },
        select: { categoryId: true },
      });
      announcedCategoryIds = globalWinners.map((w) => w.categoryId);
    }

    // If no global winners, check pool-specific winners
    if (announcedCategoryIds.length === 0) {
      const poolWinners = await prisma.actualWinner.findMany({
        where: { poolId },
        select: { categoryId: true },
      });
      announcedCategoryIds = poolWinners.map((w) => w.categoryId);
    }

    // Delete all predictions for this user in this pool, excluding categories with announced winners
    await prisma.prediction.deleteMany({
      where: {
        poolId,
        userId,
        categoryId: {
          notIn: announcedCategoryIds,
        },
      },
    });

    return { 
      success: true,
      skippedCategories: announcedCategoryIds.length,
    };
  }

  async updateOddsIfBetter(
    userId: string,
    poolId: string,
    categoryId: string
  ) {
    // Verify user is a member of the pool
    const membership = await prisma.poolMember.findUnique({
      where: {
        poolId_userId: {
          poolId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new Error('Not a member of this pool');
    }

    // Get existing prediction
    const prediction = await prisma.prediction.findUnique({
      where: {
        poolId_userId_categoryId: {
          poolId,
          userId,
          categoryId,
        },
      },
    });

    if (!prediction) {
      throw new Error('Prediction not found');
    }

    // Get pool to determine year for full category ID
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      select: { year: true },
    });

    if (!pool) {
      throw new Error('Pool not found');
    }

    // Get current odds for the selected nominee
    const fullCategoryId = `${categoryId}-${pool.year}`;
    const currentOdds = await oddsService.getCurrentOdds(fullCategoryId, prediction.nomineeId);

    // Use the minimum (lower percentage) of current and original odds
    // Lower percentage = worse odds = higher multiplier = more points
    // If current odds are higher (worse for bonus), keep original
    // If current odds are lower (better for bonus), upgrade to current
    const storedOdds = prediction.oddsPercentage;
    const originalOdds = prediction.originalOddsPercentage;
    
    let oddsToUse: number | null = null;
    if (currentOdds !== null && currentOdds !== undefined) {
      if (originalOdds !== null && originalOdds !== undefined) {
        // Use min of current and original - lower percentage = better bonus
        oddsToUse = Math.min(currentOdds, originalOdds);
      } else {
        // If no original odds, use current odds
        oddsToUse = currentOdds;
      }
    }
    
    // Only update if stored odds differ from what they should be
    if (oddsToUse !== null && storedOdds !== null && storedOdds !== undefined &&
        Math.abs(storedOdds - oddsToUse) > 0.01) {
      const updated = await prisma.prediction.update({
        where: {
          poolId_userId_categoryId: {
            poolId,
            userId,
            categoryId,
          },
        },
        data: {
          oddsPercentage: oddsToUse,
          // Preserve originalOddsPercentage - don't overwrite it
          updatedAt: new Date(),
        },
      });

      return {
        ...updated,
        currentOdds,
        upgraded: true,
        oldOdds: storedOdds,
      };
    }

    // No upgrade needed
    return {
      ...prediction,
      currentOdds,
      upgraded: false,
    };
  }

  async upgradeAllPredictionsForCategory(categoryId: string, year: string): Promise<{ upgraded: number; checked: number }> {
    // Get all predictions for this category across all pools
    // categoryId here is the base ID (e.g., "best-picture")
    // We need to find all predictions where the pool's year matches
    const pools = await prisma.pool.findMany({
      where: { year },
      select: { id: true },
    });

    if (pools.length === 0) {
      return { upgraded: 0, checked: 0 };
    }

    const poolIds = pools.map(p => p.id);
    const predictions = await prisma.prediction.findMany({
      where: {
        poolId: { in: poolIds },
        categoryId,
        oddsPercentage: { not: null },
      },
    });

    const fullCategoryId = `${categoryId}-${year}`;
    let upgradedCount = 0;
    let checkedCount = 0;

    for (const prediction of predictions) {
      checkedCount++;
      const currentOdds = await oddsService.getCurrentOdds(fullCategoryId, prediction.nomineeId);
      const storedOdds = prediction.oddsPercentage;
      const originalOdds = prediction.originalOddsPercentage;

      // Use the minimum (lower percentage) of current and original odds
      // Lower percentage = worse odds = higher multiplier = more points
      // If current odds are higher (worse for bonus), keep original
      // If current odds are lower (better for bonus), upgrade to current
      let oddsToUse: number | null = null;
      
      if (currentOdds !== null && currentOdds !== undefined) {
        if (originalOdds !== null && originalOdds !== undefined) {
          // Use min of current and original - lower percentage = better bonus
          oddsToUse = Math.min(currentOdds, originalOdds);
        } else {
          // If no original odds, use current odds
          oddsToUse = currentOdds;
        }
      }

      // Only update if stored odds differ from what they should be
      if (oddsToUse !== null && storedOdds !== null && storedOdds !== undefined &&
          Math.abs(storedOdds - oddsToUse) > 0.01) {
        await prisma.prediction.update({
          where: {
            poolId_userId_categoryId: {
              poolId: prediction.poolId,
              userId: prediction.userId,
              categoryId: prediction.categoryId,
            },
          },
          data: {
            oddsPercentage: oddsToUse,
            updatedAt: new Date(),
          },
        });
        upgradedCount++;
      } else if (oddsToUse !== null && (storedOdds === null || storedOdds === undefined)) {
        // If stored odds is null but we have odds to use, update it
        await prisma.prediction.update({
          where: {
            poolId_userId_categoryId: {
              poolId: prediction.poolId,
              userId: prediction.userId,
              categoryId: prediction.categoryId,
            },
          },
          data: {
            oddsPercentage: oddsToUse,
            updatedAt: new Date(),
          },
        });
        upgradedCount++;
      }
    }

    return { upgraded: upgradedCount, checked: checkedCount };
  }

  async getUserOtherPoolSubmissions(userId: string, excludePoolId: string) {
    // Get all pools where user is a member, excluding the current pool
    const memberships = await prisma.poolMember.findMany({
      where: {
        userId,
        poolId: { not: excludePoolId },
      },
      include: {
        pool: {
          select: {
            id: true,
            name: true,
            year: true,
          },
        },
      },
    });

    // Get predictions for each pool
    const poolIds = memberships.map(m => m.pool.id);
    const allPredictions = await prisma.prediction.findMany({
      where: {
        userId,
        poolId: { in: poolIds },
      },
    });

    // Get unique years from pools
    const years = [...new Set(memberships.map(m => m.pool.year))];
    
    // Get total category count for each year
    const categoryCountsByYear: Record<string, number> = {};
    for (const year of years) {
      const categoryCount = await prisma.category.count({
        where: { year },
      });
      categoryCountsByYear[year] = categoryCount;
    }

    // Group predictions by pool and count them
    const submissions = memberships.map(membership => {
      const poolPredictions = allPredictions.filter(p => p.poolId === membership.pool.id);
      const totalCategories = categoryCountsByYear[membership.pool.year] || 0;
      return {
        poolId: membership.pool.id,
        poolName: membership.pool.name,
        year: membership.pool.year,
        submissionName: membership.submissionName,
        predictionCount: poolPredictions.length,
        totalCategories,
        predictions: poolPredictions,
      };
    }).filter(submission => {
      // Only return pools with all categories completed
      return submission.predictionCount > 0 && submission.predictionCount === submission.totalCategories;
    });

    return submissions;
  }

  async copyPredictionsFromPool(
    userId: string,
    targetPoolId: string,
    sourcePoolId: string
  ) {
    // Verify user is a member of both pools
    const targetMembership = await prisma.poolMember.findUnique({
      where: {
        poolId_userId: {
          poolId: targetPoolId,
          userId,
        },
      },
    });

    const sourceMembership = await prisma.poolMember.findUnique({
      where: {
        poolId_userId: {
          poolId: sourcePoolId,
          userId,
        },
      },
    });

    if (!targetMembership) {
      throw new Error('Not a member of target pool');
    }

    if (!sourceMembership) {
      throw new Error('Not a member of source pool');
    }

    // Get both pools to check years
    const targetPool = await prisma.pool.findUnique({
      where: { id: targetPoolId },
      select: { year: true },
    });

    const sourcePool = await prisma.pool.findUnique({
      where: { id: sourcePoolId },
      select: { year: true },
    });

    if (!targetPool || !sourcePool) {
      throw new Error('Pool not found');
    }

    // Only allow copying if pools are from the same year
    if (targetPool.year !== sourcePool.year) {
      throw new Error('Cannot copy predictions between pools from different years');
    }

    // Get source predictions
    const sourcePredictions = await prisma.prediction.findMany({
      where: {
        userId,
        poolId: sourcePoolId,
      },
    });

    if (sourcePredictions.length === 0) {
      throw new Error('No predictions found in source pool');
    }

    // Check for global winners (can't modify predictions after winners announced)
    const globalPool = await prisma.pool.findFirst({
      where: {
        name: `Global Oscars Pool ${targetPool.year}`,
        year: targetPool.year,
        isPublic: true,
      },
    });

    let copiedCount = 0;
    let skippedCount = 0;

    // Copy each prediction
    for (const sourcePrediction of sourcePredictions) {
      // Check if winner has been announced for this category
      if (globalPool) {
        const normalizedCategoryId = sourcePrediction.categoryId.replace(/-\d{4}$/, '');
        const globalWinner = await prisma.actualWinner.findFirst({
          where: {
            poolId: globalPool.id,
            OR: [
              { categoryId: normalizedCategoryId },
              { categoryId: `${normalizedCategoryId}-${targetPool.year}` },
            ],
          },
        });

        if (globalWinner) {
          skippedCount++;
          continue; // Skip categories with announced winners
        }
      }

      // Get current odds for the nominee in the target pool
      const fullCategoryId = `${sourcePrediction.categoryId}-${targetPool.year}`;
      const currentOdds = await oddsService.getCurrentOdds(fullCategoryId, sourcePrediction.nomineeId);

      // Check if prediction already exists in target pool
      const existingPrediction = await prisma.prediction.findUnique({
        where: {
          poolId_userId_categoryId: {
            poolId: targetPoolId,
            userId,
            categoryId: sourcePrediction.categoryId,
          },
        },
      });

      if (existingPrediction) {
        // Update existing prediction
        await prisma.prediction.update({
          where: {
            poolId_userId_categoryId: {
              poolId: targetPoolId,
              userId,
              categoryId: sourcePrediction.categoryId,
            },
          },
          data: {
            nomineeId: sourcePrediction.nomineeId,
            oddsPercentage: currentOdds,
            originalOddsPercentage: currentOdds,
            updatedAt: new Date(),
          },
        });
        copiedCount++;
      } else {
        // Create new prediction
        await prisma.prediction.create({
          data: {
            poolId: targetPoolId,
            userId,
            categoryId: sourcePrediction.categoryId,
            nomineeId: sourcePrediction.nomineeId,
            oddsPercentage: currentOdds,
            originalOddsPercentage: currentOdds,
          },
        });
        copiedCount++;
      }
    }

    return {
      copied: copiedCount,
      skipped: skippedCount,
      total: sourcePredictions.length,
    };
  }
}
