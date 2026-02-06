import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Category, Nominee } from '../types/pool';
import { getNomineeImage } from '../utils/nomineeImages';
// Helper to get nominee info from nominee object
function getNomineeInfoFromData(
  nominee: Nominee,
  category: Category,
): {
  category: string;
  nominee: string;
  blurb_sentence_1: string;
  blurb_sentence_2: string;
  imdb_url: string;
  letterboxd_url?: string;
} | null {
  // Check if nominee has the required fields
  if (nominee.blurb_sentence_1 && nominee.blurb_sentence_2 && nominee.imdb_url) {
    return {
      category: category.name,
      nominee: nominee.name,
      blurb_sentence_1: nominee.blurb_sentence_1,
      blurb_sentence_2: nominee.blurb_sentence_2,
      imdb_url: nominee.imdb_url,
      letterboxd_url: nominee.letterboxd_url,
    };
  }
  return null;
}

// Category grouping configuration (3 types, single select)
const categoryGroups = [
  {
    name: 'Major',
    categoryIds: [
      'best-picture',
      'directing',
      'writing-original',
      'writing-adapted',
      'actor-leading',
      'actress-leading',
      'actor-supporting',
      'actress-supporting',
    ],
  },
  {
    name: 'Technical',
    categoryIds: [
      'cinematography',
      'film-editing',
      'sound',
      'visual-effects',
      'production-design',
      'costume-design',
      'makeup-hairstyling',
      'music-score',
      'music-song',
    ],
  },
  {
    name: 'Film Categories',
    categoryIds: [
      'international-feature',
      'animated-feature',
      'documentary-feature',
      'animated-short',
      'documentary-short',
      'live-action-short',
      'casting',
    ],
  },
];

function calculateScoringPreview(
  odds: number | null,
  basePoints: number,
  multiplierEnabled: boolean,
  multiplierFormula: string,
): { basePoints: number; multiplier: number; totalPoints: number } {
  if (!odds || odds <= 0 || odds > 100) {
    return { basePoints, multiplier: 1.0, totalPoints: basePoints };
  }

  const oddsDecimal = odds / 100;
  let multiplier = 1.0;

  if (multiplierEnabled) {
    switch (multiplierFormula) {
      case 'inverse':
        multiplier = Math.max(1.0, 100 / odds);
        break;
      case 'sqrt':
        multiplier = 1 + Math.sqrt(1 - oddsDecimal);
        break;
      case 'log':
        multiplier = 1 + Math.log(100 / odds);
        break;
      default: // 'linear'
        multiplier = 2 - oddsDecimal;
    }
  }

  return {
    basePoints,
    multiplier,
    totalPoints: basePoints * multiplier,
  };
}

// Helper function to filter odds history to one point per day
function filterOddsHistoryByDay(
  history: Array<{ oddsPercentage: number; snapshotTime: string }>,
): Array<{ oddsPercentage: number; snapshotTime: string }> {
  const filteredHistory: Array<{ oddsPercentage: number; snapshotTime: string }> = [];
  const seenDays = new Set<string>();

  for (const item of history) {
    const date = new Date(item.snapshotTime);
    const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    if (!seenDays.has(dayKey)) {
      seenDays.add(dayKey);
      filteredHistory.push(item);
    }
  }

  // Always include the last point (current)
  if (
    filteredHistory.length > 0 &&
    filteredHistory[filteredHistory.length - 1].snapshotTime !==
      history[history.length - 1].snapshotTime
  ) {
    filteredHistory.push(history[history.length - 1]);
  }

  return filteredHistory;
}

// Helper function to generate smooth bezier curve path
function generateSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return '';
  if (points.length === 2) return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;

  let path = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return path;
}

// Helper function to convert hex color to rgba
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Helper function to darken a color for dark mode backgrounds
function darkenColor(hex: string, percent: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Darken by reducing RGB values
  const newR = Math.round(r * (1 - percent));
  const newG = Math.round(g * (1 - percent));
  const newB = Math.round(b * (1 - percent));

  return `rgb(${newR}, ${newG}, ${newB})`;
}

// Helper function to get brightness of a hex color
function getBrightness(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

// Helper function to get the lightest color from image colors
function getLightestColor(imageColors: {
  primary: string;
  secondary: string;
  accent: string;
}): string {
  const colors = [
    { color: imageColors.primary, brightness: getBrightness(imageColors.primary) },
    { color: imageColors.secondary, brightness: getBrightness(imageColors.secondary) },
    { color: imageColors.accent, brightness: getBrightness(imageColors.accent) },
  ];
  colors.sort((a, b) => b.brightness - a.brightness);
  return colors[0]?.color || imageColors.primary;
}

// Helper function to get text color based on mode
function getTextColorForMode(hex: string, isDarkMode: boolean): string {
  if (isDarkMode) {
    return getTextColorForDarkBg(hex);
  } else {
    // For light mode, use dark text
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;

    // If the color is very dark, use a lighter version for contrast
    if (brightness < 50) {
      return '#1f2937'; // Dark gray for readability
    }
    return '#1f2937'; // Dark text for light backgrounds
  }
}

// Helper function to get a readable text color for dark backgrounds
function getTextColorForDarkBg(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  // If the darkened color is still bright, use a lighter version of the original color
  // Otherwise, use white or a very light tint
  if (brightness > 100) {
    // Use a lighter, more saturated version
    return hex;
  }
  return '#ffffff';
}

// Helper function to extract dominant colors from an image
function extractImageColors(
  imageSrc: string,
): Promise<{ primary: string; secondary: string; accent: string; averageBrightness: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    // Try with CORS first, but handle same-origin images
    try {
      const url = new URL(imageSrc, window.location.href);
      if (url.origin !== window.location.origin) {
        img.crossOrigin = 'anonymous';
      }
    } catch {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Calculate average brightness of the image for light/dark mode detection
        // Sample a grid across the image for accurate brightness reading
        const gridSize = 20;
        const stepX = Math.max(1, Math.floor(img.width / gridSize));
        const stepY = Math.max(1, Math.floor(img.height / gridSize));
        let totalBrightness = 0;
        let sampleCount = 0;

        for (let y = 0; y < img.height; y += stepY) {
          for (let x = 0; x < img.width; x += stepX) {
            const imageData = ctx.getImageData(x, y, 1, 1);
            const [r, g, b] = imageData.data;
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            totalBrightness += brightness;
            sampleCount++;
          }
        }
        const averageBrightness = totalBrightness / sampleCount;

        // Sample more colors from different regions for better color extraction
        const samplePoints = [
          { x: img.width * 0.1, y: img.height * 0.1 },
          { x: img.width * 0.3, y: img.height * 0.2 },
          { x: img.width * 0.5, y: img.height * 0.15 },
          { x: img.width * 0.7, y: img.height * 0.25 },
          { x: img.width * 0.9, y: img.height * 0.3 },
          { x: img.width * 0.2, y: img.height * 0.5 },
          { x: img.width * 0.5, y: img.height * 0.5 },
          { x: img.width * 0.8, y: img.height * 0.5 },
          { x: img.width * 0.1, y: img.height * 0.7 },
          { x: img.width * 0.4, y: img.height * 0.8 },
          { x: img.width * 0.6, y: img.height * 0.75 },
          { x: img.width * 0.9, y: img.height * 0.85 },
        ];

        const colors: Array<{
          r: number;
          g: number;
          b: number;
          brightness: number;
          saturation: number;
          vibrancy: number;
        }> = [];

        for (const point of samplePoints) {
          const imageData = ctx.getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1);
          const [r, g, b] = imageData.data;
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;
          // Calculate vibrancy - prefer colors that are both saturated and not too dark/light
          const vibrancy =
            saturation * (brightness > 50 && brightness < 200 ? 1.2 : 1) * (brightness / 255);
          colors.push({ r, g, b, brightness, saturation, vibrancy });
        }

        // Filter out very dark colors, allow light colors but cap them to prevent too bright
        // Allow brightness up to 240, but prefer colors in the 40-200 range
        const vibrantColors = colors
          .filter((c) => {
            if (c.brightness < 30 || c.saturation < 0.15) return false;
            // Allow light colors but cap them - if brightness > 200, reduce preference
            if (c.brightness > 240) return false;
            return true;
          })
          .map((c) => {
            // If color is too light (> 200), reduce its vibrancy score to prefer medium colors
            if (c.brightness > 200) {
              return { ...c, vibrancy: c.vibrancy * 0.7 };
            }
            return c;
          });

        if (vibrantColors.length === 0) {
          // Fallback to all colors if no vibrant ones found
          vibrantColors.push(...colors);
        }

        vibrantColors.sort((a, b) => b.vibrancy - a.vibrancy);

        // Get primary (most vibrant), secondary (second most vibrant), and accent (brightest of top colors)
        const primary = vibrantColors[0] || colors[0];
        const secondary =
          vibrantColors[Math.min(1, vibrantColors.length - 1)] ||
          colors[Math.floor(colors.length / 2)];
        const accent =
          vibrantColors.slice(0, 3).sort((a, b) => b.brightness - a.brightness)[0] ||
          vibrantColors[0] ||
          colors[0];

        const toHex = (r: number, g: number, b: number) => {
          return `#${[r, g, b]
            .map((x) => {
              const hex = x.toString(16);
              return hex.length === 1 ? '0' + hex : hex;
            })
            .join('')}`;
        };

        resolve({
          primary: toHex(primary.r, primary.g, primary.b),
          secondary: toHex(secondary.r, secondary.g, secondary.b),
          accent: toHex(accent.r, accent.g, accent.b),
          averageBrightness: averageBrightness,
        });
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageSrc;
  });
}

export default function PoolEdit() {
  const { poolId } = useParams<{ poolId: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [selectedCategoryType, setSelectedCategoryType] = useState<string | null>(
    categoryGroups[0]?.name || null,
  );
  const [showStickySummary, setShowStickySummary] = useState(false);

  const submissionHeaderRef = useRef<HTMLDivElement | null>(null);
  const stickySummaryRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [stickySummaryHeight, setStickySummaryHeight] = useState(52);
  const [headerHeight, setHeaderHeight] = useState(44);
  const [pendingSelection, setPendingSelection] = useState<{
    categoryId: string;
    categoryName: string;
    nomineeId: string;
    nomineeName: string;
    oldNomineeId: string;
    oldNomineeName: string;
    oldOdds: number | null;
    currentOdds: number | null;
  } | null>(null);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(() => {
    // Default to open on desktop (screen width >= 640px)
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 640;
    }
    return false;
  });
  const [selectedNomineeInfo, setSelectedNomineeInfo] = useState<{
    nominee: Nominee;
    category: Category;
    info: {
      category: string;
      nominee: string;
      blurb_sentence_1: string;
      blurb_sentence_2: string;
      imdb_url: string;
      letterboxd_url?: string;
    };
  } | null>(null);
  const [imageError, setImageError] = useState(false);
  const [imageColors, setImageColors] = useState<{
    primary: string;
    secondary: string;
    accent: string;
    averageBrightness: number;
  } | null>(null);
  const [nomineeImageColors, setNomineeImageColors] = useState<
    Map<string, { primary: string; secondary: string; accent: string; averageBrightness: number }>
  >(new Map());

  // Check if viewing someone else's submission
  const viewUserId = searchParams.get('userId');
  const isViewingOtherSubmission = Boolean(viewUserId && viewUserId !== user?.id);
  const targetUserId = isViewingOtherSubmission ? viewUserId : user?.id;

  const { data: pool, isLoading: poolLoading } = useQuery({
    queryKey: ['pool', poolId],
    queryFn: async () => {
      const response = await api.get(`/pools/${poolId}`);
      return response.data;
    },
    enabled: !!poolId,
  });

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['nominees', pool?.year],
    queryFn: async () => {
      const response = await api.get(`/nominees/${pool?.year}`);
      return response.data as Category[];
    },
    enabled: !!pool?.year,
  });

  const { data: predictions } = useQuery({
    queryKey: ['predictions', poolId, targetUserId],
    queryFn: async () => {
      if (isViewingOtherSubmission && targetUserId) {
        // Fetch specific user's predictions (read-only view)
        const response = await api.get(`/predictions/pool/${poolId}/all`);
        const allPredictions = response.data;
        // Filter by userId (predictions from /all include user.id in user object)
        return allPredictions.filter(
          (p: any) => p.userId === targetUserId || p.user?.id === targetUserId,
        );
      } else {
        // Fetch current user's predictions (editable)
        const response = await api.get(`/predictions/pool/${poolId}`);
        return response.data;
      }
    },
    enabled: !!poolId && !!targetUserId,
  });

  const { data: poolSettings } = useQuery({
    queryKey: ['poolSettings', poolId],
    queryFn: async () => {
      const response = await api.get(`/settings/${poolId}`);
      return response.data;
    },
    enabled: !!poolId,
  });

  // Fetch global winners for the pool's year (used for all pools)
  const { data: actualWinners } = useQuery({
    queryKey: ['globalWinners', pool?.year],
    queryFn: async () => {
      if (!pool?.year) return [];
      const response = await api.get(`/winners/global/${pool.year}`);
      return response.data;
    },
    enabled: !!poolId && !!pool?.year,
  });

  const { data: userMembership } = useQuery({
    queryKey: ['userMembership', poolId],
    queryFn: async () => {
      if (!poolId || !user?.id) return null;
      try {
        const response = await api.get(`/pools/${poolId}/members`);
        const members = response.data;
        return members.find((m: any) => m.userId === user.id) || null;
      } catch (error) {
        if (pool?.members && Array.isArray(pool.members) && pool.members.length > 0) {
          return pool.members[0];
        }
        return null;
      }
    },
    enabled: !!poolId && !!user?.id,
  });

  // Fetch odds history for the selected nominee (from Jan 25 onwards)
  const { data: oddsHistory } = useQuery({
    queryKey: [
      'oddsHistory',
      selectedNomineeInfo?.category.id,
      selectedNomineeInfo?.nominee.id,
      pool?.year,
    ],
    queryFn: async () => {
      if (!selectedNomineeInfo || !pool?.year) return null;
      const fullCategoryId = `${selectedNomineeInfo.category.id}-${pool.year}`;
      try {
        const response = await api.get(
          `/odds/${fullCategoryId}/${selectedNomineeInfo.nominee.id}/history`,
        );
        const history = response.data.history || [];
        // Filter to only show data from Jan 25, 2026 onwards
        const cutoffDate = new Date('2026-01-25T00:00:00Z');
        return history.filter((h: any) => new Date(h.snapshotTime) >= cutoffDate);
      } catch (error) {
        console.error('Error fetching odds history:', error);
        return [];
      }
    },
    enabled: !!selectedNomineeInfo && !!pool?.year,
  });

  // Fetch odds for all categories at once
  const { data: allCategoryOdds, isLoading: oddsLoading } = useQuery({
    queryKey: ['odds', 'all', pool?.year],
    queryFn: async () => {
      if (!pool?.year || !categories) return {};
      const oddsMap: Record<string, Array<{ nomineeId: string; odds: number | null }>> = {};

      // Fetch odds for all categories in parallel
      const oddsPromises = categories.map(async (category) => {
        const categoryId = `${category.id}-${pool.year}`;
        try {
          const response = await api.get(`/odds/category/${categoryId}`);
          return {
            categoryId: category.id,
            nominees: (response.data.nominees || []) as Array<{
              nomineeId: string;
              odds: number | null;
            }>,
          };
        } catch (error: any) {
          console.error(`Error fetching odds for ${categoryId}:`, error);
          return {
            categoryId: category.id,
            nominees: [] as Array<{ nomineeId: string; odds: number | null }>,
          };
        }
      });

      const results = await Promise.all(oddsPromises);
      results.forEach(({ categoryId, nominees }) => {
        oddsMap[categoryId] = nominees;
      });

      return oddsMap;
    },
    enabled: !!pool?.year && !!categories && categories.length > 0,
    staleTime: 1000 * 60 * 60,
  });

  // Helper to get odds for a specific category
  const getCategoryOdds = (categoryId: string) => {
    return allCategoryOdds?.[categoryId] || [];
  };

  // Measure header height
  useEffect(() => {
    const measureHeader = () => {
      if (headerRef.current) {
        const height = headerRef.current.offsetHeight;
        setHeaderHeight(height);
      }
    };

    measureHeader();
    window.addEventListener('resize', measureHeader);

    let resizeObserver: ResizeObserver | null = null;
    if (headerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        measureHeader();
      });
      resizeObserver.observe(headerRef.current);
    }

    return () => {
      window.removeEventListener('resize', measureHeader);
      if (resizeObserver && headerRef.current) {
        resizeObserver.unobserve(headerRef.current);
      }
    };
  }, []);

  // Detect when to show sticky summary and measure its height
  useEffect(() => {
    const handleScroll = () => {
      if (!submissionHeaderRef.current) return;

      const headerRect = submissionHeaderRef.current.getBoundingClientRect();
      // Show sticky summary when the full header is scrolled past
      setShowStickySummary(headerRect.bottom < 0);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial state

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Measure sticky summary height whenever it becomes visible or content changes
  useEffect(() => {
    if (!showStickySummary || !stickySummaryRef.current) return;

    const measureStickySummary = () => {
      if (stickySummaryRef.current) {
        // Use getBoundingClientRect for more accurate measurement including borders
        const rect = stickySummaryRef.current.getBoundingClientRect();
        const height = rect.height;
        setStickySummaryHeight(height);
      }
    };

    // Measure immediately when it appears
    measureStickySummary();

    // Use requestAnimationFrame to ensure DOM has fully rendered
    requestAnimationFrame(() => {
      measureStickySummary();
    });

    // Also measure on resize
    window.addEventListener('resize', measureStickySummary);

    // Use ResizeObserver to measure height when content changes
    const resizeObserver = new ResizeObserver(() => {
      measureStickySummary();
    });
    resizeObserver.observe(stickySummaryRef.current);

    return () => {
      window.removeEventListener('resize', measureStickySummary);
      resizeObserver.disconnect();
    };
  }, [showStickySummary]);

  // Scroll to top when tab changes
  useEffect(() => {
    if (selectedCategoryType) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [selectedCategoryType]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!selectedNomineeInfo) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeNomineeModal();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [selectedNomineeInfo]);

  const createPrediction = useMutation({
    mutationFn: async ({ categoryId, nomineeId }: { categoryId: string; nomineeId: string }) => {
      const response = await api.post('/predictions', {
        poolId,
        categoryId,
        nomineeId,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predictions', poolId] });
    },
  });

  const deletePrediction = useMutation({
    mutationFn: async ({ categoryId }: { categoryId: string }) => {
      const response = await api.delete('/predictions', {
        data: {
          poolId,
          categoryId,
        },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predictions', poolId] });
    },
  });

  const getPredictionForCategory = (categoryId: string) => {
    return predictions?.find((p: any) => p.categoryId === categoryId);
  };

  const handleNomineeSelect = (categoryId: string, nomineeId: string) => {
    // Don't allow editing if viewing someone else's submission
    if (isViewingOtherSubmission) {
      return;
    }

    // Don't allow editing if a winner has been announced for this category
    const winner = actualWinners?.find((w: any) => {
      const normalizedWinnerCategoryId = w.categoryId?.replace(/-\d{4}$/, '') || w.categoryId;
      return normalizedWinnerCategoryId === categoryId;
    });
    if (winner) {
      return;
    }

    const existingPrediction = getPredictionForCategory(categoryId);

    // If clicking the same nominee, deselect it
    if (existingPrediction && existingPrediction.nomineeId === nomineeId) {
      deletePrediction.mutate({ categoryId });
      return;
    }

    // If changing from an existing selection, check if odds have changed
    if (existingPrediction && existingPrediction.nomineeId !== nomineeId) {
      const oldOdds = existingPrediction.oddsPercentage;

      // Only show warning if the old selection had odds stored AND they differ from current odds
      if (oldOdds !== null && oldOdds !== undefined) {
        const categoryOddsForThis = getCategoryOdds(categoryId);
        // Get current odds for the currently selected nominee (the one being changed from)
        const currentOddsForOldNominee =
          categoryOddsForThis.find((o: any) => o.nomineeId === existingPrediction.nomineeId)
            ?.odds || null;

        // Only show warning if odds have changed for the current selection
        if (
          currentOddsForOldNominee !== null &&
          currentOddsForOldNominee !== undefined &&
          Math.abs(currentOddsForOldNominee - oldOdds) > 0.01
        ) {
          const category = categories?.find((c: Category) => c.id === categoryId);
          const oldNominee = category?.nominees.find(
            (n: Nominee) => n.id === existingPrediction.nomineeId,
          );
          const newNominee = category?.nominees.find((n: Nominee) => n.id === nomineeId);
          const currentOddsForNewNominee =
            categoryOddsForThis.find((o: any) => o.nomineeId === nomineeId)?.odds || null;

          setPendingSelection({
            categoryId,
            categoryName: category?.name || categoryId,
            nomineeId,
            nomineeName: newNominee?.name || nomineeId,
            oldNomineeId: existingPrediction.nomineeId,
            oldNomineeName: oldNominee?.name || existingPrediction.nomineeId,
            oldOdds,
            currentOdds: currentOddsForNewNominee,
          });
          return;
        }
      }
    }

    // Proceed with selection (no warning needed)
    createPrediction.mutate({ categoryId, nomineeId });
  };

  const confirmSelectionChange = () => {
    if (pendingSelection) {
      createPrediction.mutate({
        categoryId: pendingSelection.categoryId,
        nomineeId: pendingSelection.nomineeId,
      });
      setPendingSelection(null);
    }
  };

  const cancelSelectionChange = () => {
    setPendingSelection(null);
  };

  const handleNomineeImageClick = (e: React.MouseEvent, nominee: Nominee, category: Category) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent triggering nominee selection
    const info = getNomineeInfoFromData(nominee, category);
    if (info) {
      setImageError(false);
      setSelectedNomineeInfo({ nominee, category, info });
    }
  };

  const closeNomineeModal = () => {
    setSelectedNomineeInfo(null);
    setImageError(false);
    setImageColors(null);
  };

  // Get submission info for the target user (from submissions list)
  const { data: submissions } = useQuery({
    queryKey: ['submissions', poolId],
    queryFn: async () => {
      const response = await api.get(`/pools/${poolId}/submissions`);
      return response.data;
    },
    enabled: Boolean(poolId && isViewingOtherSubmission),
  });

  if (poolLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div>Loading pool...</div>
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div>Pool not found</div>
      </div>
    );
  }

  const targetSubmission = submissions?.find((s: any) => s.userId === targetUserId);

  const defaultName = 'My Ballot';
  const submissionName = isViewingOtherSubmission
    ? targetSubmission?.submissionName || 'Ballot'
    : userMembership?.submissionName || defaultName;

  return (
    <div className="min-h-screen bg-gray-50">
      <header ref={headerRef} className="sticky top-0 oscars-red text-white py-3 px-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Back Button - Left side */}
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

          {/* Logo - Right of back button */}
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

          {/* Spacer */}
          <div className="flex-1" />

          {/* Logout Button */}
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
        {/* Submission Header with Summary */}
        <div
          ref={submissionHeaderRef}
          className="bg-white rounded-lg shadow mb-6 overflow-hidden"
          id="submission-header"
        >
          {/* Submission Name Header */}
          <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
            {isViewingOtherSubmission ? (
              <h2 className="oscars-font text-base sm:text-lg font-bold whitespace-normal break-words">
                {submissionName}
              </h2>
            ) : (
              <SubmissionNameEditor
                poolId={poolId!}
                currentName={userMembership?.submissionName || null}
                defaultName={defaultName}
                onUpdate={() => {
                  queryClient.invalidateQueries({ queryKey: ['userMembership', poolId] });
                }}
              />
            )}
          </div>

          {/* Summary Stats Cards */}
          {categories &&
            predictions &&
            (() => {
              const categoryPoints = (poolSettings?.categoryPoints as Record<string, number>) || {};
              const multiplierEnabled = poolSettings?.oddsMultiplierEnabled ?? true;
              const multiplierFormula = poolSettings?.oddsMultiplierFormula || 'log';
              let totalPossiblePoints = 0;
              let totalEarnedPoints = 0;
              let correctCount = 0;
              let incorrectCount = 0;

              predictions.forEach((prediction: any) => {
                const category = categories.find((c: Category) => c.id === prediction.categoryId);
                if (category) {
                  const basePoints =
                    categoryPoints[prediction.categoryId] || category.defaultPoints;
                  const nomineeOdds = prediction.oddsPercentage || null;
                  const scoring = calculateScoringPreview(
                    nomineeOdds,
                    basePoints,
                    multiplierEnabled,
                    multiplierFormula,
                  );
                  totalPossiblePoints += scoring.totalPoints;

                  // Check if this prediction is correct (matches actual winner)
                  if (actualWinners) {
                    const winner = actualWinners.find(
                      (w: any) => w.categoryId === prediction.categoryId,
                    );
                    if (winner) {
                      if (winner.nomineeId === prediction.nomineeId) {
                        totalEarnedPoints += scoring.totalPoints;
                        correctCount++;
                      } else {
                        incorrectCount++;
                      }
                    }
                  }
                }
              });

              const isComplete = predictions.length === categories.length;
              const hasWinners = actualWinners && actualWinners.length > 0;
              const totalWithWinners = correctCount + incorrectCount;
              const percentCorrect =
                totalWithWinners > 0 ? Math.round((correctCount / totalWithWinners) * 100) : 0;

              return (
                <div className="px-4 sm:px-6 py-3 border-b border-gray-200">
                  <div
                    className={`grid ${hasWinners ? 'grid-cols-4' : 'grid-cols-3'} gap-2 md:gap-4`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">
                        Categories
                      </span>
                      <span
                        className={`font-semibold text-sm ${
                          isComplete ? 'text-green-600' : 'text-yellow-600'
                        }`}
                      >
                        {predictions.length}/{categories.length}
                        {isComplete && <span className="ml-1 hidden md:inline">✓</span>}
                      </span>
                    </div>
                    {hasWinners && totalWithWinners > 0 && (
                      <div className="flex flex-col items-center text-center">
                        <span
                          className={`text-xs uppercase tracking-wide ${
                            percentCorrect >= 70
                              ? 'text-green-700'
                              : percentCorrect >= 50
                                ? 'text-yellow-700'
                                : 'text-red-700'
                          }`}
                        >
                          Percent Correct
                        </span>
                        <span
                          className={`font-semibold text-sm ${
                            percentCorrect >= 70
                              ? 'text-green-700'
                              : percentCorrect >= 50
                                ? 'text-yellow-700'
                                : 'text-red-700'
                          }`}
                        >
                          {percentCorrect}%
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col items-center text-center">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">
                        Possible
                      </span>
                      <span className="font-semibold text-sm oscars-gold">
                        {totalPossiblePoints.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Earned</span>
                      <span
                        className={`font-semibold text-sm ${
                          hasWinners && totalEarnedPoints > 0 ? 'text-green-700' : 'oscars-dark'
                        }`}
                      >
                        {totalEarnedPoints.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

          {/* How It Works - Collapsible */}
          {categories &&
            predictions &&
            (() => {
              const multiplierEnabled = poolSettings?.oddsMultiplierEnabled === true;

              return (
                <div className="border-t border-gray-200 bg-gray-50">
                  <div className="px-4 sm:px-6 py-3">
                    <h3 className="oscars-font text-sm font-semibold oscars-dark mb-2">
                      How It Works
                    </h3>
                    <div className="relative">
                      <div
                        className={`text-xs text-gray-600 space-y-3 ${!isHowItWorksOpen ? 'line-clamp-2' : ''}`}
                      >
                        <p>
                          Pick who you think is going to win in each category. You can update your
                          predictions as many times as you want until 24 hours before the ceremony.
                        </p>
                        <div>
                          <p className="font-medium text-gray-700 mb-1">Scoring</p>
                          <p>
                            Each category is assigned a certain point value. You earn those points
                            for each correct prediction
                            {multiplierEnabled && (
                              <span>
                                . When the multiplier is enabled, picking underdogs earns you more
                                points.
                              </span>
                            )}
                          </p>
                        </div>
                        {multiplierEnabled && (
                          <div>
                            <p className="font-medium text-gray-700 mb-1">How Odds Work</p>
                            <ul className="space-y-1.5 list-disc list-inside">
                              <li>
                                <strong className="text-gray-700">
                                  Odds are saved when you select:
                                </strong>{' '}
                                The current odds percentage is saved with your pick and used to
                                calculate your potential points.
                              </li>
                              <li>
                                <strong className="text-gray-700">Odds change over time:</strong>{' '}
                                Betting odds update regularly as the ceremony approaches. Your
                                scoring automatically uses the best odds available.
                              </li>
                              <li>
                                <strong className="text-gray-700">
                                  Lower odds mean more points:
                                </strong>{' '}
                                Lower percentage odds (worse chances) result in a higher multiplier
                                and more points if you're correct.
                              </li>
                            </ul>
                          </div>
                        )}
                      </div>
                      {!isHowItWorksOpen && (
                        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none"></div>
                      )}
                    </div>
                    <button
                      onClick={() => setIsHowItWorksOpen(!isHowItWorksOpen)}
                      className="mt-2 flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 transition-colors mx-auto"
                    >
                      <span>{isHowItWorksOpen ? 'Show less' : 'Show more'}</span>
                      <svg
                        className={`w-4 h-4 transition-transform ${isHowItWorksOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })()}

          {/* Action Buttons */}
          <div className="px-4 sm:px-6 py-3 border-t border-gray-200">
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {!isViewingOtherSubmission && (
                  <CopyFromOtherPoolButton
                    poolId={poolId!}
                    poolYear={pool?.year}
                    onCopy={() => {
                      queryClient.invalidateQueries({ queryKey: ['predictions', poolId] });
                    }}
                  />
                )}
                {!isViewingOtherSubmission && predictions && predictions.length > 0 && (
                  <ClearAllButton
                    poolId={poolId!}
                    actualWinners={actualWinners}
                    onClear={() => {
                      queryClient.invalidateQueries({ queryKey: ['predictions', poolId] });
                    }}
                  />
                )}
              </div>
              <button
                onClick={() => navigate(`/pool/${poolId}`)}
                className="px-6 py-2.5 min-h-[44px] oscars-gold-bg text-white rounded hover:opacity-90 active:opacity-80 transition-opacity text-sm font-medium touch-manipulation w-full sm:w-auto"
              >
                {isViewingOtherSubmission ? 'Back to Pool' : 'Update'}
              </button>
            </div>
          </div>
        </div>

        {/* Collapsed Sticky Submission Summary */}
        {categories && predictions && showStickySummary && (
          <div
            ref={stickySummaryRef}
            className="sticky bg-white border-b border-gray-200 z-30 py-3"
            style={{ top: `${headerHeight}px` }}
          >
            <div className="flex items-start justify-between px-4 md:px-6 gap-3">
              <span className="oscars-font font-bold oscars-dark text-sm md:text-base whitespace-normal break-words flex-1 min-w-0">
                {submissionName}
              </span>
              <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                {/* Desktop: Show full stats */}
                <div className="hidden md:flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">Categories:</span>
                    <span
                      className={`font-semibold ${
                        predictions.length === categories.length
                          ? 'text-green-600'
                          : 'text-yellow-600'
                      }`}
                    >
                      {predictions.length}/{categories.length}
                    </span>
                  </div>
                  {(() => {
                    const categoryPoints =
                      (poolSettings?.categoryPoints as Record<string, number>) || {};
                    const multiplierEnabled = poolSettings?.oddsMultiplierEnabled ?? true;
                    const multiplierFormula = poolSettings?.oddsMultiplierFormula || 'log';
                    let totalPossiblePoints = 0;
                    let totalEarnedPoints = 0;
                    let correctCount = 0;
                    let incorrectCount = 0;

                    predictions.forEach((prediction: any) => {
                      const category = categories.find(
                        (c: Category) => c.id === prediction.categoryId,
                      );
                      if (category) {
                        const basePoints =
                          categoryPoints[prediction.categoryId] || category.defaultPoints;
                        const nomineeOdds = prediction.oddsPercentage || null;
                        const scoring = calculateScoringPreview(
                          nomineeOdds,
                          basePoints,
                          multiplierEnabled,
                          multiplierFormula,
                        );
                        totalPossiblePoints += scoring.totalPoints;

                        // Check if this prediction is correct (matches actual winner)
                        if (actualWinners) {
                          const winner = actualWinners.find(
                            (w: any) => w.categoryId === prediction.categoryId,
                          );
                          if (winner) {
                            if (winner.nomineeId === prediction.nomineeId) {
                              totalEarnedPoints += scoring.totalPoints;
                              correctCount++;
                            } else {
                              incorrectCount++;
                            }
                          }
                        }
                      }
                    });

                    const hasWinners = actualWinners && actualWinners.length > 0;
                    const totalWithWinners = correctCount + incorrectCount;
                    const percentCorrect =
                      totalWithWinners > 0
                        ? Math.round((correctCount / totalWithWinners) * 100)
                        : 0;

                    return (
                      <div className="flex items-center gap-4">
                        {hasWinners && totalWithWinners > 0 && (
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-semibold ${
                                percentCorrect >= 70
                                  ? 'text-green-700'
                                  : percentCorrect >= 50
                                    ? 'text-yellow-700'
                                    : 'text-red-700'
                              }`}
                            >
                              {percentCorrect}% Correct
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Possible:</span>
                          <span className="oscars-gold font-bold">
                            {totalPossiblePoints.toFixed(1)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Earned:</span>
                          <span
                            className={`font-bold ${
                              hasWinners && totalEarnedPoints > 0 ? 'text-green-700' : 'oscars-dark'
                            }`}
                          >
                            {totalEarnedPoints.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <button
                  onClick={() => navigate(`/pool/${poolId}`)}
                  className="px-4 py-2.5 oscars-gold-bg text-white rounded hover:opacity-90 text-sm font-semibold min-h-[44px] flex items-center whitespace-nowrap"
                >
                  {isViewingOtherSubmission ? 'Back' : 'Update'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Categories Navigation */}
        {categoriesLoading && (
          <div className="mb-6">
            <p className="text-gray-600">Loading categories...</p>
          </div>
        )}
        {categories && categories.length > 0 && (
          <div>
            {isViewingOtherSubmission ? (
              /* Summary View - Show all picks without tabs, using same order as edit view */
              <div className="bg-white rounded-lg shadow p-3 md:p-6">
                {!predictions || predictions.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-lg mb-2">No picks yet</p>
                    <p className="text-gray-400 text-sm">This ballot hasn't been filled out yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Use same category ordering as edit view - iterate through categoryGroups */}
                    {categoryGroups
                      .flatMap((group) =>
                        group.categoryIds
                          .map((categoryId) => {
                            const category = categories.find((cat) => cat.id === categoryId);
                            if (!category) return null;
                            const prediction = getPredictionForCategory(category.id);
                            if (!prediction) return null; // Only show categories with picks
                            return { category, prediction };
                          })
                          .filter(
                            (item): item is { category: any; prediction: any } => item !== null,
                          ),
                      )
                      .map(({ category, prediction }) => {
                        const categoryPoints =
                          (poolSettings?.categoryPoints as Record<string, number>) || {};
                        const basePoints =
                          categoryPoints[category.id] || category.defaultPoints || 0;
                        const multiplierEnabled = poolSettings?.oddsMultiplierEnabled ?? true;
                        const multiplierFormula = poolSettings?.oddsMultiplierFormula || 'log';
                        const categoryOddsForThis = getCategoryOdds(category.id);
                        const selectedNominee = category.nominees.find(
                          (n: Nominee) => n.id === prediction.nomineeId,
                        );

                        if (!selectedNominee) return null;

                        const currentOdds =
                          categoryOddsForThis.find((o: any) => o.nomineeId === selectedNominee.id)
                            ?.odds || null;
                        const oddsForScoring =
                          prediction?.oddsPercentage !== null &&
                          prediction?.oddsPercentage !== undefined
                            ? prediction.oddsPercentage
                            : currentOdds;
                        const scoring = calculateScoringPreview(
                          oddsForScoring,
                          basePoints,
                          multiplierEnabled,
                          multiplierFormula,
                        );

                        // Check if this prediction is correct
                        // Normalize categoryId for comparison (handle both base and full IDs)
                        const winner = actualWinners?.find((w: any) => {
                          const normalizedWinnerCategoryId =
                            w.categoryId?.replace(/-\d{4}$/, '') || w.categoryId;
                          return normalizedWinnerCategoryId === category.id;
                        });
                        const isCorrect = winner && winner.nomineeId === prediction.nomineeId;
                        const hasWinner = !!winner;
                        const actualWinnerNominee = winner
                          ? category.nominees.find((n: Nominee) => n.id === winner.nomineeId)
                          : null;

                        return (
                          <div
                            key={category.id}
                            className={`p-3 md:p-4 rounded-lg border-2 ${
                              hasWinner
                                ? isCorrect
                                  ? 'bg-green-50 border-green-400'
                                  : 'bg-red-50 border-red-400'
                                : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="oscars-font text-base font-bold oscars-dark">
                                {category.name}
                                {hasWinner && (
                                  <span
                                    className={`ml-2 text-sm font-semibold ${
                                      isCorrect ? 'text-green-700' : 'text-red-700'
                                    }`}
                                  >
                                    {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                                  </span>
                                )}
                              </h4>
                            </div>
                            <div className="flex items-center gap-3">
                              <div
                                className={`relative w-12 h-12 flex-shrink-0 rounded overflow-hidden flex items-center justify-center cursor-zoom-in border border-gray-300/50 active:scale-95 transition-transform ${
                                  hasWinner && !isCorrect ? 'opacity-50' : ''
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNomineeImageClick(e, selectedNominee, category);
                                }}
                              >
                                <img
                                  src={getNomineeImage(selectedNominee, category.id, pool.year)}
                                  alt={selectedNominee.name}
                                  className="w-full h-full object-contain"
                                  onClick={(e) =>
                                    handleNomineeImageClick(e, selectedNominee, category)
                                  }
                                  onLoad={(e) => {
                                    const imgSrc = e.currentTarget.src;
                                    const colorKey = `${category.id}-${selectedNominee.id}`;
                                    if (!nomineeImageColors.has(colorKey)) {
                                      extractImageColors(imgSrc)
                                        .then((colors) => {
                                          setNomineeImageColors((prev) =>
                                            new Map(prev).set(colorKey, colors),
                                          );
                                        })
                                        .catch(() => {
                                          // Silently fail - overlay will use default color
                                        });
                                    }
                                  }}
                                  onError={(e) => {
                                    console.error(
                                      `Failed to load image: ${getNomineeImage(selectedNominee, category.id, pool.year)}`,
                                    );
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                                {/* Info icon badge - mobile only, subtle */}
                                <div className="md:hidden absolute top-0.5 right-0.5 bg-white/50 backdrop-blur-sm rounded-full p-0.5">
                                  <svg
                                    className="w-2 h-2 text-gray-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                </div>
                                {/* Hover overlay with magnifying glass - desktop only */}
                                {(() => {
                                  const colorKey = `${category.id}-${selectedNominee.id}`;
                                  const colors = nomineeImageColors.get(colorKey);
                                  return (
                                    <div
                                      className="hidden md:flex absolute inset-0 opacity-0 hover:opacity-100 transition-opacity items-center justify-center rounded"
                                      style={
                                        colors
                                          ? {
                                              background: `linear-gradient(to bottom, ${hexToRgba(colors.primary, 0.6)}, ${hexToRgba(colors.secondary, 0.5)})`,
                                            }
                                          : {
                                              backgroundColor: 'rgba(0, 0, 0, 0.4)',
                                            }
                                      }
                                    >
                                      <svg
                                        className="w-6 h-6 text-white"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                        />
                                      </svg>
                                    </div>
                                  );
                                })()}
                              </div>
                              <div className="flex-1 min-w-0">
                                {selectedNominee.film &&
                                  selectedNominee.name !== selectedNominee.film && (
                                    <>
                                      <h5
                                        className={`font-bold text-sm truncate ${
                                          hasWinner && !isCorrect
                                            ? 'line-through text-gray-500'
                                            : 'oscars-dark'
                                        }`}
                                      >
                                        {selectedNominee.name}
                                      </h5>
                                      <h5
                                        className={`font-normal text-xs italic truncate mt-0.5 ${
                                          hasWinner && !isCorrect
                                            ? 'line-through text-gray-400'
                                            : 'text-gray-600'
                                        }`}
                                      >
                                        {selectedNominee.film}
                                      </h5>
                                    </>
                                  )}
                                {(!selectedNominee.film ||
                                  selectedNominee.name === selectedNominee.film) && (
                                  <h5
                                    className={`font-bold text-sm truncate ${
                                      hasWinner && !isCorrect
                                        ? 'line-through text-gray-500'
                                        : 'oscars-dark'
                                    }`}
                                  >
                                    {selectedNominee.name}
                                  </h5>
                                )}
                                {!oddsLoading && (
                                  <div className="text-xs text-gray-600 mt-0.5">
                                    {prediction?.originalOddsPercentage !== null &&
                                    prediction?.originalOddsPercentage !== undefined &&
                                    prediction?.nomineeId === selectedNominee.id ? (
                                      <>
                                        {currentOdds !== null &&
                                        currentOdds > 0 &&
                                        currentOdds !== prediction.originalOddsPercentage ? (
                                          <div className="text-gray-700">
                                            Chance to win:{' '}
                                            <span className="font-semibold">
                                              {currentOdds.toFixed(0)}%
                                            </span>{' '}
                                            <span className="text-gray-500">
                                              (Selected at:{' '}
                                              {prediction.originalOddsPercentage.toFixed(0)}%)
                                            </span>
                                          </div>
                                        ) : (
                                          <span>
                                            Selected at:{' '}
                                            <span className="font-semibold">
                                              {prediction.originalOddsPercentage.toFixed(0)}%
                                            </span>
                                          </span>
                                        )}
                                      </>
                                    ) : prediction?.oddsPercentage !== null &&
                                      prediction?.oddsPercentage !== undefined ? (
                                      currentOdds !== null && currentOdds > 0 ? (
                                        <span>
                                          Scoring at:{' '}
                                          <span className="font-semibold text-yellow-700">
                                            {currentOdds.toFixed(0)}%
                                          </span>
                                        </span>
                                      ) : (
                                        <span>
                                          Selected at:{' '}
                                          <span className="font-semibold">
                                            {prediction.oddsPercentage.toFixed(0)}%
                                          </span>
                                        </span>
                                      )
                                    ) : currentOdds !== null && currentOdds > 0 ? (
                                      <span>
                                        Chance to win:{' '}
                                        <span className="font-semibold">
                                          {currentOdds.toFixed(0)}%
                                        </span>
                                      </span>
                                    ) : null}
                                  </div>
                                )}
                                {hasWinner && !isCorrect && actualWinnerNominee && (
                                  <div className="mt-2 pt-2 border-t border-red-300">
                                    <div className="text-xs text-red-700 font-semibold mb-1">
                                      Actual Winner:
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 flex-shrink-0 rounded overflow-hidden flex items-center justify-center bg-white">
                                        <img
                                          src={getNomineeImage(
                                            actualWinnerNominee,
                                            category.id,
                                            pool.year,
                                          )}
                                          alt={actualWinnerNominee.name}
                                          className="w-full h-full object-contain"
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                          }}
                                        />
                                      </div>
                                      <div>
                                        {actualWinnerNominee.film &&
                                          actualWinnerNominee.name !== actualWinnerNominee.film && (
                                            <>
                                              <div className="font-bold text-sm text-red-700 truncate">
                                                {actualWinnerNominee.name}
                                              </div>
                                              <div className="font-normal text-xs text-red-600 italic truncate">
                                                {actualWinnerNominee.film}
                                              </div>
                                            </>
                                          )}
                                        {(!actualWinnerNominee.film ||
                                          actualWinnerNominee.name ===
                                            actualWinnerNominee.film) && (
                                          <div className="font-bold text-sm text-red-700 truncate">
                                            {actualWinnerNominee.name}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                              {multiplierEnabled && (
                                <div className="flex flex-col items-end text-sm flex-shrink-0">
                                  {scoring.multiplier !== 1.0 && (
                                    <span className="text-gray-600 text-xs">
                                      ×{scoring.multiplier.toFixed(2)}
                                    </span>
                                  )}
                                  {hasWinner ? (
                                    isCorrect ? (
                                      <>
                                        <span className="text-xs text-green-700 font-semibold mb-0.5">
                                          Earned
                                        </span>
                                        <span className="font-bold text-green-700">
                                          {scoring.totalPoints.toFixed(1)} pts
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="font-bold text-red-700 text-base mb-0.5">
                                          0 pts
                                        </span>
                                        <span className="text-gray-400 line-through text-xs">
                                          {scoring.totalPoints.toFixed(1)} pts
                                        </span>
                                      </>
                                    )
                                  ) : (
                                    <span className="font-bold oscars-gold">
                                      {scoring.totalPoints.toFixed(1)} pts
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Tab Navigation - Sticky */}
                <div
                  className="sticky bg-white z-20"
                  style={{
                    top:
                      categories && predictions && showStickySummary
                        ? `${headerHeight + stickySummaryHeight}px`
                        : `${headerHeight}px`,
                  }}
                >
                  <div className="bg-white rounded-t-lg border-b border-gray-200">
                    <div className="flex -mb-px">
                      {categoryGroups.map((group) => {
                        const groupCategories = categories.filter((cat) =>
                          group.categoryIds.includes(cat.id),
                        );
                        if (groupCategories.length === 0) return null;

                        const selectedCount = groupCategories.filter((cat) =>
                          getPredictionForCategory(cat.id),
                        ).length;
                        const totalCount = groupCategories.length;
                        const isComplete = selectedCount === totalCount && totalCount > 0;
                        const isActive = selectedCategoryType === group.name;

                        return (
                          <button
                            key={group.name}
                            onClick={() => {
                              setSelectedCategoryType(group.name);
                              window.scrollTo({ top: 0, behavior: 'auto' }); // Jump to top
                            }}
                            className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors min-h-[44px] flex items-center whitespace-nowrap ${
                              isActive
                                ? 'border-yellow-500 text-yellow-600 oscars-gold'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            } cursor-pointer`}
                          >
                            <span className="flex items-center gap-2">
                              {group.name === 'Film Categories' ? (
                                <>
                                  <span className="md:hidden">Film</span>
                                  <span className="hidden md:inline">Film Categories</span>
                                </>
                              ) : (
                                group.name
                              )}
                              {selectedCount > 0 && (
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
                                    isComplete
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-yellow-100 text-yellow-700'
                                  }`}
                                >
                                  {selectedCount}/{totalCount}
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Tab Content */}
                {selectedCategoryType && (
                  <div className="bg-white rounded-b-lg shadow p-3 md:p-6">
                    <div className="space-y-4">
                      {categoryGroups
                        .find((group) => group.name === selectedCategoryType)
                        ?.categoryIds.map((categoryId) => {
                          const category = categories.find((cat) => cat.id === categoryId);
                          if (!category) return null;
                          const prediction = getPredictionForCategory(category.id);
                          const categoryPoints =
                            (poolSettings?.categoryPoints as Record<string, number>) || {};
                          const basePoints =
                            categoryPoints[category.id] || category.defaultPoints || 0;
                          const multiplierEnabled = poolSettings?.oddsMultiplierEnabled ?? true;
                          const multiplierFormula = poolSettings?.oddsMultiplierFormula || 'log';
                          const categoryOddsForThis = getCategoryOdds(category.id);

                          // Check if winner has been announced for this category
                          // Normalize categoryId for comparison (handle both base and full IDs)
                          const winner = actualWinners?.find((w: any) => {
                            const normalizedWinnerCategoryId =
                              w.categoryId?.replace(/-\d{4}$/, '') || w.categoryId;
                            return normalizedWinnerCategoryId === category.id;
                          });
                          const hasWinner = !!winner;
                          const isCorrect =
                            hasWinner && prediction && winner.nomineeId === prediction.nomineeId;

                          const containerBgClass = hasWinner
                            ? isCorrect
                              ? 'bg-green-50'
                              : prediction
                                ? 'bg-red-50'
                                : 'bg-white'
                            : 'bg-white';

                          return (
                            <div
                              key={category.id}
                              className={`${
                                hasWinner
                                  ? isCorrect
                                    ? 'bg-green-50 border-2 border-green-300'
                                    : prediction
                                      ? 'bg-red-50 border-2 border-red-300'
                                      : 'bg-white'
                                  : 'bg-white'
                              }`}
                            >
                              <div
                                className={`sticky md:static ${containerBgClass} z-10 flex items-center justify-between mb-3 pt-3 pb-2 border-b border-gray-200`}
                                style={{
                                  top:
                                    categories && predictions && showStickySummary
                                      ? `${headerHeight + stickySummaryHeight + 48}px`
                                      : `${headerHeight + 48}px`,
                                }}
                              >
                                <h4 className="oscars-font text-base font-bold oscars-dark">
                                  {category.name}
                                  {hasWinner && (
                                    <span
                                      className={`ml-2 text-sm font-semibold ${
                                        isCorrect
                                          ? 'text-green-700'
                                          : prediction
                                            ? 'text-red-700'
                                            : ''
                                      }`}
                                    >
                                      {isCorrect ? '✓ Correct' : prediction ? '✗ Incorrect' : ''}
                                    </span>
                                  )}
                                  {!hasWinner && prediction && (
                                    <span className="ml-2 text-green-600">✓</span>
                                  )}
                                </h4>
                                <span className="text-sm font-bold oscars-dark pr-2 md:pr-2.5">
                                  {multiplierEnabled ? 'Base: ' : ''}
                                  {basePoints} pts
                                </span>
                              </div>
                              <div className="space-y-2 md:grid md:grid-cols-5 md:gap-2 md:space-y-0">
                                {[...category.nominees]
                                  .sort((a, b) => {
                                    const oddsA =
                                      categoryOddsForThis.find((o: any) => o.nomineeId === a.id)
                                        ?.odds || 0;
                                    const oddsB =
                                      categoryOddsForThis.find((o: any) => o.nomineeId === b.id)
                                        ?.odds || 0;
                                    if (oddsB !== oddsA) {
                                      return oddsB - oddsA;
                                    }
                                    return a.name.localeCompare(b.name);
                                  })
                                  .map((nominee) => {
                                    const isSelected = prediction?.nomineeId === nominee.id;
                                    const currentOdds =
                                      categoryOddsForThis.find(
                                        (o: any) => o.nomineeId === nominee.id,
                                      )?.odds || null;
                                    // For scoring preview, use min of current and original odds
                                    // Lower percentage = worse odds = higher multiplier = more points
                                    // If current odds are lower (better for bonus), use current
                                    // If current odds are higher (worse for bonus), use original
                                    let oddsForScoring: number | null = null;
                                    if (
                                      isSelected &&
                                      prediction?.originalOddsPercentage !== null &&
                                      prediction?.originalOddsPercentage !== undefined &&
                                      prediction?.nomineeId === nominee.id
                                    ) {
                                      if (currentOdds !== null && currentOdds !== undefined) {
                                        // Use min of current and original - lower percentage = better bonus
                                        oddsForScoring = Math.min(
                                          currentOdds,
                                          prediction.originalOddsPercentage,
                                        );
                                      } else {
                                        // Fallback to stored odds if current not available
                                        oddsForScoring =
                                          prediction.oddsPercentage ??
                                          prediction.originalOddsPercentage;
                                      }
                                    } else if (currentOdds !== null && currentOdds !== undefined) {
                                      oddsForScoring = currentOdds;
                                    } else if (
                                      isSelected &&
                                      prediction?.oddsPercentage !== null &&
                                      prediction?.oddsPercentage !== undefined
                                    ) {
                                      oddsForScoring = prediction.oddsPercentage;
                                    }
                                    const scoring =
                                      oddsForScoring !== null
                                        ? calculateScoringPreview(
                                            oddsForScoring,
                                            basePoints,
                                            multiplierEnabled,
                                            multiplierFormula,
                                          )
                                        : { basePoints, multiplier: 1.0, totalPoints: basePoints };

                                    // Check if winner has been announced and if this nominee is correct/incorrect
                                    // Normalize categoryId for comparison (handle both base and full IDs)
                                    const winner = actualWinners?.find((w: any) => {
                                      const normalizedWinnerCategoryId =
                                        w.categoryId?.replace(/-\d{4}$/, '') || w.categoryId;
                                      return normalizedWinnerCategoryId === category.id;
                                    });
                                    const hasWinner = !!winner;
                                    const isCorrect = hasWinner && winner.nomineeId === nominee.id;
                                    const isIncorrect =
                                      hasWinner && isSelected && winner.nomineeId !== nominee.id;
                                    const isActualWinnerButNotSelected =
                                      hasWinner && isCorrect && !isSelected;

                                    const canSelect = !hasWinner && !isViewingOtherSubmission;

                                    return (
                                      <div
                                        key={nominee.id}
                                        onClick={(e) => {
                                          // Don't trigger selection if clicking on the image container
                                          if (
                                            (e.target as HTMLElement).closest(
                                              '.nominee-image-container',
                                            )
                                          ) {
                                            return;
                                          }
                                          if (canSelect) {
                                            handleNomineeSelect(category.id, nominee.id);
                                          }
                                        }}
                                        className={`border-2 rounded-lg p-4 md:p-3 transition-all flex md:flex-col gap-4 md:gap-0 ${
                                          hasWinner && isCorrect
                                            ? 'border-green-500 bg-green-50 cursor-not-allowed'
                                            : hasWinner && isIncorrect
                                              ? 'border-red-400 bg-red-50 cursor-not-allowed opacity-75'
                                              : isSelected
                                                ? canSelect
                                                  ? 'border-yellow-400 bg-yellow-50 cursor-pointer'
                                                  : 'border-yellow-400 bg-yellow-50 cursor-not-allowed'
                                                : canSelect
                                                  ? 'border-gray-200 hover:border-yellow-300 cursor-pointer bg-white'
                                                  : 'border-gray-200 cursor-not-allowed bg-gray-50 opacity-60'
                                        }`}
                                      >
                                        <div
                                          className="nominee-image-container relative w-24 h-24 md:w-full md:aspect-square flex-shrink-0 rounded overflow-hidden flex items-center justify-center bg-gray-100 cursor-zoom-in md:mb-2 border border-gray-300/50 active:scale-95 transition-transform"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleNomineeImageClick(e, nominee, category);
                                          }}
                                        >
                                          <img
                                            src={getNomineeImage(nominee, category.id, pool.year)}
                                            alt={nominee.name}
                                            className="w-full h-full object-contain"
                                            onClick={(e) =>
                                              handleNomineeImageClick(e, nominee, category)
                                            }
                                            onLoad={(e) => {
                                              const imgSrc = e.currentTarget.src;
                                              const colorKey = `${category.id}-${nominee.id}`;
                                              if (!nomineeImageColors.has(colorKey)) {
                                                extractImageColors(imgSrc)
                                                  .then((colors) => {
                                                    setNomineeImageColors((prev) =>
                                                      new Map(prev).set(colorKey, colors),
                                                    );
                                                  })
                                                  .catch(() => {
                                                    // Silently fail - overlay will use default color
                                                  });
                                              }
                                            }}
                                            onError={(e) => {
                                              console.error(
                                                `Failed to load image: ${getNomineeImage(nominee, category.id, pool.year)}`,
                                              );
                                              e.currentTarget.style.display = 'none';
                                            }}
                                          />
                                          {/* Info icon badge - mobile only, subtle */}
                                          <div className="md:hidden absolute top-1 right-1 bg-white/50 backdrop-blur-sm rounded-full p-0.5">
                                            <svg
                                              className="w-2.5 h-2.5 text-gray-500"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                              />
                                            </svg>
                                          </div>
                                          {/* Hover overlay with magnifying glass - desktop only */}
                                          {(() => {
                                            const colorKey = `${category.id}-${nominee.id}`;
                                            const colors = nomineeImageColors.get(colorKey);
                                            return (
                                              <div
                                                className="hidden md:flex absolute inset-0 opacity-0 hover:opacity-100 transition-opacity items-center justify-center rounded"
                                                style={
                                                  colors
                                                    ? {
                                                        background: `linear-gradient(to bottom, ${hexToRgba(colors.primary, 0.6)}, ${hexToRgba(colors.secondary, 0.5)})`,
                                                      }
                                                    : {
                                                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                                                      }
                                                }
                                              >
                                                <svg
                                                  className="w-8 h-8 text-white"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  viewBox="0 0 24 24"
                                                >
                                                  <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                                  />
                                                </svg>
                                              </div>
                                            );
                                          })()}
                                        </div>
                                        {/* Mobile content */}
                                        <div className="flex-1 min-w-0 md:hidden">
                                          {nominee.film && nominee.name !== nominee.film && (
                                            <h4 className="font-bold text-base oscars-dark">
                                              {nominee.name}
                                            </h4>
                                          )}
                                          {nominee.film && nominee.name !== nominee.film && (
                                            <h4 className="font-normal text-xs text-gray-600 italic mt-0.5">
                                              {nominee.film}
                                            </h4>
                                          )}
                                          {(!nominee.film || nominee.name === nominee.film) && (
                                            <h4 className="font-bold text-base oscars-dark">
                                              {nominee.name}
                                            </h4>
                                          )}
                                          {!oddsLoading && (
                                            <div className="text-sm text-gray-600 mt-1">
                                              {isSelected ? (
                                                <>
                                                  {prediction?.originalOddsPercentage !== null &&
                                                  prediction?.originalOddsPercentage !==
                                                    undefined &&
                                                  prediction?.nomineeId === nominee.id ? (
                                                    <>
                                                      {currentOdds !== null &&
                                                      currentOdds > 0 &&
                                                      currentOdds !==
                                                        prediction.originalOddsPercentage ? (
                                                        <div className="text-gray-700">
                                                          <div className="flex flex-wrap items-baseline gap-1">
                                                            <span>
                                                              Win:{' '}
                                                              <span className="font-semibold">
                                                                {currentOdds.toFixed(0)}%
                                                              </span>
                                                            </span>
                                                            <span className="text-gray-500">
                                                              (was{' '}
                                                              {prediction.originalOddsPercentage.toFixed(
                                                                0,
                                                              )}
                                                              %)
                                                            </span>
                                                            <span
                                                              className={`${currentOdds < prediction.originalOddsPercentage ? 'text-yellow-600' : 'text-green-600'}`}
                                                            >
                                                              {currentOdds <
                                                              prediction.originalOddsPercentage
                                                                ? 'Odds updated'
                                                                : 'Odds locked'}
                                                            </span>
                                                          </div>
                                                        </div>
                                                      ) : (
                                                        <span>
                                                          Win:{' '}
                                                          <span className="font-semibold text-yellow-700">
                                                            {prediction.originalOddsPercentage.toFixed(
                                                              0,
                                                            )}
                                                            %
                                                          </span>
                                                        </span>
                                                      )}
                                                    </>
                                                  ) : currentOdds !== null && currentOdds > 0 ? (
                                                    <span>
                                                      Scoring:{' '}
                                                      <span className="font-semibold text-yellow-700">
                                                        {currentOdds.toFixed(0)}%
                                                      </span>
                                                    </span>
                                                  ) : (
                                                    prediction?.oddsPercentage !== null &&
                                                    prediction?.oddsPercentage !== undefined && (
                                                      <span>
                                                        Scoring:{' '}
                                                        <span className="font-semibold text-yellow-700">
                                                          {prediction.oddsPercentage.toFixed(0)}%
                                                        </span>
                                                      </span>
                                                    )
                                                  )}
                                                </>
                                              ) : (
                                                currentOdds !== null &&
                                                currentOdds > 0 && (
                                                  <span>
                                                    Win:{' '}
                                                    <span className="font-semibold">
                                                      {currentOdds.toFixed(0)}%
                                                    </span>
                                                  </span>
                                                )
                                              )}
                                            </div>
                                          )}
                                          {multiplierEnabled && (
                                            <div className="mt-3 pt-3 border-t border-gray-200">
                                              <div className="flex items-center justify-between">
                                                <span className="text-xs text-gray-500">
                                                  Points
                                                </span>
                                                <div className="flex items-baseline gap-2">
                                                  {hasWinner && isCorrect && isSelected && (
                                                    <span className="font-bold text-green-700 text-base">
                                                      {scoring.totalPoints.toFixed(1)}
                                                    </span>
                                                  )}
                                                  {hasWinner && isIncorrect && (
                                                    <>
                                                      <span className="font-bold text-red-700 text-base">
                                                        0
                                                      </span>
                                                      <span className="text-gray-400 line-through text-xs">
                                                        {scoring.totalPoints.toFixed(1)}
                                                      </span>
                                                    </>
                                                  )}
                                                  {!hasWinner && !isActualWinnerButNotSelected && (
                                                    <>
                                                      <span className="text-yellow-600 font-semibold text-base">
                                                        {scoring.totalPoints.toFixed(1)}
                                                      </span>
                                                      {scoring.multiplier !== 1.0 && (
                                                        <span className="text-yellow-600 text-sm">
                                                          ({scoring.multiplier.toFixed(2)}x)
                                                        </span>
                                                      )}
                                                    </>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>

                                        {/* Desktop content */}
                                        <div className="hidden md:flex md:flex-col md:w-full md:gap-0">
                                          {/* Name section */}
                                          <div className="leading-tight">
                                            {nominee.film && nominee.name !== nominee.film && (
                                              <>
                                                <h4 className="font-bold text-xs oscars-dark leading-tight">
                                                  {nominee.name}
                                                </h4>
                                                <h4 className="font-normal text-[10px] text-gray-600 italic truncate leading-tight">
                                                  {nominee.film}
                                                </h4>
                                              </>
                                            )}
                                            {(!nominee.film || nominee.name === nominee.film) && (
                                              <h4 className="font-bold text-xs oscars-dark leading-tight">
                                                {nominee.name}
                                              </h4>
                                            )}
                                          </div>

                                          {/* Odds section - with slight spacing from name */}
                                          {!oddsLoading && (
                                            <div className="text-xs text-gray-600 leading-tight mt-1">
                                              {isSelected ? (
                                                <>
                                                  {prediction?.originalOddsPercentage !== null &&
                                                  prediction?.originalOddsPercentage !==
                                                    undefined &&
                                                  prediction?.nomineeId === nominee.id ? (
                                                    <>
                                                      {currentOdds !== null &&
                                                      currentOdds > 0 &&
                                                      currentOdds !==
                                                        prediction.originalOddsPercentage ? (
                                                        <div className="text-gray-700">
                                                          <span className="inline-block w-full">
                                                            Chance to win:{' '}
                                                            <span className="font-semibold">
                                                              {currentOdds.toFixed(0)}%
                                                            </span>{' '}
                                                            <span className="text-gray-500">
                                                              (was{' '}
                                                              {prediction.originalOddsPercentage.toFixed(
                                                                0,
                                                              )}
                                                              %)
                                                            </span>
                                                          </span>
                                                        </div>
                                                      ) : (
                                                        <div className="text-gray-700">
                                                          <span className="inline-block w-full">
                                                            Chance to win:{' '}
                                                            <span className="font-semibold text-yellow-700">
                                                              {prediction.originalOddsPercentage.toFixed(
                                                                0,
                                                              )}
                                                              %
                                                            </span>
                                                            <span className="text-gray-500 invisible">
                                                              {' '}
                                                              (was 0%)
                                                            </span>
                                                          </span>
                                                        </div>
                                                      )}
                                                    </>
                                                  ) : currentOdds !== null && currentOdds > 0 ? (
                                                    <span>
                                                      Scoring at:{' '}
                                                      <span className="font-semibold text-yellow-700">
                                                        {currentOdds.toFixed(0)}%
                                                      </span>
                                                    </span>
                                                  ) : (
                                                    prediction?.oddsPercentage !== null &&
                                                    prediction?.oddsPercentage !== undefined && (
                                                      <span>
                                                        Scoring at:{' '}
                                                        <span className="font-semibold text-yellow-700">
                                                          {prediction.oddsPercentage.toFixed(0)}%
                                                        </span>
                                                      </span>
                                                    )
                                                  )}
                                                </>
                                              ) : (
                                                currentOdds !== null &&
                                                currentOdds > 0 && (
                                                  <div className="text-gray-700">
                                                    <span className="inline-block w-full">
                                                      Chance to win:{' '}
                                                      <span className="font-semibold">
                                                        {currentOdds.toFixed(0)}%
                                                      </span>
                                                      <span className="text-gray-500 invisible">
                                                        {' '}
                                                        (was 0%)
                                                      </span>
                                                    </span>
                                                  </div>
                                                )
                                              )}
                                            </div>
                                          )}

                                          {/* Points section */}
                                          {multiplierEnabled && (
                                            <div className="mt-2 pt-2 border-t border-gray-200">
                                              <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs text-gray-500">
                                                  Points
                                                </span>
                                                <div className="flex items-baseline gap-1">
                                                  {hasWinner && isCorrect && isSelected && (
                                                    <span className="font-bold text-green-700 text-sm">
                                                      {scoring.totalPoints.toFixed(1)}
                                                    </span>
                                                  )}
                                                  {hasWinner && isIncorrect && (
                                                    <>
                                                      <span className="font-bold text-red-700 text-sm">
                                                        0
                                                      </span>
                                                      <span className="text-gray-400 line-through text-xs">
                                                        {scoring.totalPoints.toFixed(1)}
                                                      </span>
                                                    </>
                                                  )}
                                                  {!hasWinner && !isActualWinnerButNotSelected && (
                                                    <>
                                                      <span className="text-yellow-600 font-semibold text-sm">
                                                        {scoring.totalPoints.toFixed(1)}
                                                      </span>
                                                      {scoring.multiplier !== 1.0 && (
                                                        <span className="text-yellow-600 text-xs">
                                                          ({scoring.multiplier.toFixed(2)}x)
                                                        </span>
                                                      )}
                                                    </>
                                                  )}
                                                </div>
                                              </div>
                                              {isSelected &&
                                                prediction?.originalOddsPercentage !== null &&
                                                prediction?.originalOddsPercentage !== undefined &&
                                                prediction?.nomineeId === nominee.id &&
                                                currentOdds !== null &&
                                                currentOdds > 0 &&
                                                currentOdds !==
                                                  prediction.originalOddsPercentage && (
                                                  <div
                                                    className={`text-[10px] text-center mt-1 ${
                                                      currentOdds <
                                                      prediction.originalOddsPercentage
                                                        ? 'text-yellow-600'
                                                        : 'text-green-600'
                                                    }`}
                                                  >
                                                    {currentOdds < prediction.originalOddsPercentage
                                                      ? 'Updated to current odds'
                                                      : 'Locked in original odds'}
                                                  </div>
                                                )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {/* Next Tab Button */}
                    {(() => {
                      const currentTabIndex = categoryGroups.findIndex(
                        (group) => group.name === selectedCategoryType,
                      );
                      const nextTab = categoryGroups[currentTabIndex + 1];

                      // Only show button if there's a next tab and it has categories
                      if (nextTab && categories) {
                        const nextTabCategories = categories.filter((cat) =>
                          nextTab.categoryIds.includes(cat.id),
                        );
                        if (nextTabCategories.length > 0) {
                          return (
                            <div className="mt-6 pt-6 border-t border-gray-200 flex justify-center">
                              <button
                                onClick={() => {
                                  setSelectedCategoryType(nextTab.name);
                                  window.scrollTo({ top: 0, behavior: 'auto' });
                                }}
                                className="px-6 py-3 oscars-gold-bg text-white rounded-lg hover:opacity-90 active:opacity-80 transition-opacity text-sm font-semibold min-h-[44px] flex items-center gap-2 touch-manipulation"
                              >
                                Next: {nextTab.name}
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5l7 7-7 7"
                                  />
                                </svg>
                              </button>
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Confirmation Dialog for Changing Selection */}
      {pendingSelection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="oscars-font text-xl font-bold oscars-dark mb-4">
              Change Your Selection?
            </h3>
            <p className="text-gray-700 mb-3">
              <strong>{pendingSelection.categoryName}:</strong> You're about to change from{' '}
              <strong className="text-yellow-700">{pendingSelection.oldNomineeName}</strong>{' '}
              (selected at {pendingSelection.oldOdds?.toFixed(0)}%) to{' '}
              <strong className="text-yellow-700">{pendingSelection.nomineeName}</strong>
              {pendingSelection.currentOdds !== null && pendingSelection.currentOdds !== undefined
                ? ` (current odds: ${pendingSelection.currentOdds.toFixed(0)}%)`
                : ''}
              .
            </p>
            <p className="text-gray-700 mb-6">
              <strong className="text-red-600">Important:</strong> If you change your selection and
              then switch back to <strong>{pendingSelection.oldNomineeName}</strong> later, you'll
              get the <strong>current odds at that time</strong>, not your original{' '}
              {pendingSelection.oldOdds?.toFixed(0)}% odds. Your original odds will be lost.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelSelectionChange}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSelectionChange}
                className="px-4 py-2 oscars-gold-bg text-white rounded hover:opacity-90 transition-colors font-semibold"
              >
                Change Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nominee Info Modal */}
      {selectedNomineeInfo && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fadeIn"
          onClick={closeNomineeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div
            className="rounded-xl max-w-4xl w-full max-h-[90vh] lg:max-h-[90vh] h-[90vh] lg:h-auto overflow-hidden shadow-2xl flex flex-col animate-slideUp relative"
            onClick={(e) => e.stopPropagation()}
            style={
              imageColors
                ? (() => {
                    const isDarkMode = imageColors.averageBrightness < 140;
                    if (isDarkMode) {
                      const bgOpacity = 0.15;
                      return {
                        background: `linear-gradient(to bottom, ${hexToRgba(imageColors.primary, bgOpacity)}, ${hexToRgba(imageColors.secondary, bgOpacity * 0.8)}, ${hexToRgba(imageColors.primary, bgOpacity)})`,
                        backdropFilter: 'blur(20px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                        boxShadow: `0 20px 60px ${hexToRgba(imageColors.primary, 0.2)}, inset 0 1px 0 ${hexToRgba(imageColors.primary, 0.1)}`,
                        border: `1px solid ${hexToRgba(imageColors.primary, 0.2)}`,
                      };
                    } else {
                      // Light mode: use white/light colors with transparency for frosted glass effect
                      return {
                        background: `linear-gradient(to bottom, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.4))`,
                        backdropFilter: 'blur(20px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                        boxShadow: `0 20px 60px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                        border: `1px solid rgba(255, 255, 255, 0.3)`,
                      };
                    }
                  })()
                : {
                    backdropFilter: 'blur(20px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  }
            }
          >
            {/* Header - Mobile only */}
            <div
              className="flex-shrink-0 px-6 py-3 transition-all bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200"
              style={
                imageColors
                  ? (() => {
                      return {
                        background: 'rgba(242, 232, 218, 0.92)',
                        borderBottomColor: '#e5e7eb',
                        borderBottomWidth: '1px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                      };
                    })()
                  : {
                      background: 'white',
                      borderBottomColor: '#e5e7eb',
                      borderBottomWidth: '1px',
                    }
              }
            >
              {imageColors && imageColors.averageBrightness < 140 && (
                <style>{`
                  @media (min-width: 1024px) {
                    [data-modal-header-${selectedNomineeInfo.nominee.id.replace(/[^a-zA-Z0-9]/g, '-')}] {
                      background: linear-gradient(to right, ${darkenColor(imageColors.primary, 0.55)}, ${darkenColor(imageColors.secondary, 0.57)}) !important;
                    }
                    [data-modal-header-${selectedNomineeInfo.nominee.id.replace(/[^a-zA-Z0-9]/g, '-')}] h2 {
                      color: ${getLightestColor(imageColors)} !important;
                    }
                    [data-modal-header-${selectedNomineeInfo.nominee.id.replace(/[^a-zA-Z0-9]/g, '-')}] button {
                      color: ${getTextColorForMode(imageColors.accent, true)} !important;
                      background-color: ${hexToRgba(imageColors.accent, 0.2)} !important;
                    }
                  }
                `}</style>
              )}
              <div
                className="flex items-center justify-between gap-4 min-w-0"
                data-modal-header={selectedNomineeInfo.nominee.id.replace(/[^a-zA-Z0-9]/g, '-')}
              >
                <h2
                  id="modal-title"
                  className="oscars-font text-lg font-bold leading-tight truncate min-w-0 flex-1 whitespace-nowrap overflow-hidden transition-colors"
                  style={{
                    color: '#334155',
                    fontWeight: '700',
                    letterSpacing: '0.01em',
                  }}
                >
                  {selectedNomineeInfo.nominee.name}
                </h2>
                <button
                  onClick={closeNomineeModal}
                  className="transition-all p-2 rounded-full focus:outline-none focus:ring-2 flex-shrink-0"
                  style={
                    imageColors
                      ? (() => {
                          return {
                            color: '#334155',
                            backgroundColor: 'transparent',
                          };
                        })()
                      : {
                          color: '#334155',
                          backgroundColor: 'transparent',
                        }
                  }
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#1f2937';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#334155';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  aria-label="Close modal"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div
              className="flex-1 overflow-y-auto flex flex-col min-h-0 lg:overflow-y-auto"
              style={
                imageColors
                  ? (() => {
                      const isDarkMode = imageColors.averageBrightness < 140;
                      if (isDarkMode) {
                        return {
                          background: hexToRgba(imageColors.secondary, 0.08),
                          backdropFilter: 'blur(8px)',
                          WebkitBackdropFilter: 'blur(8px)',
                        };
                      } else {
                        // Light mode: use white with transparency
                        return {
                          background: 'rgba(255, 255, 255, 0.3)',
                          backdropFilter: 'blur(8px)',
                          WebkitBackdropFilter: 'blur(8px)',
                        };
                      }
                    })()
                  : {
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      backgroundColor: 'rgba(255, 255, 255, 0.5)',
                    }
              }
            >
              {/* Full bleed image - Mobile only, shows full poster */}
              <div
                className="lg:hidden w-full flex-shrink-0 max-h-[40vh] overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center relative"
                style={
                  imageColors
                    ? (() => {
                        const isDarkMode = imageColors.averageBrightness < 140;
                        if (isDarkMode) {
                          return {
                            background: `linear-gradient(to bottom, ${hexToRgba(imageColors.primary, 0.12)}, ${hexToRgba(imageColors.secondary, 0.1)})`,
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            border: `1px solid ${hexToRgba(imageColors.primary, 0.2)}`,
                          };
                        } else {
                          // Light mode: use white with transparency for frosted glass effect
                          return {
                            background: `linear-gradient(to bottom, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.3))`,
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            border: `1px solid rgba(255, 255, 255, 0.4)`,
                          };
                        }
                      })()
                    : {
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        backgroundColor: 'rgba(243, 244, 246, 0.6)',
                      }
                }
              >
                {imageColors && (
                  <div
                    className="absolute inset-0 pointer-events-none z-10"
                    style={{
                      background: `linear-gradient(to bottom, transparent, ${hexToRgba(imageColors.primary, 0.1)}, ${hexToRgba(imageColors.secondary, 0.15)})`,
                    }}
                  />
                )}
                {imageError ? (
                  <div className="flex flex-col items-center justify-center p-8 text-gray-400">
                    <svg
                      className="w-16 h-16 mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-sm">No image available</p>
                  </div>
                ) : (
                  <>
                    <img
                      src={getNomineeImage(
                        selectedNomineeInfo.nominee,
                        selectedNomineeInfo.category.id,
                        pool.year,
                      )}
                      alt={selectedNomineeInfo.nominee.name}
                      className="w-full h-full object-contain object-center relative z-0"
                      onError={() => {
                        setImageError(true);
                        setImageColors(null);
                      }}
                      onLoad={(e) => {
                        const imgSrc = e.currentTarget.src;
                        extractImageColors(imgSrc)
                          .then((colors) => {
                            setImageColors(colors);
                          })
                          .catch(() => {
                            setImageColors(null);
                          });
                      }}
                    />
                    {imageColors && (
                      <div
                        className="absolute inset-0 pointer-events-none z-10"
                        style={{
                          background: `linear-gradient(to bottom, transparent, ${hexToRgba(imageColors.primary, 0.1)}, ${hexToRgba(imageColors.secondary, 0.15)})`,
                        }}
                      />
                    )}
                  </>
                )}
              </div>

              <div className="p-4 md:p-6 lg:p-6 pb-6 lg:pb-6 flex flex-col flex-1 min-h-0">
                {/* Mobile Chart Section - Tagline and Chart */}
                <div className="lg:hidden flex flex-col flex-1 min-h-0">
                  {/* Tagline - Hidden on very small screens, shown on sm and up */}
                  <div className="hidden sm:block text-center w-full mb-3 flex-shrink-0">
                    <p
                      className="text-sm sm:text-base leading-relaxed"
                      style={
                        imageColors
                          ? (() => {
                              const isDarkMode = imageColors.averageBrightness < 140;
                              return {
                                color: getTextColorForMode(imageColors.secondary, isDarkMode),
                                textShadow: isDarkMode
                                  ? `0 1px 1px ${hexToRgba(imageColors.secondary, 0.2)}`
                                  : 'none',
                              };
                            })()
                          : { color: '#374151' }
                      }
                    >
                      {selectedNomineeInfo.info.blurb_sentence_1}
                    </p>
                  </div>

                  {/* Odds Trend - Mobile first, Desktop in right column */}
                  {oddsHistory && oddsHistory.length > 0 ? (
                    <div className="flex flex-col flex-1 min-h-0 -mx-4 md:-mx-6">
                      <div className="p-2 sm:p-3 flex flex-col flex-1 min-h-0">
                        {(() => {
                          const history = oddsHistory as Array<{
                            oddsPercentage: number;
                            snapshotTime: string;
                          }>;
                          const filteredHistory = filterOddsHistoryByDay(history);

                          const firstOdds = filteredHistory[0].oddsPercentage;
                          const currentOdds =
                            filteredHistory[filteredHistory.length - 1].oddsPercentage;
                          const maxOdds = Math.max(...filteredHistory.map((h) => h.oddsPercentage));
                          const minOdds = Math.min(...filteredHistory.map((h) => h.oddsPercentage));
                          const range = maxOdds - minOdds || 1;
                          const padding = range * 0.2;
                          const yMin = Math.max(0, minOdds - padding);
                          const yMax = maxOdds + padding;
                          const yRange = yMax - yMin;

                          const points = filteredHistory.map((h, i) => {
                            const x = (i / (filteredHistory.length - 1)) * 100;
                            const y = 100 - ((h.oddsPercentage - yMin) / yRange) * 100;
                            return { x, y, odds: h.oddsPercentage, time: h.snapshotTime };
                          });

                          const smoothPath = generateSmoothPath(points);
                          const areaPath = smoothPath + ` L 100,100 L 0,100 Z`;
                          const gradientId = `oddsGradient-mobile-${selectedNomineeInfo.nominee.id.replace(/[^a-zA-Z0-9]/g, '-')}`;

                          // Use extracted colors if available, fallback to default gold
                          const gradientColor1 = imageColors ? imageColors.primary : '#fbbf24';
                          const gradientColor2 = imageColors ? imageColors.secondary : '#fbbf24';
                          const strokeColor = imageColors ? imageColors.accent : '#f59e0b';
                          const oddsTextColor = imageColors ? imageColors.primary : undefined;

                          return (
                            <div
                              className="relative flex-1 min-h-[120px] w-full flex flex-col rounded-lg p-4"
                              style={
                                imageColors
                                  ? (() => {
                                      const isDarkMode = imageColors.averageBrightness < 140;
                                      if (isDarkMode) {
                                        return {
                                          background: `linear-gradient(to bottom, ${hexToRgba(imageColors.primary, 0.15)}, ${hexToRgba(imageColors.secondary, 0.12)})`,
                                          backdropFilter: 'blur(12px) saturate(180%)',
                                          WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                                          border: `1px solid ${hexToRgba(imageColors.primary, 0.25)}`,
                                          boxShadow: `0 4px 16px ${hexToRgba(imageColors.primary, 0.1)}, inset 0 1px 0 ${hexToRgba(imageColors.primary, 0.08)}`,
                                        };
                                      } else {
                                        // Light mode: use white with transparency for frosted glass effect
                                        return {
                                          background: `linear-gradient(to bottom, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.2))`,
                                          backdropFilter: 'blur(12px) saturate(180%)',
                                          WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                                          border: `1px solid rgba(255, 255, 255, 0.3)`,
                                          boxShadow: `0 4px 16px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                                        };
                                      }
                                    })()
                                  : {
                                      backdropFilter: 'blur(12px)',
                                      WebkitBackdropFilter: 'blur(12px)',
                                      backgroundColor: 'rgba(255, 255, 255, 0.6)',
                                    }
                              }
                            >
                              {/* Odds labels */}
                              <div className="flex justify-between items-start mb-2 flex-shrink-0">
                                <div className="flex flex-col">
                                  <span
                                    className="text-xs"
                                    style={
                                      imageColors
                                        ? (() => {
                                            const isDarkMode = imageColors.averageBrightness < 140;
                                            return {
                                              color: getTextColorForMode(
                                                imageColors.primary,
                                                isDarkMode,
                                              ),
                                            };
                                          })()
                                        : { color: '#6b7280' }
                                    }
                                  >
                                    Opening
                                  </span>
                                  <span
                                    className="text-base sm:text-lg font-bold oscars-gold"
                                    style={
                                      oddsTextColor && imageColors
                                        ? {
                                            color: getTextColorForMode(
                                              oddsTextColor,
                                              imageColors.averageBrightness < 140,
                                            ),
                                            fontWeight: '700',
                                            letterSpacing: '0.01em',
                                          }
                                        : oddsTextColor
                                          ? {
                                              color: oddsTextColor,
                                              fontWeight: '700',
                                              letterSpacing: '0.01em',
                                            }
                                          : undefined
                                    }
                                  >
                                    {firstOdds.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex flex-col items-end">
                                  <span
                                    className="text-xs"
                                    style={
                                      imageColors
                                        ? (() => {
                                            const isDarkMode = imageColors.averageBrightness < 140;
                                            return {
                                              color: getTextColorForMode(
                                                imageColors.primary,
                                                isDarkMode,
                                              ),
                                            };
                                          })()
                                        : { color: '#6b7280' }
                                    }
                                  >
                                    Current
                                  </span>
                                  <span
                                    className="text-base sm:text-lg font-bold oscars-gold"
                                    style={
                                      oddsTextColor && imageColors
                                        ? {
                                            color: getTextColorForMode(
                                              oddsTextColor,
                                              imageColors.averageBrightness < 140,
                                            ),
                                            fontWeight: '700',
                                            letterSpacing: '0.01em',
                                          }
                                        : oddsTextColor
                                          ? {
                                              color: oddsTextColor,
                                              fontWeight: '700',
                                              letterSpacing: '0.01em',
                                            }
                                          : undefined
                                    }
                                  >
                                    {currentOdds.toFixed(1)}%
                                  </span>
                                </div>
                              </div>

                              {/* Chart */}
                              <div className="flex-1 min-h-0 w-full mt-2">
                                <svg
                                  className="w-full h-full"
                                  viewBox="0 0 100 100"
                                  preserveAspectRatio="none"
                                >
                                  <defs>
                                    <linearGradient
                                      id={gradientId}
                                      x1="0%"
                                      y1="0%"
                                      x2="0%"
                                      y2="100%"
                                    >
                                      <stop
                                        offset="0%"
                                        stopColor={gradientColor1}
                                        stopOpacity={imageColors ? '0.6' : '0.2'}
                                      />
                                      <stop
                                        offset="50%"
                                        stopColor={gradientColor2}
                                        stopOpacity={imageColors ? '0.4' : '0.1'}
                                      />
                                      <stop
                                        offset="100%"
                                        stopColor={gradientColor2}
                                        stopOpacity={imageColors ? '0.15' : '0.05'}
                                      />
                                    </linearGradient>
                                  </defs>
                                  {/* Area fill */}
                                  <path d={areaPath} fill={`url(#${gradientId})`} />
                                  {/* Smooth curve line */}
                                  <path
                                    d={smoothPath}
                                    fill="none"
                                    stroke={strokeColor}
                                    strokeWidth={imageColors ? '2' : '1.5'}
                                    vectorEffect="non-scaling-stroke"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center mb-4">
                      <p className="text-gray-500 text-sm">Odds history not available</p>
                    </div>
                  )}
                </div>

                <div className="hidden lg:flex flex-col lg:flex-row gap-4 md:gap-6 lg:gap-6 flex-1 min-h-0">
                  {/* Left Column - Basic Info */}
                  <div className="flex-shrink-0 flex flex-col items-center lg:items-start lg:w-2/5">
                    {/* Nominee Image - Desktop only */}
                    <div
                      className="hidden lg:block w-full max-w-xs lg:max-w-none lg:w-full aspect-square rounded-xl overflow-hidden flex items-center justify-center mb-4 relative"
                      style={
                        imageColors
                          ? (() => {
                              const isDarkMode = imageColors.averageBrightness < 140;
                              if (isDarkMode) {
                                return {
                                  background: `linear-gradient(to bottom, ${hexToRgba(imageColors.primary, 0.18)}, ${hexToRgba(imageColors.secondary, 0.16)})`,
                                  backdropFilter: 'blur(16px) saturate(180%)',
                                  WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                                  border: `1px solid ${hexToRgba(imageColors.primary, 0.3)}`,
                                  boxShadow: `0 8px 24px ${hexToRgba(imageColors.primary, 0.12)}, inset 0 1px 0 ${hexToRgba(imageColors.primary, 0.1)}`,
                                  padding: '12px',
                                };
                              } else {
                                // Light mode: use white with transparency for frosted glass effect
                                return {
                                  background: `linear-gradient(to bottom, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.35))`,
                                  backdropFilter: 'blur(16px) saturate(180%)',
                                  WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                                  border: `1px solid rgba(255, 255, 255, 0.4)`,
                                  boxShadow: `0 8px 24px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.3)`,
                                  padding: '12px',
                                };
                              }
                            })()
                          : {
                              backdropFilter: 'blur(16px)',
                              WebkitBackdropFilter: 'blur(16px)',
                              background: 'rgba(243, 244, 246, 0.7)',
                              border: 'none',
                              boxShadow:
                                '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                              padding: '12px',
                            }
                      }
                    >
                      {imageError ? (
                        <div className="flex flex-col items-center justify-center p-8 text-gray-400">
                          <svg
                            className="w-16 h-16 mb-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          <p className="text-sm">No image available</p>
                        </div>
                      ) : (
                        <div className="relative w-full h-full rounded-lg overflow-hidden">
                          <img
                            src={getNomineeImage(
                              selectedNomineeInfo.nominee,
                              selectedNomineeInfo.category.id,
                              pool.year,
                            )}
                            alt={selectedNomineeInfo.nominee.name}
                            className="w-full h-full object-contain relative z-0"
                            style={{ padding: '12px' }}
                            onError={() => {
                              setImageError(true);
                              setImageColors(null);
                            }}
                            onLoad={(e) => {
                              const imgSrc = e.currentTarget.src;
                              extractImageColors(imgSrc)
                                .then((colors) => {
                                  setImageColors(colors);
                                })
                                .catch(() => {
                                  setImageColors(null);
                                });
                            }}
                          />
                          {imageColors && (
                            <div
                              className="absolute inset-0 pointer-events-none z-10 rounded-lg"
                              style={{
                                background: `radial-gradient(circle at center, transparent 50%, ${hexToRgba(imageColors.primary, 0.08)} 100%)`,
                                boxShadow: `inset 0 1px 0 ${hexToRgba(imageColors.primary, 0.1)}`,
                              }}
                            />
                          )}
                        </div>
                      )}
                    </div>

                    {/* First blurb - Desktop only */}
                    <div className="hidden lg:block text-center lg:text-left w-full lg:flex-shrink-0">
                      <p
                        className="text-base lg:text-sm leading-relaxed"
                        style={
                          imageColors
                            ? (() => {
                                const isDarkMode = imageColors.averageBrightness < 140;
                                return {
                                  color: getTextColorForMode(imageColors.secondary, isDarkMode),
                                  textShadow: isDarkMode
                                    ? `0 1px 1px ${hexToRgba(imageColors.secondary, 0.2)}`
                                    : 'none',
                                };
                              })()
                            : { color: '#374151' }
                        }
                      >
                        {selectedNomineeInfo.info.blurb_sentence_1}
                      </p>
                    </div>
                  </div>

                  {/* Right Column - Awards Info and Actions */}
                  <div className="flex-1 min-w-0 lg:w-3/5 flex flex-col min-h-0">
                    {/* Odds Trend - Desktop only */}
                    {oddsHistory && oddsHistory.length > 0 ? (
                      <div className="hidden lg:flex flex-col mb-3 lg:mb-4 flex-1 min-h-0 overflow-hidden">
                        <div className="p-3 lg:p-5 flex flex-col lg:h-auto lg:max-h-[300px] min-h-0">
                          {(() => {
                            const history = oddsHistory as Array<{
                              oddsPercentage: number;
                              snapshotTime: string;
                            }>;
                            const filteredHistory = filterOddsHistoryByDay(history);

                            const firstOdds = filteredHistory[0].oddsPercentage;
                            const currentOdds =
                              filteredHistory[filteredHistory.length - 1].oddsPercentage;
                            const maxOdds = Math.max(
                              ...filteredHistory.map((h) => h.oddsPercentage),
                            );
                            const minOdds = Math.min(
                              ...filteredHistory.map((h) => h.oddsPercentage),
                            );
                            const range = maxOdds - minOdds || 1;
                            const padding = range * 0.2;
                            const yMin = Math.max(0, minOdds - padding);
                            const yMax = maxOdds + padding;
                            const yRange = yMax - yMin;

                            const points = filteredHistory.map((h, i) => {
                              const x = (i / (filteredHistory.length - 1)) * 100;
                              const y = 100 - ((h.oddsPercentage - yMin) / yRange) * 100;
                              return { x, y, odds: h.oddsPercentage, time: h.snapshotTime };
                            });

                            const smoothPath = generateSmoothPath(points);
                            const areaPath = smoothPath + ` L 100,100 L 0,100 Z`;
                            const gradientId = `oddsGradient-${selectedNomineeInfo.nominee.id.replace(/[^a-zA-Z0-9]/g, '-')}`;

                            // Use extracted colors if available, fallback to default gold
                            const gradientColor1 = imageColors ? imageColors.primary : '#fbbf24';
                            const gradientColor2 = imageColors ? imageColors.secondary : '#fbbf24';
                            const strokeColor = imageColors ? imageColors.accent : '#f59e0b';
                            const oddsTextColor = imageColors ? imageColors.primary : undefined;

                            return (
                              <div
                                className="relative rounded-lg p-5"
                                style={{
                                  height: '200px',
                                  ...(imageColors
                                    ? (() => {
                                        const isDarkMode = imageColors.averageBrightness < 140;
                                        if (isDarkMode) {
                                          return {
                                            background: `linear-gradient(to bottom, ${hexToRgba(imageColors.primary, 0.15)}, ${hexToRgba(imageColors.secondary, 0.12)})`,
                                            backdropFilter: 'blur(12px) saturate(180%)',
                                            WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                                            border: `1px solid ${hexToRgba(imageColors.primary, 0.25)}`,
                                            boxShadow: `0 4px 16px ${hexToRgba(imageColors.primary, 0.1)}, inset 0 1px 0 ${hexToRgba(imageColors.primary, 0.08)}`,
                                          };
                                        } else {
                                          // Light mode: use white with transparency for frosted glass effect
                                          return {
                                            background: `linear-gradient(to bottom, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.2))`,
                                            backdropFilter: 'blur(12px) saturate(180%)',
                                            WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                                            border: `1px solid rgba(255, 255, 255, 0.3)`,
                                            boxShadow: `0 4px 16px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                                          };
                                        }
                                      })()
                                    : {
                                        backdropFilter: 'blur(12px)',
                                        WebkitBackdropFilter: 'blur(12px)',
                                        backgroundColor: 'rgba(255, 255, 255, 0.6)',
                                      }),
                                }}
                              >
                                {/* Odds labels */}
                                <div className="absolute top-0 left-0 right-0 flex justify-between items-start z-10 px-3 pt-3">
                                  <div className="flex flex-col">
                                    <span
                                      className="text-xs"
                                      style={
                                        imageColors
                                          ? (() => {
                                              const isDarkMode =
                                                imageColors.averageBrightness < 140;
                                              return {
                                                color: getTextColorForMode(
                                                  imageColors.primary,
                                                  isDarkMode,
                                                ),
                                              };
                                            })()
                                          : { color: '#6b7280' }
                                      }
                                    >
                                      Opening
                                    </span>
                                    <span
                                      className="text-lg font-bold oscars-gold"
                                      style={
                                        oddsTextColor && imageColors
                                          ? {
                                              color: getTextColorForMode(
                                                oddsTextColor,
                                                imageColors.averageBrightness < 140,
                                              ),
                                              fontWeight: '800',
                                            }
                                          : oddsTextColor
                                            ? {
                                                color: getTextColorForDarkBg(oddsTextColor),
                                                fontWeight: '800',
                                              }
                                            : undefined
                                      }
                                    >
                                      {firstOdds.toFixed(1)}%
                                    </span>
                                  </div>
                                  <div className="flex flex-col items-end">
                                    <span
                                      className="text-xs"
                                      style={
                                        imageColors
                                          ? (() => {
                                              const isDarkMode =
                                                imageColors.averageBrightness < 140;
                                              return {
                                                color: getTextColorForMode(
                                                  imageColors.primary,
                                                  isDarkMode,
                                                ),
                                              };
                                            })()
                                          : { color: '#6b7280' }
                                      }
                                    >
                                      Current
                                    </span>
                                    <span
                                      className="text-lg font-bold oscars-gold"
                                      style={
                                        oddsTextColor && imageColors
                                          ? {
                                              color: getTextColorForMode(
                                                oddsTextColor,
                                                imageColors.averageBrightness < 140,
                                              ),
                                              fontWeight: '800',
                                            }
                                          : oddsTextColor
                                            ? {
                                                color: getTextColorForDarkBg(oddsTextColor),
                                                fontWeight: '800',
                                              }
                                            : undefined
                                      }
                                    >
                                      {currentOdds.toFixed(1)}%
                                    </span>
                                  </div>
                                </div>

                                {/* Chart */}
                                <svg
                                  className="w-full h-full"
                                  viewBox="0 0 100 100"
                                  preserveAspectRatio="none"
                                  style={{ marginTop: '40px', height: 'calc(100% - 40px)' }}
                                >
                                  <defs>
                                    <linearGradient
                                      id={gradientId}
                                      x1="0%"
                                      y1="0%"
                                      x2="0%"
                                      y2="100%"
                                    >
                                      <stop
                                        offset="0%"
                                        stopColor={gradientColor1}
                                        stopOpacity={imageColors ? '0.7' : '0.2'}
                                      />
                                      <stop
                                        offset="50%"
                                        stopColor={gradientColor2}
                                        stopOpacity={imageColors ? '0.5' : '0.1'}
                                      />
                                      <stop
                                        offset="100%"
                                        stopColor={gradientColor2}
                                        stopOpacity={imageColors ? '0.3' : '0.05'}
                                      />
                                    </linearGradient>
                                  </defs>
                                  {/* Area fill */}
                                  <path d={areaPath} fill={`url(#${gradientId})`} />
                                  {/* Smooth curve line */}
                                  <path
                                    d={smoothPath}
                                    fill="none"
                                    stroke={strokeColor}
                                    strokeWidth={imageColors ? '2' : '1.5'}
                                    vectorEffect="non-scaling-stroke"
                                  />
                                </svg>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div className="hidden lg:block p-8 text-center">
                        <p className="text-gray-500 text-sm">Odds history not available</p>
                      </div>
                    )}

                    {/* Action Buttons - Desktop only */}
                    <div className="hidden lg:flex flex-col">
                      <div
                        className="p-3 lg:p-5 flex flex-col border-t"
                        style={
                          imageColors
                            ? (() => {
                                const isDarkMode = imageColors.averageBrightness < 140;
                                return {
                                  background: 'transparent',
                                  borderTopColor: isDarkMode
                                    ? hexToRgba(imageColors.primary, 0.3)
                                    : '#e5e7eb',
                                  borderTopWidth: '1px',
                                };
                              })()
                            : {
                                background: 'transparent',
                                borderTopColor: '#e5e7eb',
                                borderTopWidth: '1px',
                              }
                        }
                      >
                        <div className="flex flex-col gap-3">
                          {!isViewingOtherSubmission &&
                            (() => {
                              const existingPrediction = getPredictionForCategory(
                                selectedNomineeInfo.category.id,
                              );
                              const isSelected =
                                existingPrediction?.nomineeId === selectedNomineeInfo.nominee.id;

                              return (
                                <button
                                  onClick={() => {
                                    handleNomineeSelect(
                                      selectedNomineeInfo.category.id,
                                      selectedNomineeInfo.nominee.id,
                                    );
                                    closeNomineeModal();
                                  }}
                                  className={`w-full px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${
                                    isSelected
                                      ? 'cta-selected shadow-none hover:shadow-none'
                                      : 'cta-neutral-invert'
                                  }`}
                                >
                                  {isSelected ? '✓ Selected' : 'Select'}
                                </button>
                              );
                            })()}
                          <div className="flex flex-row gap-3">
                            <a
                              href={selectedNomineeInfo.info.imdb_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-lg transition-colors font-semibold focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 cta-header-secondary"
                            >
                              <span>IMDb</span>
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                />
                              </svg>
                            </a>
                            {selectedNomineeInfo.info.letterboxd_url ? (
                              <a
                                href={selectedNomineeInfo.info.letterboxd_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-lg transition-colors font-semibold focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 cta-header-secondary"
                              >
                                <span>Letterboxd</span>
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                  />
                                </svg>
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons - Mobile only, fixed at bottom */}
            <div
              className="lg:hidden flex-shrink-0 border-t px-6 py-4"
              style={
                imageColors
                  ? (() => {
                      return {
                        background: 'rgba(242, 232, 218, 0.92)',
                        borderTopColor: '#e5e7eb',
                        borderTopWidth: '1px',
                        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.05)',
                      };
                    })()
                  : {
                      background: '#F2E8DA',
                      borderTopColor: '#e5e7eb',
                      borderTopWidth: '1px',
                    }
              }
            >
              <div className="flex flex-col gap-3">
                {!isViewingOtherSubmission &&
                  (() => {
                    const existingPrediction = getPredictionForCategory(
                      selectedNomineeInfo.category.id,
                    );
                    const isSelected =
                      existingPrediction?.nomineeId === selectedNomineeInfo.nominee.id;

                    return (
                      <button
                        onClick={() => {
                          handleNomineeSelect(
                            selectedNomineeInfo.category.id,
                            selectedNomineeInfo.nominee.id,
                          );
                          closeNomineeModal();
                        }}
                        className={`w-full px-6 py-3 min-h-[44px] rounded-lg font-semibold shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${
                          isSelected
                            ? 'cta-selected shadow-none hover:shadow-none'
                            : 'cta-neutral-invert'
                        }`}
                      >
                        {isSelected ? '✓ Selected' : 'Select'}
                      </button>
                    );
                  })()}
                <div className="flex flex-row gap-3">
                  <a
                    href={selectedNomineeInfo.info.imdb_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-lg transition-colors font-semibold focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 cta-neutral-soft"
                  >
                    <span>IMDb</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                  {selectedNomineeInfo.info.letterboxd_url ? (
                    <a
                      href={selectedNomineeInfo.info.letterboxd_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-lg transition-colors font-semibold focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 cta-neutral-soft"
                    >
                      <span>Letterboxd</span>
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CopyFromOtherPoolButton({
  poolId,
  poolYear,
  onCopy,
}: {
  poolId: string;
  poolYear?: string;
  onCopy: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [copyResult, setCopyResult] = useState<{
    copied: number;
    skipped: number;
    total: number;
  } | null>(null);

  const { data: otherSubmissions, isLoading } = useQuery({
    queryKey: ['otherPoolSubmissions', poolId],
    queryFn: async () => {
      const response = await api.get(`/predictions/other-pools/${poolId}`);
      return response.data;
    },
    enabled: !!poolId,
  });

  const copyMutation = useMutation({
    mutationFn: async (sourcePoolId: string) => {
      const response = await api.post('/predictions/copy-from-pool', {
        targetPoolId: poolId,
        sourcePoolId,
      });
      return response.data;
    },
    onSuccess: (data) => {
      setCopyResult(data);
      setTimeout(() => {
        setShowModal(false);
        setCopyResult(null);
        setSelectedPoolId(null);
        onCopy();
      }, 2000);
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to copy predictions');
    },
  });

  const filteredSubmissions = otherSubmissions?.filter((sub: any) => sub.year === poolYear) || [];
  const hasCompletedSubmissions = filteredSubmissions.length > 0;

  if (!hasCompletedSubmissions) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-3 py-2.5 min-h-[44px] text-xs text-gray-600 hover:text-gray-800 active:text-gray-800 border border-gray-300 rounded hover:border-gray-400 hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation whitespace-nowrap flex-1 sm:flex-initial"
      >
        Copy Selections
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="oscars-font text-lg font-bold oscars-dark mb-4">Copy Selections</h3>

            {isLoading ? (
              <p className="text-gray-600 text-sm">Loading...</p>
            ) : filteredSubmissions.length === 0 ? (
              <p className="text-gray-600 text-sm mb-4">
                No completed ballots in other {poolYear} pools.
              </p>
            ) : (
              <>
                <p className="text-gray-600 text-xs mb-4">
                  We'll copy your selections from another pool but use the current odds.
                </p>
                <div className="space-y-2 mb-4">
                  {filteredSubmissions.map((submission: any) => (
                    <button
                      key={submission.poolId}
                      onClick={() => setSelectedPoolId(submission.poolId)}
                      className={`w-full text-left p-3 rounded border-2 transition-colors ${
                        selectedPoolId === submission.poolId
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      disabled={copyMutation.isPending}
                    >
                      <div className="font-semibold text-gray-900 text-sm">
                        {submission.poolName}
                      </div>
                    </button>
                  ))}
                </div>

                {copyResult && (
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                    Copied {copyResult.copied}{' '}
                    {copyResult.copied === 1 ? 'selection' : 'selections'}
                    {copyResult.skipped > 0 && (
                      <span className="block mt-1 text-xs">
                        Skipped {copyResult.skipped}{' '}
                        {copyResult.skipped === 1 ? 'category' : 'categories'} with winners.
                      </span>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowModal(false);
                  setCopyResult(null);
                  setSelectedPoolId(null);
                }}
                className="px-4 py-2 text-sm bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
                disabled={copyMutation.isPending}
              >
                {copyResult ? 'Close' : 'Cancel'}
              </button>
              {filteredSubmissions && filteredSubmissions.length > 0 && !copyResult && (
                <button
                  onClick={() => {
                    if (selectedPoolId) {
                      copyMutation.mutate(selectedPoolId);
                    }
                  }}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={copyMutation.isPending || !selectedPoolId}
                >
                  {copyMutation.isPending ? 'Copying...' : 'Copy'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ClearAllButton({
  poolId,
  actualWinners,
  onClear,
}: {
  poolId: string;
  actualWinners?: any[];
  onClear: () => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [skippedCount, setSkippedCount] = useState<number | null>(null);

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete('/predictions/all', {
        data: { poolId },
      });
      return response.data;
    },
    onSuccess: (data) => {
      setSkippedCount(data.skippedCategories || 0);
      setTimeout(() => {
        setShowConfirm(false);
        setSkippedCount(null);
        onClear();
      }, 2000);
    },
  });

  const announcedCount = actualWinners?.length || 0;

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="px-3 py-2.5 min-h-[44px] text-xs text-gray-600 hover:text-gray-800 active:text-gray-800 border border-gray-300 rounded hover:border-red-300 active:border-red-400 hover:bg-red-50 active:bg-red-100 transition-colors touch-manipulation whitespace-nowrap flex-1 sm:flex-initial"
      >
        Clear All
      </button>

      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="oscars-font text-xl font-bold oscars-dark mb-4">Clear All Picks?</h3>
            <p className="text-gray-700 mb-6">
              Are you sure you want to clear all your picks? This action cannot be undone.
              <br />
              <br />
              {announcedCount > 0 && (
                <>
                  <strong className="text-yellow-600">Note:</strong> Categories with announced
                  winners ({announcedCount} {announcedCount === 1 ? 'category' : 'categories'}) will
                  not be cleared.
                  <br />
                  <br />
                </>
              )}
              <strong className="text-red-600">Important:</strong> When you make new picks, they
              will use the current odds, which may be different from when you originally selected
              them. This means your potential points may change.
            </p>
            {skippedCount !== null && skippedCount > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800">
                  <strong>
                    Skipped {skippedCount} {skippedCount === 1 ? 'category' : 'categories'} with
                    announced winners.
                  </strong>
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowConfirm(false);
                  setSkippedCount(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
                disabled={clearAllMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={() => clearAllMutation.mutate()}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                disabled={clearAllMutation.isPending}
              >
                {clearAllMutation.isPending ? 'Clearing...' : 'Clear All Picks'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SubmissionNameEditor({
  poolId,
  currentName,
  defaultName,
  onUpdate,
}: {
  poolId: string;
  currentName: string | null;
  defaultName: string;
  onUpdate: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentName || defaultName);

  const updateName = useMutation({
    mutationFn: async (submissionName: string) => {
      const response = await api.patch(`/pools/${poolId}/submission-name`, {
        submissionName,
      });
      return response.data;
    },
    onSuccess: () => {
      setIsEditing(false);
      onUpdate();
    },
  });

  const displayName = currentName || defaultName;
  const trimmedCurrentName = (currentName ?? '').trim();
  const trimmedDefaultName = defaultName.trim();
  const isDefaultName = trimmedCurrentName.length === 0 || trimmedCurrentName === trimmedDefaultName;
  const renameButtonClasses = isDefaultName
    ? 'flex items-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-semibold rounded-full border-2 border-yellow-200 text-yellow-100 bg-yellow-100/10 shadow-md hover:bg-yellow-100/20 transition-all focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-slate-900'
    : 'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 rounded-md transition-colors';
  const displayNameClasses = `oscars-font text-lg sm:text-xl font-bold text-white whitespace-normal break-words ${
    isDefaultName
      ? 'inline-block px-2 py-1 rounded-md border border-dashed border-yellow-200/70 bg-yellow-100/10'
      : ''
  }`;

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1 w-full">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter ballot name..."
          className="oscars-font text-lg sm:text-xl font-bold text-slate-800 px-2 py-1 border-2 border-yellow-400 rounded bg-white w-full"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              updateName.mutate(name);
            } else if (e.key === 'Escape') {
              setIsEditing(false);
              setName(displayName);
            }
          }}
          onBlur={() => {
            updateName.mutate(name);
          }}
        />
        <p className="text-xs text-white/70">Press Enter to save, Esc to cancel.</p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 w-full">
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="flex-1 text-left"
        aria-label="Edit ballot name"
      >
        <h2 className={displayNameClasses}>{displayName}</h2>
        {isDefaultName && (
          <p className="mt-1 text-[11px] uppercase tracking-wide text-yellow-100/90">
            Click to rename
          </p>
        )}
      </button>
      {!isDefaultName && (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className={renameButtonClasses}
          title="Rename ballot"
          aria-label="Rename ballot"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          Rename
        </button>
      )}
    </div>
  );
}
