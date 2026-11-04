import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL || "libsql://mesto-dheereshag.aws-ap-south-1.turso.io",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
