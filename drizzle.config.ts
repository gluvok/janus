import { defineConfig } from "drizzle-kit";

if (process.loadEnvFile) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    try {
      process.loadEnvFile(".env");
    } catch {
      // Ignore if env files are missing
    }
  }
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL || "libsql://mesto-dheereshag.aws-ap-south-1.turso.io",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});

