export function UnauthHero() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-rose-50 p-6 shadow">
      <div className="absolute -top-16 -right-10 h-40 w-40 rounded-full bg-amber-200/30 blur-2xl" />
      <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-rose-200/30 blur-2xl" />
      <div className="relative">
        <p className="text-xs uppercase tracking-[0.2em] text-amber-700/80">Award Season is here!</p>
        <h1 className="oscars-font text-2xl sm:text-3xl font-bold text-slate-900 mt-2">
          Turn predictions into a real competition.
        </h1>
        <p className="text-sm sm:text-base text-slate-700 mt-3 max-w-xl">
          Make your picks, watch the show, and see the leaderboard move in real time. Create or
          join a pool in seconds.
        </p>
      </div>
    </div>
  );
}

export function UnauthHowItWorks() {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
        <h2 className="oscars-font text-base sm:text-lg font-bold">How It Works</h2>
      </div>
      <div className="px-4 sm:px-6 py-6">
        <div className="grid gap-4 sm:grid-cols-3 text-sm text-gray-700">
          <div className="rounded-lg border border-gray-200 p-4 bg-gray-50 flex h-full flex-col">
            <div className="text-xs uppercase tracking-wide text-gray-500">Step 1</div>
            <div className="font-semibold oscars-dark mt-1">Start or join a pool</div>
            <div className="text-xs text-gray-600 mt-1">
              Create a private link or join a group in seconds.
            </div>
            <div className="mt-auto pt-3 text-xs text-amber-700 font-semibold">
              Play it casual or competitive.
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 p-4 bg-gray-50 flex h-full flex-col">
            <div className="text-xs uppercase tracking-wide text-gray-500">Step 2</div>
            <div className="font-semibold oscars-dark mt-1">Lock your picks</div>
            <div className="text-xs text-gray-600 mt-1">
              Pick winners in every category, then add odds multipliers.
            </div>
            <div className="mt-auto pt-3 text-xs text-amber-700 font-semibold">
              Clean picks. Instant scoring.
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 p-4 bg-gray-50 flex h-full flex-col">
            <div className="text-xs uppercase tracking-wide text-gray-500">Step 3</div>
            <div className="font-semibold oscars-dark mt-1">Watch the show</div>
            <div className="text-xs text-gray-600 mt-1">
              Scores update live as winners are announced.
            </div>
            <div className="mt-auto pt-3 text-xs text-amber-700 font-semibold">
              Celebrate the champ and the best calls.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UnauthMarketing() {
  return (
    <div className="space-y-6">
      <UnauthHero />
      <UnauthHowItWorks />
    </div>
  );
}
