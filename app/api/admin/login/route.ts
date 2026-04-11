import { NextResponse } from "next/server";

import {
  ADMIN_COOKIE_NAME,
  createAdminCookieValue,
  hasAdminPasswordConfigured,
  matchesAdminPassword,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/admin");
  const origin = new URL(request.url);
  const isSecureOrigin = origin.protocol === "https:";

  if (!hasAdminPasswordConfigured()) {
    return NextResponse.redirect(new URL("/admin", origin), { status: 303 });
  }

  if (!matchesAdminPassword(password)) {
    return NextResponse.redirect(new URL("/admin?error=invalid", origin), {
      status: 303,
    });
  }

  const response = NextResponse.redirect(new URL(redirectTo, origin), {
    status: 303,
  });

  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: createAdminCookieValue() ?? "",
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureOrigin,
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
