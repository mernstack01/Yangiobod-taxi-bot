'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV = [
  { href: '/dashboard', label: 'Statistika', icon: '📊' },
  { href: '/dashboard/drivers', label: 'Haydovchilar', icon: '🚗' },
  { href: '/dashboard/users', label: 'Foydalanuvchilar', icon: '👥' },
  { href: '/dashboard/listings', label: "E'lonlar", icon: '📋' },
  { href: '/dashboard/topics', label: 'Topiclar', icon: '💬' },
  { href: '/dashboard/locations', label: 'Manzillar', icon: '📍' },
  { href: '/dashboard/settings', label: 'Sozlamalar', icon: '⚙️' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    localStorage.removeItem('admin_token');
    document.cookie = 'admin_token=; path=/; max-age=0';
    router.push('/login');
  }

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col h-full">
      <div className="px-4 py-5 border-b border-gray-700">
        <div className="text-xl font-bold">🚖 Taxi Admin</div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-1">
        {NAV.map((item) => {
          const active =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-2 py-3 border-t border-gray-700">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 transition-colors"
        >
          <span>🚪</span>
          <span>Chiqish</span>
        </button>
      </div>
    </aside>
  );
}
