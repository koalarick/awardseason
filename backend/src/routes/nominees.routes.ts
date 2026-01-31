import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireSuperuser, AuthRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();

const router = Router();

// Get nominees for a year
router.get('/:year', async (req, res: Response) => {
  try {
    const { year } = req.params;
    console.log(`Fetching nominees for year: ${year}`);

    // Fetch categories with nominees from database
    const categories = await prisma.category.findMany({
      where: { year },
      include: {
        nominees: {
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    console.log(`Found ${categories.length} categories in database for year ${year}`);

    if (!categories || categories.length === 0) {
      res.status(404).json({
        error: `No nominees data found for year ${year}`,
      });
      return;
    }

    // Transform to match the expected format
    // Extract the base category ID (remove year suffix)
    const formattedCategories = categories.map((category) => {
      // category.id is like "best-picture-2026", extract "best-picture"
      const baseCategoryId = category.id.replace(`-${year}`, '');
      return {
        id: baseCategoryId,
        name: category.name,
        defaultPoints: category.defaultPoints,
        nominees: category.nominees.map((nominee) => ({
          id: nominee.id,
          name: nominee.name,
          film: nominee.film || undefined,
          song: nominee.song || undefined,
          producers: nominee.producers || undefined,
          blurb_sentence_1: (nominee as any).blurb_sentence_1 || undefined,
          blurb_sentence_2: (nominee as any).blurb_sentence_2 || undefined,
          imdb_url: (nominee as any).imdb_url || undefined,
          letterboxd_url: (nominee as any).letterboxd_url || undefined,
        })),
      };
    });

    console.log(`Returning ${formattedCategories.length} formatted categories for year ${year}`);
    res.json(formattedCategories);
  } catch (error: any) {
    console.error('Error fetching nominees:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
    res.status(500).json({
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Update nominee metadata (superuser only)
router.patch(
  '/:year/:categoryId/:nomineeId',
  authenticate,
  requireSuperuser,
  async (req: AuthRequest, res: Response) => {
    try {
      const { year, categoryId, nomineeId } = req.params;

      if (!year || !categoryId || !nomineeId) {
        res.status(400).json({ error: 'Year, category ID, and nominee ID are required' });
        return;
      }

      const categoryIdWithYear = categoryId.endsWith(`-${year}`)
        ? categoryId
        : `${categoryId}-${year}`;

      const category = await prisma.category.findUnique({
        where: { id: categoryIdWithYear },
      });

      if (!category) {
        res.status(404).json({ error: `Category not found for year ${year}` });
        return;
      }

      const nominee = await prisma.nominee.findUnique({
        where: {
          categoryId_id: {
            categoryId: category.id,
            id: nomineeId,
          },
        },
      });

      if (!nominee) {
        res.status(404).json({ error: 'Nominee not found' });
        return;
      }

      const fields = [
        'blurb_sentence_1',
        'blurb_sentence_2',
        'imdb_url',
        'letterboxd_url',
      ] as const;
      type NomineeMetadataField = (typeof fields)[number];
      const updateData: Partial<Record<NomineeMetadataField, string | null>> = {};

      for (const field of fields) {
        if (!(field in req.body)) continue;
        const rawValue = req.body[field];

        if (rawValue !== null && typeof rawValue !== 'string') {
          res.status(400).json({ error: `${field} must be a string or null` });
          return;
        }

        if (rawValue === null) {
          updateData[field] = null;
          continue;
        }

        const trimmed = rawValue.trim();
        updateData[field] = trimmed.length > 0 ? trimmed : null;
      }

      if (Object.keys(updateData).length === 0) {
        res.status(400).json({ error: 'No metadata fields provided to update' });
        return;
      }

      const updatedNominee = await prisma.nominee.update({
        where: {
          categoryId_id: {
            categoryId: category.id,
            id: nomineeId,
          },
        },
        data: updateData,
      });

      res.json({
        id: updatedNominee.id,
        categoryId: categoryId,
        blurb_sentence_1: updatedNominee.blurb_sentence_1 || undefined,
        blurb_sentence_2: updatedNominee.blurb_sentence_2 || undefined,
        imdb_url: updatedNominee.imdb_url || undefined,
        letterboxd_url: updatedNominee.letterboxd_url || undefined,
      });
    } catch (error: any) {
      console.error('Error updating nominee metadata:', error);
      res.status(500).json({ error: error.message });
    }
  },
);

export default router;
