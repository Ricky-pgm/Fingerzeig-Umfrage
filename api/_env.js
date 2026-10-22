// The Neon integration may add a project prefix (e.g. "fingerzeig_umfrage_DATABASE_URL").
export function databaseUrl(env = process.env) {
  const plain = env.DATABASE_URL || env.POSTGRES_URL;
  if (plain) return plain;
  const key = Object.keys(env).find((k) => /_(DATABASE|POSTGRES)_URL$/.test(k) && env[k]);
  return key ? env[key] : undefined;
}
