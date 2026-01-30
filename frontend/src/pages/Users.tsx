import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

type UserSummary = {
  id: string
  email: string
  role: string
  oauthProvider?: string | null
  createdAt: string
  updatedAt: string
  _count: {
    ownedPools: number
    poolMemberships: number
    predictions: number
  }
}

const formatDate = (value?: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString()
}

export default function Users() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (user && user.role !== 'SUPERUSER') {
      navigate('/')
    }
  }, [user, navigate])

  const { data: users, isLoading, isError } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users')
      return response.data as UserSummary[]
    },
    enabled: user?.role === 'SUPERUSER',
  })

  const filteredUsers = useMemo(() => {
    if (!users) return []
    const term = search.trim().toLowerCase()
    if (!term) return users
    return users.filter((entry) => {
      const email = entry.email?.toLowerCase() || ''
      const id = entry.id?.toLowerCase() || ''
      return email.includes(term) || id.includes(term)
    })
  }, [users, search])

  const totalUsers = users?.length || 0
  const superuserCount = users?.filter((entry) => entry.role === 'SUPERUSER').length || 0
  const oauthUsers = users?.filter((entry) => entry.oauthProvider).length || 0

  if (user?.role !== 'SUPERUSER') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 oscars-red text-white py-3 px-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 text-white hover:text-yellow-300 hover:bg-white/10 active:bg-white/20 rounded-full transition-all touch-manipulation focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-red-600"
            aria-label="Go back"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

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

          <div className="flex-1" />

          <button
            onClick={logout}
            className="flex items-center justify-center px-4 py-2 min-h-[44px] text-white border-2 border-white/30 hover:border-white/50 hover:bg-white/10 active:bg-white/20 rounded-lg transition-all text-sm font-medium touch-manipulation focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-red-600"
            aria-label="Logout"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-slate-800 text-white px-4 sm:px-6 py-3">
            <h2 className="oscars-font text-base sm:text-lg font-bold">User Directory</h2>
          </div>

          <div className="p-4 sm:p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Users</p>
                <p className="text-lg font-bold oscars-dark">{totalUsers}</p>
              </div>
              <div className="border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Superusers</p>
                <p className="text-lg font-bold oscars-dark">{superuserCount}</p>
              </div>
              <div className="border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">OAuth Users</p>
                <p className="text-lg font-bold oscars-dark">{oauthUsers}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1">
                <label htmlFor="user-search" className="text-xs font-semibold oscars-dark uppercase tracking-wide">
                  Search by email or ID
                </label>
                <input
                  id="user-search"
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search users..."
                  className="mt-2 w-full px-3 py-2.5 min-h-[44px] text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>
            </div>

            {isLoading && (
              <p className="text-sm text-gray-600">Loading users...</p>
            )}

            {isError && (
              <p className="text-sm text-red-600">Failed to load users.</p>
            )}

            {!isLoading && filteredUsers.length === 0 && (
              <p className="text-sm text-gray-600">No users match this search.</p>
            )}

            {!isLoading && filteredUsers.length > 0 && (
              <>
                <div className="hidden md:block border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="text-left px-4 py-2">Email</th>
                        <th className="text-left px-4 py-2">Role</th>
                        <th className="text-left px-4 py-2">Provider</th>
                        <th className="text-left px-4 py-2">Joined</th>
                        <th className="text-right px-4 py-2">Owned</th>
                        <th className="text-right px-4 py-2">Member</th>
                        <th className="text-right px-4 py-2">Predictions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((entry) => (
                        <tr key={entry.id} className="border-t border-gray-200">
                          <td className="px-4 py-3">
                            <div className="font-medium oscars-dark">{entry.email}</div>
                            <div className="text-xs text-gray-500">ID: {entry.id}</div>
                          </td>
                          <td className="px-4 py-3">{entry.role}</td>
                          <td className="px-4 py-3">{entry.oauthProvider || 'Password'}</td>
                          <td className="px-4 py-3">{formatDate(entry.createdAt)}</td>
                          <td className="px-4 py-3 text-right">{entry._count.ownedPools}</td>
                          <td className="px-4 py-3 text-right">{entry._count.poolMemberships}</td>
                          <td className="px-4 py-3 text-right">{entry._count.predictions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden space-y-3">
                  {filteredUsers.map((entry) => (
                    <div key={entry.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold oscars-dark">{entry.email}</p>
                          <p className="text-xs text-gray-500">ID: {entry.id}</p>
                        </div>
                        <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded border border-gray-200 bg-gray-50 text-gray-600">
                          {entry.role}
                        </span>
                      </div>
                      <div className="mt-3 text-xs text-gray-600 space-y-1">
                        <div>Provider: {entry.oauthProvider || 'Password'}</div>
                        <div>Joined: {formatDate(entry.createdAt)}</div>
                        <div>Owned pools: {entry._count.ownedPools}</div>
                        <div>Memberships: {entry._count.poolMemberships}</div>
                        <div>Predictions: {entry._count.predictions}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
