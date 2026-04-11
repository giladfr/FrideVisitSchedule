import Link from "next/link";

import { getInfrastructureStatus } from "@/lib/infrastructure-status";

const setupSteps = [
  "Create the GitHub repository and push this project.",
  "Create a Supabase project and copy the URL plus anon key into Vercel env vars.",
  "Link the repo to Vercel and redeploy.",
  "Confirm the landing page shows all systems as connected.",
];

export default function Home() {
  const status = getInfrastructureStatus();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-8 lg:px-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel)] p-8 shadow-[0_20px_80px_rgba(28,25,23,0.08)] backdrop-blur md:p-12">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-700/50 to-transparent" />

        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <p className="inline-flex rounded-full border border-emerald-800/15 bg-emerald-800/5 px-3 py-1 text-sm font-medium text-emerald-900">
              Family trip scheduler infrastructure
            </p>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl">
                A calm starting point for the Israel visit schedule app.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[var(--muted)]">
                This starter is intentionally simple: a public landing page,
                Vercel-ready Next.js app, Supabase environment wiring, and a
                GitHub-friendly repo you can grow into the full family planner.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/api/status"
                className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
              >
                View system status JSON
              </Link>
              <a
                href="https://vercel.com/new"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-stone-300 bg-white/80 px-5 py-3 text-sm font-semibold text-stone-900 transition hover:border-stone-400 hover:bg-white"
              >
                Create Vercel project
              </a>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-stone-200/80 bg-white/75 p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
              Current wiring
            </p>
            <div className="mt-5 space-y-4">
              {status.checks.map((check) => (
                <div
                  key={check.label}
                  className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-stone-900">{check.label}</p>
                      <p className="mt-1 text-sm text-stone-600">
                        {check.detail}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        check.connected
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {check.connected ? "Connected" : "Needs setup"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[1.75rem] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_12px_40px_rgba(28,25,23,0.06)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
            What this starter includes
          </p>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-stone-700">
            <li>Public landing page ready for Vercel hosting</li>
            <li>Supabase client scaffolding and environment validation</li>
            <li>Status endpoint for quick infrastructure checks</li>
            <li>Room to add the actual trip planner once the services are linked</li>
          </ul>
        </div>

        <div className="rounded-[1.75rem] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_12px_40px_rgba(28,25,23,0.06)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
            Next setup steps
          </p>
          <ol className="mt-4 space-y-3 text-sm leading-7 text-stone-700">
            {setupSteps.map((step, index) => (
              <li
                key={step}
                className="flex gap-3 rounded-2xl border border-stone-200 bg-white/70 px-4 py-3"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}
