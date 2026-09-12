import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/field-workers', label: 'Field Workers' },
  { to: '/households', label: 'Households' },
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="px-6 py-5">
          <p className="text-sm font-semibold text-slate-900">Health Survey</p>
          <p className="text-xs text-slate-500">Admin console</p>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 px-4 py-4">
          <p className="truncate text-xs text-slate-500">{user?.email}</p>
          <button onClick={logout} className="mt-2 text-sm font-medium text-slate-600 hover:text-slate-900">
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
