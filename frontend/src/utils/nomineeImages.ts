import type { Nominee } from '../types/pool';

export function filmNameToSlug(filmName: string): string {
  return filmName
    .toLowerCase()
    .replace(/[āáàâä]/g, 'a')
    .replace(/[ēéèêë]/g, 'e')
    .replace(/[īíìîï]/g, 'i')
    .replace(/[ōóòôö]/g, 'o')
    .replace(/[ūúùûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getNomineeImage(
  nominee: Nominee,
  categoryId: string,
  year: string = '2026',
): string {
  const isPersonCategory =
    categoryId.includes('actor') ||
    categoryId.includes('actress') ||
    categoryId.includes('directing');

  if (isPersonCategory) {
    return `/images/${year}_${categoryId}_${nominee.id}.jpg`;
  }

  let movieId = nominee.id;
  if (nominee.film && categoryId === 'international-feature') {
    movieId = filmNameToSlug(nominee.film);
  } else if (nominee.song && categoryId === 'music-song') {
    const match = nominee.song.match(/from\s+([^;]+)/i);
    if (match && match[1]) {
      movieId = filmNameToSlug(match[1].trim());
    }
  } else if (nominee.film) {
    movieId = filmNameToSlug(nominee.film);
  } else if (nominee.name) {
    movieId = filmNameToSlug(nominee.name);
  } else {
    movieId = nominee.id;
  }

  return `/images/${year}_movie_${movieId}.jpg`;
}

export function getMoviePosterImage(movieTitle: string, year: string = '2026'): string {
  const movieId = filmNameToSlug(movieTitle);
  return `/images/${year}_movie_${movieId}.jpg`;
}
