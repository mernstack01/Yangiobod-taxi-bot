'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface User {
  id: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  phone: string | null;
  role: string;
  isBlocked: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [filterBlocked, setFilterBlocked] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filterBlocked) params.set('isBlocked', filterBlocked);
    api
      .get<User[]>(`/api/users?${params}`)
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [filterBlocked]); // eslint-disable-line react-hooks/exhaustive-deps

  async function block(id: string) {
    const reason = prompt("Bloklash sababi:");
    if (!reason) return;
    setActionLoading(id + '_block');
    try {
      await api.patch(`/api/users/${id}/block`, { reason });
      load();
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setActionLoading(null);
    }
  }

  async function unblock(id: string) {
    setActionLoading(id + '_unblock');
    try {
      await api.patch(`/api/users/${id}/unblock`, {});
      load();
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setActionLoading(null);
    }
  }

  const ROLE_LABEL: Record<string, string> = {
    USER: 'Foydalanuvchi',
    DRIVER: 'Haydovchi',
    ADMIN: 'Admin',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Foydalanuvchilar</h1>

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Qidirish (ism, username, telefon...)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterBlocked}
          onChange={(e) => setFilterBlocked(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Barchasi</option>
          <option value="false">Faol</option>
          <option value="true">Bloklangan</option>
        </select>
        <button
          onClick={load}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-blue-700"
        >
          Qidirish
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm">Yuklanmoqda...</div>
      ) : users.length === 0 ? (
        <div className="text-gray-400 text-sm">Foydalanuvchilar topilmadi</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Ism</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Holat</th>
                <th className="px-4 py-3 font-medium">Sana</th>
                <th className="px-4 py-3 font-medium">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">
                      {u.firstName} {u.lastName ?? ''}
                    </div>
                    {u.username && <div className="text-xs text-gray-400">@{u.username}</div>}
                    {u.phone && <div className="text-xs text-gray-400">{u.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {ROLE_LABEL[u.role] ?? u.role}
                  </td>
                  <td className="px-4 py-3">
                    {u.isBlocked ? (
                      <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full">Bloklangan</span>
                    ) : (
                      <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">Faol</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(u.createdAt).toLocaleDateString('uz-UZ')}
                  </td>
                  <td className="px-4 py-3">
                    {u.isBlocked ? (
                      <button
                        onClick={() => unblock(u.id)}
                        disabled={actionLoading === u.id + '_unblock'}
                        className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-lg hover:bg-green-200 disabled:opacity-50"
                      >
                        Tiklash
                      </button>
                    ) : (
                      <button
                        onClick={() => block(u.id)}
                        disabled={actionLoading === u.id + '_block'}
                        className="bg-red-100 text-red-600 text-xs px-3 py-1 rounded-lg hover:bg-red-200 disabled:opacity-50"
                      >
                        Bloklash
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
