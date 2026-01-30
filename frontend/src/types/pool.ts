export type OddsMultiplierFormula = 'linear' | 'inverse' | 'sqrt' | 'log'

export interface PayoutStructureEntry {
  position: number
  percentage: number
}

export interface PoolSettings {
  id?: string
  poolId?: string
  categoryPoints: Record<string, number>
  oddsMultiplierEnabled: boolean
  oddsMultiplierFormula: OddsMultiplierFormula
  payoutStructure?: PayoutStructureEntry[] | null
  createdAt?: string
  updatedAt?: string
}

export interface PoolMember {
  id?: string
  poolId?: string
  userId?: string
  submissionName?: string | null
  hasPaid?: boolean
  joinedAt?: string
  user?: {
    id?: string
    email?: string
  }
}

export interface Pool {
  id: string
  name: string
  isPublic: boolean
  isPaidPool: boolean
  entryAmount?: number | null
  venmoAlias?: string | null
  ownerId: string
  year: string
  ceremonyDate: string | Date
  createdAt?: string
  updatedAt?: string
  owner?: {
    id: string
    email?: string
  }
  _count?: {
    members?: number
    predictions?: number
    actualWinners?: number
  }
  members?: PoolMember[]
  settings?: PoolSettings | null
}

export interface Prediction {
  id: string
  poolId: string
  userId: string
  categoryId: string
  nomineeId: string
  oddsPercentage?: number | null
  originalOddsPercentage?: number | null
  createdAt?: string
  updatedAt?: string
}

export interface ActualWinner {
  id?: string
  poolId: string
  categoryId: string
  nomineeId: string
  enteredBy?: string | null
  isAutoDetected?: boolean
  enteredAt?: string
  updatedAt?: string
}

export interface PoolSubmission {
  userId: string
  submissionName: string
  filledCategories: number
  totalCategories: number
  correctCount: number
  isComplete: boolean
  totalPossiblePoints: number
  totalEarnedPoints: number
  hasPaid: boolean
  userEmail?: string
}

export interface Nominee {
  id: string
  name: string
  film?: string
  song?: string
  producers?: string
  blurb_sentence_1?: string
  blurb_sentence_2?: string
  imdb_url?: string
  letterboxd_url?: string
  [key: string]: unknown
}

export interface Category {
  id: string
  name: string
  defaultPoints: number
  nominees: Nominee[]
  year?: string
}
