import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
      <p className="text-lg font-semibold text-slate-900">Page not found</p>
      <Link to="/" className="text-sm text-indigo-600 hover:text-indigo-500">
        Back to dashboard
      </Link>
    </div>
  );
}
