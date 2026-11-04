import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.ts";

config({ path: ".env.local" });

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error("TURSO_DATABASE_URL or TURSO_AUTH_TOKEN is not defined");
}

export const client = createClient({
  url,
  authToken,
});

export const db = drizzle({
  client,
  relations: schema.relations,
});
export { schema };
