
export const RANK = { synced: 0, pending: 1, error: 2, conflict: 3 };
export const STATUS_BY_RANK = ['synced', 'pending', 'error', 'conflict'];


export function rankCase(column) {
  return `CASE ${column} WHEN 'conflict' THEN 3 WHEN 'error' THEN 2 WHEN 'pending' THEN 1 ELSE 0 END`;
}


export function worseOf(ownStatus, childMaxRank) {
  const ownRank = RANK[ownStatus] ?? 0;
  const rank = Math.max(ownRank, childMaxRank || 0);
  return STATUS_BY_RANK[rank];
}
