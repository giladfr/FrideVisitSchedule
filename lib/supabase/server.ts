import { createClient } from "@supabase/supabase-js";

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function createSupabaseServerClient(options?: {
  admin?: boolean;
  viewerName?: string;
}) {
  const url = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const headers: Record<string, string> = {};

  if (options?.viewerName) {
    headers["x-suggester-name"] = options.viewerName;
  }

  if (options?.admin) {
    const adminPassword = getRequiredEnv("ADMIN_PASSWORD");
    headers["x-admin-password"] = adminPassword;
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers,
    },
  });
}
