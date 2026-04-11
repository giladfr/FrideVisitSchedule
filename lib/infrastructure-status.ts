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
  return Boolean(value && !value.includes("your-"));
}

export function getInfrastructureStatus(): InfrastructureStatus {
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
      connected:
        isConfigured(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
        isConfigured(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      detail:
        isConfigured(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
        isConfigured(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
          ? "Public URL and anon key are available to the app."
          : "Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    },
    {
      label: "GitHub repository",
      connected: Boolean(process.env.NEXT_PUBLIC_GITHUB_REPO),
      detail: process.env.NEXT_PUBLIC_GITHUB_REPO
        ? `Connected to ${process.env.NEXT_PUBLIC_GITHUB_REPO}.`
        : "Optional: set NEXT_PUBLIC_GITHUB_REPO so the app can display the repo name.",
    },
  ];

  return {
    ready: checks.every((check) => check.connected),
    checks,
  };
}
