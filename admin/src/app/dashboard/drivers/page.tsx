'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type RegistrationStatus = 'PENDING' | 'ACTIVE' | 'BLOCKED';

interface Driver {
  id: string;
  carModel: string;
  carNumber: string;
  carColor: string | null;
  status: RegistrationStatus;
  availableSeats: number;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string | null;
    username: string | null;
    phone: string | null;
  };
}

const STATUS_LABEL: Record<RegistrationStatus, string> = {
  PENDING: '⏳ Kutilmoqda',
  ACTIVE: '✅ Faol',
  BLOCKED: '❌ Bloklangan',
};

const STATUS_COLOR: Record<RegistrationStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  ACTIVE: 'bg-green-100 text-green-700',
  BLOCKED: 'bg-red-100 text-red-700',
};

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filterStatus, setFilterStatus] = useState<RegistrationStatus | ''>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    if (search) params.set('search', search);
    api
      .get<Driver[]>(`/api/drivers?${params}`)
      .then(setDrivers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  async function approve(id: string) {
    setActionLoading(id + '_approve');
    try {
      await api.patch(`/api/drivers/${id}/approve`, {});
      load();
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setActionLoading(null);
    }
  }

  async function block(id: string) {
    if (!confirm('Haydovchini bloklaysizmi?')) return;
    setActionLoading(id + '_block');
    try {
      await api.patch(`/api/drivers/${id}/block`, {});
      load();
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Haydovchilar</h1>

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Qidirish (ism, mashina raqami...)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as RegistrationStatus | '')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Barchasi</option>
          <option value="PENDING">Kutilmoqda</option>
          <option value="ACTIVE">Faol</option>
          <option value="BLOCKED">Bloklangan</option>
        </select>
        <button
          onClick={load}
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-blue-700"
        >
          Qidirish
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm">Yuklanmoqda...</div>
      ) : drivers.length === 0 ? (
        <div className="text-gray-400 text-sm">Haydovchilar topilmadi</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Ism</th>
                <th className="px-4 py-3 font-medium">Mashina</th>
                <th className="px-4 py-3 font-medium">Holat</th>
                <th className="px-4 py-3 font-medium">Ro'yxat sanasi</th>
                <th className="px-4 py-3 font-medium">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {drivers.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">
                      {d.user.firstName} {d.user.lastName ?? ''}
                    </div>
                    {d.user.username && (
                      <div className="text-xs text-gray-400">@{d.user.username}</div>
                    )}
                    {d.user.phone && (
                      <div className="text-xs text-gray-400">{d.user.phone}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-800">{d.carModel}</div>
                    <div className="text-xs text-gray-500">
                      {d.carNumber}{d.carColor ? ` · ${d.carColor}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[d.status]}`}>
                      {STATUS_LABEL[d.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(d.createdAt).toLocaleDateString('uz-UZ')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {d.status === 'PENDING' && (
                        <button
                          onClick={() => approve(d.id)}
                          disabled={actionLoading === d.id + '_approve'}
                          className="bg-green-600 text-white text-xs px-3 py-1 rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          Tasdiqlash
                        </button>
                      )}
                      {d.status !== 'BLOCKED' && (
                        <button
                          onClick={() => block(d.id)}
                          disabled={actionLoading === d.id + '_block'}
                          className="bg-red-100 text-red-600 text-xs px-3 py-1 rounded-lg hover:bg-red-200 disabled:opacity-50"
                        >
                          Bloklash
                        </button>
                      )}
                      {d.status === 'BLOCKED' && (
                        <button
                          onClick={() => approve(d.id)}
                          disabled={actionLoading === d.id + '_approve'}
                          className="bg-blue-100 text-blue-600 text-xs px-3 py-1 rounded-lg hover:bg-blue-200 disabled:opacity-50"
                        >
                          Tiklash
                        </button>
                      )}
                    </div>
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
