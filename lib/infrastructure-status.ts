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

export function getInfrastructureStatus(): InfrastructureStatus {
  const githubRepo = process.env.NEXT_PUBLIC_GITHUB_REPO?.trim();

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
      connected: Boolean(githubRepo),
      detail: githubRepo
        ? `Connected to ${githubRepo}.`
        : "Optional: set NEXT_PUBLIC_GITHUB_REPO so the app can display the repo name.",
    },
  ];

  return {
    ready: checks.every((check) => check.connected),
    checks,
  };
}
