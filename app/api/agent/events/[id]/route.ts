import { NextResponse } from "next/server";

import {
  isAgentApiAuthorized,
  parseAgentEventInput,
} from "@/lib/agent-api";
import {
  deleteAdminEvent,
  setAdminEventStatus,
  updateAdminEvent,
} from "@/lib/schedule-store";

function unauthorized() {
  return NextResponse.json(
    {
      error: "Unauthorized.",
      detail: "Send Authorization: Bearer <AGENT_API_TOKEN>.",
    },
    { status: 401 },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAgentApiAuthorized(request)) {
    return unauthorized();
  }

  try {
    const { id } = await params;
    const payload = (await request.json()) as Record<string, unknown>;

    if (
      payload.action === "approve" ||
      payload.action === "reject" ||
      payload.action === "set-status"
    ) {
      const status =
        payload.action === "approve"
          ? "approved"
          : payload.action === "reject"
            ? "rejected"
            : payload.status;

      if (status !== "approved" && status !== "rejected") {
        return NextResponse.json(
          { error: "Invalid status. Use approved or rejected." },
          { status: 400 },
        );
      }

      const event = await setAdminEventStatus(id, status);
      return NextResponse.json({ ok: true, action: status, event });
    }

    const event = await updateAdminEvent(id, parseAgentEventInput(payload));
    return NextResponse.json({ ok: true, action: "update", event });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update event." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAgentApiAuthorized(request)) {
    return unauthorized();
  }

  try {
    const { id } = await params;
    await deleteAdminEvent(id);
    return NextResponse.json({ ok: true, action: "delete", id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete event." },
      { status: 500 },
    );
  }
}
