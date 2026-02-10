type BackButtonProps = {
  onClick: () => void;
  className?: string;
  ariaLabel?: string;
};

const baseClasses =
  'flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 text-white hover:text-yellow-300 hover:bg-white/10 active:bg-white/20 rounded-full transition-all touch-manipulation focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-slate-900';

export default function BackButton({
  onClick,
  className = '',
  ariaLabel = 'Go back',
}: BackButtonProps) {
  const classes = className ? `${baseClasses} ${className}` : baseClasses;

  return (
    <button type="button" onClick={onClick} className={classes} aria-label={ariaLabel}>
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  );
}
