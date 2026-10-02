import { z } from 'zod';

/**
 * Environment, validated once at module load.
 *
 * A production deploy should fail at boot on a missing key, not at 4pm when an
 * account manager hits submit and gets a stack trace instead of an FRV.
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  FIRECRAWL_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;

  const parsed = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
  });

  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(
      `Environment is not configured: ${missing}. Copy .env.example to .env.local and fill it in.`,
    );
  }

  cached = parsed.data;
  return cached;
}

/** True when Supabase is reachable in config terms. Lets pages degrade rather than crash. */
export function isConfigured(): boolean {
  try {
    env();
    return true;
  } catch {
    return false;
  }
}
