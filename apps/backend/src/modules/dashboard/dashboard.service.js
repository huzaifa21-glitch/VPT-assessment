const { prisma } = require('../../prisma/client');
const { cache } = require('../../redis/cache');

const STATS_CACHE_KEY = 'dashboard:stats';
const STATS_TTL_SECONDS = 60; // freshness bound even if an invalidation is ever missed

const dashboardService = {
  // Cache-aside: served from Redis when warm, computed via a handful of
  // count() queries on miss, and re-cached with a short TTL. Writes across
  // households/members/assessments/field-workers call invalidate() below so
  // the dashboard doesn't wait out the full TTL to reflect new data.
  async getStats() {
    const cached = await cache.get(STATS_CACHE_KEY);
    if (cached) return { ...cached, source: 'cache' };

    const [households, fieldWorkers, assessments, urgentAssessments] = await Promise.all([
      prisma.household.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { role: 'FIELD_WORKER' } }),
      prisma.healthAssessment.count({ where: { deletedAt: null } }),
      prisma.healthAssessment.count({ where: { deletedAt: null, isUrgent: true } }),
    ]);

    const stats = { households, fieldWorkers, assessments, urgentAssessments };
    await cache.set(STATS_CACHE_KEY, stats, STATS_TTL_SECONDS);
    return { ...stats, source: 'db' };
  },

  async invalidate() {
    await cache.del(STATS_CACHE_KEY);
  },

  async recentActivity(limit = 20) {
    return prisma.activityLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  },
};

module.exports = { dashboardService };
