import { useEffect, useState, type ReactNode } from 'react';

type MoviePosterProps = {
  title: string;
  src: string;
  fallbackSrcs?: string[];
  containerClassName?: string;
  imageClassName?: string;
  badge?: ReactNode;
  fallbackVariant?: 'compact' | 'full';
};

export default function MoviePoster({
  title,
  src,
  fallbackSrcs,
  containerClassName = '',
  imageClassName = 'w-full h-full object-cover',
  badge,
  fallbackVariant = 'full',
}: MoviePosterProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMissing, setIsMissing] = useState(false);

  const fallbackKey = fallbackSrcs?.join('|') ?? '';
  const sources = [src, ...(fallbackSrcs ?? [])].filter(Boolean);
  const activeSrc = sources[currentIndex] ?? '';

  useEffect(() => {
    setCurrentIndex(0);
    setIsMissing(false);
  }, [src, fallbackKey]);

  return (
    <div className={`relative overflow-hidden ${containerClassName}`}>
      {!isMissing && activeSrc ? (
        <img
          src={activeSrc}
          alt={title}
          className={imageClassName}
          onError={() => {
            const nextIndex = currentIndex + 1;
            if (nextIndex < sources.length) {
              setCurrentIndex(nextIndex);
            } else {
              setIsMissing(true);
            }
          }}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 text-gray-500 px-2 text-center">
          <span className="text-[9px] uppercase tracking-[0.2em] text-gray-400 font-semibold">
            Poster
          </span>
          {fallbackVariant === 'full' ? (
            <span className="mt-2 text-[11px] text-gray-600 font-semibold leading-snug">
              {title}
            </span>
          ) : (
            <span className="mt-1 text-[10px] text-gray-500">Coming soon</span>
          )}
        </div>
      )}
      {badge}
    </div>
  );
}
