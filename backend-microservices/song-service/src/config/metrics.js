import client from 'prom-client';

// Create a Registry
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({
  register,
  prefix: 'song_service_',
});

// HTTP Request Duration
const httpRequestDuration = new client.Histogram({
  name: 'song_service_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

// HTTP Request Counter
const httpRequestTotal = new client.Counter({
  name: 'song_service_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Cache Hits
const cacheHits = new client.Counter({
  name: 'song_service_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_key_pattern'],
});

// Cache Misses
const cacheMisses = new client.Counter({
  name: 'song_service_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_key_pattern'],
});

// Database Query Duration
const dbQueryDuration = new client.Histogram({
  name: 'song_service_db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'collection'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1],
});

// External Service Calls (Cloudinary, Recombee)
const externalServiceDuration = new client.Histogram({
  name: 'song_service_external_service_duration_seconds',
  help: 'Duration of external service calls',
  labelNames: ['service', 'operation'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

// Song Uploads
const songUploads = new client.Counter({
  name: 'song_service_uploads_total',
  help: 'Total number of song uploads',
  labelNames: ['status'],
});

// Streaming Requests
const streamingRequests = new client.Counter({
  name: 'song_service_streaming_requests_total',
  help: 'Total number of streaming requests',
  labelNames: ['quality'],
});

// Register metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(cacheHits);
register.registerMetric(cacheMisses);
register.registerMetric(dbQueryDuration);
register.registerMetric(externalServiceDuration);
register.registerMetric(songUploads);
register.registerMetric(streamingRequests);

export {
  register,
  httpRequestDuration,
  httpRequestTotal,
  cacheHits,
  cacheMisses,
  dbQueryDuration,
  externalServiceDuration,
  songUploads,
  streamingRequests,
};