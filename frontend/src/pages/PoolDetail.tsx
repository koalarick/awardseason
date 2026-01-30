import { useState, useRef, useEffect, useMemo } from 'react'
import type { FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import type { AuthUser } from '../context/AuthContext'
import type {
  ActualWinner,
  Category,
  OddsMultiplierFormula,
  PayoutStructureEntry,
  Pool,
  PoolMember,
  PoolSettings,
  PoolSubmission,
  Prediction,
} from '../types/pool'

// Submissions Lock Countdown Component
function SubmissionsLockCountdown({ ceremonyDate }: { ceremonyDate: Date | string }) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })

  // Calculate lock time: 24 hours (1 day) before ceremony
  const lockTime = useMemo(() => {
    const ceremony = new Date(ceremonyDate)
    return new Date(ceremony.getTime() - 24 * 60 * 60 * 1000)
  }, [ceremonyDate])

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime()
      const lock = lockTime.getTime()
      const difference = lock - now

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000),
        })
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
      }
    }

    calculateTimeLeft()
    const interval = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(interval)
  }, [lockTime])

  const isLocked = new Date().getTime() >= lockTime.getTime()

  if (isLocked) {
    return (
      <div className="w-full bg-gradient-to-r from-red-50 to-red-100/50 border-b-2 border-red-600 py-2 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs sm:text-sm text-center oscars-red-text font-bold flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Ballots are now locked
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full bg-gradient-to-r from-red-50 to-red-100/50 border-b-2 border-red-600 py-2 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 oscars-red-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="oscars-font text-xs sm:text-sm font-bold oscars-red-text">Ballots Lock In:</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {timeLeft.days > 0 && (
              <>
                <div className="bg-white/80 rounded px-2 py-1 border border-red-200 shadow-sm min-w-[50px] sm:min-w-[60px]">
                  <p className="text-[9px] sm:text-[10px] oscars-red-text/60 mb-0.5 uppercase tracking-wider font-semibold text-center">Days</p>
                  <p className="font-bold text-lg sm:text-xl oscars-red-text text-center leading-none">{String(timeLeft.days).padStart(2, '0')}</p>
                </div>
                <span className="oscars-red-text/40 text-lg sm:text-xl font-bold">:</span>
              </>
            )}
            <div className="bg-white/80 rounded px-2 py-1 border border-red-200 shadow-sm min-w-[50px] sm:min-w-[60px]">
              <p className="text-[9px] sm:text-[10px] oscars-red-text/60 mb-0.5 uppercase tracking-wider font-semibold text-center">Hours</p>
              <p className="font-bold text-lg sm:text-xl oscars-red-text text-center leading-none">{String(timeLeft.hours).padStart(2, '0')}</p>
            </div>
            <span className="oscars-red-text/40 text-lg sm:text-xl font-bold">:</span>
            <div className="bg-white/80 rounded px-2 py-1 border border-red-200 shadow-sm min-w-[50px] sm:min-w-[60px]">
              <p className="text-[9px] sm:text-[10px] oscars-red-text/60 mb-0.5 uppercase tracking-wider font-semibold text-center">Minutes</p>
              <p className="font-bold text-lg sm:text-xl oscars-red-text text-center leading-none">{String(timeLeft.minutes).padStart(2, '0')}</p>
            </div>
            <span className="oscars-red-text/40 text-lg sm:text-xl font-bold">:</span>
            <div className="bg-white/80 rounded px-2 py-1 border border-red-200 shadow-sm min-w-[50px] sm:min-w-[60px]">
              <p className="text-[9px] sm:text-[10px] oscars-red-text/60 mb-0.5 uppercase tracking-wider font-semibold text-center">Seconds</p>
              <p className="font-bold text-lg sm:text-xl oscars-red-text text-center leading-none">{String(timeLeft.seconds).padStart(2, '0')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
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
      'casting',
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
    ],
  },
]

// Get default points for a category based on its type
function getDefaultPointsForCategory(categoryId: string): number {
  if (categoryGroups[0].categoryIds.includes(categoryId)) {
    return 10 // Major
  } else if (categoryGroups[1].categoryIds.includes(categoryId)) {
    return 3 // Technical
  } else if (categoryGroups[2].categoryIds.includes(categoryId)) {
    return 5 // Film Categories
  }
  // Fallback to 10 if category not found in any group
  return 10
}

type ApiError = { response?: { data?: { error?: string } } }

const getApiErrorMessage = (error: unknown, fallback: string) =>
  (error as ApiError)?.response?.data?.error || fallback

type CreatePoolPayload = {
  name: string
  year: string
  password?: string
  isPublic: boolean
  isPaidPool: boolean
  entryAmount?: number
  venmoAlias?: string
  payoutStructure?: PayoutStructureEntry[]
  oddsMultiplierEnabled: boolean
  oddsMultiplierFormula: string
  categoryPoints?: Record<string, number>
}

type PoolUpdatePayload = {
  name?: string
  isPaidPool?: boolean
  entryAmount?: number | null
  venmoAlias?: string | null
}

type RankedSubmission = PoolSubmission & { originalRank: number }

// Pool Creation Form Component
function PoolCreationForm({ navigate }: { navigate: (path: string) => void }) {
  const [name, setName] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [password, setPassword] = useState('')
  const [isPaidPool, setIsPaidPool] = useState(false)
  const [entryAmount, setEntryAmount] = useState('')
  const [venmoAlias, setVenmoAlias] = useState('')
  const [payoutStructure, setPayoutStructure] = useState<PayoutStructureEntry[]>([
    { position: 1, percentage: 100 }
  ])
  const [oddsMultiplierEnabled, setOddsMultiplierEnabled] = useState(true)
  const [oddsMultiplierFormula, setOddsMultiplierFormula] = useState('log')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const queryClient = useQueryClient()
  
  // Category base values
  const currentYear = new Date().getFullYear().toString()
  const [categoryPoints, setCategoryPoints] = useState<Record<string, number>>({})
  const [useDefaultCategoryPoints, setUseDefaultCategoryPoints] = useState(true)
  
  // Fetch categories for the year
  const { data: categories, isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ['nominees', currentYear],
    queryFn: async () => {
      const response = await api.get(`/nominees/${currentYear}`)
      return response.data as Category[]
    },
    enabled: true,
  })
  
  // Note: categoryPoints only stores custom values (non-default)
  // If a category is not in categoryPoints, it uses its default value

  const createPool = useMutation<Pool, ApiError, CreatePoolPayload>({
    mutationFn: async (data: CreatePoolPayload) => {
      const response = await api.post('/pools', data)
      return response.data as Pool
    },
    onSuccess: (pool) => {
      // Invalidate pools query so Dashboard shows the new pool
      queryClient.invalidateQueries({ queryKey: ['pools'] })
      navigate(`/pool/${pool.id}`)
    },
    onError: (error: unknown) => {
      setErrors({ submit: getApiErrorMessage(error, 'Failed to create pool') })
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setErrors({})

    // Validation
    const newErrors: Record<string, string> = {}
    if (!name.trim()) {
      newErrors.name = 'Pool name is required'
    }
    if (!isPublic && !password.trim()) {
      newErrors.password = 'Password is required for private pools'
    }
    if (isPaidPool) {
      if (!entryAmount || parseFloat(entryAmount) <= 0) {
        newErrors.entryAmount = 'Entry amount must be greater than 0'
      }
      if (!venmoAlias.trim()) {
        newErrors.venmoAlias = 'Venmo alias is required for paid pools'
      }
      // Validate payout structure
      const totalPercentage = payoutStructure.reduce((sum, item) => sum + item.percentage, 0)
      if (Math.abs(totalPercentage - 100) > 0.01) {
        newErrors.payoutStructure = `Payout structure must equal 100% (currently ${totalPercentage.toFixed(1)}%)`
      }
      if (payoutStructure.length === 0) {
        newErrors.payoutStructure = 'At least one payout position is required'
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    // categoryPoints already only contains custom values (non-default)
    // Send it if there are any custom values and user is not using defaults
    createPool.mutate({
      name: name.trim(),
      year: currentYear,
      password: isPublic ? undefined : password,
      isPublic,
      isPaidPool,
      entryAmount: isPaidPool ? parseFloat(entryAmount) : undefined,
      venmoAlias: isPaidPool ? venmoAlias.trim() : undefined,
      payoutStructure: isPaidPool ? payoutStructure : undefined,
      oddsMultiplierEnabled,
      oddsMultiplierFormula,
      categoryPoints: !useDefaultCategoryPoints && Object.keys(categoryPoints).length > 0 ? categoryPoints : undefined,
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 oscars-red text-white py-3 px-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-white hover:text-yellow-300 text-sm py-2 px-2 -mx-2 min-h-[44px] flex items-center"
          >
            ← Back
          </button>
          <h1 className="oscars-font text-lg font-bold">Create New Pool</h1>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-4 sm:p-6">
        <form id="pool-creation-form" onSubmit={handleSubmit} className="space-y-6" autoComplete="off" noValidate data-form-type="other">
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
              <h2 className="oscars-font text-base sm:text-lg font-bold">Basic Information</h2>
            </div>
            <div className="px-4 sm:px-6 py-6 space-y-4">
              {/* Pool Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium oscars-dark mb-2">
                  Pool Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  autoComplete="off"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Family Oscars Pool"
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              {/* Public/Private Toggle */}
              <div>
                <label htmlFor="isPublic" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    id="isPublic"
                    name="isPublic"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                  />
                  <span className="text-sm font-medium oscars-dark">Public Pool (anyone can join)</span>
                </label>
              </div>

              {/* Password (if private) */}
              {!isPublic && (
                <div>
                  <label htmlFor="password" className="block text-sm font-medium oscars-dark mb-2">
                    Password *
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 ${
                      errors.password ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter pool password"
                  />
                  {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                </div>
              )}
            </div>
          </div>

          {/* Category Base Values */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
              <h2 className="oscars-font text-base sm:text-lg font-bold">Category Base Values</h2>
            </div>
            <div className="px-4 sm:px-6 py-6">
              <label className="flex items-start gap-3 cursor-pointer group mb-4">
                <input
                  type="checkbox"
                  checked={useDefaultCategoryPoints}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setUseDefaultCategoryPoints(checked)
                    // Clear custom category points when using defaults
                    if (checked) {
                      setCategoryPoints({})
                    }
                  }}
                  className="w-4 h-4 mt-0.5 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500 cursor-pointer flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium oscars-dark block">Use default category points</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    All categories will use their default point values: Major categories (10 pts), Technical (3 pts), Film Categories (5 pts)
                  </p>
                </div>
              </label>
              
              {!useDefaultCategoryPoints && (
                <>
                  {categoriesLoading ? (
                    <div className="text-center py-4 text-gray-500">Loading categories...</div>
                  ) : categories && categories.length > 0 ? (
                    <div className="space-y-6 max-h-96 overflow-y-auto pt-2 border-t border-gray-200">
                      {categoryGroups.map((group) => {
                        // Filter categories that belong to this group
                        const groupCategories = categories.filter(cat => 
                          group.categoryIds.includes(cat.id)
                        )
                        
                        if (groupCategories.length === 0) return null
                        
                        return (
                          <div key={group.name} className="space-y-3">
                            <h3 className="text-sm font-semibold oscars-dark uppercase tracking-wide">
                              {group.name}
                            </h3>
                            <div className="space-y-2 pl-2">
                              {groupCategories.map((category) => {
                                const defaultPoints = getDefaultPointsForCategory(category.id)
                                return (
                                  <div key={category.id} className="flex items-center gap-3">
                                    <label className="flex-1 text-sm font-medium oscars-dark min-w-0">
                                      <span className="truncate block">{category.name}</span>
                                      <span className="text-xs text-gray-500 font-normal">Default: {defaultPoints} pts</span>
                                    </label>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={categoryPoints[category.id] || ''}
                                        onChange={(e) => {
                                          const inputValue = e.target.value.trim()
                                          if (inputValue === '') {
                                            // Remove from categoryPoints to use default
                                            setCategoryPoints(prev => {
                                              const updated = { ...prev }
                                              delete updated[category.id]
                                              return updated
                                            })
                                          } else {
                                            const value = parseInt(inputValue)
                                            if (!isNaN(value) && value >= 1 && value !== defaultPoints) {
                                              // Only store if different from default
                                              setCategoryPoints(prev => ({
                                                ...prev,
                                                [category.id]: value
                                              }))
                                            } else if (!isNaN(value) && value >= 1 && value === defaultPoints) {
                                              // If user sets to default, remove from custom values
                                              setCategoryPoints(prev => {
                                                const updated = { ...prev }
                                                delete updated[category.id]
                                                return updated
                                              })
                                            }
                                          }
                                        }}
                                        placeholder={defaultPoints.toString()}
                                        className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                      />
                                      <span className="text-xs text-gray-500 w-8">pts</span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                      
                      {/* Show any categories not in any group */}
                      {(() => {
                        const allGroupedIds = categoryGroups.flatMap(g => g.categoryIds)
                        const ungroupedCategories = categories.filter(cat => 
                          !allGroupedIds.includes(cat.id)
                        )
                        
                        if (ungroupedCategories.length === 0) return null
                        
                        return (
                          <div className="space-y-3">
                            <h3 className="text-sm font-semibold oscars-dark uppercase tracking-wide">
                              Other
                            </h3>
                            <div className="space-y-2 pl-2">
                              {ungroupedCategories.map((category) => {
                                const defaultPoints = getDefaultPointsForCategory(category.id)
                                return (
                                  <div key={category.id} className="flex items-center gap-3">
                                    <label className="flex-1 text-sm font-medium oscars-dark min-w-0">
                                      <span className="truncate block">{category.name}</span>
                                      <span className="text-xs text-gray-500 font-normal">Default: {defaultPoints} pts</span>
                                    </label>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={categoryPoints[category.id] || ''}
                                        onChange={(e) => {
                                          const inputValue = e.target.value.trim()
                                          if (inputValue === '') {
                                            // Remove from categoryPoints to use default
                                            setCategoryPoints(prev => {
                                              const updated = { ...prev }
                                              delete updated[category.id]
                                              return updated
                                            })
                                          } else {
                                            const value = parseInt(inputValue)
                                            if (!isNaN(value) && value >= 1 && value !== defaultPoints) {
                                              // Only store if different from default
                                              setCategoryPoints(prev => ({
                                                ...prev,
                                                [category.id]: value
                                              }))
                                            } else if (!isNaN(value) && value >= 1 && value === defaultPoints) {
                                              // If user sets to default, remove from custom values
                                              setCategoryPoints(prev => {
                                                const updated = { ...prev }
                                                delete updated[category.id]
                                                return updated
                                              })
                                            }
                                          }
                                        }}
                                        placeholder={defaultPoints.toString()}
                                        className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                      />
                                      <span className="text-xs text-gray-500 w-8">pts</span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">No categories found for year {currentYear}</div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Scoring Settings */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
              <h2 className="oscars-font text-base sm:text-lg font-bold">Scoring Settings</h2>
            </div>
            <div className="px-4 sm:px-6 py-6">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={oddsMultiplierEnabled}
                  onChange={(e) => setOddsMultiplierEnabled(e.target.checked)}
                  className="w-4 h-4 mt-0.5 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500 cursor-pointer flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium oscars-dark block">Odds Multiplier</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Multiply points based on how unlikely a pick is to win
                  </p>
                </div>
              </label>

              {oddsMultiplierEnabled && (
                <div className="mt-4 ml-7 space-y-3">
                  <div>
                    <label className="text-xs font-medium oscars-dark block mb-2">Formula</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { name: 'Linear', value: 'linear', description: 'Simple linear scaling' },
                        { name: 'Logarithmic', value: 'log', description: 'Rewards underdogs more than linear' },
                        { name: 'Square Root', value: 'sqrt', description: 'Moderate reward for underdogs' },
                        { name: 'Inverse', value: 'inverse', description: 'Maximum reward for underdogs' },
                      ].map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setOddsMultiplierFormula(preset.value)}
                          className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                            oddsMultiplierFormula === preset.value
                              ? 'bg-yellow-50 border-yellow-400 text-yellow-700 font-medium'
                              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {[
                        { name: 'Linear', value: 'linear', description: 'Simple linear scaling' },
                        { name: 'Logarithmic', value: 'log', description: 'Rewards underdogs more than linear' },
                        { name: 'Square Root', value: 'sqrt', description: 'Moderate reward for underdogs' },
                        { name: 'Inverse', value: 'inverse', description: 'Maximum reward for underdogs' },
                      ].find(p => p.value === oddsMultiplierFormula)?.description}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment Settings */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
              <h2 className="oscars-font text-base sm:text-lg font-bold">Payment Settings</h2>
            </div>
            <div className="px-4 sm:px-6 py-6 space-y-4">
              {/* Paid Pool Toggle */}
              <div>
                <label htmlFor="isPaidPool" className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    id="isPaidPool"
                    name="isPaidPool"
                    checked={isPaidPool}
                    onChange={(e) => setIsPaidPool(e.target.checked)}
                    className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                  />
                  <span className="text-sm font-medium oscars-dark">Enable paid pool (entry fee required)</span>
                </label>
              </div>

              {/* Payment Notice */}
              {isPaidPool && (
                <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold text-lg leading-none mt-0.5">⚠</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-900 mb-1">Payment Responsibility</p>
                      <p className="text-xs text-amber-800">
                        All entry fees and payouts take place <strong>outside of this platform</strong> and are the <strong>sole responsibility of the pool owner</strong>. This platform does not handle, process, or guarantee any payments.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Paid Pool Fields */}
              {isPaidPool && (
                <div className="space-y-4 pt-2 border-t border-gray-200">
                  {/* Entry Amount and Venmo in a grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="entryAmount" className="block text-sm font-medium oscars-dark mb-2">
                        Entry Amount ($) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input
                          type="number"
                          id="entryAmount"
                          name="entryAmount"
                          autoComplete="off"
                          value={entryAmount}
                          onChange={(e) => setEntryAmount(e.target.value)}
                          min="0.01"
                          step="0.01"
                          className={`w-full pl-7 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 ${
                            errors.entryAmount ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="10.00"
                        />
                      </div>
                      {errors.entryAmount && <p className="mt-1 text-sm text-red-600">{errors.entryAmount}</p>}
                    </div>

                    <div>
                      <label htmlFor="venmoAlias" className="block text-sm font-medium oscars-dark mb-2">
                        Venmo Alias *
                      </label>
                      <input
                        type="text"
                        id="venmoAlias"
                        name="venmoAlias"
                        autoComplete="off"
                        value={venmoAlias}
                        onChange={(e) => setVenmoAlias(e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 ${
                          errors.venmoAlias ? 'border-red-500' : 'border-gray-300'
                        }`}
                        placeholder="@your-venmo-alias"
                      />
                      {errors.venmoAlias && <p className="mt-1 text-sm text-red-600">{errors.venmoAlias}</p>}
                      <p className="mt-1 text-xs text-gray-500">Members will send entry fees to this Venmo account. You are responsible for collecting fees and distributing payouts.</p>
                    </div>
                  </div>

                  {/* Payout Structure */}
                  <div className="pt-2 border-t border-gray-200">
                    <label className="block text-sm font-medium oscars-dark mb-3">Payout Structure</label>
                    
                    {/* Preset Selector */}
                    <div className="mb-3">
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { name: 'Winner Takes All', structure: [{ position: 1, percentage: 100 }] },
                          { name: '60/30/10', structure: [{ position: 1, percentage: 60 }, { position: 2, percentage: 30 }, { position: 3, percentage: 10 }] },
                          { name: '50/30/20', structure: [{ position: 1, percentage: 50 }, { position: 2, percentage: 30 }, { position: 3, percentage: 20 }] },
                        ].map((preset) => {
                          const isSelected = JSON.stringify(payoutStructure) === JSON.stringify(preset.structure)
                          return (
                            <button
                              key={preset.name}
                              type="button"
                              onClick={() => setPayoutStructure(preset.structure)}
                              className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                                isSelected
                                  ? 'bg-yellow-50 border-yellow-400 text-yellow-700 font-medium'
                                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {preset.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Custom Editor */}
                    <div className="space-y-2">
                      {payoutStructure.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 flex-shrink-0 w-20">
                            <span className="text-xs text-gray-600 font-medium">{item.position}</span>
                            <span className="text-xs text-gray-500">place</span>
                          </div>
                          <div className="relative flex-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={item.percentage === 0 ? '' : item.percentage}
                              onChange={(e) => {
                                const numValue = e.target.value === '' ? 0 : parseFloat(e.target.value)
                                if (isNaN(numValue) || numValue < 0) return
                                const newStructure = [...payoutStructure]
                                newStructure[index] = { ...newStructure[index], percentage: Math.min(100, numValue) }
                                setPayoutStructure(newStructure)
                                const { payoutStructure: _, ...restErrors } = errors
                                setErrors(restErrors)
                              }}
                              placeholder="0"
                              className="w-full px-3 py-2 pr-8 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</span>
                          </div>
                          {payoutStructure.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const removedPercentage = payoutStructure[index].percentage
                                const newStructure = payoutStructure.filter((_, i) => i !== index).map((item, i) => ({
                                  ...item,
                                  position: i + 1,
                                }))
                                if (newStructure.length > 0) {
                                  newStructure[0].percentage += removedPercentage
                                }
                                setPayoutStructure(newStructure)
                                const { payoutStructure: _, ...restErrors } = errors
                                setErrors(restErrors)
                              }}
                              className="px-2 py-1 text-xs text-red-600 hover:text-red-700 flex-shrink-0"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const remaining = 100 - payoutStructure.reduce((sum, item) => sum + item.percentage, 0)
                          setPayoutStructure([...payoutStructure, { position: payoutStructure.length + 1, percentage: Math.max(0, remaining) }])
                          const { payoutStructure: _, ...restErrors } = errors
                          setErrors(restErrors)
                        }}
                        className="text-xs text-yellow-600 hover:text-yellow-700 font-medium"
                      >
                        + Add Position
                      </button>
                    </div>

                    {/* Total Percentage Display */}
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">Total:</span>
                        <span className={`text-xs font-semibold ${
                          Math.abs(payoutStructure.reduce((sum, item) => sum + item.percentage, 0) - 100) < 0.01
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}>
                          {payoutStructure.reduce((sum, item) => sum + item.percentage, 0).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {errors.payoutStructure && (
                      <p className="mt-2 text-sm text-red-600">{errors.payoutStructure}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              id="cancel-button"
              onClick={() => navigate('/')}
              className="px-6 py-2.5 min-h-[44px] bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors text-sm font-medium touch-manipulation"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-button"
              disabled={createPool.isPending}
              className="px-6 py-2.5 min-h-[44px] oscars-gold-bg text-white rounded-lg hover:opacity-90 active:opacity-80 disabled:opacity-50 transition-opacity text-sm font-medium touch-manipulation flex-1"
            >
              {createPool.isPending ? 'Creating...' : 'Create Pool'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}

// Pool Name Editor Component (inline)
function PoolNameEditor({
  poolId,
  currentName,
  onUpdate
}: {
  poolId: string
  currentName: string
  onUpdate: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(currentName)
  const [error, setError] = useState<string | null>(null)

  const updatePool = useMutation<Pool, ApiError, string>({
    mutationFn: async (newName: string) => {
      const response = await api.put(`/pools/${poolId}`, { name: newName.trim() })
      return response.data as Pool
    },
    onSuccess: () => {
      setIsEditing(false)
      setError(null)
      onUpdate()
    },
    onError: (error: unknown) => {
      setError(getApiErrorMessage(error, 'Failed to update pool name'))
    },
  })

  const handleSave = () => {
    if (!name.trim()) {
      setError('Pool name is required')
      return
    }
    updatePool.mutate(name)
  }

  const handleCancel = () => {
    setName(currentName)
    setIsEditing(false)
    setError(null)
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSave()
            } else if (e.key === 'Escape') {
              handleCancel()
            }
          }}
          className="flex-1 px-2 py-1 oscars-font text-base sm:text-lg font-bold text-white bg-white/20 border-2 border-yellow-400 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400"
          autoFocus
        />
            <button
          onClick={handleSave}
          disabled={updatePool.isPending}
          className="px-2 py-1 text-white hover:text-yellow-300 transition-colors disabled:opacity-50"
          title="Save"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
            </button>
        <button
          onClick={handleCancel}
          className="px-2 py-1 text-white hover:text-yellow-300 transition-colors"
          title="Cancel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {error && (
          <span className="text-xs text-red-200 ml-2">{error}</span>
        )}
          </div>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <h2 className="oscars-font text-base sm:text-lg font-bold truncate flex-1">{currentName}</h2>
      <button
        onClick={() => setIsEditing(true)}
        className="text-white/70 hover:text-white transition-colors p-1 flex-shrink-0"
        title="Edit pool name"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
      </div>
    )
  }

// Pool Info Editor Component (just paid pool toggle now)
function PoolInfoEditor({
  poolId,
  currentPool,
  onUpdate,
  onSave,
  onPaidPoolChange
}: {
  poolId: string
  currentPool: Pool
  onUpdate: () => void
  onSave?: (saveFn: () => Promise<boolean>) => void
  onPaidPoolChange?: (isPaidPool: boolean) => void
}) {
  const [isPaidPool, setIsPaidPool] = useState(currentPool.isPaidPool || false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const updatePool = useMutation<Pool, ApiError, PoolUpdatePayload>({
    mutationFn: async (data: PoolUpdatePayload) => {
      const response = await api.put(`/pools/${poolId}`, data)
      return response.data as Pool
    },
    onSuccess: () => {
      onUpdate()
      setErrors({})
    },
    onError: (error: unknown) => {
      setErrors({ submit: getApiErrorMessage(error, 'Failed to update pool') })
    },
  })

  const handleSave = async (): Promise<boolean> => {
    setErrors({})

    return new Promise((resolve) => {
      updatePool.mutate(
        {
          isPaidPool,
        },
        {
          onSuccess: () => resolve(true),
          onError: () => resolve(false),
        }
      )
    })
  }

  // Expose save function to parent
  useEffect(() => {
    if (onSave) {
      onSave(handleSave)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaidPool, onSave])

  // Notify parent when isPaidPool changes
  useEffect(() => {
    if (onPaidPoolChange) {
      onPaidPoolChange(isPaidPool)
    }
  }, [isPaidPool, onPaidPoolChange])

  return (
    <div>
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={isPaidPool}
          onChange={(e) => setIsPaidPool(e.target.checked)}
          className="w-5 h-5 mt-0.5 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500 cursor-pointer flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium oscars-dark block">Paid Pool</span>
          <p className="text-xs text-gray-600 mt-0.5">
            Require members to pay an entry fee to join
          </p>
        </div>
      </label>
      {errors.submit && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
          {errors.submit}
        </div>
      )}
    </div>
  )
}

// Payment Settings Editor Component (separate from basic pool info)
function PaymentSettingsEditor({
  poolId,
  currentPool,
  onUpdate,
  onSave
}: {
  poolId: string
  currentPool: Pool
  onUpdate: () => void
  onSave?: (saveFn: () => Promise<boolean>) => void
}) {
  const [entryAmount, setEntryAmount] = useState(currentPool.entryAmount?.toString() || '')
  const [venmoAlias, setVenmoAlias] = useState(currentPool.venmoAlias || '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const updatePool = useMutation<Pool, ApiError, PoolUpdatePayload>({
    mutationFn: async (data: PoolUpdatePayload) => {
      const response = await api.put(`/pools/${poolId}`, data)
      return response.data as Pool
    },
    onSuccess: () => {
      onUpdate()
      setErrors({})
    },
    onError: (error: unknown) => {
      setErrors({ submit: getApiErrorMessage(error, 'Failed to update payment settings') })
    },
  })

  const handleSave = async (): Promise<boolean> => {
    setErrors({})

    // Validation
    const newErrors: Record<string, string> = {}
    if (!entryAmount || parseFloat(entryAmount) <= 0) {
      newErrors.entryAmount = 'Entry amount must be greater than 0'
    }
    if (!venmoAlias.trim()) {
      newErrors.venmoAlias = 'Venmo alias is required for paid pools'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return false
    }

    return new Promise((resolve) => {
      updatePool.mutate(
        {
          entryAmount: parseFloat(entryAmount),
          venmoAlias: venmoAlias.trim(),
        },
        {
          onSuccess: () => resolve(true),
          onError: () => resolve(false),
        }
      )
    })
  }

  // Expose save function to parent
  useEffect(() => {
    if (onSave) {
      onSave(handleSave)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryAmount, venmoAlias, onSave])

  return (
    <div className="space-y-3">
      {/* Entry Amount and Venmo in a grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="entry-amount" className="block text-xs font-medium oscars-dark mb-1.5">
            Entry Amount ($) *
          </label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
            <input
              type="number"
              id="entry-amount"
              value={entryAmount}
              onChange={(e) => setEntryAmount(e.target.value)}
              min="0.01"
              step="0.01"
              className={`w-full pl-7 pr-2.5 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 ${
                errors.entryAmount ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="20.00"
            />
          </div>
          {errors.entryAmount && <p className="mt-1 text-xs text-red-600">{errors.entryAmount}</p>}
        </div>

        <div>
          <label htmlFor="venmo-alias" className="block text-xs font-medium oscars-dark mb-1.5">
            Venmo Alias *
          </label>
          <input
            type="text"
            id="venmo-alias"
            value={venmoAlias}
            onChange={(e) => setVenmoAlias(e.target.value)}
            className={`w-full px-2.5 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 ${
              errors.venmoAlias ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="@your-venmo-alias"
          />
          {errors.venmoAlias && <p className="mt-1 text-xs text-red-600">{errors.venmoAlias}</p>}
        </div>
      </div>

      {/* Submit Error */}
      {errors.submit && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
          {errors.submit}
        </div>
      )}
    </div>
  )
}

// Pool Settings Content Component (combines all settings)
function PoolSettingsContent({
  poolId,
  pool,
  poolSettings,
  onClose,
  queryClient
}: {
  poolId: string
  pool: Pool
  poolSettings: PoolSettings
  onClose: () => void
  queryClient: QueryClient
}) {
  const poolInfoSaveRef = useRef<(() => Promise<boolean>) | null>(null)
  const paymentSaveRef = useRef<(() => Promise<boolean>) | null>(null)
  const payoutSaveRef = useRef<(() => Promise<boolean>) | null>(null)
  const categoryPointsSaveRef = useRef<(() => Promise<boolean>) | null>(null)
  const scoringSaveRef = useRef<(() => Promise<boolean>) | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isPaidPool, setIsPaidPool] = useState(pool?.isPaidPool || false)

  const handleSaveAll = async () => {
    setIsSaving(true)
    try {
      const saves: Promise<boolean>[] = []
      if (poolInfoSaveRef.current) {
        saves.push(poolInfoSaveRef.current())
      }
      if (isPaidPool && paymentSaveRef.current) {
        saves.push(paymentSaveRef.current())
      }
      if (isPaidPool && payoutSaveRef.current) {
        saves.push(payoutSaveRef.current())
      }
      if (categoryPointsSaveRef.current) {
        saves.push(categoryPointsSaveRef.current())
      }
      if (scoringSaveRef.current) {
        saves.push(scoringSaveRef.current())
      }
      
      await Promise.all(saves)
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['pool', poolId] })
      queryClient.invalidateQueries({ queryKey: ['poolSettings', poolId] })
      queryClient.invalidateQueries({ queryKey: ['submissions', poolId] })
      queryClient.invalidateQueries({ queryKey: ['poolMembers', poolId] })
      
      // Refetch pool settings to ensure payout structure is updated
      await queryClient.refetchQueries({ queryKey: ['poolSettings', poolId] })
      
      // Close the settings section
      onClose()
      } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Update local state when pool changes
  useEffect(() => {
    if (pool?.isPaidPool !== undefined) {
      setIsPaidPool(pool.isPaidPool)
    }
  }, [pool?.isPaidPool])

  return (
    <div className="px-4 sm:px-6 py-3 space-y-4 border-t border-gray-200">
      {/* Paid Pool Toggle */}
      {pool && (
        <PoolInfoEditor
          poolId={poolId}
          currentPool={pool}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ['pool', poolId] })
          }}
          onSave={(saveFn) => {
            poolInfoSaveRef.current = saveFn
          }}
          onPaidPoolChange={setIsPaidPool}
        />
      )}

      {/* Payment Configuration (if paid pool enabled) */}
      {isPaidPool && pool && (
        <div className="space-y-4 pt-3 border-t border-gray-100">
          <PaymentSettingsEditor
            poolId={poolId}
            currentPool={pool}
            onUpdate={() => {
              queryClient.invalidateQueries({ queryKey: ['pool', poolId] })
            }}
            onSave={(saveFn) => {
              paymentSaveRef.current = saveFn
            }}
          />
          {poolSettings && (
            <PayoutStructureEditor
              poolId={poolId}
              currentSettings={poolSettings}
              onUpdate={() => {
                queryClient.invalidateQueries({ queryKey: ['poolSettings', poolId] })
              }}
              onSave={(saveFn) => {
                payoutSaveRef.current = saveFn
              }}
            />
          )}
        </div>
      )}
      
      {/* Category Points Settings */}
      {poolSettings && pool && (
        <div className="pt-3 border-t border-gray-100">
          <CategoryPointsEditor
            poolId={poolId}
            pool={pool}
            currentSettings={poolSettings}
            onUpdate={() => {
              queryClient.invalidateQueries({ queryKey: ['poolSettings', poolId] })
              queryClient.invalidateQueries({ queryKey: ['submissions', poolId] })
            }}
            onSave={(saveFn) => {
              categoryPointsSaveRef.current = saveFn
            }}
          />
        </div>
      )}
      
      {/* Scoring Settings */}
      {poolSettings && (
        <div className="pt-3 border-t border-gray-100">
          <PoolSettingsEditor 
            poolId={poolId} 
            currentSettings={poolSettings}
            onUpdate={() => {
              queryClient.invalidateQueries({ queryKey: ['poolSettings', poolId] })
              queryClient.invalidateQueries({ queryKey: ['submissions', poolId] })
            }}
            onSave={(saveFn) => {
              scoringSaveRef.current = saveFn
            }}
          />
        </div>
      )}

      {/* Single Save Button - Sticky on mobile */}
      <div className="sticky bottom-0 bg-white border-t-2 border-gray-200 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 -mb-3 sm:-mb-6 shadow-lg sm:shadow-none">
        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-gray-800 rounded-lg transition-colors text-sm font-medium touch-manipulation"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] oscars-gold-bg text-white rounded-lg hover:opacity-90 active:opacity-80 disabled:opacity-50 transition-opacity touch-manipulation font-semibold"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Invite Modal Component
function InviteModal({
  pool,
  user,
  onClose
}: {
  pool: Pool
  user: AuthUser | null
  onClose: () => void
}) {
  const [copiedLink, setCopiedLink] = useState(false)
  
  // Generate invite link - using invite route
  const inviteLink = `${window.location.origin}/pool/${pool.id}/invite`
  
  const copyToClipboard = async (text: string, setCopied: (value: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold oscars-dark">Invite People to Pool</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Invite Link */}
          <div>
            <label className="block text-sm font-medium oscars-dark mb-2">
              Invite Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={inviteLink}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono"
              />
              <button
                onClick={() => copyToClipboard(inviteLink, setCopiedLink)}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 active:bg-yellow-800 transition-colors text-sm font-medium whitespace-nowrap"
              >
                {copiedLink ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Share this link with people you want to invite. They can sign up or log in directly from the invite page.
            </p>
          </div>

          {/* Password Info (if private pool) */}
          {!pool.isPublic && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-yellow-600 font-bold text-lg leading-none mt-0.5">🔒</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-yellow-900 mb-1">Password Required</p>
                  <p className="text-xs text-yellow-800">
                    This pool is password-protected. Invitees will need the pool password to join. 
                    {pool.ownerId === user?.id ? (
                      <span className="font-medium"> You are the pool owner - make sure to share the password with your invitees.</span>
                    ) : (
                      <span> Contact the pool owner if you need the password.</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 active:bg-gray-400 transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

  // Submissions list component
function SubmissionsList({ 
  poolId, 
  user, 
  pool, 
  navigate,
  predictions,
  canEditSettings
}: { 
  poolId: string
  user: AuthUser | null
  pool: Pool
  navigate: (path: string) => void
  predictions: Prediction[] | undefined
  canEditSettings: boolean
}) {
  const queryClient = useQueryClient()
  const [submissionToRemove, setSubmissionToRemove] = useState<{ userId: string; submissionName: string } | null>(null)

  const updatePaymentStatus = useMutation({
    mutationFn: async ({ userId, hasPaid }: { userId: string; hasPaid: boolean }) => {
      const response = await api.patch(`/pools/${poolId}/members/${userId}/payment`, { hasPaid })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poolMembers', poolId] })
      queryClient.invalidateQueries({ queryKey: ['submissions', poolId] })
    },
  })

  const removeSubmission = useMutation({
    mutationFn: async (userId: string) => {
      const response = await api.delete(`/pools/${poolId}/submissions/${userId}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions', poolId] })
      queryClient.invalidateQueries({ queryKey: ['poolMembers', poolId] })
      queryClient.invalidateQueries({ queryKey: ['predictions', poolId] })
      setSubmissionToRemove(null)
    },
    onError: (error: unknown) => {
      alert(getApiErrorMessage(error, 'Failed to remove ballot'))
    },
  })
      const { data: submissions, isLoading: submissionsLoading, error: submissionsError } = useQuery<PoolSubmission[], Error>({
        queryKey: ['submissions', poolId],
        queryFn: async () => {
          const response = await api.get(`/pools/${poolId}/submissions`)
          return response.data as PoolSubmission[]
        },
        enabled: !!poolId && poolId !== 'new',
      })


    const userHasSubmission =
      submissions?.some((submission) => submission.userId === user?.id) ||
      (predictions && predictions.length > 0)

    // Sort submissions to put current user's submission first, but preserve original rank
    const sortedSubmissions: RankedSubmission[] = submissions
      ? submissions
          .map((submission, index) => ({
            ...submission,
            originalRank: index + 1,
          }))
          .sort((a, b) => {
            const aIsUser = a.userId === user?.id
            const bIsUser = b.userId === user?.id
            if (aIsUser && !bIsUser) return -1
            if (!aIsUser && bIsUser) return 1
            return 0 // Keep original order for others
          })
      : []

    const isPoolOwner = pool?.ownerId === user?.id
    const isSuperuser = user?.role === 'SUPERUSER'
    const canRemove = (isPoolOwner || isSuperuser) && canEditSettings

    return (
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header - Matching pool name style */}
        <div className="bg-slate-800 text-white px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="oscars-font text-base sm:text-lg font-bold">Ballots</h2>
            <p className="text-xs text-white/70 mt-0.5">
              Default ballot names are anonymized until edited.
            </p>
          </div>
          {!userHasSubmission && (
            <button
              onClick={() => navigate(`/pool/${poolId}/edit`)}
              className="px-4 py-2 min-h-[36px] oscars-gold-bg text-white rounded hover:opacity-90 active:opacity-80 text-sm font-medium transition-opacity touch-manipulation"
            >
              Create Ballot
            </button>
          )}
        </div>

        {/* Confirmation Dialog */}
        {submissionToRemove && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-bold oscars-dark mb-4">Remove Ballot</h3>
              <p className="text-gray-700 mb-6">
                Are you sure you want to remove <strong>{submissionToRemove.submissionName}</strong> from this pool? 
                This will delete all their predictions and cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setSubmissionToRemove(null)}
                  disabled={removeSubmission.isPending}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => removeSubmission.mutate(submissionToRemove.userId)}
                  disabled={removeSubmission.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {removeSubmission.isPending ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 sm:p-6">
        
        {submissionsLoading ? (
          <div className="text-center py-8">
            <p className="text-gray-600">Loading ballots...</p>
          </div>
        ) : sortedSubmissions && sortedSubmissions.length > 0 ? (
          <>
            {/* Mobile Card Layout */}
            <div className="block md:hidden space-y-3">
              {sortedSubmissions.map((submission) => {
                const displayName =
                  submission.userId === user?.id && /^Ballot #\d+$/.test(submission.submissionName)
                    ? 'My Ballot'
                    : submission.submissionName

                return (
                <div
                  key={submission.userId}
                  onClick={() => {
                    if (submission.userId === user?.id) {
                      navigate(`/pool/${poolId}/edit`)
                    } else {
                      navigate(`/pool/${poolId}/edit?userId=${submission.userId}`)
                    }
                  }}
                  className={`rounded-lg border-2 cursor-pointer transition-all shadow-sm hover:shadow-md ${
                    submission.userId === user?.id 
                      ? 'bg-yellow-50 border-yellow-300' 
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Header Section */}
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="font-bold oscars-gold text-xl flex-shrink-0 leading-none">#{submission.originalRank}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold oscars-dark text-base mb-0.5 leading-tight">{displayName}</div>
                          {!pool?.isPublic && (
                            <div className="text-xs text-gray-500 truncate mt-0.5">{submission.userEmail}</div>
                          )}
                        </div>
                      </div>
                      
                      {/* Status Badges - Inline */}
                      <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap ${
                            submission.isComplete
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {submission.isComplete ? '✓ Complete' : 'In Progress'}
                        </span>
                        {pool?.isPaidPool && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (canEditSettings) {
                                updatePaymentStatus.mutate({
                                  userId: submission.userId,
                                  hasPaid: !submission.hasPaid,
                                })
                              }
                            }}
                            disabled={!canEditSettings || updatePaymentStatus.isPending}
                            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                              submission.hasPaid
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-red-100 text-red-800 hover:bg-red-200'
                            } ${canEditSettings ? 'cursor-pointer' : 'cursor-default'} disabled:opacity-50`}
                          >
                            {updatePaymentStatus.isPending ? '...' : submission.hasPaid ? '✓ Paid' : 'Unpaid'}
                          </button>
                        )}
                        {canRemove && submission.userId !== pool?.ownerId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSubmissionToRemove({
                                userId: submission.userId,
                                submissionName: submission.submissionName,
                              })
                            }}
                            className="px-2.5 py-1 rounded-md text-xs font-semibold bg-red-100 text-red-800 hover:bg-red-200 transition-colors whitespace-nowrap"
                            title="Remove ballot"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Stats Section */}
                  <div className="px-4 pb-4 pt-3 border-t border-gray-200">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-xs text-gray-600 mb-1.5 uppercase tracking-wide font-medium">Correct</p>
                        <p className="font-semibold text-base oscars-dark">{submission.correctCount || 0} / {submission.totalCategories}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-600 mb-1.5 uppercase tracking-wide font-medium">Possible</p>
                        <p className="font-semibold text-base oscars-gold">{submission.totalPossiblePoints.toFixed(1)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-600 mb-1.5 uppercase tracking-wide font-medium">Earned</p>
                        <p className="font-bold text-base oscars-dark">{submission.totalEarnedPoints.toFixed(1)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )})}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-center py-3 px-4 font-semibold oscars-dark w-12">#</th>
                    <th className="text-left py-3 px-4 font-semibold oscars-dark">Ballot Name</th>
                    <th className="text-left py-3 px-4 font-semibold oscars-dark">Status</th>
                    <th className="text-right py-3 px-4 font-semibold oscars-dark">Correct</th>
                    <th className="text-right py-3 px-4 font-semibold oscars-dark">Possible</th>
                    <th className="text-right py-3 px-4 font-semibold oscars-dark">Earned</th>
                    {canRemove && <th className="text-center py-3 px-4 font-semibold oscars-dark w-16">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {sortedSubmissions.map((submission) => {
                    const displayName =
                      submission.userId === user?.id && /^Ballot #\d+$/.test(submission.submissionName)
                        ? 'My Ballot'
                        : submission.submissionName

                    return (
                    <tr
                      key={submission.userId}
                      onClick={() => {
                        if (submission.userId === user?.id) {
                          navigate(`/pool/${poolId}/edit`)
                        } else {
                          navigate(`/pool/${poolId}/edit?userId=${submission.userId}`)
                        }
                      }}
                      className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                        submission.userId === user?.id ? 'bg-yellow-50' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold oscars-gold text-lg">{submission.originalRank}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold oscars-dark">{displayName}</div>
                        {!pool?.isPublic && (
                          <div className="text-xs text-gray-500">{submission.userEmail}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            submission.isComplete
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {submission.isComplete ? '✓ Complete' : 'In Progress'}
                        </span>
                        {pool?.isPaidPool && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (canEditSettings) {
                                updatePaymentStatus.mutate({
                                  userId: submission.userId,
                                  hasPaid: !submission.hasPaid,
                                })
                              }
                            }}
                            disabled={!canEditSettings || updatePaymentStatus.isPending}
                            className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                              submission.hasPaid
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-red-100 text-red-800 hover:bg-red-200'
                            } ${canEditSettings ? 'cursor-pointer' : 'cursor-default'} disabled:opacity-50`}
                          >
                            {updatePaymentStatus.isPending ? '...' : submission.hasPaid ? '✓ Paid' : 'Unpaid'}
                          </button>
                        )}
                      </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {submission.correctCount || 0} / {submission.totalCategories}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold oscars-gold">
                        {submission.totalPossiblePoints.toFixed(1)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold oscars-dark">
                        {submission.totalEarnedPoints.toFixed(1)}
                      </td>
                      {canRemove && (
                        <td className="py-3 px-4 text-center">
                          {submission.userId !== pool?.ownerId ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSubmissionToRemove({
                                  userId: submission.userId,
                                  submissionName: submission.submissionName,
                                })
                              }}
                              className="px-3 py-1.5 rounded text-xs font-semibold bg-red-100 text-red-800 hover:bg-red-200 transition-colors"
                              title="Remove ballot"
                            >
                              Remove
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">Owner</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </>
        ) : submissionsError ? (
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">Error loading ballots: {submissionsError.message}</p>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">No ballots yet.</p>
            {!userHasSubmission && (
            <button
              onClick={() => navigate(`/pool/${poolId}/edit`)}
              className="px-6 py-3 min-h-[44px] oscars-gold-bg text-white rounded hover:opacity-90 active:opacity-80 transition-opacity touch-manipulation"
            >
              Create First Ballot
            </button>
            )}
          </div>
        )}
        </div>
      </div>
    )
  }

// Payout Structure Editor Component
function PayoutStructureEditor({
  poolId,
  currentSettings,
  onUpdate,
  onSave
}: {
  poolId: string
  currentSettings: PoolSettings
  onUpdate: () => void
  onSave?: (saveFn: () => Promise<boolean>) => void
}) {
  const presets = [
    { name: 'Winner Takes All', structure: [{ position: 1, percentage: 100 }] },
    { name: '60/30/10', structure: [{ position: 1, percentage: 60 }, { position: 2, percentage: 30 }, { position: 3, percentage: 10 }] },
    { name: '50/30/20', structure: [{ position: 1, percentage: 50 }, { position: 2, percentage: 30 }, { position: 3, percentage: 20 }] },
  ]

  const defaultPayoutStructure = [{ position: 1, percentage: 100 }]
  const [payoutStructure, setPayoutStructure] = useState<PayoutStructureEntry[]>(
    currentSettings.payoutStructure || defaultPayoutStructure
  )
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [isCustom, setIsCustom] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Check if current structure matches a preset
  useEffect(() => {
    const currentStr = JSON.stringify(payoutStructure)
    const matchingPreset = presets.find(p => JSON.stringify(p.structure) === currentStr)
    if (matchingPreset) {
      setSelectedPreset(matchingPreset.name)
      setIsCustom(false)
    } else {
      setSelectedPreset(null)
      setIsCustom(true)
    }
  }, [payoutStructure])

  const updateSettings = useMutation<PoolSettings, ApiError, { payoutStructure: PayoutStructureEntry[] }>({
    mutationFn: async (settings: { payoutStructure: PayoutStructureEntry[] }) => {
      const response = await api.put(`/settings/${poolId}`, settings)
      return response.data as PoolSettings
    },
    onSuccess: () => {
      onUpdate()
      setErrors({})
    },
    onError: (error: unknown) => {
      setErrors({ submit: getApiErrorMessage(error, 'Failed to update payout structure') })
    },
  })

  const handleSave = async (): Promise<boolean> => {
    setErrors({})

    // Validation
    const totalPercentage = payoutStructure.reduce((sum, item) => sum + item.percentage, 0)
    if (Math.abs(totalPercentage - 100) > 0.01) {
      setErrors({ total: `Must equal 100% (currently ${totalPercentage.toFixed(1)}%)` })
      return false
    }

    if (payoutStructure.length === 0) {
      setErrors({ total: 'At least one payout position is required' })
      return false
    }

    // Validate positions are sequential and percentages are valid
    for (let i = 0; i < payoutStructure.length; i++) {
      if (payoutStructure[i].position !== i + 1) {
        setErrors({ total: 'Positions must be sequential starting from 1' })
        return false
      }
      if (payoutStructure[i].percentage <= 0 || payoutStructure[i].percentage > 100) {
        setErrors({ total: 'Each percentage must be between 0 and 100' })
        return false
      }
    }

    return new Promise((resolve) => {
      updateSettings.mutate(
        { payoutStructure },
        {
          onSuccess: () => resolve(true),
          onError: () => resolve(false),
        }
      )
    })
  }

  // Expose save function to parent
  useEffect(() => {
    if (onSave) {
      onSave(handleSave)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payoutStructure, onSave])

  const applyPreset = (preset: typeof presets[0]) => {
    setPayoutStructure(preset.structure)
    setSelectedPreset(preset.name)
    setIsCustom(false)
    setErrors({})
  }

  const enableCustom = () => {
    setIsCustom(true)
    setSelectedPreset(null)
  }

  const addPosition = () => {
    const remaining = 100 - payoutStructure.reduce((sum, item) => sum + item.percentage, 0)
    setPayoutStructure([...payoutStructure, { position: payoutStructure.length + 1, percentage: Math.max(0, remaining) }])
    setIsCustom(true)
    setSelectedPreset(null)
  }

  const removePosition = (index: number) => {
    if (payoutStructure.length <= 1) return
    const removedPercentage = payoutStructure[index].percentage
    const newStructure = payoutStructure.filter((_, i) => i !== index).map((item, i) => ({
      ...item,
      position: i + 1,
    }))
    // Redistribute removed percentage to first position
    if (newStructure.length > 0) {
      newStructure[0].percentage += removedPercentage
    }
    setPayoutStructure(newStructure)
    setIsCustom(true)
    setSelectedPreset(null)
  }

  const updatePosition = (index: number, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value)
    if (isNaN(numValue) || numValue < 0) return
    
    const newStructure = [...payoutStructure]
    newStructure[index] = { ...newStructure[index], percentage: Math.min(100, numValue) }
    setPayoutStructure(newStructure)
    setIsCustom(true)
    setSelectedPreset(null)
    setErrors({})
  }

  const autoBalance = () => {
    const total = payoutStructure.reduce((sum, item) => sum + item.percentage, 0)
    if (total === 0) return
    
    const diff = 100 - total
    if (Math.abs(diff) < 0.01) return
    
    const newStructure = [...payoutStructure]
    // Adjust the first position to balance
    newStructure[0].percentage += diff
    if (newStructure[0].percentage < 0) {
      newStructure[0].percentage = 0
    }
    setPayoutStructure(newStructure)
    setErrors({})
  }

  const totalPercentage = payoutStructure.reduce((sum, item) => sum + item.percentage, 0)
  const isBalanced = Math.abs(totalPercentage - 100) < 0.01

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium oscars-dark block mb-2">Payout Structure</label>
        
        {/* Preset Selector */}
        <div className="mb-2">
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                  selectedPreset === preset.name
                    ? 'bg-yellow-50 border-yellow-400 text-yellow-700 font-medium'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {preset.name}
              </button>
            ))}
            <button
              type="button"
              onClick={enableCustom}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                isCustom && !selectedPreset
                  ? 'bg-yellow-50 border-yellow-400 text-yellow-700 font-medium'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Custom
            </button>
          </div>
        </div>

        {/* Custom Editor */}
        {isCustom && (
          <div className="space-y-2">
            {payoutStructure.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 flex-shrink-0 w-16">
                  <span className="text-xs text-gray-600">{item.position}</span>
                  <span className="text-xs text-gray-500">place</span>
                </div>
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={item.percentage === 0 ? '' : item.percentage}
                    onChange={(e) => updatePosition(index, e.target.value)}
                    onBlur={() => {
                      if (payoutStructure[index].percentage === 0 && payoutStructure.length > 1) {
                        removePosition(index)
                      }
                    }}
                    placeholder="0"
                    className="w-full px-2 py-1.5 pr-8 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</span>
                </div>
                {payoutStructure.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePosition(index)}
                    className="px-2 py-1 text-xs text-red-600 hover:text-red-700 flex-shrink-0"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addPosition}
              className="text-xs text-yellow-600 hover:text-yellow-700 font-medium"
            >
              + Add Position
            </button>
            
            {/* Total Percentage Display - Only show for custom */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Total:</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                    {totalPercentage.toFixed(1)}%
                  </span>
                  {!isBalanced && (
                    <button
                      type="button"
                      onClick={autoBalance}
                      className="text-xs text-yellow-600 hover:text-yellow-700 font-medium underline"
                    >
                      Auto-balance
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {errors.total && (
          <p className="mt-1 text-xs text-red-600">{errors.total}</p>
        )}
        {errors.submit && (
          <p className="mt-1 text-xs text-red-600">{errors.submit}</p>
        )}
      </div>
    </div>
  )
}

// Category Points Editor Component
function CategoryPointsEditor({
  poolId,
  pool,
  currentSettings,
  onUpdate,
  onSave
}: {
  poolId: string
  pool: Pool
  currentSettings: PoolSettings
  onUpdate: () => void
  onSave?: (saveFn: () => Promise<boolean>) => void
}) {
  const [categoryPoints, setCategoryPoints] = useState<Record<string, number>>(() => {
    const existingPoints = (currentSettings?.categoryPoints as Record<string, number>) || {}
    return existingPoints
  })
  const [useDefaultCategoryPoints, setUseDefaultCategoryPoints] = useState(() => {
    const existingPoints = (currentSettings?.categoryPoints as Record<string, number>) || {}
    return Object.keys(existingPoints).length === 0
  })
  
  // Update state when settings change
  useEffect(() => {
    const existingPoints = (currentSettings?.categoryPoints as Record<string, number>) || {}
    setCategoryPoints(existingPoints)
    setUseDefaultCategoryPoints(Object.keys(existingPoints).length === 0)
  }, [currentSettings])
  
  // Fetch categories for the pool's year
  const { data: categories, isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ['nominees', pool?.year],
    queryFn: async () => {
      const response = await api.get(`/nominees/${pool?.year}`)
      return response.data as Category[]
    },
    enabled: !!pool?.year,
  })
  
  const updateSettings = useMutation<PoolSettings, ApiError, { categoryPoints?: Record<string, number> }>({
    mutationFn: async (settings: { categoryPoints?: Record<string, number> }) => {
      const response = await api.put(`/settings/${poolId}`, settings)
      return response.data as PoolSettings
    },
    onSuccess: () => {
      onUpdate()
    },
  })
  
  const handleSave = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      const pointsToSave = useDefaultCategoryPoints ? {} : categoryPoints
      updateSettings.mutate(
        { categoryPoints: Object.keys(pointsToSave).length > 0 ? pointsToSave : {} },
        {
          onSuccess: () => resolve(true),
          onError: () => resolve(false),
        }
      )
    })
  }
  
  // Expose save function to parent
  useEffect(() => {
    if (onSave) {
      onSave(handleSave)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryPoints, useDefaultCategoryPoints, onSave])
  
  return (
    <div className="space-y-3">
      <div>
        <label className="flex items-start gap-3 cursor-pointer group mb-4">
          <input
            type="checkbox"
            checked={useDefaultCategoryPoints}
            onChange={(e) => {
              const checked = e.target.checked
              setUseDefaultCategoryPoints(checked)
              // Clear custom category points when using defaults
              if (checked) {
                setCategoryPoints({})
              }
            }}
            className="w-5 h-5 mt-0.5 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500 cursor-pointer flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium oscars-dark block">Use default category points</span>
            <p className="text-xs text-gray-600 mt-0.5">
              All categories will use their default point values
            </p>
          </div>
        </label>
        
        {!useDefaultCategoryPoints && (
          <>
            {categoriesLoading ? (
              <div className="text-center py-4 text-gray-500 text-sm">Loading categories...</div>
            ) : categories && categories.length > 0 ? (
              <div className="space-y-4 max-h-96 overflow-y-auto pt-2 border-t border-gray-200">
                {categoryGroups.map((group) => {
                  // Filter categories that belong to this group
                  const groupCategories = categories.filter(cat => 
                    group.categoryIds.includes(cat.id)
                  )
                  
                  if (groupCategories.length === 0) return null
                  
                  return (
                    <div key={group.name} className="space-y-2">
                      <h4 className="text-xs font-semibold oscars-dark uppercase tracking-wide">
                        {group.name}
                      </h4>
                      <div className="space-y-1.5 pl-2">
                        {groupCategories.map((category) => {
                          const defaultPoints = getDefaultPointsForCategory(category.id)
                          const currentValue = categoryPoints[category.id]
                          
                          return (
                            <div key={category.id} className="flex items-center gap-3">
                              <label className="flex-1 text-xs font-medium oscars-dark min-w-0">
                                <span className="truncate block">{category.name}</span>
                                <span className="text-xs text-gray-500 font-normal">Default: {defaultPoints} pts</span>
                              </label>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={currentValue !== undefined ? currentValue : ''}
                                  onChange={(e) => {
                                    const inputValue = e.target.value.trim()
                                    if (inputValue === '') {
                                      // Remove from categoryPoints to use default
                                      setCategoryPoints(prev => {
                                        const updated = { ...prev }
                                        delete updated[category.id]
                                        return updated
                                      })
                                    } else {
                                      const value = parseInt(inputValue)
                                      if (!isNaN(value) && value >= 1 && value !== defaultPoints) {
                                        // Only store if different from default
                                        setCategoryPoints(prev => ({
                                          ...prev,
                                          [category.id]: value
                                        }))
                                      } else if (!isNaN(value) && value >= 1 && value === defaultPoints) {
                                        // If user sets to default, remove from custom values
                                        setCategoryPoints(prev => {
                                          const updated = { ...prev }
                                          delete updated[category.id]
                                          return updated
                                        })
                                      }
                                    }
                                  }}
                                  placeholder={defaultPoints.toString()}
                                  className="w-16 px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                />
                                <span className="text-xs text-gray-500 w-6">pts</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                
                {/* Show any categories not in any group */}
                {(() => {
                  const allGroupedIds = categoryGroups.flatMap(g => g.categoryIds)
                  const ungroupedCategories = categories.filter(cat => 
                    !allGroupedIds.includes(cat.id)
                  )
                  
                  if (ungroupedCategories.length === 0) return null
                  
                  return (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold oscars-dark uppercase tracking-wide">
                        Other
                      </h4>
                      <div className="space-y-1.5 pl-2">
                        {ungroupedCategories.map((category) => {
                          const defaultPoints = getDefaultPointsForCategory(category.id)
                          const currentValue = categoryPoints[category.id]
                          
                          return (
                            <div key={category.id} className="flex items-center gap-3">
                              <label className="flex-1 text-xs font-medium oscars-dark min-w-0">
                                <span className="truncate block">{category.name}</span>
                                <span className="text-xs text-gray-500 font-normal">Default: {defaultPoints} pts</span>
                              </label>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={currentValue !== undefined ? currentValue : ''}
                                  onChange={(e) => {
                                    const inputValue = e.target.value.trim()
                                    if (inputValue === '') {
                                      // Remove from categoryPoints to use default
                                      setCategoryPoints(prev => {
                                        const updated = { ...prev }
                                        delete updated[category.id]
                                        return updated
                                      })
                                    } else {
                                      const value = parseInt(inputValue)
                                      if (!isNaN(value) && value >= 1 && value !== defaultPoints) {
                                        // Only store if different from default
                                        setCategoryPoints(prev => ({
                                          ...prev,
                                          [category.id]: value
                                        }))
                                      } else if (!isNaN(value) && value >= 1 && value === defaultPoints) {
                                        // If user sets to default, remove from custom values
                                        setCategoryPoints(prev => {
                                          const updated = { ...prev }
                                          delete updated[category.id]
                                          return updated
                                        })
                                      }
                                    }
                                  }}
                                  placeholder={defaultPoints.toString()}
                                  className="w-16 px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                />
                                <span className="text-xs text-gray-500 w-6">pts</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">No categories found</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Pool Settings Editor Component
function PoolSettingsEditor({ 
  poolId, 
  currentSettings,
  onUpdate,
  onSave
}: {
  poolId: string
  currentSettings: PoolSettings
  onUpdate: () => void
  onSave?: (saveFn: () => Promise<boolean>) => void
}) {
  const formulaPresets: { name: string; value: OddsMultiplierFormula; description: string }[] = [
    { name: 'Linear', value: 'linear', description: 'Simple linear scaling: 2 - (odds/100)' },
    { name: 'Logarithmic', value: 'log', description: 'Rewards underdogs more than linear, but less than inverse' },
    { name: 'Square Root', value: 'sqrt', description: 'Moderate reward for underdogs' },
    { name: 'Inverse', value: 'inverse', description: 'Maximum reward for underdogs (can be very high)' },
  ]

  const [oddsMultiplierEnabled, setOddsMultiplierEnabled] = useState(currentSettings.oddsMultiplierEnabled ?? true)
  const [oddsMultiplierFormula, setOddsMultiplierFormula] = useState<OddsMultiplierFormula>(currentSettings.oddsMultiplierFormula || 'log')
  
  const updateSettings = useMutation<PoolSettings, ApiError, { oddsMultiplierEnabled: boolean; oddsMultiplierFormula: OddsMultiplierFormula }>({
    mutationFn: async (settings: { oddsMultiplierEnabled: boolean; oddsMultiplierFormula: OddsMultiplierFormula }) => {
      const response = await api.put(`/settings/${poolId}`, settings)
      return response.data as PoolSettings
    },
    onSuccess: () => {
      onUpdate()
    },
  })

  const handleSave = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      updateSettings.mutate(
        {
          oddsMultiplierEnabled,
          oddsMultiplierFormula,
        },
        {
          onSuccess: () => resolve(true),
          onError: () => resolve(false),
        }
      )
    })
  }

  // Expose save function to parent
  useEffect(() => {
    if (onSave) {
      onSave(handleSave)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oddsMultiplierEnabled, oddsMultiplierFormula, onSave])

  const selectedPreset = formulaPresets.find(p => p.value === oddsMultiplierFormula)

  return (
    <div className="space-y-3">
      <div>
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={oddsMultiplierEnabled}
            onChange={(e) => setOddsMultiplierEnabled(e.target.checked)}
            className="w-5 h-5 mt-0.5 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500 cursor-pointer flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium oscars-dark block">Odds Multiplier</span>
            <p className="text-xs text-gray-600 mt-0.5">
              Multiply points based on how unlikely a pick is to win
            </p>
          </div>
        </label>

        {oddsMultiplierEnabled && (
          <div className="mt-3">
            <label className="text-xs font-medium oscars-dark block mb-2">Formula</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {formulaPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setOddsMultiplierFormula(preset.value)}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                    oddsMultiplierFormula === preset.value
                      ? 'bg-yellow-50 border-yellow-400 text-yellow-700 font-medium'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
            {selectedPreset && (
              <p className="text-xs text-gray-500 mt-1">{selectedPreset.description}</p>
            )}
            
            {/* Odds Explanation */}
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs font-medium oscars-dark mb-2">How Odds Work:</p>
              <div className="text-xs text-gray-600 space-y-1.5">
                <p>
                  <strong className="text-gray-700">Odds are tracked when selected:</strong> When a participant picks a nominee, the odds at that moment are saved as your original odds. This is used to track your risk-taking.
                </p>
                <p>
                  <strong className="text-gray-700">Odds change over time:</strong> Betting odds are updated regularly as the awards ceremony approaches. A nominee's chances can improve or worsen based on news, reviews, and betting activity.
                </p>
                <p>
                  <strong className="text-gray-700">Scoring uses best odds for bonus:</strong> Your points are calculated using the lower percentage (worse odds = higher multiplier). If odds move lower after you selected, you get the better bonus. If odds move higher, you keep your original better bonus.
                </p>
                <p className="text-gray-500 italic">
                  Note: Lower percentage = worse odds = higher multiplier = more points. Your scoring odds update automatically to always use the best (lowest percentage) odds.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PoolDetail() {
  const { poolId } = useParams<{ poolId: string }>()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const queryClient = useQueryClient()
  const [showSettings, setShowSettings] = useState(false)
  const [showPaidPoolDetails, setShowPaidPoolDetails] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)

  const { data: pool, isLoading: poolLoading } = useQuery<Pool>({
    queryKey: ['pool', poolId],
    queryFn: async () => {
      const response = await api.get(`/pools/${poolId}`)
      return response.data as Pool
    },
    enabled: !!poolId && poolId !== 'new',
  })

  const { data: poolSettings } = useQuery<PoolSettings>({
    queryKey: ['poolSettings', poolId],
    queryFn: async () => {
      const response = await api.get(`/settings/${poolId}`)
      return response.data as PoolSettings
    },
    enabled: !!poolId && poolId !== 'new',
  })

  // Get global pool ceremony date (all pools should use the same Oscars date)
  const { data: globalPool } = useQuery<Pool>({
    queryKey: ['globalPool'],
    queryFn: async () => {
      const response = await api.get('/pools/global')
      return response.data as Pool
    },
  })

  // Fetch global winners for the pool's year (used for all pools)
  const { data: actualWinners } = useQuery<ActualWinner[]>({
    queryKey: ['globalWinners', pool?.year],
    queryFn: async () => {
      if (!pool?.year) return []
      const response = await api.get(`/winners/global/${pool.year}`)
      return response.data as ActualWinner[]
    },
    enabled: !!poolId && !!pool?.year && poolId !== 'new',
  })

  // Use global pool ceremony date for countdown (all pools use same Oscars date)
  const ceremonyDateForCountdown = globalPool?.ceremonyDate || pool?.ceremonyDate

  const isPoolOwner = pool?.ownerId === user?.id
  const isSuperuser = user?.role === 'SUPERUSER'
  const hasWinners = (actualWinners?.length || 0) > 0
  const canEditSettings = (isPoolOwner || isSuperuser) && !hasWinners


  const deletePool = useMutation({
    mutationFn: async () => {
      const response = await api.delete(`/pools/${poolId}`)
      return response.data
    },
    onSuccess: () => {
      // Optimistically remove from cache to avoid transient 403s on dashboard
      queryClient.setQueryData<Pool[] | undefined>(['pools'], (previous) =>
        previous?.filter((existingPool) => existingPool.id !== poolId)
      )
      // Invalidate pools query so Dashboard updates
      queryClient.invalidateQueries({ queryKey: ['pools'] })
      // Navigate back to dashboard
      navigate('/')
    },
    onError: (error: unknown) => {
      alert(getApiErrorMessage(error, 'Failed to delete pool'))
    },
  })

  // Get current user's membership to access submission name
  useQuery<PoolMember | null, Error>({
    queryKey: ['userMembership', poolId],
    queryFn: async () => {
      if (!poolId || !user?.id) return null
      try {
        const response = await api.get(`/pools/${poolId}/members`)
        const members = response.data as PoolMember[]
        return members.find((member) => member.userId === user.id) || null
      } catch (error) {
        // If members endpoint fails, try to get from pool data
        if (pool?.members && Array.isArray(pool.members) && pool.members.length > 0) {
          return pool.members[0]
        }
        return null
      }
    },
    enabled: !!poolId && !!user?.id && poolId !== 'new',
  })

  const { data: predictions } = useQuery<Prediction[]>({
    queryKey: ['predictions', poolId],
    queryFn: async () => {
      const response = await api.get(`/predictions/pool/${poolId}`)
      return response.data as Prediction[]
    },
    enabled: !!poolId && poolId !== 'new',
  })

  const { data: submissions } = useQuery<PoolSubmission[], Error>({
    queryKey: ['submissions', poolId],
    queryFn: async () => {
      const response = await api.get(`/pools/${poolId}/submissions`)
      return response.data as PoolSubmission[]
    },
    enabled: !!poolId && poolId !== 'new',
  })

  const userHasSubmission =
    submissions?.some((submission) => submission.userId === user?.id) ||
    (predictions && predictions.length > 0)

  // Handle "new" pool creation - must be after all hooks
  if (poolId === 'new') {
    return <PoolCreationForm navigate={navigate} />
  }

  if (poolLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div>Loading pool...</div>
      </div>
    )
  }

  if (!pool) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div>Pool not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 oscars-red text-white py-3 px-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Back Button - Left side */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 text-white hover:text-yellow-300 hover:bg-white/10 active:bg-white/20 rounded-full transition-all touch-manipulation focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-red-600"
            aria-label="Go back"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Logo - Right of back button */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 flex-shrink-0 hover:opacity-90 transition-opacity touch-manipulation focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-red-600 rounded"
            aria-label="Go to home"
          >
            <img 
              src="/images/logo.png" 
              alt="Academy Awards Pool" 
              className="h-16 w-auto"
            />
            <span className="hidden sm:inline oscars-font text-base sm:text-lg font-bold">ACADEMY AWARDS POOL</span>
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Logout Button */}
          <button
            onClick={logout}
            className="flex items-center justify-center px-4 py-2 min-h-[44px] text-white border-2 border-white/30 hover:border-white/50 hover:bg-white/10 active:bg-white/20 rounded-lg transition-all text-sm font-medium touch-manipulation focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-red-600"
            aria-label="Logout"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Submissions Lock Countdown */}
      {ceremonyDateForCountdown && (
        <SubmissionsLockCountdown ceremonyDate={ceremonyDateForCountdown instanceof Date ? ceremonyDateForCountdown : new Date(ceremonyDateForCountdown)} />
      )}

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Two Column Layout on Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pool Summary - First on mobile, right column on desktop */}
          <div className="lg:col-span-1 order-1 lg:order-2">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              {/* Pool Name Header */}
              <div className="bg-slate-800 text-white px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {canEditSettings ? (
                    <PoolNameEditor
                      poolId={poolId!}
                      currentName={pool.name}
                      onUpdate={() => {
                        queryClient.invalidateQueries({ queryKey: ['pool', poolId] })
                      }}
                    />
                  ) : (
                    <h2 className="oscars-font text-base sm:text-lg font-bold">{pool.name}</h2>
                  )}
                </div>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex-shrink-0 px-3 py-1.5 text-white border border-white/50 hover:border-white bg-transparent rounded transition-colors text-xs font-medium"
                  title="Invite people to this pool"
                >
                  Invite
                </button>
              </div>

              {/* Pool Details Grid */}
              <div className="px-4 sm:px-6 py-4">
                {/* Compact Stats */}
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Members</span>
                    <span className="font-bold text-base oscars-dark">{pool._count?.members || 0}</span>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold flex-shrink-0 ${
                    pool.isPublic 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {pool.isPublic ? 'Public' : 'Private'}
                  </span>
                </div>
                
                {/* Paid Pool Info - Collapsed by default */}
                {pool.isPaidPool && (() => {
                  const memberCount = pool._count?.members || 0
                  const totalPrize = pool.entryAmount ? memberCount * pool.entryAmount : 0
                  const payoutStructureRaw = poolSettings?.payoutStructure
                  const payoutStructure =
                    payoutStructureRaw && Array.isArray(payoutStructureRaw) && payoutStructureRaw.length > 0
                      ? (payoutStructureRaw as PayoutStructureEntry[])
                    : null
                  
                  // Match payout structure to preset shorthand
                  const getPayoutShorthand = () => {
                    if (!payoutStructure || payoutStructure.length === 0) return null
                    
                    const presets = [
                      { name: 'Winner Takes All', structure: [{ position: 1, percentage: 100 }] },
                      { name: '60/30/10', structure: [{ position: 1, percentage: 60 }, { position: 2, percentage: 30 }, { position: 3, percentage: 10 }] },
                      { name: '50/30/20', structure: [{ position: 1, percentage: 50 }, { position: 2, percentage: 30 }, { position: 3, percentage: 20 }] },
                      { name: '70/30', structure: [{ position: 1, percentage: 70 }, { position: 2, percentage: 30 }] },
                      { name: '50/25/15/10', structure: [{ position: 1, percentage: 50 }, { position: 2, percentage: 25 }, { position: 3, percentage: 15 }, { position: 4, percentage: 10 }] },
                    ]
                    
                    const currentStr = JSON.stringify(payoutStructure)
                    const matchingPreset = presets.find(p => JSON.stringify(p.structure) === currentStr)
                    
                    if (matchingPreset) {
                      return matchingPreset.name
                    }
                    
                    // If no preset matches, create shorthand from percentages
                    const percentages = payoutStructure.map(item => item.percentage).join('/')
                    return percentages
                  }
                  
                  const payoutShorthand = getPayoutShorthand()
                  
                  return (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg overflow-hidden shadow-sm mb-4">
                      <button
                        onClick={() => setShowPaidPoolDetails(!showPaidPoolDetails)}
                        className="w-full flex items-center justify-between p-4 hover:bg-yellow-100 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-lg flex-shrink-0">💰</span>
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-sm font-semibold oscars-dark flex-shrink-0">Prize Pool</span>
                            {totalPrize > 0 && (
                              <>
                                <span className="text-lg font-bold oscars-gold flex-shrink-0">
                                  ${totalPrize.toFixed(2)}
                                </span>
                                {payoutShorthand && (
                                  <span className="text-xs text-gray-600 flex-shrink-0">
                                    • {payoutShorthand}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <span className="text-gray-500 text-sm flex-shrink-0 ml-3">
                          {showPaidPoolDetails ? '▼' : '▶'}
                        </span>
                      </button>
                      
                      {showPaidPoolDetails && (
                        <div className="px-4 pb-4 border-t border-yellow-200 bg-white">
                          <div className="space-y-4 pt-4">
                            {/* Payment Info */}
                            <div className="space-y-2.5">
                              <h4 className="text-xs font-semibold oscars-dark uppercase tracking-wide mb-1">Payment</h4>
                              <div className="bg-gray-50 rounded-lg p-3.5 border border-gray-200 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-600">Entry:</span>
                                  <span className="text-base font-bold oscars-gold">${pool.entryAmount?.toFixed(2)}</span>
                                </div>
                                {pool.venmoAlias && (
                                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                                    <span className="text-sm text-gray-600">Pay to:</span>
                                    <span className="font-mono text-sm font-semibold oscars-dark break-all ml-2 text-right">@{pool.venmoAlias}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Prize Pool Breakdown */}
                            {totalPrize > 0 && (
                              <div className="space-y-2.5">
                                <h4 className="text-xs font-semibold oscars-dark uppercase tracking-wide mb-1">Payouts</h4>
                                {payoutStructure ? (
                                  <div className="bg-gray-50 rounded-lg p-3.5 border border-gray-200 space-y-2">
                                    {payoutStructure.map((item, index) => {
                                      const amount = (totalPrize * item.percentage) / 100
                                      const positionLabel = item.position === 1 ? '1st' : item.position === 2 ? '2nd' : item.position === 3 ? '3rd' : `${item.position}th`
                                      return (
                                        <div key={index} className="flex items-center justify-between py-2 px-3 bg-white rounded-md border border-yellow-200 shadow-sm">
                                          <span className="text-sm font-medium text-gray-800">{positionLabel} ({item.percentage}%)</span>
                                          <span className="text-sm font-bold oscars-gold">${amount.toFixed(2)}</span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <div className="bg-gray-50 rounded-lg p-3.5 border border-gray-200 text-sm text-gray-600 italic">
                                    Not configured
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Settings Locked Message */}
                {(isPoolOwner || isSuperuser) && hasWinners && (
                  <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-xs text-yellow-800">
                      <strong>Settings locked:</strong> Pool settings cannot be changed after winners have been announced.
                    </p>
                  </div>
                )}

                {/* Action Buttons - At the bottom */}
                <div className="pt-4 border-t border-gray-200 flex flex-col gap-2.5">
                  {userHasSubmission && (
                    <button
                      onClick={() => navigate(`/pool/${poolId}/edit`)}
                      className="w-full px-4 py-2.5 min-h-[44px] oscars-gold-bg text-white rounded-lg hover:opacity-90 active:opacity-80 transition-opacity text-sm font-semibold touch-manipulation shadow-sm"
                    >
                      Edit My Ballot
                    </button>
                  )}
                  {(isPoolOwner || isSuperuser) && !hasWinners && (
                    <button
                      onClick={() => setShowSettings(!showSettings)}
                      className="w-full px-4 py-2.5 min-h-[44px] bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50 active:bg-gray-100 text-gray-700 rounded-lg transition-colors text-sm font-medium touch-manipulation shadow-sm flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {showSettings ? 'Hide Settings' : 'Pool Settings'}
                    </button>
                  )}
                </div>
              </div>
              
              {/* Pool Settings Section */}
              {showSettings && canEditSettings && pool && poolSettings && (
                <>
                  <PoolSettingsContent
                    poolId={poolId!} 
                    pool={pool}
                    poolSettings={poolSettings}
                    onClose={() => setShowSettings(false)}
                    queryClient={queryClient}
                  />
                  
                  {/* Delete Pool Section (understated, inside settings) */}
                  {(isPoolOwner || isSuperuser) && (
                    <div className="px-4 sm:px-6 py-3 border-t border-gray-200">
                      {!showDeleteConfirm ? (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-600">Danger Zone</p>
                            <button
                              onClick={() => setShowDeleteConfirm(true)}
                              className="mt-1 text-xs text-gray-500 hover:text-red-600 underline transition-colors"
                            >
                              Delete this pool
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="bg-red-50 border border-red-200 rounded p-3">
                            <p className="text-sm text-red-800 font-medium mb-1">
                              Are you sure you want to delete this pool?
                            </p>
                            <p className="text-xs text-red-700">
                              This action cannot be undone. All members, predictions, and settings will be permanently deleted.
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => deletePool.mutate()}
                              disabled={deletePool.isPending}
                              className="flex-1 px-4 py-2.5 min-h-[44px] bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded transition-colors text-sm font-medium touch-manipulation disabled:opacity-50"
                            >
                              {deletePool.isPending ? 'Deleting...' : 'Yes, Delete Pool'}
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(false)}
                              disabled={deletePool.isPending}
                              className="flex-1 px-4 py-2.5 min-h-[44px] bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-gray-800 rounded transition-colors text-sm font-medium touch-manipulation disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

            </div>
          </div>

          {/* Submissions - Second on mobile, left column on desktop */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            <SubmissionsList poolId={poolId!} user={user} pool={pool} navigate={navigate} predictions={predictions} canEditSettings={canEditSettings} />
          </div>
        </div>
      </main>

      {/* Invite Modal */}
      {showInviteModal && pool && (
        <InviteModal pool={pool} user={user} onClose={() => setShowInviteModal(false)} />
      )}
    </div>
  )
}
