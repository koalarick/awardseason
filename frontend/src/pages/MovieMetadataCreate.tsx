import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import type { Movie } from '../types/pool';
import { getApiErrorMessage } from '../utils/apiErrors';
import BackButton from '../components/BackButton';
import { useSmartBack } from '../hooks/useSmartBack';

type MovieFormState = {
  title: string;
  year: string;
  imdbId: string;
  letterboxdUrl: string;
  tmdbId: string;
  wikidataId: string;
  posterPath: string;
  posterImageId: string;
};

const emptyForm: MovieFormState = {
  title: '',
  year: '',
  imdbId: '',
  letterboxdUrl: '',
  tmdbId: '',
  wikidataId: '',
  posterPath: '',
  posterImageId: '',
};

const normalizeValue = (value?: string | null) => (value ?? '').trim();

export default function MovieMetadataCreate() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const goBack = useSmartBack({ fallback: '/movies/metadata' });
  const defaultYear = String(new Date().getFullYear() - 1);
  const [formState, setFormState] = useState<MovieFormState>({
    ...emptyForm,
    year: defaultYear,
  });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== 'SUPERUSER') {
      navigate('/');
    }
  }, [user, navigate]);

  const createMovie = useMutation({
    mutationFn: async (payload: MovieFormState) => {
      const yearValue = Number.parseInt(payload.year.trim(), 10);
      const tmdbValue = payload.tmdbId.trim()
        ? Number.parseInt(payload.tmdbId.trim(), 10)
        : null;

      const response = await api.post('/movies', {
        title: normalizeValue(payload.title),
        year: yearValue,
        imdbId: normalizeValue(payload.imdbId) || null,
        letterboxdUrl: normalizeValue(payload.letterboxdUrl) || null,
        tmdbId: Number.isFinite(tmdbValue) ? tmdbValue : null,
        wikidataId: normalizeValue(payload.wikidataId) || null,
        posterPath: normalizeValue(payload.posterPath) || null,
        posterImageId: normalizeValue(payload.posterImageId) || null,
      });
      return response.data as Movie;
    },
    onSuccess: (createdMovie) => {
      navigate('/movies/metadata', {
        state: {
          createdMovieId: createdMovie.id,
          year: String(createdMovie.year),
        },
      });
    },
    onError: (error: unknown) => {
      setFormError(getApiErrorMessage(error) ?? 'Failed to add movie.');
    },
  });

  const handleSubmit = () => {
    setFormError(null);

    const missingFields = [];
    if (!formState.title.trim()) missingFields.push('Title');
    if (!formState.year.trim()) missingFields.push('Release year');

    if (missingFields.length > 0) {
      setFormError(`Missing required fields: ${missingFields.join(', ')}`);
      return;
    }

    const parsedYear = Number.parseInt(formState.year.trim(), 10);
    if (!Number.isFinite(parsedYear)) {
      setFormError('Release year must be a number.');
      return;
    }

    if (formState.tmdbId.trim()) {
      const parsedTmdb = Number.parseInt(formState.tmdbId.trim(), 10);
      if (!Number.isFinite(parsedTmdb)) {
        setFormError('TMDB ID must be a number.');
        return;
      }
    }

    createMovie.mutate(formState);
  };

  const handleReset = () => {
    setFormState({ ...emptyForm, year: defaultYear });
    setFormError(null);
  };

  if (user?.role !== 'SUPERUSER') {
    return null;
  }

  const canSubmit = Boolean(formState.title.trim() && formState.year.trim());

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 oscars-red text-white py-3 px-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <BackButton onClick={goBack} />

          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 flex-shrink-0 hover:opacity-90 transition-opacity touch-manipulation focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-slate-900 rounded"
            aria-label="Go to home"
          >
            <img
              src="/images/awardseason_logo_assets/awardseason_topnav_256.png"
              alt="Award Season"
              className="h-12 w-12 sm:h-14 sm:w-14 object-contain"
            />
            <span className="oscars-font text-[0.9rem] sm:text-xl font-medium sm:font-bold text-white/80 sm:text-white whitespace-nowrap">
              AWARD SEASON
            </span>
          </button>

          <div className="flex-1" />

          <button
            onClick={logout}
            className="flex items-center justify-center px-4 py-2 min-h-[44px] text-white border-2 border-white/30 hover:border-white/50 hover:bg-white/10 active:bg-white/20 rounded-lg transition-all text-sm font-medium touch-manipulation focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-slate-900"
            aria-label="Logout"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
            <h2 className="oscars-font text-base sm:text-lg font-bold">Add Movie</h2>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold oscars-dark uppercase tracking-wide">
                Title
              </label>
              <input
                type="text"
                value={formState.title}
                onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                className="w-full px-3 py-2.5 min-h-[44px] text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold oscars-dark uppercase tracking-wide">
                Release Year
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formState.year}
                onChange={(e) => setFormState({ ...formState, year: e.target.value })}
                className="w-full px-3 py-2.5 min-h-[44px] text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold oscars-dark uppercase tracking-wide">
                IMDb ID (optional)
              </label>
              <input
                type="text"
                placeholder="tt1234567"
                value={formState.imdbId}
                onChange={(e) => setFormState({ ...formState, imdbId: e.target.value })}
                className="w-full px-3 py-2.5 min-h-[44px] text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold oscars-dark uppercase tracking-wide">
                Letterboxd URL (optional)
              </label>
              <input
                type="url"
                value={formState.letterboxdUrl}
                onChange={(e) =>
                  setFormState({ ...formState, letterboxdUrl: e.target.value })
                }
                className="w-full px-3 py-2.5 min-h-[44px] text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold oscars-dark uppercase tracking-wide">
                TMDB ID (optional)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formState.tmdbId}
                onChange={(e) => setFormState({ ...formState, tmdbId: e.target.value })}
                className="w-full px-3 py-2.5 min-h-[44px] text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold oscars-dark uppercase tracking-wide">
                Wikidata ID (optional)
              </label>
              <input
                type="text"
                placeholder="Q123456"
                value={formState.wikidataId}
                onChange={(e) => setFormState({ ...formState, wikidataId: e.target.value })}
                className="w-full px-3 py-2.5 min-h-[44px] text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold oscars-dark uppercase tracking-wide">
                Poster Path (optional)
              </label>
              <input
                type="text"
                value={formState.posterPath}
                onChange={(e) => setFormState({ ...formState, posterPath: e.target.value })}
                className="w-full px-3 py-2.5 min-h-[44px] text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold oscars-dark uppercase tracking-wide">
                Poster Image ID (optional)
              </label>
              <input
                type="text"
                value={formState.posterImageId}
                onChange={(e) => setFormState({ ...formState, posterImageId: e.target.value })}
                className="w-full px-3 py-2.5 min-h-[44px] text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || createMovie.isPending}
                className="px-4 py-2.5 min-h-[44px] bg-slate-800 text-white rounded-md hover:bg-slate-700 active:bg-slate-900 transition-colors text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {createMovie.isPending ? 'Adding...' : 'Add movie'}
              </button>
              <button
                onClick={handleReset}
                disabled={createMovie.isPending}
                className="px-4 py-2.5 min-h-[44px] bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 active:bg-gray-300 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
