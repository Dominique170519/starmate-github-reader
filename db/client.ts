import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./notebook-schema";

let cachedDatabase: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDatabase() {
  if (!process.env.DATABASE_URL) return null;
  if (!cachedDatabase) {
    cachedDatabase = drizzle(neon(process.env.DATABASE_URL), { schema });
  }
  return cachedDatabase;
}
