import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';

export function HouseholdDetailPage() {
  const { id } = useParams();
  const [household, setHousehold] = useState(null);
  const [assessmentsByMember, setAssessmentsByMember] = useState({});
  const [expandedMemberId, setExpandedMemberId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getHousehold(id)
      .then(setHousehold)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function toggleMember(memberId) {
    if (expandedMemberId === memberId) {
      setExpandedMemberId(null);
      return;
    }
    setExpandedMemberId(memberId);
    if (!assessmentsByMember[memberId]) {
      const data = await api.listAssessmentsByMember(memberId);
      setAssessmentsByMember((prev) => ({ ...prev, [memberId]: data }));
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading household…</p>;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!household) return null;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/households" className="text-sm text-slate-500 hover:text-slate-700">
          ← Back to households
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">{household.householdCode}</h1>
        <p className="text-sm text-slate-500">
          {household.address} · {household.area?.name}
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-900">Members</h2>
        {household.members.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No members recorded yet" />
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {household.members.map((member) => (
              <div key={member.id} className="rounded-lg border border-slate-200 bg-white">
                <button
                  onClick={() => toggleMember(member.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{member.name}</p>
                    <p className="text-xs text-slate-500">
                      {member.age} yrs · {member.gender} · {member.relationship}
                    </p>
                  </div>
                  <span className="text-sm text-indigo-600">
                    {expandedMemberId === member.id ? 'Hide assessments' : 'View assessments'}
                  </span>
                </button>
                {expandedMemberId === member.id && (
                  <div className="border-t border-slate-100 px-4 py-3">
                    {!assessmentsByMember[member.id] ? (
                      <p className="text-sm text-slate-500">Loading…</p>
                    ) : assessmentsByMember[member.id].length === 0 ? (
                      <EmptyState title="No assessments recorded yet" />
                    ) : (
                      <div className="space-y-2">
                        {assessmentsByMember[member.id].map((assessment) => (
                          <div key={assessment.id} className="rounded-md bg-slate-50 px-3 py-2 text-sm">
                            <div className="flex items-center justify-between">
                              <p className="text-slate-700">
                                {assessment.temperatureC != null
                                  ? `${assessment.temperatureC}°C`
                                  : 'No temperature recorded'}
                              </p>
                              {assessment.isUrgent && <Badge tone="urgent">Urgent</Badge>}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {[
                                assessment.hasFever && 'Fever',
                                assessment.hasCough && 'Cough',
                                assessment.hasBreathingDifficulty && 'Breathing difficulty',
                              ]
                                .filter(Boolean)
                                .join(' · ') || 'No symptoms flagged'}
                            </p>
                            {assessment.notes && (
                              <p className="mt-1 text-xs text-slate-500">{assessment.notes}</p>
                            )}
                            <p className="mt-1 text-[11px] text-slate-400">
                              {new Date(assessment.createdAt).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
