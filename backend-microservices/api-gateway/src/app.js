import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { io as ioClient } from "socket.io-client";
import cors from "cors";
import dotenv from "dotenv";
import { createProxyMiddleware } from "http-proxy-middleware";
import {
  register,
  httpRequestDuration,
  httpRequestTotal,
  activeRequests,
} from "./config/metrics.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server first
const httpServer = createServer(app);

const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
};

app.use(cors(corsOptions));

// ============================================
// WebSocket Gateway Setup
// ============================================
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  },
  path: "/socket.io",
});

// Map để track client socket -> song service socket
const clientToServiceSocket = new Map();

io.on("connection", (clientSocket) => {
  console.log("✅ Client connected to Gateway:", clientSocket.id);

  // Tạo connection riêng đến Song Service cho mỗi client
  const songServiceSocket = ioClient(
    process.env.SONG_SERVICE_URL || "http://localhost:3002",
    {
      transports: ["websocket"],
      autoConnect: true,
    }
  );

  clientToServiceSocket.set(clientSocket.id, songServiceSocket);

  songServiceSocket.on("connect", () => {
    console.log(`🔗 Gateway socket ${clientSocket.id} -> Song Service ${songServiceSocket.id}`);
  });

  // Forward client events to Song Service
  const forwardEvents = [
    "create-room",
    "join-room",
    "host-play",
    "host-pause",
    "host-seek",
    "host-change-song",
    "request-sync",
    "end-room",
    "leave-room",
  ];

  forwardEvents.forEach((event) => {
    clientSocket.on(event, (data) => {
      console.log(`📤 Forwarding ${event} from client ${clientSocket.id}`);
      songServiceSocket.emit(event, data);
    });
  });

  // Forward Song Service responses to client
  const responseEvents = [
    "room-created",
    "room-joined",
    "sync-play",
    "sync-pause",
    "sync-seek",
    "sync-change-song",
    "sync-response",
    "room-ended",
    "member-joined",
    "member-left",
    "error",
  ];

  responseEvents.forEach((event) => {
    songServiceSocket.on(event, (data) => {
      console.log(`📥 Forwarding ${event} to client ${clientSocket.id}`);
      clientSocket.emit(event, data);
    });
  });

  // Handle disconnection
  clientSocket.on("disconnect", () => {
    console.log("❌ Client disconnected from Gateway:", clientSocket.id);
    
    // Cleanup: disconnect và remove song service socket
    if (songServiceSocket && songServiceSocket.connected) {
      songServiceSocket.disconnect();
    }
    clientToServiceSocket.delete(clientSocket.id);
  });

  songServiceSocket.on("disconnect", () => {
    console.log(`🔌 Song Service socket disconnected for client ${clientSocket.id}`);
  });

  songServiceSocket.on("connect_error", (error) => {
    console.error(`❌ Song Service connection error for client ${clientSocket.id}:`, error.message);
    clientSocket.emit("error", { message: "Failed to connect to music service" });
  });
});

// ============================================
// HTTP Middleware & Routes
// ============================================

// Normalize route to avoid cardinality explosion
const normalizeRoute = (path) => {
  return path
    .replace(/\/[0-9a-fA-F]{24}/g, '/:id')
    .replace(/\/[0-9]+/g, '/:id');
};

// Get target service from path
const getTargetService = (path) => {
  if (path.startsWith("/api/auth") || path.startsWith("/api/users") || path.startsWith("/api/admin/users")) {
    return "user-service";
  } else if (path.startsWith("/api/songs") || path.startsWith("/api/admin/songs")) {
    return "song-service";
  } else if (path.startsWith("/api/albums") || path.startsWith("/api/admin/albums")) {
    return "album-service";
  }
  return "unknown";
};

// Metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  const route = normalizeRoute(req.path);
  const targetService = getTargetService(req.path);

  // Increment active requests
  activeRequests.inc({ target_service: targetService });

  // Log request
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${targetService}`
  );

  // Override res.end to capture metrics
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = (Date.now() - start) / 1000;

    // Record metrics
    httpRequestDuration.observe(
      {
        method: req.method,
        route,
        status_code: res.statusCode,
        target_service: targetService,
      },
      duration
    );

    httpRequestTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
      target_service: targetService,
    });

    // Decrement active requests
    activeRequests.dec({ target_service: targetService });

    originalEnd.apply(res, args);
  };

  next();
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "api-gateway",
    timestamp: new Date().toISOString(),
    websocket: "enabled",
  });
});

// Metrics endpoint
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.get("/health/services", async (req, res) => {
  const services = {
    user: process.env.USER_SERVICE_URL || "http://localhost:3001",
    song: process.env.SONG_SERVICE_URL || "http://localhost:3002",
    album: process.env.ALBUM_SERVICE_URL || "http://localhost:3003",
  };

  const healthChecks = await Promise.allSettled(
    Object.entries(services).map(async ([name, url]) => {
      try {
        const response = await fetch(`${url}/health`);
        const data = await response.json();
        return { name, status: "healthy", data };
      } catch (error) {
        return { name, status: "unhealthy", error: error.message };
      }
    })
  );

  res.json({
    gateway: "healthy",
    websocket_clients: io.engine.clientsCount,
    services: healthChecks.map((result) => result.value),
  });
});

const proxyOptions = (target) => ({
  target,
  changeOrigin: true,
  onProxyReq: (proxyReq, req) => {
    // Forward all headers including auth
    if (req.headers.authorization) {
      proxyReq.setHeader("authorization", req.headers.authorization);
    }
    if (req.headers["x-clerk-session-id"]) {
      proxyReq.setHeader(
        "x-clerk-session-id",
        req.headers["x-clerk-session-id"]
      );
    }
  },
  onError: (err, req, res) => {
    console.error("Proxy error:", err);
    res.status(503).json({
      error: "Service unavailable",
      message: "The requested service is currently unavailable",
    });
  },
});

// User Service routes
app.use(
  "/api/auth",
  createProxyMiddleware({
    ...proxyOptions(process.env.USER_SERVICE_URL || "http://localhost:3001"),
    pathRewrite: { "^/api/auth": "/auth" },
  })
);

app.use(
  "/api/users",
  createProxyMiddleware({
    ...proxyOptions(process.env.USER_SERVICE_URL || "http://localhost:3001"),
    pathRewrite: { "^/api/users": "/users" },
  })
);

app.use(
  "/api/admin/users",
  createProxyMiddleware({
    ...proxyOptions(process.env.USER_SERVICE_URL || "http://localhost:3001"),
    pathRewrite: { "^/api/admin/users": "/admin/users" },
  })
);

// Song Service routes
app.use(
  "/api/songs",
  createProxyMiddleware({
    ...proxyOptions(process.env.SONG_SERVICE_URL || "http://localhost:3002"),
    pathRewrite: { "^/api/songs": "/songs" },
  })
);

app.use(
  "/api/admin/songs",
  createProxyMiddleware({
    ...proxyOptions(process.env.SONG_SERVICE_URL || "http://localhost:3002"),
    pathRewrite: { "^/api/admin/songs": "/admin/songs" },
  })
);

// Album Service routes
app.use(
  "/api/albums",
  createProxyMiddleware({
    ...proxyOptions(process.env.ALBUM_SERVICE_URL || "http://localhost:3003"),
    pathRewrite: { "^/api/albums": "/albums" },
  })
);

app.use(
  "/api/admin/albums",
  createProxyMiddleware({
    ...proxyOptions(process.env.ALBUM_SERVICE_URL || "http://localhost:3003"),
    pathRewrite: { "^/api/admin/albums": "/admin/albums" },
  })
);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`);
  console.log(`🏥 Health check at http://localhost:${PORT}/health`);
  console.log(`🔌 WebSocket enabled at path: /socket.io`);
  console.log(`\nServices:`);
  console.log(`  User Service: ${process.env.USER_SERVICE_URL || "http://localhost:3001"}`);
  console.log(`  Song Service: ${process.env.SONG_SERVICE_URL || "http://localhost:3002"}`);
  console.log(`  Album Service: ${process.env.ALBUM_SERVICE_URL || "http://localhost:3003"}`);
});