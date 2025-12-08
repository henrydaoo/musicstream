import client from 'prom-client';

// Create a Registry
const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({
  register,
  prefix: 'gateway_',
});

// HTTP Request Duration
const httpRequestDuration = new client.Histogram({
  name: 'gateway_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'target_service'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

// HTTP Request Counter
const httpRequestTotal = new client.Counter({
  name: 'gateway_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'target_service'],
});

// Proxy Errors
const proxyErrors = new client.Counter({
  name: 'gateway_proxy_errors_total',
  help: 'Total number of proxy errors',
  labelNames: ['target_service'],
});

// Active Requests
const activeRequests = new client.Gauge({
  name: 'gateway_active_requests',
  help: 'Number of active requests',
  labelNames: ['target_service'],
});

// Register metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(proxyErrors);
register.registerMetric(activeRequests);

export {
  register,
  httpRequestDuration,
  httpRequestTotal,
  proxyErrors,
  activeRequests,
};