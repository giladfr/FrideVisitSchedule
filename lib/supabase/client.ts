import { createClient } from "@supabase/supabase-js";

function normalizeEnvValue(value?: string) {
  let normalized = value?.trim();

  if (normalized?.startsWith('"') && normalized.endsWith('"')) {
    normalized = normalized.slice(1, -1).trim();
  }

  if (normalized) {
    normalized = normalized.replace(/\\n/g, "\n").trim();
  }

  return normalized;
}

export function createSupabaseBrowserClient() {
  const url = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = normalizeEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createClient(url, anonKey);
}
