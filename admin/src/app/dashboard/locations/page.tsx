'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Location {
  id: string;
  name: string;
  tier: string;
  sortOrder: number;
  isActive: boolean;
}

const TIER_LABEL: Record<string, string> = {
  CITY: 'Shahar',
  CENTER: 'Markaz',
  DISTRICT: 'Tuman',
  VILLAGE: 'Qishloq',
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api
      .get<Location[]>('/api/locations')
      .then(setLocations)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(loc: Location) {
    try {
      await api.patch(`/api/locations/${loc.id}`, { isActive: !loc.isActive });
      load();
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  }

  async function saveName(id: string) {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await api.patch(`/api/locations/${id}`, { name: editName.trim() });
      setEditing(null);
      load();
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Manzillar</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm">Yuklanmoqda...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Nomi</th>
                <th className="px-4 py-3 font-medium">Turi</th>
                <th className="px-4 py-3 font-medium">Holat</th>
                <th className="px-4 py-3 font-medium">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {locations.map((loc) => (
                <tr key={loc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 text-xs">{loc.sortOrder}</td>
                  <td className="px-4 py-3">
                    {editing === loc.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <span className="font-medium text-gray-800">{loc.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                      {TIER_LABEL[loc.tier] ?? loc.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(loc)}
                      className={`text-xs px-2 py-1 rounded-full font-medium cursor-pointer ${
                        loc.isActive
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {loc.isActive ? '✅ Faol' : '⏸ Nofaol'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {editing === loc.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveName(loc.id)}
                          disabled={saving}
                          className="bg-blue-600 text-white text-xs px-3 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          Saqlash
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-lg hover:bg-gray-200"
                        >
                          Bekor
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditing(loc.id); setEditName(loc.name); }}
                        className="bg-blue-50 text-blue-600 text-xs px-3 py-1 rounded-lg hover:bg-blue-100"
                      >
                        Tahrirlash
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
