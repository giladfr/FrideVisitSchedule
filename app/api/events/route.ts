import { NextResponse } from "next/server";

import { isAdminSessionValid, ADMIN_COOKIE_NAME } from "@/lib/admin-auth";
import {
  createAdminEvent,
  createSuggestedEvent,
  fetchScheduleSnapshot,
  seedDemoEvents,
  type EventMutationInput,
} from "@/lib/schedule-store";
import {
  people,
  segmentLabels,
  type PersonId,
  type SegmentId,
} from "@/lib/trip-schedule";

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
    placeUrl:
      typeof raw.placeUrl === "string" && raw.placeUrl.trim()
        ? raw.placeUrl.trim()
        : undefined,
    notes: typeof raw.notes === "string" ? raw.notes.trim() : undefined,
    photos: Array.isArray(raw.photos)
      ? raw.photos
          .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object")
          .map((photo) => ({
            id: typeof photo.id === "string" && photo.id.trim() ? photo.id.trim() : `photo-${Date.now()}`,
            url: typeof photo.url === "string" ? photo.url.trim() : "",
            caption: typeof photo.caption === "string" && photo.caption.trim() ? photo.caption.trim() : undefined,
            addedByName:
              typeof photo.addedByName === "string" && photo.addedByName.trim()
                ? photo.addedByName.trim()
                : undefined,
            createdAt:
              typeof photo.createdAt === "string" && photo.createdAt.trim()
                ? photo.createdAt.trim()
                : new Date().toISOString(),
          }))
          .filter((photo) => photo.url)
      : undefined,
    comments: Array.isArray(raw.comments)
      ? raw.comments
          .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object")
          .map((comment) => ({
            id: typeof comment.id === "string" && comment.id.trim() ? comment.id.trim() : `comment-${Date.now()}`,
            authorName: typeof comment.authorName === "string" ? comment.authorName.trim() : "",
            text: typeof comment.text === "string" ? comment.text.trim() : "",
            createdAt:
              typeof comment.createdAt === "string" && comment.createdAt.trim()
                ? comment.createdAt.trim()
                : new Date().toISOString(),
          }))
          .filter((comment) => comment.authorName && comment.text)
      : undefined,
    requestType:
      raw.requestType === "new" || raw.requestType === "change" || raw.requestType === "remove"
        ? raw.requestType
        : undefined,
    targetEventId: typeof raw.targetEventId === "string" && raw.targetEventId.trim()
      ? raw.targetEventId.trim()
      : undefined,
    viewerKey: typeof raw.viewerKey === "string" && raw.viewerKey.trim()
      ? raw.viewerKey.trim()
      : undefined,
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
    const viewerKey = searchParams.get("viewerKey")?.trim() || undefined;
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
      viewerKey: isAdmin ? undefined : viewerKey,
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
