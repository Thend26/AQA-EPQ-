export type WorkerConfig = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  workerId: string;
  pollIntervalMs: number;
  ocrEnabled: boolean;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadWorkerConfig(): WorkerConfig {
  return {
    supabaseUrl: requiredEnv("SUPABASE_URL").replace(/\/$/, ""),
    supabaseServiceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    workerId: process.env.WORKER_ID || `epq-worker-${Date.now()}`,
    pollIntervalMs: optionalIntegerEnv("WORKER_POLL_INTERVAL_MS", 5_000),
    ocrEnabled: process.env.OCR_ENABLED === "true",
  };
}
