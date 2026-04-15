import { NextResponse } from "next/server";

import {
  buildAgentMetadata,
  filterAgentEvents,
  isAgentApiAuthorized,
  parseAgentEventInput,
} from "@/lib/agent-api";
import {
  createAdminEvent,
  createSuggestedEvent,
  fetchScheduleSnapshot,
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

export async function GET(request: Request) {
  if (!isAgentApiAuthorized(request)) {
    return unauthorized();
  }

  try {
    const snapshot = await fetchScheduleSnapshot({ admin: true });
    const { events, filters } = filterAgentEvents(snapshot, request);

    return NextResponse.json({
      ok: true,
      count: events.length,
      filters,
      ...buildAgentMetadata(),
      events,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load events." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!isAgentApiAuthorized(request)) {
    return unauthorized();
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const operation =
      typeof payload.operation === "string"
        ? payload.operation
        : typeof payload.mode === "string"
          ? payload.mode
          : payload.suggestedByName
            ? "suggest"
            : "create";

    const input = parseAgentEventInput(payload);

    if (operation === "suggest") {
      if (!input.suggestedByName || !input.suggestedByPerson) {
        return NextResponse.json(
          {
            error:
              "Suggestion requires suggestedByName and suggestedByPerson.",
          },
          { status: 400 },
        );
      }

      const event = await createSuggestedEvent(input);
      return NextResponse.json({ ok: true, operation: "suggest", event });
    }

    if (operation !== "create") {
      return NextResponse.json(
        { error: "Invalid operation. Use create or suggest." },
        { status: 400 },
      );
    }

    const event = await createAdminEvent(input);
    return NextResponse.json({ ok: true, operation: "create", event });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create event." },
      { status: 500 },
    );
  }
}
