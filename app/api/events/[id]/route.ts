import { NextResponse } from "next/server";

import { ADMIN_COOKIE_NAME, isAdminSessionValid } from "@/lib/admin-auth";
import {
  addEventComment,
  addEventPhoto,
  applyApprovedRequest,
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

  if (typeof raw.title !== "string" || typeof raw.location !== "string" || attendees.length === 0) {
    throw new Error("Missing required event fields.");
  }

  const date =
    typeof raw.date === "string" && raw.date.trim() ? raw.date.trim() : null;
  const segment =
    typeof raw.segment === "string" && raw.segment.trim()
      ? raw.segment.trim()
      : null;

  if ((date && !segment) || (!date && segment) || (segment && !isSegment(segment))) {
    throw new Error("Date and time segment must either both be set or both be empty.");
  }

  const input: EventMutationInput = {
    title: raw.title.trim(),
    emoji: typeof raw.emoji === "string" ? raw.emoji.trim() : undefined,
    date,
    segment: segment as SegmentId | null,
    attendees,
    location: raw.location.trim(),
    placeUrl:
      typeof raw.placeUrl === "string" && raw.placeUrl.trim()
        ? raw.placeUrl.trim()
        : undefined,
    eventUrl:
      typeof raw.eventUrl === "string" && raw.eventUrl.trim()
        ? raw.eventUrl.trim()
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = (await request.json()) as Record<string, unknown>;

    if (payload.action === "add-comment") {
      const authorName =
        typeof payload.authorName === "string" ? payload.authorName.trim() : "";
      const text = typeof payload.text === "string" ? payload.text.trim() : "";

      if (!authorName || !text) {
        return NextResponse.json({ error: "Name and comment text are required." }, { status: 400 });
      }

      const event = await addEventComment(id, {
        id: `comment-${Date.now()}`,
        authorName,
        text,
        createdAt: new Date().toISOString(),
      });

      return NextResponse.json({ event });
    }

    if (payload.action === "add-photo") {
      const url = typeof payload.url === "string" ? payload.url.trim() : "";
      const authorName =
        typeof payload.authorName === "string" ? payload.authorName.trim() : "";
      const caption = typeof payload.caption === "string" ? payload.caption.trim() : "";

      if (!url) {
        return NextResponse.json({ error: "Photo URL is required." }, { status: 400 });
      }

      const event = await addEventPhoto(id, {
        id: `photo-${Date.now()}`,
        url,
        caption: caption || undefined,
        addedByName: authorName || undefined,
        createdAt: new Date().toISOString(),
      });

      return NextResponse.json({ event });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update event." },
      { status: 500 },
    );
  }
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

    if (payload.action === "approve-request") {
      const result = await applyApprovedRequest(id);
      return NextResponse.json({ result });
    }

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
