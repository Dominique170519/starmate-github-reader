import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./notebook-schema";

let cachedDatabase: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getTransactionalDatabase() {
  if (!process.env.DATABASE_URL) return null;
  if (!cachedDatabase) {
    cachedDatabase = drizzle({ connection: process.env.DATABASE_URL, schema });
  }
  return cachedDatabase;
}
