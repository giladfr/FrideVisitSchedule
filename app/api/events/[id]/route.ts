import { NextResponse } from "next/server";

import { ADMIN_COOKIE_NAME, isAdminSessionValid } from "@/lib/admin-auth";
import {
  deleteAdminEvent,
  setAdminEventStatus,
  updateAdminEvent,
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
    emoji: typeof raw.emoji === "string" ? raw.emoji.trim() : undefined,
    date: raw.date,
    segment: raw.segment,
    attendees,
    location: raw.location.trim(),
    notes: typeof raw.notes === "string" ? raw.notes.trim() : undefined,
  };

  if (typeof raw.suggestedByName === "string" && raw.suggestedByName.trim()) {
    input.suggestedByName = raw.suggestedByName.trim();
  }

  if (typeof raw.suggestedByPerson === "string" && isPersonId(raw.suggestedByPerson)) {
    input.suggestedByPerson = raw.suggestedByPerson;
  }

  return input;
}

function isAdmin(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieValue = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE_NAME}=`))
    ?.split("=")[1];

  return isAdminSessionValid(cookieValue);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const payload = (await request.json()) as Record<string, unknown>;

    if (payload.action === "set-status") {
      const status = payload.status;

      if (status !== "approved" && status !== "rejected") {
        return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      }

      const event = await setAdminEventStatus(id, status);
      return NextResponse.json({ event });
    }

    const event = await updateAdminEvent(id, parseEventInput(payload));
    return NextResponse.json({ event });
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
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    await deleteAdminEvent(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete event." },
      { status: 500 },
    );
  }
}
