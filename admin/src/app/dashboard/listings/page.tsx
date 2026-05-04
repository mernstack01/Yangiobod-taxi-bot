'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type ListingStatus = 'ACTIVE' | 'MATCHED' | 'CLOSED' | 'EXPIRED' | 'CANCELLED';

interface Listing {
  id: string;
  status: ListingStatus;
  passengerCount: number;
  parcelOnly: boolean;
  needTime: string;
  priceOffer: number | null;
  createdAt: string;
  expiresAt: string;
  client: { firstName: string; lastName: string | null; username: string | null };
  from: { name: string };
  to: { name: string };
  matchedDriver: { user: { firstName: string } } | null;
}

const STATUS_COLOR: Record<ListingStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  MATCHED: 'bg-blue-100 text-blue-700',
  CLOSED: 'bg-gray-100 text-gray-600',
  EXPIRED: 'bg-orange-100 text-orange-600',
  CANCELLED: 'bg-red-100 text-red-600',
};

const STATUS_LABEL: Record<ListingStatus, string> = {
  ACTIVE: 'Faol',
  MATCHED: 'Matched',
  CLOSED: 'Yopilgan',
  EXPIRED: 'Muddati o\'tgan',
  CANCELLED: 'Bekor',
};

const NEED_TIME: Record<string, string> = {
  NOW: 'Hozir',
  IN_15_MIN: '15 daqiqada',
  IN_30_MIN: '30 daqiqada',
  IN_1_HOUR: '1 soatda',
  SCHEDULED: 'Belgilangan vaqt',
};

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [filterStatus, setFilterStatus] = useState<ListingStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ limit: '100' });
    if (filterStatus) params.set('status', filterStatus);
    api
      .get<Listing[]>(`/api/listings?${params}`)
      .then(setListings)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  async function cancel(id: string) {
    if (!confirm("E'lonni bekor qilasizmi?")) return;
    try {
      await api.del(`/api/listings/${id}`);
      load();
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">E&apos;lonlar</h1>

      <div className="flex gap-3 mb-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as ListingStatus | '')}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Barchasi</option>
          <option value="ACTIVE">Faol</option>
          <option value="MATCHED">Matched</option>
          <option value="CLOSED">Yopilgan</option>
          <option value="EXPIRED">Muddati o&apos;tgan</option>
          <option value="CANCELLED">Bekor</option>
        </select>
        <button onClick={load} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-blue-700">
          Yangilash
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm">Yuklanmoqda...</div>
      ) : listings.length === 0 ? (
        <div className="text-gray-400 text-sm">E&apos;lonlar topilmadi</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Mijoz</th>
                <th className="px-4 py-3 font-medium">Marshrut</th>
                <th className="px-4 py-3 font-medium">Vaqt</th>
                <th className="px-4 py-3 font-medium">Holat</th>
                <th className="px-4 py-3 font-medium">Narx</th>
                <th className="px-4 py-3 font-medium">Sana</th>
                <th className="px-4 py-3 font-medium">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {listings.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-gray-800">
                      {l.client.firstName} {l.client.lastName ?? ''}
                    </div>
                    {l.client.username && (
                      <div className="text-xs text-gray-400">@{l.client.username}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-800">{l.from.name} → {l.to.name}</div>
                    <div className="text-xs text-gray-500">
                      {l.parcelOnly ? 'Faqat pochta' : `${l.passengerCount} kishi`}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {NEED_TIME[l.needTime] ?? l.needTime}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[l.status]}`}>
                      {STATUS_LABEL[l.status]}
                    </span>
                    {l.matchedDriver && (
                      <div className="text-xs text-blue-500 mt-1">
                        → {l.matchedDriver.user.firstName}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {l.priceOffer ? `${l.priceOffer.toLocaleString()} so'm` : 'Kelishiladi'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(l.createdAt).toLocaleString('uz-UZ', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {l.status === 'ACTIVE' && (
                      <button
                        onClick={() => cancel(l.id)}
                        className="bg-red-100 text-red-600 text-xs px-3 py-1 rounded-lg hover:bg-red-200"
                      >
                        Bekor
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
