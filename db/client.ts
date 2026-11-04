import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.ts";

config({ path: ".env.local" });

const url = process.env.TURSO_DATABASE_URL || "libsql://mesto-dheereshag.aws-ap-south-1.turso.io";
const authToken = process.env.TURSO_AUTH_TOKEN;

export const client = createClient({
  url,
  authToken,
});

export const db = drizzle({
  client,
  relations: schema.relations,
});
export { schema };
