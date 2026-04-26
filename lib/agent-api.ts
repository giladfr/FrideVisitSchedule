import { createHash, timingSafeEqual } from "node:crypto";

import {
  people,
  segmentLabels,
  type PersonId,
  type SegmentId,
} from "@/lib/trip-schedule";
import { type EventMutationInput, type ScheduleSnapshot } from "@/lib/schedule-store";

function hashValue(value: string) {
  return createHash("sha256").update(`fride-agent:${value}`).digest("hex");
}

function matchesToken(actual: string, expected: string) {
  const expectedBuffer = Buffer.from(hashValue(expected));
  const actualBuffer = Buffer.from(hashValue(actual));

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function isAgentApiAuthorized(request: Request) {
  const configured = process.env.AGENT_API_TOKEN?.trim();
  if (!configured) {
    return false;
  }

  const header = request.headers.get("authorization")?.trim() ?? "";
  if (!header.startsWith("Bearer ")) {
    return false;
  }

  const provided = header.slice("Bearer ".length).trim();
  if (!provided) {
    return false;
  }

  return matchesToken(provided, configured);
}

export function hasAgentApiTokenConfigured() {
  return Boolean(process.env.AGENT_API_TOKEN?.trim());
}

export function isSegment(value: string): value is SegmentId {
  return value in segmentLabels;
}

export function isPersonId(value: string): value is PersonId {
  return people.some((person) => person.id === value);
}

export function parseAgentEventInput(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid payload.");
  }

  const raw = payload as Record<string, unknown>;
  const attendees = Array.isArray(raw.attendees)
    ? raw.attendees.filter(
        (value): value is PersonId => typeof value === "string" && isPersonId(value),
      )
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

export function filterAgentEvents(snapshot: ScheduleSnapshot, request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date")?.trim();
  const from = searchParams.get("from")?.trim();
  const to = searchParams.get("to")?.trim();
  const status = searchParams.get("status")?.trim();
  const person = searchParams.get("person")?.trim();
  const segment = searchParams.get("segment")?.trim();
  const suggestedByName = searchParams.get("suggestedByName")?.trim();

  let events = snapshot.events;

  if (date) {
    events = events.filter((event) => event.date === date);
  }

  if (from) {
    events = events.filter((event) => event.date !== null && event.date >= from);
  }

  if (to) {
    events = events.filter((event) => event.date !== null && event.date <= to);
  }

  if (status === "approved" || status === "pending" || status === "rejected") {
    events = events.filter((event) => event.status === status);
  }

  if (person && isPersonId(person)) {
    events = events.filter(
      (event) =>
        event.attendees.includes(person) || event.suggestedByPerson === person,
    );
  }

  if (segment && isSegment(segment)) {
    events = events.filter((event) => event.segment === segment);
  }

  if (suggestedByName) {
    const normalized = suggestedByName.toLocaleLowerCase();
    events = events.filter(
      (event) => event.suggestedByName?.toLocaleLowerCase() === normalized,
    );
  }

  return {
    filters: {
      date: date ?? null,
      from: from ?? null,
      to: to ?? null,
      status: status ?? null,
      person: person ?? null,
      segment: segment ?? null,
      suggestedByName: suggestedByName ?? null,
    },
    events,
  };
}

export function buildAgentMetadata() {
  return {
    people: people.map((person) => ({
      id: person.id,
      name: person.name,
      emoji: person.personEmoji,
    })),
    segments: Object.entries(segmentLabels).map(([id, label]) => ({
      id,
      label,
    })),
  };
}
