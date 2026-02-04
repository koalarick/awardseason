import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

type UserSummary = {
  id: string;
  email: string;
  role: string;
  oauthProvider?: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    ownedPools: number;
    poolMemberships: number;
    predictions: number;
  };
};

type RoleUpdate = {
  userId: string;
  role: string;
  previousRole: string;
};

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

export default function Users() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleEdits, setRoleEdits] = useState<Record<string, string>>({});
  const [roleSaving, setRoleSaving] = useState<Record<string, boolean>>({});
  const [passwordEdits, setPasswordEdits] = useState<Record<string, string>>({});
  const [passwordEditing, setPasswordEditing] = useState<Record<string, boolean>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== 'SUPERUSER') {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(null), 2500);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  const {
    data: users,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/users');
      return response.data as UserSummary[];
    },
    enabled: user?.role === 'SUPERUSER',
  });

  useEffect(() => {
    if (!users) return;
    const initialRoles: Record<string, string> = {};
    users.forEach((entry) => {
      initialRoles[entry.id] = entry.role;
    });
    setRoleEdits(initialRoles);
  }, [users]);

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: RoleUpdate) => {
      const response = await api.patch(`/users/${userId}/role`, { role });
      return response.data;
    },
    onMutate: (variables) => {
      setRoleSaving((prev) => ({ ...prev, [variables.userId]: true }));
      return { userId: variables.userId };
    },
    onSuccess: () => {
      setStatusMessage('Role updated.');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any, variables) => {
      setRoleEdits((prev) => ({ ...prev, [variables.userId]: variables.previousRole }));
      setStatusMessage(error?.response?.data?.error || 'Failed to update role.');
    },
    onSettled: (_data, _error, variables) => {
      if (variables?.userId) {
        setRoleSaving((prev) => ({ ...prev, [variables.userId]: false }));
      }
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const response = await api.patch(`/users/${userId}/password`, { password });
      return response.data;
    },
    onSuccess: (_data, variables) => {
      setStatusMessage('Password updated.');
      setPasswordEdits((prev) => ({ ...prev, [variables.userId]: '' }));
      setPasswordEditing((prev) => ({ ...prev, [variables.userId]: false }));
    },
    onError: (error: any) => {
      setStatusMessage(error?.response?.data?.error || 'Failed to update password.');
    },
  });

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((entry) => {
      const email = entry.email?.toLowerCase() || '';
      const id = entry.id?.toLowerCase() || '';
      return email.includes(term) || id.includes(term);
    });
  }, [users, search]);

  const totalUsers = users?.length || 0;
  const superuserCount = users?.filter((entry) => entry.role === 'SUPERUSER').length || 0;
  const oauthUsers = users?.filter((entry) => entry.oauthProvider).length || 0;

  const handleRoleChange = (userId: string, serverRole: string, nextRole: string) => {
    const previousRole = roleEdits[userId] ?? serverRole;
    setRoleEdits((prev) => ({ ...prev, [userId]: nextRole }));
    if (nextRole === serverRole) {
      return;
    }
    updateRoleMutation.mutate({ userId, role: nextRole, previousRole });
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
                <label
                  htmlFor="user-search"
                  className="text-xs font-semibold oscars-dark uppercase tracking-wide"
                >
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

            {statusMessage && (
              <div className="text-sm text-slate-700 bg-slate-100 border border-slate-200 rounded-md px-3 py-2">
                {statusMessage}
              </div>
            )}

            {isLoading && <p className="text-sm text-gray-600">Loading users...</p>}

            {isError && <p className="text-sm text-red-600">Failed to load users.</p>}

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
                        <th className="text-left px-4 py-2">Password</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((entry) => {
                        const currentRole = roleEdits[entry.id] ?? entry.role;
                        const isOauthUser = Boolean(entry.oauthProvider);
                        const passwordValue = passwordEdits[entry.id] ?? '';
                        const isEditingPassword = passwordEditing[entry.id] ?? false;
                        const canSetPassword = !isOauthUser && passwordValue.trim().length >= 6;
                        const isSavingRole = roleSaving[entry.id] ?? false;

                        return (
                          <tr key={entry.id} className="border-t border-gray-200">
                            <td className="px-4 py-3">
                              <div className="font-medium oscars-dark">{entry.email}</div>
                              <div className="text-xs text-gray-500">ID: {entry.id}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <select
                                  className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                                  value={currentRole}
                                  onChange={(event) =>
                                    handleRoleChange(entry.id, entry.role, event.target.value)
                                  }
                                  disabled={isSavingRole}
                                >
                                  <option value="USER">USER</option>
                                  <option value="SUPERUSER">SUPERUSER</option>
                                </select>
                                {isSavingRole && (
                                  <span className="text-xs text-gray-500">Saving...</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">{entry.oauthProvider || 'Password'}</td>
                            <td className="px-4 py-3">{formatDate(entry.createdAt)}</td>
                            <td className="px-4 py-3 text-right">{entry._count.ownedPools}</td>
                            <td className="px-4 py-3 text-right">{entry._count.poolMemberships}</td>
                            <td className="px-4 py-3 text-right">{entry._count.predictions}</td>
                            <td className="px-4 py-3">
                              {isOauthUser ? (
                                <span className="text-xs text-gray-500">OAuth user</span>
                              ) : (
                                <div className="space-y-2">
                                  {!isEditingPassword ? (
                                    <button
                                      onClick={() =>
                                        setPasswordEditing((prev) => ({
                                          ...prev,
                                          [entry.id]: true,
                                        }))
                                      }
                                      className="px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 text-slate-700"
                                    >
                                      Change
                                    </button>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="password"
                                        value={passwordValue}
                                        onChange={(event) =>
                                          setPasswordEdits((prev) => ({
                                            ...prev,
                                            [entry.id]: event.target.value,
                                          }))
                                        }
                                        placeholder="New password"
                                        className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                                      />
                                      <button
                                        onClick={() =>
                                          updatePasswordMutation.mutate({
                                            userId: entry.id,
                                            password: passwordValue,
                                          })
                                        }
                                        disabled={!canSetPassword || updatePasswordMutation.isPending}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 text-slate-700 disabled:opacity-50"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() =>
                                          setPasswordEditing((prev) => ({
                                            ...prev,
                                            [entry.id]: false,
                                          }))
                                        }
                                        className="px-3 py-1.5 text-xs font-semibold rounded-md border border-transparent text-gray-500"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden space-y-3">
                  {filteredUsers.map((entry) => {
                    const currentRole = roleEdits[entry.id] ?? entry.role;
                    const isSavingRole = roleSaving[entry.id] ?? false;
                    const isEditingPassword = passwordEditing[entry.id] ?? false;
                    const passwordValue = passwordEdits[entry.id] ?? '';
                    const canSetPassword = passwordValue.trim().length >= 6;

                    return (
                      <div key={entry.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold oscars-dark">{entry.email}</p>
                            <p className="text-xs text-gray-500">ID: {entry.id}</p>
                          </div>
                          <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded border border-gray-200 bg-gray-50 text-gray-600">
                            {currentRole}
                          </span>
                        </div>
                        <div className="mt-3 text-xs text-gray-600 space-y-1">
                          <div>Provider: {entry.oauthProvider || 'Password'}</div>
                          <div>Joined: {formatDate(entry.createdAt)}</div>
                          <div>Owned pools: {entry._count.ownedPools}</div>
                          <div>Memberships: {entry._count.poolMemberships}</div>
                          <div>Predictions: {entry._count.predictions}</div>
                          <div className="pt-2">
                            <div className="flex items-center gap-2">
                              <select
                                className="border border-gray-300 rounded-md px-2 py-1 text-xs"
                                value={currentRole}
                                onChange={(event) =>
                                  handleRoleChange(entry.id, entry.role, event.target.value)
                                }
                                disabled={isSavingRole}
                              >
                                <option value="USER">USER</option>
                                <option value="SUPERUSER">SUPERUSER</option>
                              </select>
                              {isSavingRole && (
                                <span className="text-[10px] text-gray-500">Saving...</span>
                              )}
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              {entry.oauthProvider ? (
                                <span className="text-[10px] text-gray-500">OAuth user</span>
                              ) : (
                                <>
                                  {isEditingPassword ? (
                                    <>
                                      <input
                                        type="password"
                                        value={passwordValue}
                                        onChange={(event) =>
                                          setPasswordEdits((prev) => ({
                                            ...prev,
                                            [entry.id]: event.target.value,
                                          }))
                                        }
                                        placeholder="New password"
                                        className="border border-gray-300 rounded-md px-2 py-1 text-xs"
                                      />
                                      <button
                                        onClick={() =>
                                          updatePasswordMutation.mutate({
                                            userId: entry.id,
                                            password: passwordValue,
                                          })
                                        }
                                        disabled={!canSetPassword || updatePasswordMutation.isPending}
                                        className="px-3 py-1 text-[10px] font-semibold rounded-md border border-slate-300 text-slate-700 disabled:opacity-50"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() =>
                                          setPasswordEditing((prev) => ({
                                            ...prev,
                                            [entry.id]: false,
                                          }))
                                        }
                                        className="px-3 py-1 text-[10px] font-semibold rounded-md border border-transparent text-gray-500"
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        setPasswordEditing((prev) => ({
                                          ...prev,
                                          [entry.id]: true,
                                        }))
                                      }
                                      className="px-3 py-1 text-[10px] font-semibold rounded-md border border-slate-300 text-slate-700"
                                    >
                                      Change password
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
