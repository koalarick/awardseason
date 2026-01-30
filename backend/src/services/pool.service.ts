import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { calculateOddsMultiplier } from './scoring.service';
import { buildFallbackNameMap, resolveSubmissionName } from '../utils/submission-name';

const prisma = new PrismaClient();

const normalizeCategoryId = (categoryId: string) => categoryId.replace(/-\d{4}$/, '');
type CategoryRecord = Awaited<ReturnType<typeof prisma.category.findMany>>[number];
type OwnerLookup = { ownerId: string } | null;

const getPoolOwnerIdOrThrow = async (poolId: string): Promise<string> => {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    select: { ownerId: true },
  });

  if (!pool) {
    throw new Error('Pool not found');
  }

  return pool.ownerId;
};

const requirePoolMember = async (poolId: string, userId: string, userRole?: string) => {
  if (userRole === 'SUPERUSER') {
    return null;
  }

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

  return membership;
};

const getPoolOwner = async (poolId: string): Promise<OwnerLookup> => {
  return prisma.pool.findUnique({
    where: { id: poolId },
    select: { ownerId: true },
  });
};

export class PoolService {
  async createPool(
    userId: string,
    name: string,
    year: string,
    ceremonyDate: Date,
    password?: string,
    isPublic: boolean = false,
    isPaidPool: boolean = false,
    entryAmount?: number,
    venmoAlias?: string,
    payoutStructure?: Array<{ position: number; percentage: number }>,
    oddsMultiplierEnabled?: boolean,
    oddsMultiplierFormula?: string,
    categoryPoints?: Record<string, number>
  ) {
    let passwordHash: string | null = null;
    if (password && !isPublic) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const pool = await prisma.pool.create({
      data: {
        name,
        passwordHash,
        isPublic: isPublic || !password,
        isPaidPool,
        entryAmount: isPaidPool && entryAmount ? entryAmount : null,
        venmoAlias: isPaidPool && venmoAlias ? venmoAlias : null,
        ownerId: userId,
        year,
        ceremonyDate,
      },
      include: {
        owner: {
          select: {
            id: true,
            // Email not needed for pool creation response
          },
        },
      },
    });

    // Add owner as member
    await prisma.poolMember.create({
      data: {
        poolId: pool.id,
        userId: pool.ownerId,
      },
    });

    // Create pool settings
    await prisma.poolSettings.create({
      data: {
        poolId: pool.id,
        categoryPoints: categoryPoints || {},
        oddsMultiplierEnabled: oddsMultiplierEnabled !== undefined ? oddsMultiplierEnabled : true,
        oddsMultiplierFormula: oddsMultiplierFormula || 'log',
        payoutStructure: payoutStructure || undefined,
      },
    });

    return pool;
  }

  async joinPool(userId: string, poolId: string, password?: string) {
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
    });

    if (!pool) {
      throw new Error('Pool not found');
    }

    // Check if already a member
    const existingMember = await prisma.poolMember.findUnique({
      where: {
        poolId_userId: {
          poolId,
          userId,
        },
      },
    });

    if (existingMember) {
      throw new Error('Already a member of this pool');
    }

    // Check password if pool is not public
    if (!pool.isPublic && pool.passwordHash) {
      if (!password) {
        throw new Error('Password required');
      }
      const isValid = await bcrypt.compare(password, pool.passwordHash);
      if (!isValid) {
        throw new Error('Invalid password');
      }
    }

    // Add user as member
    const member = await prisma.poolMember.create({
      data: {
        poolId,
        userId,
      },
      include: {
        pool: {
          include: {
            owner: {
              select: {
                id: true,
                // Email not needed for join response
              },
            },
          },
        },
      },
    });

    return member;
  }

  async getUserPools(userId: string) {
    const memberships = await prisma.poolMember.findMany({
      where: { userId },
      include: {
        pool: {
          include: {
            owner: {
              select: {
                id: true,
                email: true,
              },
            },
            _count: {
              select: {
                members: true,
              },
            },
            settings: true,
          },
        },
      },
    });

    if (memberships.length === 0) {
      return [];
    }

    // Get all pool IDs
    const poolIds = memberships.map((m) => m.pool.id);

    // Get all predictions for these pools by this user
    const predictions = await prisma.prediction.findMany({
      where: {
        userId,
        poolId: { in: poolIds },
      },
    });

    // Group predictions by poolId
    const predictionsByPool = new Map<string, typeof predictions>();
    predictions.forEach((pred) => {
      if (!predictionsByPool.has(pred.poolId)) {
        predictionsByPool.set(pred.poolId, []);
      }
      predictionsByPool.get(pred.poolId)!.push(pred);
    });

    // Get all winners for these pools
    const winners = await prisma.actualWinner.findMany({
      where: {
        poolId: { in: poolIds },
      },
    });

    // Group winners by poolId
    const winnersByPool = new Map<string, typeof winners>();
    winners.forEach((winner) => {
      if (!winnersByPool.has(winner.poolId)) {
        winnersByPool.set(winner.poolId, []);
      }
      winnersByPool.get(winner.poolId)!.push(winner);
    });

    // Get all categories for pools (grouped by year)
    const poolYears = [...new Set(memberships.map((m) => m.pool.year))];
    const categoriesByYear = new Map<string, CategoryRecord[]>();
    const categoriesByYearEntries = await Promise.all(
      poolYears.map(async (year) => {
        const categories = await prisma.category.findMany({
          where: { year },
        });
        return [year, categories] as const;
      })
    );
    categoriesByYearEntries.forEach(([year, categories]) => {
      categoriesByYear.set(year, categories);
    });

    // Enrich pools with entry status and correct count
    return memberships.map((m) => {
      const pool = m.pool;
      const userPredictions = predictionsByPool.get(pool.id) || [];
      const poolWinners = winnersByPool.get(pool.id) || [];
      const categories = categoriesByYear.get(pool.year) || [];
      
      // Determine submission status
      const predictionCount = userPredictions.length;
      const totalCategories = categories.length;
      let submissionStatus: string;
      if (predictionCount === 0) {
        submissionStatus = 'Not Submitted';
      } else if (predictionCount === totalCategories) {
        submissionStatus = 'Complete';
      } else {
        submissionStatus = 'In Progress';
      }
      
      // Calculate correct count
      let correctCount = 0;
      if (poolWinners.length > 0 && userPredictions.length > 0) {
        // Create a map of categoryId -> winner nomineeId
        const winnerMap = new Map<string, string>();
        poolWinners.forEach((winner) => {
          const baseCategoryId = normalizeCategoryId(winner.categoryId);
          winnerMap.set(baseCategoryId, winner.nomineeId);
        });

        // Count correct predictions
        userPredictions.forEach((prediction) => {
          const baseCategoryId = normalizeCategoryId(prediction.categoryId);
          const winnerNomineeId = winnerMap.get(baseCategoryId);
          if (winnerNomineeId && prediction.nomineeId === winnerNomineeId) {
            correctCount++;
          }
        });
      }

      // Use a neutral fallback so email prefixes aren't exposed
      const submissionName = resolveSubmissionName(m.submissionName, 'My Ballot')

      return {
        ...pool,
        submissionStatus,
        hasSubmitted: predictionCount > 0, // Keep for backward compatibility if needed
        correctCount,
        totalCategories,
        submissionName,
      };
    });
  }

  async updateSubmissionName(userId: string, poolId: string, submissionName: string) {
    // Verify user is a member
    await requirePoolMember(poolId, userId);

    // Update submission name
    const updated = await prisma.poolMember.update({
      where: {
        poolId_userId: {
          poolId,
          userId,
        },
      },
      data: {
        submissionName: submissionName.trim() || null,
      },
    });

    return updated;
  }

  async getPoolSubmissions(poolId: string) {
    // Get pool with settings and categories
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: {
        settings: true,
        members: {
          select: {
            userId: true,
            submissionName: true,
            hasPaid: true,
            joinedAt: true,
          },
        },
      },
    });

    if (!pool || !pool.settings) {
      throw new Error('Pool or settings not found');
    }

    // Get all categories for this pool's year
    const categories = await prisma.category.findMany({
      where: { year: pool.year },
    });

    const totalCategories = categories.length;
    const categoriesById = new Map(categories.map((category) => [category.id, category]));
    const categoryPoints = pool.settings.categoryPoints as Record<string, number> || {};

    // Get all predictions grouped by user (odds are stored in prediction)
    const predictions = await prisma.prediction.findMany({
      where: { poolId },
    });
    const predictionsByUser = new Map<string, typeof predictions>();
    predictions.forEach((prediction) => {
      const list = predictionsByUser.get(prediction.userId);
      if (list) {
        list.push(prediction);
      } else {
        predictionsByUser.set(prediction.userId, [prediction]);
      }
    });

    // Pre-fetch current odds for predictions that don't have stored odds
    // This avoids doing async lookups inside the loop
    const predictionsNeedingOdds = predictions.filter(
      (prediction) => prediction.oddsPercentage === null || prediction.oddsPercentage === undefined
    );
    const currentOddsMap: Record<string, number | null> = {};
    
    if (predictionsNeedingOdds.length > 0) {
      const uniqueOddsLookups = new Map<string, { categoryId: string; nomineeId: string }>();
      predictionsNeedingOdds.forEach((prediction) => {
        const key = `${prediction.categoryId}-${prediction.nomineeId}`;
        if (!uniqueOddsLookups.has(key)) {
          uniqueOddsLookups.set(key, {
            categoryId: prediction.categoryId,
            nomineeId: prediction.nomineeId,
          });
        }
      });

      const oddsLookups = await Promise.all(
        [...uniqueOddsLookups.values()].map(async (prediction) => {
          const fullCategoryId = `${prediction.categoryId}-${pool.year}`;
          const snapshot = await prisma.oddsSnapshot.findFirst({
            where: {
              categoryId: fullCategoryId,
              nomineeId: prediction.nomineeId,
            },
            orderBy: {
              snapshotTime: 'desc',
            },
          });
          return {
            key: `${prediction.categoryId}-${prediction.nomineeId}`,
            odds: snapshot?.oddsPercentage || null,
          };
        })
      );
      
      oddsLookups.forEach(({ key, odds }) => {
        currentOddsMap[key] = odds;
      });
    }

    // Get global winners for this year (from global pool) - do this once outside the loop
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

    const fallbackNameMap = buildFallbackNameMap(pool.members);

    // Calculate submission metadata for each member
    const submissions = await Promise.all(
      pool.members.map(async (member) => {
        const userPredictions = predictionsByUser.get(member.userId) || [];
        const filledCategories = userPredictions.length;
        const isComplete = filledCategories === totalCategories;

        // Calculate total possible points and earned points
        // Possible points logic matches login homepage:
        // - For categories WITH winners: only count if user predicted correctly
        // - For categories WITHOUT winners: count if user has a prediction
        let totalPossiblePoints = 0;
        let totalEarnedPoints = 0;
        let correctCount = 0;

        // Create a map of categoryId -> winner nomineeId for quick lookup
        const winnerMap = new Map<string, string>();
        winnersToUse.forEach(winner => {
          const baseCategoryId = normalizeCategoryId(winner.categoryId);
          winnerMap.set(baseCategoryId, winner.nomineeId);
        });

        for (const prediction of userPredictions) {
          // prediction.categoryId is base ID (e.g., "best-picture")
          // categories have full ID (e.g., "best-picture-2026")
          const fullCategoryId = `${prediction.categoryId}-${pool.year}`;
          const category = categoriesById.get(fullCategoryId);
          if (!category) continue;

          const basePoints = categoryPoints[prediction.categoryId] || category.defaultPoints;
          // Use odds stored in prediction (at time of selection)
          // If not stored (null), fall back to current odds from pre-fetched map
          let odds = prediction.oddsPercentage;
          if (odds === null || odds === undefined) {
            const oddsKey = `${prediction.categoryId}-${prediction.nomineeId}`;
            odds = currentOddsMap[oddsKey] || null;
          }

          let multiplier = 1.0;
          if (pool.settings && pool.settings.oddsMultiplierEnabled && odds !== null && odds > 0) {
            multiplier = calculateOddsMultiplier(odds, pool.settings.oddsMultiplierFormula || 'linear');
          }

          const winnerNomineeId = winnerMap.get(prediction.categoryId);
          
          if (winnerNomineeId) {
            // Winner has been announced for this category
            if (prediction.nomineeId === winnerNomineeId) {
              // User predicted correctly - count actual points earned
              const earnedPoints = basePoints * multiplier;
              totalEarnedPoints += earnedPoints;
              totalPossiblePoints += earnedPoints; // Already earned, counts toward possible
              correctCount++;
            }
            // If user predicted incorrectly, don't count anything (can't get those points)
          } else {
            // No winner announced yet - count possible points if user has a prediction
            totalPossiblePoints += basePoints * multiplier;
          }
        }

        const fallbackName = fallbackNameMap.get(member.userId) || 'Ballot';
        const submissionName = resolveSubmissionName(member.submissionName, fallbackName);

        return {
          userId: member.userId,
          // Exclude userEmail for privacy - use submissionName instead
          submissionName,
          filledCategories,
          totalCategories,
          correctCount,
          isComplete,
          totalPossiblePoints: parseFloat(totalPossiblePoints.toFixed(1)),
          totalEarnedPoints: parseFloat(totalEarnedPoints.toFixed(1)),
          hasPaid: member.hasPaid,
        };
      })
    );

    // Sort by total earned points (descending), then by total possible points (descending)
    return submissions.sort((a, b) => {
      if (b.totalEarnedPoints !== a.totalEarnedPoints) {
        return b.totalEarnedPoints - a.totalEarnedPoints;
      }
      return b.totalPossiblePoints - a.totalPossiblePoints;
    });
  }

  async getPoolMembers(poolId: string, userId: string, userRole?: string) {
    // Verify user is a member
    await requirePoolMember(poolId, userId, userRole);

    // Check if user is pool owner - only owners can see member emails
    const isOwner = await this.isPoolOwner(poolId, userId);

    const members = await prisma.poolMember.findMany({
      where: { poolId },
      include: {
        user: {
          select: {
            id: true,
            // Only include email if requester is pool owner
            ...(isOwner ? { email: true } : {}),
          },
        },
      },
    });

    return members;
  }

  async updatePool(
    poolId: string,
    userId: string,
    updates: {
      name?: string;
      isPaidPool?: boolean;
      entryAmount?: number | null;
      venmoAlias?: string | null;
    }
  ) {
    // Verify user is pool owner
    const isOwner = await this.isPoolOwner(poolId, userId);
    if (!isOwner) {
      throw new Error('Only pool owner can update pool settings');
    }

    const updateData: any = {};
    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }
    if (updates.isPaidPool !== undefined) {
      updateData.isPaidPool = updates.isPaidPool;
      // If disabling paid pool, clear entry amount and venmo alias
      if (!updates.isPaidPool) {
        updateData.entryAmount = null;
        updateData.venmoAlias = null;
      }
    }
    if (updates.entryAmount !== undefined) {
      updateData.entryAmount = updates.entryAmount;
    }
    if (updates.venmoAlias !== undefined) {
      updateData.venmoAlias = updates.venmoAlias;
    }

    const pool = await prisma.pool.update({
      where: { id: poolId },
      data: updateData,
      include: {
        owner: {
          select: {
            id: true,
            // Email not needed for update response
          },
        },
      },
    });

    return pool;
  }

  async markMemberAsPaid(
    poolId: string,
    memberUserId: string,
    ownerUserId: string,
    hasPaid: boolean
  ) {
    // Verify requester is pool owner
    const isOwner = await this.isPoolOwner(poolId, ownerUserId);
    if (!isOwner) {
      throw new Error('Only pool owner can mark payment status');
    }

    // Verify member exists in pool
    const membership = await prisma.poolMember.findUnique({
      where: {
        poolId_userId: {
          poolId,
          userId: memberUserId,
        },
      },
    });

    if (!membership) {
      throw new Error('Member not found in pool');
    }

    const updated = await prisma.poolMember.update({
      where: {
        poolId_userId: {
          poolId,
          userId: memberUserId,
        },
      },
      data: {
        hasPaid,
      },
      include: {
        user: {
          select: {
            id: true,
            // Only pool owners can see member emails - handled in getPoolMembers
          },
        },
      },
    });

    return updated;
  }

  async getPoolInfoPublic(poolId: string) {
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      select: {
        id: true,
        name: true,
        isPublic: true,
        isPaidPool: true,
        entryAmount: true,
        year: true,
        ceremonyDate: true,
        _count: {
          select: {
            members: true,
          },
        },
        owner: {
          select: {
            id: true,
            // Exclude email for privacy - public endpoint
          },
        },
      },
    });

    if (!pool) {
      throw new Error('Pool not found');
    }

    return pool;
  }

  async getPoolById(poolId: string, userId: string, userRole?: string) {
    // Verify user is a member
    await requirePoolMember(poolId, userId, userRole);

    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
          },
        },
        settings: true,
        _count: {
          select: {
            members: true,
          },
        },
        members: {
          where: {
            userId: userId,
          },
          select: {
            submissionName: true,
          },
        },
      },
    });

    if (!pool) {
      throw new Error('Pool not found');
    }

    return pool;
  }

  async isPoolOwner(poolId: string, userId: string): Promise<boolean> {
    const pool = await getPoolOwner(poolId);
    return pool?.ownerId === userId;
  }

  async deletePool(poolId: string, userId: string, userRole?: string): Promise<void> {
    // Verify user is pool owner or superuser
    const isOwner = await this.isPoolOwner(poolId, userId);
    const isSuperuser = userRole === 'SUPERUSER';
    if (!isOwner && !isSuperuser) {
      throw new Error('Only pool owner or superuser can delete pool');
    }

    // Check if pool exists
    await getPoolOwnerIdOrThrow(poolId);

    // Delete pool (cascade deletes will handle related data)
    await prisma.pool.delete({
      where: { id: poolId },
    });
  }

  async removeSubmission(
    poolId: string,
    targetUserId: string,
    requesterUserId: string,
    requesterRole?: string
  ): Promise<void> {
    // Verify requester is pool owner or superuser
    const isOwner = await this.isPoolOwner(poolId, requesterUserId);
    const isSuperuser = requesterRole === 'SUPERUSER';
    if (!isOwner && !isSuperuser) {
      throw new Error('Only pool owner or superuser can remove submissions');
    }

    // Check if pool exists
    const ownerId = await getPoolOwnerIdOrThrow(poolId);

    // Prevent removing the pool owner's submission
    if (targetUserId === ownerId) {
      throw new Error('Cannot remove pool owner\'s submission');
    }

    // Check if target user is a member
    const membership = await prisma.poolMember.findUnique({
      where: {
        poolId_userId: {
          poolId,
          userId: targetUserId,
        },
      },
    });

    if (!membership) {
      throw new Error('User is not a member of this pool');
    }

    // Delete all predictions for this user in this pool
    await prisma.prediction.deleteMany({
      where: {
        poolId,
        userId: targetUserId,
      },
    });

    // Delete the pool membership (this removes the submission)
    await prisma.poolMember.delete({
      where: {
        poolId_userId: {
          poolId,
          userId: targetUserId,
        },
      },
    });
  }

  async getPublicPools() {
    const pools = await prisma.pool.findMany({
      where: {
        isPublic: true,
      },
      include: {
        owner: {
          select: {
            id: true,
            // Exclude email for privacy - public endpoint
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return pools;
  }

  async getGlobalPool() {
    const currentYear = new Date().getFullYear().toString();
    const pool = await prisma.pool.findFirst({
      where: {
        name: `Global Oscars Pool ${currentYear}`,
        year: currentYear,
        isPublic: true,
      },
      include: {
        owner: {
          select: {
            id: true,
            // Exclude email for privacy - public endpoint
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    return pool;
  }

  async searchPools(userId: string, query: string) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchTerm = query.trim();

    // Get pools that match the search term (by name or ID)
    // and exclude pools the user is already a member of
    const userMemberships = await prisma.poolMember.findMany({
      where: { userId },
      select: { poolId: true },
    });

    const userPoolIds = userMemberships.map((m) => m.poolId);

    const pools = await prisma.pool.findMany({
      where: {
        OR: [
          {
            name: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            id: searchTerm, // Exact match for pool ID
          },
        ],
        NOT: {
          id: {
            in: userPoolIds,
          },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            // Exclude email for privacy - search results
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20, // Limit results
    });

    return pools;
  }
}
