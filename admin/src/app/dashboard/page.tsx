'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Stats {
  users: { total: number; blocked: number };
  drivers: { total: number; pending: number; active: number; online: number };
  listings: { total: number; active: number; matchedToday: number };
}

interface StatCardProps {
  title: string;
  value: number;
  sub?: string;
  color: string;
  icon: string;
}

function StatCard({ title, value, sub, color, icon }: StatCardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${color}`}>{sub}</span>
      </div>
      <div className="text-3xl font-bold text-gray-800">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{title}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Stats>('/api/stats/overview')
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-4">
        Xatolik: {error}
      </div>
    );
  }

  if (!stats) {
    return <div className="text-gray-400 text-sm">Yuklanmoqda...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Umumiy statistika</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
        <StatCard
          title="Jami foydalanuvchilar"
          value={stats.users.total}
          sub={`${stats.users.blocked} bloklangan`}
          color="bg-blue-50 text-blue-600"
          icon="👥"
        />
        <StatCard
          title="Jami haydovchilar"
          value={stats.drivers.total}
          sub={`${stats.drivers.pending} kutilmoqda`}
          color="bg-yellow-50 text-yellow-600"
          icon="🚗"
        />
        <StatCard
          title="Faol haydovchilar"
          value={stats.drivers.active}
          sub={`${stats.drivers.online} online`}
          color="bg-green-50 text-green-600"
          icon="✅"
        />
        <StatCard
          title="Bugungi uchrashuvlar"
          value={stats.listings.matchedToday}
          sub={`${stats.listings.active} faol e'lon`}
          color="bg-purple-50 text-purple-600"
          icon="🤝"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-700 mb-4">Haydovchilar holati</h2>
          <div className="space-y-3">
            <Row label="Jami ro'yxatdan o'tgan" value={stats.drivers.total} />
            <Row label="Tasdiqlangan (ACTIVE)" value={stats.drivers.active} color="text-green-600" />
            <Row label="Kutilmoqda (PENDING)" value={stats.drivers.pending} color="text-yellow-600" />
            <Row label="Online (AVAILABLE)" value={stats.drivers.online} color="text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-700 mb-4">E'lonlar holati</h2>
          <div className="space-y-3">
            <Row label="Jami e'lonlar" value={stats.listings.total} />
            <Row label="Faol e'lonlar" value={stats.listings.active} color="text-green-600" />
            <Row label="Bugun matched" value={stats.listings.matchedToday} color="text-blue-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  color = 'text-gray-800',
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>{value}</span>
    </div>
  );
}
