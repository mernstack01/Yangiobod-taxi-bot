'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Topic {
  id: string;
  topicId: number;
  isActive: boolean;
  location: { id: string; name: string };
}

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    api
      .get<Topic[]>('/api/topics')
      .then(setTopics)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function startEdit(topic: Topic) {
    setEditing(topic.id);
    setEditVal(topic.topicId === 0 ? '' : String(topic.topicId));
  }

  async function saveEdit(id: string) {
    const num = parseInt(editVal, 10);
    if (isNaN(num) || num <= 0) {
      alert("To'g'ri topic ID kiriting (musbat raqam)");
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/api/topics/${id}`, { topicId: num, isActive: true });
      setEditing(null);
      load();
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(topic: Topic) {
    try {
      await api.patch(`/api/topics/${topic.id}`, { isActive: !topic.isActive });
      load();
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Telegram Topiclar</h1>
      <p className="text-sm text-gray-500 mb-6">
        Har bir manzil uchun super-group topic ID ni sozlang. Topic ID = 0 bo&apos;lsa, broadcast qilinmaydi.
      </p>

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
                <th className="px-4 py-3 font-medium">Manzil</th>
                <th className="px-4 py-3 font-medium">Topic ID</th>
                <th className="px-4 py-3 font-medium">Holat</th>
                <th className="px-4 py-3 font-medium">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {topics.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{t.location.name}</td>
                  <td className="px-4 py-3">
                    {editing === t.id ? (
                      <input
                        type="number"
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        className="border border-blue-300 rounded px-2 py-1 w-32 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Topic ID"
                        autoFocus
                      />
                    ) : (
                      <span className={t.topicId === 0 ? 'text-gray-400' : 'text-gray-800 font-mono'}>
                        {t.topicId === 0 ? 'Sozlanmagan' : t.topicId}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(t)}
                      className={`text-xs px-2 py-1 rounded-full font-medium cursor-pointer ${
                        t.isActive
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {t.isActive ? '✅ Faol' : '⏸ Nofaol'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {editing === t.id ? (
                        <>
                          <button
                            onClick={() => saveEdit(t.id)}
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
                        </>
                      ) : (
                        <button
                          onClick={() => startEdit(t)}
                          className="bg-blue-50 text-blue-600 text-xs px-3 py-1 rounded-lg hover:bg-blue-100"
                        >
                          Tahrirlash
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

      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
        <strong>Qanday olasiz?</strong> Telegram super-group → Topic ustiga o&apos;ng klik →
        &quot;Link to this topic&quot; → URL dagi raqam (masalan: t.me/c/123456/789 → 789 topic ID)
      </div>
    </div>
  );
}
