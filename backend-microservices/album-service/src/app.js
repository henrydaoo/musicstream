import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import { connectRedis } from "./config/redis.js";
import albumRoutes from "./routes/album.route.js";
import adminRoutes from "./routes/admin.route.js";
import { clerkMiddleware } from "@clerk/express";
import {
  register,
  httpRequestDuration,
  httpRequestTotal,
} from "./config/metrics.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());
app.use(clerkMiddleware());

// Metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  const route = req.path.replace(/\/[0-9a-fA-F]{24}/g, "/:id");

  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = (Date.now() - start) / 1000;

    httpRequestDuration.observe(
      { method: req.method, route, status_code: res.statusCode },
      duration
    );

    httpRequestTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
    });

    originalEnd.apply(res, args);
  };

  next();
});

app.get("/health", (req, res) => {
  res.json({ status: "OK", service: "album-service" });
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.use("/albums", albumRoutes);
app.use("/admin", adminRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();
    app.listen(PORT, () => {
      console.log(`🚀 Album Service running on port ${PORT}`);
      console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
