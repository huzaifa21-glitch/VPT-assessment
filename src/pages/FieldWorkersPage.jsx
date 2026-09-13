import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { Spinner } from '../components/Spinner';

const emptyForm = { name: '', email: '', password: '', areaId: '' };

export function FieldWorkersPage() {
  const [workers, setWorkers] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Tracks which worker rows currently have an update in flight (status
  // toggle or area reassignment), so each row can show its own spinner and
  // disable itself — without this, a slow request looks identical to a
  // broken click, which invites the user to click again and fire a second
  // (possibly conflicting) request.
  const [pendingWorkerIds, setPendingWorkerIds] = useState(() => new Set());

  async function load() {
    setLoading(true);
    try {
      const [workersData, areasData] = await Promise.all([api.listFieldWorkers(), api.listAreas()]);
      setWorkers(workersData.items);
      setAreas(areasData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await api.createFieldWorker({
        name: form.name,
        email: form.email,
        password: form.password,
        areaId: form.areaId || undefined,
      });
      setForm(emptyForm);
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function withPending(workerId, fn) {
    return async (...args) => {
      setPendingWorkerIds((prev) => new Set(prev).add(workerId));
      try {
        await fn(...args);
      } finally {
        setPendingWorkerIds((prev) => {
          const next = new Set(prev);
          next.delete(workerId);
          return next;
        });
      }
    };
  }

  const handleToggleStatus = (worker) =>
    withPending(worker.id, async () => {
      await api.setFieldWorkerStatus(worker.id, !worker.isActive);
      await load();
    })();

  const handleAssignArea = (worker, areaId) =>
    withPending(worker.id, async () => {
      // The API only supports assigning to a real area, not clearing one —
      // selecting "Unassigned" again on an already-unassigned worker is a no-op.
      if (!areaId) return;
      await api.assignFieldWorkerArea(worker.id, areaId);
      await load();
    })();

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner size={14} /> Loading field workers…
      </p>
    );
  }
  if (error) return <p className="text-sm text-rose-600">{error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Field Workers</h1>
          <p className="text-sm text-slate-500">Manage accounts and area assignments.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          {showForm ? 'Cancel' : 'Add field worker'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-2"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700">Name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Temporary password</label>
            <input
              required
              minLength={8}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Area</label>
            <select
              value={form.areaId}
              onChange={(e) => setForm({ ...form, areaId: e.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Unassigned</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>
          {formError && <p className="text-sm text-rose-600 sm:col-span-2">{formError}</p>}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {submitting && <Spinner size={14} />}
              {submitting ? 'Creating…' : 'Create field worker'}
            </button>
          </div>
        </form>
      )}

      {workers.length === 0 ? (
        <EmptyState title="No field workers yet" description="Add one to get started." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workers.map((worker) => {
                const isPending = pendingWorkerIds.has(worker.id);
                return (
                  <tr key={worker.id} className={isPending ? 'opacity-60' : undefined}>
                    <td className="px-4 py-3 text-slate-900">{worker.name}</td>
                    <td className="px-4 py-3 text-slate-500">{worker.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={worker.areaId || ''}
                        onChange={(e) => handleAssignArea(worker, e.target.value)}
                        disabled={isPending}
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none disabled:opacity-60"
                      >
                        <option value="">Unassigned</option>
                        {areas.map((area) => (
                          <option key={area.id} value={area.id}>
                            {area.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={worker.isActive ? 'active' : 'inactive'}>
                        {worker.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleToggleStatus(worker)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-500 disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        {isPending && <Spinner size={12} />}
                        {worker.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
