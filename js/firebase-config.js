/**
 * Firebase cutover guard for marga-biz.
 *
 * The internal AI / scanner / workflow collections have moved to local
 * Postgres-backed storage. Do not re-open browser-side Firebase writes for
 * these collections from stale cached pages or old snippets.
 */

(function applyFirebaseCutoverGuard(globalScope) {
  const retiredCollections = [
    'marga_site',
    'marga_pages',
    'marga_agents',
    'marga_tasks',
    'marga_issues',
    'marga_solutions',
    'marga_followups',
    'marga_recommendations',
    'marga_activity_log',
    'marga_shared'
  ];

  globalScope.MARGA_FIREBASE_STATUS = {
    mode: 'retired-internal-docs',
    backend: 'postgres',
    retiredCollections,
    updatedAt: '2026-07-01T00:00:00+08:00'
  };

  globalScope.db = null;
  globalScope.functions = null;
  globalScope.storage = null;

  console.warn(
    '[marga-biz] Firebase browser config is disabled. Internal AI/scanner/workflow collections now use Postgres.',
    retiredCollections
  );
})(window);
