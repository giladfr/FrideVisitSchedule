type InfrastructureCheck = {
  label: string;
  connected: boolean;
  detail: string;
};

type InfrastructureStatus = {
  ready: boolean;
  checks: InfrastructureCheck[];
};

function isConfigured(value: string | undefined) {
  const normalized = value?.trim();
  return Boolean(normalized && !normalized.includes("your-"));
}

async function verifySupabaseConnection() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!isConfigured(url) || !isConfigured(anonKey)) {
    return {
      connected: false,
      detail: "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  try {
    const authResponse = await fetch(`${url}/auth/v1/settings`, {
      headers: {
        apikey: anonKey!,
        Authorization: `Bearer ${anonKey}`,
      },
      cache: "no-store",
    });

    if (!authResponse.ok) {
      const body = await authResponse.text();
      return {
        connected: false,
        detail: `Supabase auth responded with ${authResponse.status}: ${body}`,
      };
    }

    const restResponse = await fetch(`${url}/rest/v1/visit_events?select=id&limit=1`, {
      headers: {
        apikey: anonKey!,
        Authorization: `Bearer ${anonKey}`,
      },
      cache: "no-store",
    });

    if (restResponse.ok) {
      return {
        connected: true,
        detail: "Supabase anon key is valid and the visit_events table is reachable.",
      };
    }

    const body = await restResponse.text();
    if (restResponse.status === 404) {
      return {
        connected: true,
        detail:
          "Supabase anon key is valid, but visit_events does not exist yet. Run supabase/schema.sql in the SQL editor.",
      };
    }

    return {
      connected: false,
      detail: `Supabase REST responded with ${restResponse.status}: ${body}`,
    };
  } catch (error) {
    return {
      connected: false,
      detail: error instanceof Error ? error.message : "Failed to verify Supabase connection.",
    };
  }
}

export async function getInfrastructureStatus(): Promise<InfrastructureStatus> {
  const githubRepo = process.env.NEXT_PUBLIC_GITHUB_REPO?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  const supabaseCheck = await verifySupabaseConnection();

  const checks: InfrastructureCheck[] = [
    {
      label: "Next.js app",
      connected: true,
      detail: "Starter app is running and ready for Vercel deployment.",
    },
    {
      label: "Vercel environment",
      connected: Boolean(process.env.VERCEL_URL || process.env.VERCEL),
      detail: process.env.VERCEL_URL
        ? `Deployment detected at ${process.env.VERCEL_URL}.`
        : "Will show as connected after the first Vercel deploy.",
    },
    {
      label: "Supabase project",
      connected: supabaseCheck.connected,
      detail: supabaseCheck.detail,
    },
    {
      label: "GitHub repository",
      connected: Boolean(githubRepo),
      detail: githubRepo
        ? `Connected to ${githubRepo}.`
        : "Optional: set NEXT_PUBLIC_GITHUB_REPO so the app can display the repo name.",
    },
    {
      label: "Admin password",
      connected: Boolean(adminPassword),
      detail: adminPassword
        ? "Password-only admin mode is configured."
        : "Add ADMIN_PASSWORD to unlock the private editor view.",
    },
  ];

  return {
    ready: checks.every((check) => check.connected),
    checks,
  };
}
