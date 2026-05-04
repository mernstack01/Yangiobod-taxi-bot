'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Setting {
  key: string;
  value: string;
}

const SETTING_DESCRIPTIONS: Record<string, string> = {
  'listing.expiryHours': "E'lon amal qilish muddati (soat)",
  'listing.clientCooldownMinutes': "Mijoz e'lon orasi (daqiqa)",
  'bot.maxActiveListingsPerClient': 'Bir mijozning faol e\'lonlar soni',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function load() {
    setLoading(true);
    api
      .get<Setting[]>('/api/settings')
      .then(setSettings)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function save(key: string) {
    if (!editVal.trim()) return;
    setSaving(true);
    setSuccess('');
    try {
      await api.put(`/api/settings/${key}`, { value: editVal.trim() });
      setEditing(null);
      setSuccess(`${key} saqlandi`);
      load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Sozlamalar</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 mb-4 text-sm">
          ✅ {success}
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm">Yuklanmoqda...</div>
      ) : settings.length === 0 ? (
        <div className="text-gray-400 text-sm">
          Sozlamalar topilmadi (default qiymatlar ishlatilmoqda)
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Kalit</th>
                <th className="px-4 py-3 font-medium">Tavsif</th>
                <th className="px-4 py-3 font-medium">Qiymat</th>
                <th className="px-4 py-3 font-medium">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {settings.map((s) => (
                <tr key={s.key} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{s.key}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {SETTING_DESCRIPTIONS[s.key] ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {editing === s.key ? (
                      <input
                        type="text"
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        className="border border-blue-300 rounded px-2 py-1 w-24 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <span className="font-semibold text-gray-800">{s.value}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editing === s.key ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => save(s.key)}
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
                        onClick={() => { setEditing(s.key); setEditVal(s.value); }}
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

      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
        <div className="font-medium mb-2">Default qiymatlar (DB da bo&apos;lmasa ishlatiladi):</div>
        <ul className="space-y-1">
          <li><code className="bg-gray-100 px-1 rounded">listing.expiryHours</code> = 2 soat</li>
          <li><code className="bg-gray-100 px-1 rounded">listing.clientCooldownMinutes</code> = 10 daqiqa</li>
        </ul>
      </div>
    </div>
  );
}
