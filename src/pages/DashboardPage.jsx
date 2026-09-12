import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { StatCard } from '../components/StatCard';
import { EmptyState } from '../components/EmptyState';

export function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getDashboardStats(), api.getDashboardActivity()])
      .then(([statsData, activityData]) => {
        if (cancelled) return;
        setStats(statsData);
        setActivity(activityData);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="text-sm text-slate-500">Loading dashboard…</p>;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">An overview of field activity.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Households" value={stats.households} />
        <StatCard label="Field workers" value={stats.fieldWorkers} />
        <StatCard label="Assessments" value={stats.assessments} />
        <StatCard label="Urgent assessments" value={stats.urgentAssessments} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
        <div className="mt-3 space-y-2">
          {activity.length === 0 ? (
            <EmptyState title="No activity yet" description="Urgent assessments will show up here." />
          ) : (
            activity.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
                <p className="text-slate-700">{item.message}</p>
                <p className="mt-1 text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
