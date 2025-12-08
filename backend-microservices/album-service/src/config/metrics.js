import client from 'prom-client';

// Create a Registry
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({
  register,
  prefix: 'album_service_',
});

// HTTP Request Duration
const httpRequestDuration = new client.Histogram({
  name: 'album_service_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

// HTTP Request Counter
const httpRequestTotal = new client.Counter({
  name: 'album_service_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Cache Hits
const cacheHits = new client.Counter({
  name: 'album_service_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_key_pattern'],
});

// Cache Misses
const cacheMisses = new client.Counter({
  name: 'album_service_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_key_pattern'],
});

// Database Query Duration
const dbQueryDuration = new client.Histogram({
  name: 'album_service_db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'collection'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1],
});

// Album Operations
const albumOperations = new client.Counter({
  name: 'album_service_operations_total',
  help: 'Total number of album operations',
  labelNames: ['operation', 'status'], // operation: create/update/delete/add_song/remove_song
});

// Register metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(cacheHits);
register.registerMetric(cacheMisses);
register.registerMetric(dbQueryDuration);
register.registerMetric(albumOperations);

export {
  register,
  httpRequestDuration,
  httpRequestTotal,
  cacheHits,
  cacheMisses,
  dbQueryDuration,
  albumOperations,
};