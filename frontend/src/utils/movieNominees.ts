import type { Category, Nominee } from '../types/pool';
import { filmNameToSlug } from './nomineeImages';

export type MovieEntry = {
  id: string;
  title: string;
  categories: string[];
  posterIds: string[];
  letterboxdUrl?: string;
};

const personCategoryPattern = /(actor|actress|directing)/i;

export function isPersonCategory(categoryId: string): boolean {
  return personCategoryPattern.test(categoryId);
}

function getMovieTitleFromNominee(nominee: Nominee, categoryId: string): string | null {
  if (isPersonCategory(categoryId)) {
    return nominee.film ?? null;
  }

  if (nominee.film) {
    return nominee.film;
  }

  if (categoryId === 'music-song') {
    const song = typeof nominee.song === 'string' ? nominee.song : '';
    const match = song.match(/from\s+([^;]+)/i);
    return match?.[1]?.trim() || null;
  }

  if (nominee.name) {
    return nominee.name;
  }

  return null;
}

export function getMovieEntries(categories: Category[]): MovieEntry[] {
  const movieMap = new Map<string, MovieEntry>();

  categories.forEach((category) => {
    category.nominees.forEach((nominee) => {
      const title = getMovieTitleFromNominee(nominee, category.id);
      if (!title) {
        return;
      }

      const primaryId = filmNameToSlug(title);
      const existing = movieMap.get(primaryId);
      const nomineeLetterboxd =
        !isPersonCategory(category.id) && typeof nominee.letterboxd_url === 'string'
          ? nominee.letterboxd_url
          : undefined;

      if (!existing) {
        movieMap.set(primaryId, {
          id: primaryId,
          title,
          categories: [category.name],
          posterIds: [primaryId],
          letterboxdUrl: nomineeLetterboxd,
        });
        return;
      }

      if (!existing.categories.includes(category.name)) {
        existing.categories.push(category.name);
      }
      if (!existing.letterboxdUrl && nomineeLetterboxd) {
        existing.letterboxdUrl = nomineeLetterboxd;
      }
    });
  });

  return Array.from(movieMap.values()).sort((a, b) => a.title.localeCompare(b.title));
}
