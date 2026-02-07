import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import type { Category, Nominee } from '../types/pool';
import { getApiErrorMessage } from '../utils/apiErrors';

type MetadataFormState = {
  blurb_sentence_1: string;
  blurb_sentence_2: string;
  imdb_url: string;
  letterboxd_url: string;
};

const emptyForm: MetadataFormState = {
  blurb_sentence_1: '',
  blurb_sentence_2: '',
  imdb_url: '',
  letterboxd_url: '',
};

const normalizeValue = (value?: string | null) => (value ?? '').trim();

const isMetadataComplete = (nominee: Nominee) =>
  Boolean(nominee.blurb_sentence_1 && nominee.blurb_sentence_2 && nominee.imdb_url);

const formatNomineeLabel = (nominee: Nominee) => {
  if (nominee.film && nominee.film !== nominee.name) {
    return `${nominee.name} - ${nominee.film}`;
  }
  return nominee.name;
};

export default function NomineeMetadata() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [yearInput, setYearInput] = useState(new Date().getFullYear().toString());
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedNomineeId, setSelectedNomineeId] = useState<string | null>(null);
  const [formState, setFormState] = useState<MetadataFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== 'SUPERUSER') {
      navigate('/');
    }
  }, [user, navigate]);

  const {
    data: categories,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['nominees', year],
    queryFn: async () => {
      const response = await api.get(`/nominees/${year}`);
      return response.data as Category[];
    },
    enabled: !!year,
  });

  useEffect(() => {
    if (!categories || categories.length === 0) {
      setSelectedCategoryId(null);
      return;
    }
    if (!selectedCategoryId || !categories.some((category) => category.id === selectedCategoryId)) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  const selectedCategory = useMemo(() => {
    if (!categories || !selectedCategoryId) return null;
    return categories.find((category) => category.id === selectedCategoryId) || null;
  }, [categories, selectedCategoryId]);

  const nominees = useMemo(() => selectedCategory?.nominees ?? [], [selectedCategory]);

  useEffect(() => {
    if (!nominees.length) {
      setSelectedNomineeId(null);
      return;
    }
    if (!selectedNomineeId || !nominees.some((nominee) => nominee.id === selectedNomineeId)) {
      setSelectedNomineeId(nominees[0].id);
    }
  }, [nominees, selectedNomineeId]);

  const selectedNominee = useMemo(() => {
    if (!selectedNomineeId) return null;
    return nominees.find((nominee) => nominee.id === selectedNomineeId) || null;
  }, [nominees, selectedNomineeId]);

  useEffect(() => {
    if (!selectedNominee) {
      setFormState(emptyForm);
      setFormError(null);
      setSaveMessage(null);
      return;
    }

    setFormState({
      blurb_sentence_1: normalizeValue(selectedNominee.blurb_sentence_1),
      blurb_sentence_2: normalizeValue(selectedNominee.blurb_sentence_2),
      imdb_url: normalizeValue(selectedNominee.imdb_url),
      letterboxd_url: normalizeValue(selectedNominee.letterboxd_url),
    });
    setFormError(null);
    setSaveMessage(null);
  }, [selectedNominee]);

  const isDirty = useMemo(() => {
    if (!selectedNominee) return false;
    return (
      normalizeValue(formState.blurb_sentence_1) !==
        normalizeValue(selectedNominee.blurb_sentence_1) ||
      normalizeValue(formState.blurb_sentence_2) !==
        normalizeValue(selectedNominee.blurb_sentence_2) ||
      normalizeValue(formState.imdb_url) !== normalizeValue(selectedNominee.imdb_url) ||
      normalizeValue(formState.letterboxd_url) !== normalizeValue(selectedNominee.letterboxd_url)
    );
  }, [formState, selectedNominee]);

  const updateNominee = useMutation({
    mutationFn: async (payload: MetadataFormState & { nomineeId: string; categoryId: string }) => {
      const response = await api.patch(
        `/nominees/${year}/${payload.categoryId}/${payload.nomineeId}`,
        {
          blurb_sentence_1: payload.blurb_sentence_1,
          blurb_sentence_2: payload.blurb_sentence_2,
          imdb_url: payload.imdb_url,
          letterboxd_url: payload.letterboxd_url,
        },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nominees', year] });
      setSaveMessage('Saved nominee metadata.');
      setFormError(null);
    },
    onError: (error: unknown) => {
      setFormError(getApiErrorMessage(error) ?? 'Failed to save nominee metadata.');
    },
  });

  const handleSave = () => {
    if (!selectedNominee || !selectedCategoryId) return;
    setFormError(null);
    setSaveMessage(null);

    const missingFields = [];
    if (!formState.blurb_sentence_1.trim()) missingFields.push('Blurb sentence 1');
    if (!formState.blurb_sentence_2.trim()) missingFields.push('Blurb sentence 2');
    if (!formState.imdb_url.trim()) missingFields.push('IMDb URL');

    if (missingFields.length > 0) {
      setFormError(`Missing required fields: ${missingFields.join(', ')}`);
      return;
    }

    updateNominee.mutate({
      ...formState,
      nomineeId: selectedNominee.id,
      categoryId: selectedCategoryId,
    });
  };

  const handleReset = () => {
    if (!selectedNominee) return;
    setFormState({
      blurb_sentence_1: normalizeValue(selectedNominee.blurb_sentence_1),
      blurb_sentence_2: normalizeValue(selectedNominee.blurb_sentence_2),
      imdb_url: normalizeValue(selectedNominee.imdb_url),
      letterboxd_url: normalizeValue(selectedNominee.letterboxd_url),
    });
    setFormError(null);
    setSaveMessage(null);
  };

  if (user?.role !== 'SUPERUSER') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 oscars-red text-white py-3 px-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 text-white hover:text-yellow-300 hover:bg-white/10 active:bg-white/20 rounded-full transition-all touch-manipulation focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-slate-900"
            aria-label="Go back"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 flex-shrink-0 hover:opacity-90 transition-opacity touch-manipulation focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-slate-900 rounded"
            aria-label="Go to home"
          >
            <img src="/images/awardseason_logo_assets/awardseason_topnav_256.png" alt="Award Season" className="h-12 w-12 sm:h-14 sm:w-14 object-contain" />
            <span className="hidden sm:inline oscars-font text-lg sm:text-xl font-bold">
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
            <h2 className="oscars-font text-base sm:text-lg font-bold">Nominee Metadata Editor</h2>
          </div>

          <div className="p-4 sm:p-6 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="year-input"
                  className="text-xs font-semibold oscars-dark uppercase tracking-wide"
                >
                  Year
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="year-input"
                    type="text"
                    inputMode="numeric"
                    value={yearInput}
                    onChange={(e) => setYearInput(e.target.value)}
                    className="w-24 px-3 py-2.5 min-h-[44px] text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="2026"
                  />
                  <button
                    onClick={() => {
                      const nextYear = yearInput.trim();
                      if (nextYear) {
                        setYear(nextYear);
                        setSelectedCategoryId(null);
                        setSelectedNomineeId(null);
                      }
                    }}
                    className="px-4 py-2.5 min-h-[44px] bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 active:bg-gray-300 transition-colors text-sm font-medium"
                  >
                    Load
                  </button>
                </div>
              </div>

              <div className="flex-1">
                <label
                  htmlFor="category-select"
                  className="text-xs font-semibold oscars-dark uppercase tracking-wide"
                >
                  Category
                </label>
                <select
                  id="category-select"
                  value={selectedCategoryId || ''}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="mt-2 w-full px-3 py-2.5 min-h-[44px] text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  disabled={!categories || categories.length === 0}
                >
                  {categories?.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isLoading && <p className="text-sm text-gray-600">Loading nominees...</p>}

            {isError && <p className="text-sm text-red-600">Failed to load nominees for {year}.</p>}

            {!isLoading && categories && categories.length === 0 && (
              <p className="text-sm text-gray-600">No nominees found for {year}.</p>
            )}

            {!isLoading && selectedCategory && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h3 className="text-sm font-semibold oscars-dark uppercase tracking-wide">
                      Nominees in {selectedCategory.name}
                    </h3>
                  </div>
                  <div className="max-h-[520px] overflow-y-auto">
                    {nominees.map((nominee) => {
                      const isSelected = nominee.id === selectedNomineeId;
                      const isComplete = isMetadataComplete(nominee);
                      return (
                        <button
                          key={nominee.id}
                          onClick={() => setSelectedNomineeId(nominee.id)}
                          className={`w-full text-left px-4 py-3 border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                            isSelected ? 'bg-yellow-50/60' : 'bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-sm oscars-dark">
                                {formatNomineeLabel(nominee)}
                              </p>
                              <p className="text-xs text-gray-500">ID: {nominee.id}</p>
                            </div>
                            <span
                              className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded border ${
                                isComplete
                                  ? 'bg-green-100 text-green-700 border-green-200'
                                  : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                              }`}
                            >
                              {isComplete ? 'Complete' : 'Needs info'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h3 className="text-sm font-semibold oscars-dark uppercase tracking-wide">
                      {selectedNominee ? `Edit ${selectedNominee.name}` : 'Select a nominee'}
                    </h3>
                  </div>
                  <div className="p-4 space-y-4">
                    {selectedNominee ? (
                      <>
                        <div className="text-xs text-gray-500">
                          Category: {selectedCategory.name} | Nominee ID: {selectedNominee.id}
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-semibold oscars-dark uppercase tracking-wide">
                            Blurb sentence 1
                          </label>
                          <textarea
                            value={formState.blurb_sentence_1}
                            onChange={(e) =>
                              setFormState({ ...formState, blurb_sentence_1: e.target.value })
                            }
                            rows={3}
                            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-semibold oscars-dark uppercase tracking-wide">
                            Blurb sentence 2
                          </label>
                          <textarea
                            value={formState.blurb_sentence_2}
                            onChange={(e) =>
                              setFormState({ ...formState, blurb_sentence_2: e.target.value })
                            }
                            rows={3}
                            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-semibold oscars-dark uppercase tracking-wide">
                            IMDb URL
                          </label>
                          <input
                            type="url"
                            value={formState.imdb_url}
                            onChange={(e) =>
                              setFormState({ ...formState, imdb_url: e.target.value })
                            }
                            className="w-full px-3 py-2.5 min-h-[44px] text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          />
                          {formState.imdb_url && (
                            <a
                              href={formState.imdb_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Open IMDb link
                            </a>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-semibold oscars-dark uppercase tracking-wide">
                            Letterboxd URL (optional)
                          </label>
                          <input
                            type="url"
                            value={formState.letterboxd_url}
                            onChange={(e) =>
                              setFormState({ ...formState, letterboxd_url: e.target.value })
                            }
                            className="w-full px-3 py-2.5 min-h-[44px] text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          />
                          {formState.letterboxd_url && (
                            <a
                              href={formState.letterboxd_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Open Letterboxd link
                            </a>
                          )}
                        </div>

                        {formError && <p className="text-sm text-red-600">{formError}</p>}

                        {saveMessage && <p className="text-sm text-green-700">{saveMessage}</p>}

                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={handleSave}
                            disabled={!isDirty || updateNominee.isPending}
                            className="px-4 py-2.5 min-h-[44px] bg-slate-800 text-white rounded-md hover:bg-slate-700 active:bg-slate-900 transition-colors text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {updateNominee.isPending ? 'Saving...' : 'Save metadata'}
                          </button>
                          <button
                            onClick={handleReset}
                            disabled={!isDirty || updateNominee.isPending}
                            className="px-4 py-2.5 min-h-[44px] bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 active:bg-gray-300 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            Reset
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-gray-600">Select a nominee to edit metadata.</p>
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
