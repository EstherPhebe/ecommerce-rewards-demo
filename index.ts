import cors from "cors";
import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import morgan from "morgan";
import prisma from "./prisma/client";

const app = express();

app.set("trust proxy", 1);

app.use(
  cors({
    origin:
      process.env.NODE_ENV != "development"
        ? (process.env.ALLOWED_ORIGINS ?? "").split(",").filter(Boolean)
        : ["http://localhost:3002"],
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan(process.env.NODE_ENV !== "development" ? "combined" : "dev"));

app.get("/", (_req: Request, res: Response) => {
  res.send("Achievements & Rewards API");
});

app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  if (process.env.NODE_ENV === "development") console.log(error);

  if (error.name === "ZodError") {
    res.status(422).json({
      error: error.issues[0]?.message ?? "Invalid request.",
    });
    return;
  }

  if (error?.name === "PrismaClientKnownRequestError") {
    switch (error.code) {
      case "P2002":
        res.status(409).json({
          error: "A record with this value already exists.",
          code: error.code,
        });
        return;
      case "P2025":
        res.status(404).json({ error: "Record not found.", code: error.code });
        return;
      case "P2003":
        res
          .status(400)
          .json({ error: "Related record not found.", code: error.code });
        return;
      default:
        res.status(500).json({ error: "A database error occurred." });
        return;
    }
  }

  if (error?.name === "PrismaClientValidationError") {
    console.error("[Prisma] Validation error:", error.message);
    return res.status(400).json({ success: false, error: "Invalid request." });
  }

  // Fallback
  return res
    .status(error.errorCode ?? 500)
    .json({ error: error?.message ?? "Something went wrong." });
});

app.all("*", (_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

const port = process.env.APP_PORT;

const server = app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

const gracefulShutdown = async () => {
  console.log("Shutting down server...");

  server.close(async () => {
    await prisma.$disconnect();
    console.log("All connections closed. Exiting process.");
    process.exit(0);
  });

  setTimeout(() => {
    console.error(
      "Could not close connections in time, forcefully shutting down"
    );
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
