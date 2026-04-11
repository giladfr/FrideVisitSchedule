import { NextResponse } from "next/server";

import { isAdminSessionValid, ADMIN_COOKIE_NAME } from "@/lib/admin-auth";
import {
  createAdminEvent,
  createSuggestedEvent,
  fetchScheduleSnapshot,
  seedDemoEvents,
  type EventMutationInput,
} from "@/lib/schedule-store";
import { people, segmentLabels, type PersonId, type SegmentId } from "@/lib/trip-schedule";

function isSegment(value: string): value is SegmentId {
  return value in segmentLabels;
}

function isPersonId(value: string): value is PersonId {
  return people.some((person) => person.id === value);
}

function parseEventInput(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid payload.");
  }

  const raw = payload as Record<string, unknown>;
  const attendees = Array.isArray(raw.attendees)
    ? raw.attendees.filter((value): value is PersonId => typeof value === "string" && isPersonId(value))
    : [];

  if (
    typeof raw.title !== "string" ||
    typeof raw.date !== "string" ||
    typeof raw.segment !== "string" ||
    typeof raw.location !== "string" ||
    !isSegment(raw.segment) ||
    attendees.length === 0
  ) {
    throw new Error("Missing required event fields.");
  }

  const input: EventMutationInput = {
    title: raw.title.trim(),
    date: raw.date,
    segment: raw.segment,
    attendees,
    location: raw.location.trim(),
    notes: typeof raw.notes === "string" ? raw.notes.trim() : undefined,
  };

  if (!input.title || !input.location) {
    throw new Error("Title and location are required.");
  }

  if (typeof raw.suggestedByName === "string" && raw.suggestedByName.trim()) {
    input.suggestedByName = raw.suggestedByName.trim();
  }

  if (typeof raw.suggestedByPerson === "string" && isPersonId(raw.suggestedByPerson)) {
    input.suggestedByPerson = raw.suggestedByPerson;
  }

  return input;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const viewerName = searchParams.get("viewerName")?.trim() || undefined;
    const cookieHeader = request.headers.get("cookie") ?? "";
    const cookieValue = cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${ADMIN_COOKIE_NAME}=`))
      ?.split("=")[1];
    const isAdmin = isAdminSessionValid(cookieValue);

    const snapshot = await fetchScheduleSnapshot({
      admin: isAdmin,
      viewerName: isAdmin ? undefined : viewerName,
    });

    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load events." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const cookieValue = cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${ADMIN_COOKIE_NAME}=`))
      ?.split("=")[1];
    const isAdmin = isAdminSessionValid(cookieValue);
    const payload = (await request.json()) as Record<string, unknown>;

    if (payload.action === "seed-demo") {
      if (!isAdmin) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
      }

      await seedDemoEvents();
      return NextResponse.json({ ok: true });
    }

    const input = parseEventInput(payload);

    if (isAdmin) {
      const event = await createAdminEvent(input);
      return NextResponse.json({ event });
    }

    if (!input.suggestedByName || !input.suggestedByPerson) {
      return NextResponse.json(
        { error: "Suggestion name and family member are required." },
        { status: 400 },
      );
    }

    const event = await createSuggestedEvent(input);
    return NextResponse.json({ event });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create event." },
      { status: 500 },
    );
  }
}
