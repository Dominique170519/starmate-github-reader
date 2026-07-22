declare module "cloudflare:workers" {
  type D1Result<T = unknown> = { results?: T[]; success?: boolean; meta?: unknown };
  type D1PreparedStatement = {
    bind: (...values: unknown[]) => D1PreparedStatement;
    first: <T = unknown>() => Promise<T | null>;
    all: <T = unknown>() => Promise<D1Result<T>>;
    run: () => Promise<D1Result>;
  };
  type D1Database = {
    prepare: (query: string) => D1PreparedStatement;
    batch: (statements: D1PreparedStatement[]) => Promise<D1Result[]>;
  };
  export const env: { DB?: D1Database };
}

