import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import type { Movie } from '../types/pool';
import { getApiErrorMessage } from '../utils/apiErrors';
import { filmNameToSlug } from '../utils/nomineeImages';
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
const normalizeNumber = (value?: number | null) => (value === null || value === undefined ? '' : String(value));
const stripYearSuffix = (value: string) => value.replace(/-\d{4}(?:-\d+)?$/, '');

export default function MovieMetadata() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = useSmartBack({ fallback: '/superuser' });
  const queryClient = useQueryClient();
  const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null);
  const [formState, setFormState] = useState<MovieFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const pendingSelectionRef = useRef<{ movieId?: string } | null>(null);
  const editPanelRef = useRef<HTMLDivElement | null>(null);
  const [listPanelHeight, setListPanelHeight] = useState<number | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [posterError, setPosterError] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'SUPERUSER') {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!isDesktop || !editPanelRef.current) {
      setListPanelHeight(null);
      return;
    }

    const updateHeight = () => {
      const height = editPanelRef.current?.getBoundingClientRect().height ?? 0;
      if (height > 0) {
        setListPanelHeight(height);
      }
    };

    updateHeight();

    const observer = new ResizeObserver(() => {
      updateHeight();
    });
    observer.observe(editPanelRef.current);

    return () => observer.disconnect();
  }, [isDesktop]);

  useEffect(() => {
    const state = location.state as { createdMovieId?: string } | null;
    if (!state) return;

    if (state.createdMovieId) {
      pendingSelectionRef.current = {
        movieId: state.createdMovieId,
      };
    }

    navigate('/movies/metadata', { replace: true, state: null });
  }, [location.state, navigate]);

  const {
    data: movies,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['movies'],
    queryFn: async () => {
      try {
        const response = await api.get('/movies');
        return response.data as Movie[];
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return [];
        }
        throw error;
      }
    },
  });

  useEffect(() => {
    if (!movies || movies.length === 0) {
      setSelectedMovieId(null);
      return;
    }

    const pending = pendingSelectionRef.current;
    if (pending?.movieId && movies.some((movie) => movie.id === pending.movieId)) {
      setSelectedMovieId(pending.movieId);
      pendingSelectionRef.current = null;
      return;
    }

    if (!selectedMovieId || !movies.some((movie) => movie.id === selectedMovieId)) {
      setSelectedMovieId(movies[0].id);
    }
  }, [movies, selectedMovieId]);

  const selectedMovie = useMemo(() => {
    if (!movies || !selectedMovieId) return null;
    return movies.find((movie) => movie.id === selectedMovieId) || null;
  }, [movies, selectedMovieId]);

  useEffect(() => {
    if (!selectedMovie) {
      setFormState(emptyForm);
      setFormError(null);
      setSaveMessage(null);
      return;
    }

    setFormState({
      title: normalizeValue(selectedMovie.title),
      year: normalizeNumber(selectedMovie.year),
      imdbId: normalizeValue(selectedMovie.imdbId),
      letterboxdUrl: normalizeValue(selectedMovie.letterboxdUrl),
      tmdbId: normalizeNumber(selectedMovie.tmdbId),
      wikidataId: normalizeValue(selectedMovie.wikidataId),
      posterPath: normalizeValue(selectedMovie.posterPath),
      posterImageId: normalizeValue(selectedMovie.posterImageId),
    });
    setFormError(null);
    setSaveMessage(null);
  }, [selectedMovie]);

  useEffect(() => {
    setPosterError(false);
  }, [selectedMovieId, formState.posterImageId, formState.title, formState.year]);

  const isDirty = useMemo(() => {
    if (!selectedMovie) return false;
    return (
      normalizeValue(formState.title) !== normalizeValue(selectedMovie.title) ||
      normalizeValue(formState.year) !== normalizeNumber(selectedMovie.year) ||
      normalizeValue(formState.imdbId) !== normalizeValue(selectedMovie.imdbId) ||
      normalizeValue(formState.letterboxdUrl) !== normalizeValue(selectedMovie.letterboxdUrl) ||
      normalizeValue(formState.tmdbId) !== normalizeNumber(selectedMovie.tmdbId) ||
      normalizeValue(formState.wikidataId) !== normalizeValue(selectedMovie.wikidataId) ||
      normalizeValue(formState.posterPath) !== normalizeValue(selectedMovie.posterPath) ||
      normalizeValue(formState.posterImageId) !== normalizeValue(selectedMovie.posterImageId)
    );
  }, [formState, selectedMovie]);

  const updateMovie = useMutation({
    mutationFn: async (payload: MovieFormState & { movieId: string }) => {
      const yearValue = Number.parseInt(payload.year.trim(), 10);
      const tmdbValue = payload.tmdbId.trim()
        ? Number.parseInt(payload.tmdbId.trim(), 10)
        : null;

      const response = await api.patch(`/movies/${payload.movieId}`, {
        title: normalizeValue(payload.title),
        year: yearValue,
        imdbId: normalizeValue(payload.imdbId) || null,
        letterboxdUrl: normalizeValue(payload.letterboxdUrl) || null,
        tmdbId: Number.isFinite(tmdbValue) ? tmdbValue : null,
        wikidataId: normalizeValue(payload.wikidataId) || null,
        posterPath: normalizeValue(payload.posterPath) || null,
        posterImageId: normalizeValue(payload.posterImageId) || null,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movies'] });
      setSaveMessage('Saved movie metadata.');
      setFormError(null);
    },
    onError: (error: unknown) => {
      setFormError(getApiErrorMessage(error) ?? 'Failed to save movie metadata.');
    },
  });

  const deleteMovie = useMutation({
    mutationFn: async (movieId: string) => {
      const response = await api.delete(`/movies/${movieId}`);
      return response.data as { id: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movies'] });
      setFormError(null);
      setSaveMessage(null);
    },
    onError: (error: unknown) => {
      setFormError(getApiErrorMessage(error) ?? 'Failed to delete movie.');
    },
  });

  const handleSave = () => {
    if (!selectedMovie) return;
    setFormError(null);
    setSaveMessage(null);

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

    updateMovie.mutate({
      ...formState,
      movieId: selectedMovie.id,
    });
  };

  const handleDelete = () => {
    if (!selectedMovie || deleteMovie.isPending) return;
    const confirmed = window.confirm(
      `Delete "${selectedMovie.title}" (${selectedMovie.year})? This cannot be undone.`,
    );
    if (!confirmed) return;
    deleteMovie.mutate(selectedMovie.id);
  };

  const handleReset = () => {
    if (!selectedMovie) return;
    setFormState({
      title: normalizeValue(selectedMovie.title),
      year: normalizeNumber(selectedMovie.year),
      imdbId: normalizeValue(selectedMovie.imdbId),
      letterboxdUrl: normalizeValue(selectedMovie.letterboxdUrl),
      tmdbId: normalizeNumber(selectedMovie.tmdbId),
      wikidataId: normalizeValue(selectedMovie.wikidataId),
      posterPath: normalizeValue(selectedMovie.posterPath),
      posterImageId: normalizeValue(selectedMovie.posterImageId),
    });
    setFormError(null);
    setSaveMessage(null);
  };

  if (user?.role !== 'SUPERUSER') {
    return null;
  }

  const posterPreviewId =
    normalizeValue(formState.posterImageId) ||
    (selectedMovie?.slug ? stripYearSuffix(selectedMovie.slug) : '') ||
    (formState.title.trim() ? filmNameToSlug(formState.title) : '');
  const parsedReleaseYear = Number.parseInt(formState.year.trim(), 10);
  const posterPreviewYear = Number.isFinite(parsedReleaseYear)
    ? String(parsedReleaseYear + 1)
    : String(new Date().getFullYear());
  const posterPreviewSrc = posterPreviewId
    ? `/images/${posterPreviewYear}_movie_${posterPreviewId}.jpg`
    : null;
  const showPosterPreview = Boolean(posterPreviewSrc) && !posterError;

  const movieCount = movies?.length ?? 0;
  const moviesList = movies ?? [];
  const filteredMovies = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return moviesList.filter((movie) => {
      return (
        !term ||
        movie.title.toLowerCase().includes(term) ||
        movie.slug.toLowerCase().includes(term)
      );
    });
  }, [moviesList, searchTerm]);

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

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
            <h2 className="oscars-font text-base sm:text-lg font-bold">Movie Metadata Editor</h2>
          </div>

          <div className="p-4 sm:p-6 space-y-6">
            {isLoading && <p className="text-sm text-gray-600">Loading movies...</p>}

            {isError && <p className="text-sm text-red-600">Failed to load movies.</p>}

            {!isLoading && movies && movies.length === 0 && (
              <p className="text-sm text-gray-600">No movies found.</p>
            )}

            {!isLoading && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch lg:items-start">
                <div
                  className="border border-gray-200 rounded-lg overflow-hidden flex flex-col"
                  style={
                    isDesktop && listPanelHeight ? { height: `${listPanelHeight}px` } : undefined
                  }
                >
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm font-semibold oscars-dark uppercase tracking-wide">
                        {movieCount} movies
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => navigate('/movies/metadata/new')}
                          className="px-3 py-2 text-xs font-semibold bg-slate-800 text-white rounded hover:bg-slate-700 active:bg-slate-900 transition-colors"
                        >
                          Add movie
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search title or slug"
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      />
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto max-h-[520px] lg:max-h-none">
                    {filteredMovies.map((movie) => {
                      const isSelected = movie.id === selectedMovieId;
                      return (
                        <button
                          key={movie.id}
                          onClick={() => setSelectedMovieId(movie.id)}
                          className={`w-full text-left px-4 py-3 border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                            isSelected ? 'bg-yellow-50/60' : 'bg-white'
                          }`}
                        >
                          <div>
                            <p className="font-semibold text-sm oscars-dark">
                              {movie.title} <span className="text-xs text-gray-500">({movie.year})</span>
                            </p>
                          </div>
                        </button>
                      );
                    })}
                    {filteredMovies.length === 0 && (
                      <div className="px-4 py-6 text-sm text-gray-500">
                        No movies match that filter.
                      </div>
                    )}
                  </div>
                </div>

                <div
                  ref={editPanelRef}
                  className="border border-gray-200 rounded-lg overflow-hidden lg:self-start"
                >
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <h3 className="text-sm font-semibold oscars-dark uppercase tracking-wide">
                        {selectedMovie ? `Edit ${selectedMovie.title}` : 'Select a movie'}
                      </h3>
                    </div>
                    <div className="p-4 space-y-6">
                      {selectedMovie ? (
                        <>
                          <div>
                            <div className="space-y-2">
                              <p className="text-xs font-semibold oscars-dark uppercase tracking-wide">
                                Poster
                              </p>
                              <div className="max-w-[320px] border border-gray-200 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                                {showPosterPreview ? (
                                  <img
                                    src={posterPreviewSrc ?? undefined}
                                    alt={`${formState.title || selectedMovie.title} poster`}
                                    className="max-w-full h-auto"
                                    loading="lazy"
                                    onError={() => setPosterError(true)}
                                  />
                                ) : (
                                  <div className="px-3 text-center text-xs text-gray-500">
                                    Poster not found
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="space-y-2">
                              <label className="text-xs font-semibold oscars-dark uppercase tracking-wide">
                                Title
                              </label>
                              <input
                                type="text"
                                value={formState.title}
                                onChange={(e) =>
                                  setFormState({ ...formState, title: e.target.value })
                                }
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
                                onChange={(e) =>
                                  setFormState({ ...formState, year: e.target.value })
                                }
                                className="w-full px-3 py-2.5 min-h-[44px] text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-semibold oscars-dark uppercase tracking-wide">
                                IMDb ID
                              </label>
                              <input
                                type="text"
                                placeholder="tt1234567"
                                value={formState.imdbId}
                                onChange={(e) =>
                                  setFormState({ ...formState, imdbId: e.target.value })
                                }
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
                                onChange={(e) =>
                                  setFormState({ ...formState, tmdbId: e.target.value })
                                }
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
                                onChange={(e) =>
                                  setFormState({ ...formState, wikidataId: e.target.value })
                                }
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
                                onChange={(e) =>
                                  setFormState({ ...formState, posterPath: e.target.value })
                                }
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
                                onChange={(e) =>
                                  setFormState({ ...formState, posterImageId: e.target.value })
                                }
                                className="w-full px-3 py-2.5 min-h-[44px] text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                              />
                            </div>
                          </div>

                          {formError && <p className="text-sm text-red-600">{formError}</p>}

                          {saveMessage && <p className="text-sm text-green-700">{saveMessage}</p>}

                          <div className="flex flex-wrap gap-3">
                            <button
                              onClick={handleSave}
                              disabled={!isDirty || updateMovie.isPending || deleteMovie.isPending}
                              className="px-4 py-2.5 min-h-[44px] bg-slate-800 text-white rounded-md hover:bg-slate-700 active:bg-slate-900 transition-colors text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {updateMovie.isPending ? 'Saving...' : 'Save metadata'}
                            </button>
                            <button
                              onClick={handleReset}
                              disabled={!isDirty || updateMovie.isPending || deleteMovie.isPending}
                              className="px-4 py-2.5 min-h-[44px] bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 active:bg-gray-300 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              Reset
                            </button>
                            <button
                              onClick={handleDelete}
                              disabled={deleteMovie.isPending || updateMovie.isPending}
                              className="px-4 py-2.5 min-h-[44px] bg-red-600 text-white rounded-md hover:bg-red-700 active:bg-red-800 transition-colors text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {deleteMovie.isPending ? 'Deleting...' : 'Delete movie'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-600">Select a movie to edit metadata.</p>
                      )}
                    </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
