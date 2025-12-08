import client from 'prom-client';

// Create a Registry
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({
  register,
  prefix: 'user_service_',
});

// HTTP Request Duration
const httpRequestDuration = new client.Histogram({
  name: 'user_service_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

// HTTP Request Counter
const httpRequestTotal = new client.Counter({
  name: 'user_service_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Authentication Attempts
const authAttempts = new client.Counter({
  name: 'user_service_auth_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['status', 'type'], // status: success/failure, type: login/register
});

// Database Query Duration
const dbQueryDuration = new client.Histogram({
  name: 'user_service_db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'collection'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1],
});

// Active Users
const activeUsers = new client.Gauge({
  name: 'user_service_active_users',
  help: 'Number of active authenticated users',
});

// Clerk API Calls
const clerkApiCalls = new client.Counter({
  name: 'user_service_clerk_api_calls_total',
  help: 'Total number of Clerk API calls',
  labelNames: ['operation', 'status'],
});

// Register metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(authAttempts);
register.registerMetric(dbQueryDuration);
register.registerMetric(activeUsers);
register.registerMetric(clerkApiCalls);

export {
  register,
  httpRequestDuration,
  httpRequestTotal,
  authAttempts,
  dbQueryDuration,
  activeUsers,
  clerkApiCalls,
};