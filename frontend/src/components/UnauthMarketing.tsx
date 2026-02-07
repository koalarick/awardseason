export default function UnauthMarketing() {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-rose-50 p-6 shadow">
        <div className="absolute -top-16 -right-10 h-40 w-40 rounded-full bg-amber-200/30 blur-2xl" />
        <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-rose-200/30 blur-2xl" />
        <div className="relative">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-700/80">Oscars Night, Elevated</p>
          <h1 className="oscars-font text-2xl sm:text-3xl font-bold text-slate-900 mt-2">
            Turn predictions into a real competition.
          </h1>
          <p className="text-sm sm:text-base text-slate-700 mt-3 max-w-xl">
            Make picks, watch the ceremony, and see the leaderboard update as winners are announced.
            Build private pools for friends or run a paid bracket with custom payouts.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-full bg-white/70 text-xs font-semibold text-slate-700 border border-slate-200">
              Private pools
            </span>
            <span className="px-3 py-1 rounded-full bg-white/70 text-xs font-semibold text-slate-700 border border-slate-200">
              Live scoring
            </span>
            <span className="px-3 py-1 rounded-full bg-white/70 text-xs font-semibold text-slate-700 border border-slate-200">
              Odds multipliers
            </span>
            <span className="px-3 py-1 rounded-full bg-white/70 text-xs font-semibold text-slate-700 border border-slate-200">
              Custom payouts
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
          <h2 className="oscars-font text-base sm:text-lg font-bold">Why People Sign Up</h2>
        </div>
        <div className="px-4 sm:px-6 py-6">
          <ul className="space-y-4 text-sm text-gray-700">
            <li className="flex items-start gap-3">
              <span className="text-yellow-600 font-bold mt-0.5">◆</span>
              <span>
                <strong className="oscars-dark">Bragging rights, guaranteed.</strong> Your
                leaderboard updates as winners are announced.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow-600 font-bold mt-0.5">◆</span>
              <span>
                <strong className="oscars-dark">No spreadsheets.</strong> Invite friends, track
                picks, and score automatically.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-yellow-600 font-bold mt-0.5">◆</span>
              <span>
                <strong className="oscars-dark">Flexible pools.</strong> Free, paid, casual, or
                competitive — you decide.
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
          <h2 className="oscars-font text-base sm:text-lg font-bold">How It Works</h2>
        </div>
        <div className="px-4 sm:px-6 py-6">
          <div className="grid gap-4 sm:grid-cols-3 text-sm text-gray-700">
            <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
              <div className="text-xs uppercase tracking-wide text-gray-500">Step 1</div>
              <div className="font-semibold oscars-dark mt-1">Create a pool</div>
              <div className="text-xs text-gray-600 mt-1">Private link for friends, or go public.</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
              <div className="text-xs uppercase tracking-wide text-gray-500">Step 2</div>
              <div className="font-semibold oscars-dark mt-1">Make picks</div>
              <div className="text-xs text-gray-600 mt-1">
                Choose winners across every category.
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
              <div className="text-xs uppercase tracking-wide text-gray-500">Step 3</div>
              <div className="font-semibold oscars-dark mt-1">Watch & win</div>
              <div className="text-xs text-gray-600 mt-1">Scores update as the show unfolds.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
