export function AdminLoginCard({
  passwordConfigured,
}: {
  passwordConfigured: boolean;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-10 sm:px-6">
      <section className="w-full rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel)] p-8 shadow-[0_24px_80px_rgba(28,25,23,0.08)]">
        <p className="inline-flex rounded-full border border-stone-300 bg-white/70 px-3 py-1 text-sm font-medium text-stone-700">
          עריכה פרטית
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-950">
          כניסה לעדכון הלוח
        </h1>
        <p className="mt-4 text-base leading-7 text-stone-600">
          הלוח פתוח לצפייה עבור המשפחה והחברים הקרובים. רק מי שיש לו את הסיסמה
          יכול לערוך, להזיז ולאשר הצעות חדשות.
        </p>

        {passwordConfigured ? (
          <form action="/api/admin/login" method="post" className="mt-8 space-y-4">
            <input type="hidden" name="redirectTo" value="/admin" />
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-stone-800">
                סיסמה
              </span>
              <input
                type="password"
                name="password"
                required
                className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-900 outline-none transition focus:border-stone-500"
                placeholder="הכניסו סיסמה"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              כניסה לעריכה
            </button>
          </form>
        ) : (
          <div className="mt-8 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5">
            <p className="font-semibold text-amber-950">
              סיסמת העריכה עדיין לא הוגדרה
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              צריך להוסיף `ADMIN_PASSWORD` ב-Vercel וגם ב-`.env.local`, ואז יהיה
              אפשר לפתוח את מצב העריכה.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
