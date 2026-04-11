import { cookies } from "next/headers";
import Link from "next/link";

import { AdminLoginCard } from "@/components/admin-login-card";
import { ScheduleBoard } from "@/components/schedule-board";
import {
  ADMIN_COOKIE_NAME,
  hasAdminPasswordConfigured,
  isAdminSessionValid,
} from "@/lib/admin-auth";

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const cookieStore = await cookies();
  const params = searchParams ? await searchParams : undefined;
  const isAuthed = isAdminSessionValid(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
  const passwordConfigured = hasAdminPasswordConfigured();

  if (!isAuthed) {
    return (
      <>
        {params?.error === "invalid" ? (
          <div className="mx-auto mt-6 w-full max-w-xl rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            Password was incorrect. Please try again.
          </div>
        ) : null}
        <AdminLoginCard passwordConfigured={passwordConfigured} />
      </>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-6 flex flex-col gap-3 rounded-[1.75rem] border border-sky-200 bg-sky-50 px-5 py-4 text-sky-950 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-sky-700">
            Admin session
          </p>
          <p className="mt-1 font-semibold">
            Editing mode is unlocked for the June 3, 2026 to June 24, 2026 visit.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-950 transition hover:bg-sky-100"
          >
            View public page
          </Link>
          <form action="/api/admin/logout" method="post">
            <button
              type="submit"
              className="rounded-full bg-sky-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-900"
            >
              Exit admin mode
            </button>
          </form>
        </div>
      </div>

      <ScheduleBoard editable />
    </main>
  );
}
