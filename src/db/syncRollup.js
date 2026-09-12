// Shared severity ranking so a household's card can reflect "something
// inside it needs attention" even when the household record itself is
// perfectly synced — same idea one level down (a member reflecting its
// assessments). conflict ranks above error above pending: conflict needs
// the user to make a decision, error will keep auto-retrying, pending is
// just "hasn't gone out yet".
export const RANK = { synced: 0, pending: 1, error: 2, conflict: 3 };
export const STATUS_BY_RANK = ['synced', 'pending', 'error', 'conflict'];

// SQL fragment turning a syncStatus column into its severity rank, for use
// inside a correlated subquery's MAX().
export function rankCase(column) {
  return `CASE ${column} WHEN 'conflict' THEN 3 WHEN 'error' THEN 2 WHEN 'pending' THEN 1 ELSE 0 END`;
}

// Combines a record's own status with the worst status found among its
// children (already reduced to a single rank via SQL's MAX in the caller).
export function worseOf(ownStatus, childMaxRank) {
  const ownRank = RANK[ownStatus] ?? 0;
  const rank = Math.max(ownRank, childMaxRank || 0);
  return STATUS_BY_RANK[rank];
}
