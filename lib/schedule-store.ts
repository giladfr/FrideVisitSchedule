import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  demoEvents,
  type PersonId,
  type SegmentId,
  type TripEvent,
} from "@/lib/trip-schedule";

type EventRow = {
  id: string;
  title: string;
  emoji: string | null;
  event_date: string;
  segment: SegmentId;
  attendees: PersonId[];
  location: string;
  notes: string | null;
  status: TripEvent["status"];
  created_by_role: TripEvent["createdByRole"];
  suggested_by_name: string | null;
  suggested_by_person: PersonId | null;
  created_at: string;
  updated_at: string;
};

export type ScheduleSnapshot = {
  events: TripEvent[];
  usingDemoData: boolean;
  databaseReady: boolean;
};

export type EventMutationInput = {
  title: string;
  emoji?: string;
  date: string;
  segment: SegmentId;
  attendees: PersonId[];
  location: string;
  notes?: string;
  suggestedByName?: string;
  suggestedByPerson?: PersonId;
  requestType?: TripEvent["requestType"];
  targetEventId?: string;
  viewerKey?: string;
};

type EventRequestMeta = {
  requestType?: TripEvent["requestType"];
  targetEventId?: string;
  viewerKey?: string;
};

const META_PREFIX = "<!--fride-meta:";
const META_SUFFIX = "-->";

function extractNotesPayload(notes: string | null) {
  if (!notes?.startsWith(META_PREFIX)) {
    return {
      visibleNotes: notes ?? undefined,
      meta: {} as EventRequestMeta,
    };
  }

  const metaEndIndex = notes.indexOf(META_SUFFIX);
  if (metaEndIndex === -1) {
    return {
      visibleNotes: notes,
      meta: {} as EventRequestMeta,
    };
  }

  const rawMeta = notes.slice(META_PREFIX.length, metaEndIndex);
  const remaining = notes.slice(metaEndIndex + META_SUFFIX.length).trim();

  try {
    const parsed = JSON.parse(rawMeta) as EventRequestMeta;
    return {
      visibleNotes: remaining || undefined,
      meta: parsed,
    };
  } catch {
    return {
      visibleNotes: notes,
      meta: {} as EventRequestMeta,
    };
  }
}

function packNotesPayload(visibleNotes: string | undefined, meta: EventRequestMeta) {
  const normalizedMeta = Object.fromEntries(
    Object.entries(meta).filter(([, value]) => value != null && value !== ""),
  ) as EventRequestMeta;

  const normalizedNotes = visibleNotes?.trim() || "";
  if (Object.keys(normalizedMeta).length === 0) {
    return normalizedNotes || null;
  }

  return `${META_PREFIX}${JSON.stringify(normalizedMeta)}${META_SUFFIX}${
    normalizedNotes ? `\n\n${normalizedNotes}` : ""
  }`;
}

function mapRow(row: EventRow): TripEvent {
  const { visibleNotes, meta } = extractNotesPayload(row.notes);

  return {
    id: row.id,
    title: row.title,
    emoji: row.emoji ?? undefined,
    date: row.event_date,
    segment: row.segment,
    attendees: row.attendees,
    location: row.location,
    status: row.status,
    createdByRole: row.created_by_role,
    suggestedByName: row.suggested_by_name ?? undefined,
    suggestedByPerson: row.suggested_by_person ?? undefined,
    notes: visibleNotes,
    requestType: meta.requestType ?? "new",
    targetEventId: meta.targetEventId,
    viewerKey: meta.viewerKey,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInput(
  input: EventMutationInput,
  options: {
    status: TripEvent["status"];
    createdByRole: TripEvent["createdByRole"];
  },
) {
  return {
    title: input.title,
    emoji: input.emoji?.trim() ? input.emoji.trim() : null,
    event_date: input.date,
    segment: input.segment,
    attendees: input.attendees,
    location: input.location,
    notes: packNotesPayload(input.notes, {
      requestType: input.requestType,
      targetEventId: input.targetEventId,
      viewerKey: input.viewerKey,
    }),
    status: options.status,
    created_by_role: options.createdByRole,
    suggested_by_name: input.suggestedByName?.trim() || null,
    suggested_by_person: input.suggestedByPerson ?? null,
  };
}

function isSetupError(error: { message?: string } | null) {
  const message = error?.message ?? "";

  return (
    (message.includes("relation") && message.includes("does not exist")) ||
    message.includes("Invalid API key")
  );
}

function sortEvents(events: TripEvent[]) {
  return [...events].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    const leftTime = left.createdAt ?? "";
    const rightTime = right.createdAt ?? "";
    return leftTime.localeCompare(rightTime);
  });
}

export async function fetchScheduleSnapshot(options?: {
  admin?: boolean;
  viewerName?: string;
  viewerKey?: string;
}): Promise<ScheduleSnapshot> {
  const supabase = createSupabaseServerClient({
    admin: options?.admin,
  });

  const { data, error } = await supabase
    .from("visit_events")
    .select("*")
    .order("event_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    if (isSetupError(error)) {
      return {
        events: sortEvents(demoEvents),
        usingDemoData: true,
        databaseReady: false,
      };
    }

    throw new Error(error.message);
  }

  const approvedEvents = sortEvents((data as EventRow[]).map(mapRow));

  if (!options?.admin && options?.viewerName?.trim()) {
    const adminSupabase = createSupabaseServerClient({ admin: true });
    const { data: pendingData, error: pendingError } = await adminSupabase
      .from("visit_events")
      .select("*")
      .eq("status", "pending");

    if (!pendingError && pendingData) {
      const normalizedViewerName = options.viewerName.trim().toLocaleLowerCase();
      const pendingEvents = (pendingData as EventRow[])
        .map(mapRow)
        .filter(
          (event) =>
            event.viewerKey === options.viewerKey ||
            event.suggestedByName?.trim().toLocaleLowerCase() === normalizedViewerName,
        );

      const merged = sortEvents([
        ...approvedEvents,
        ...pendingEvents,
      ]);

      return {
        events: merged,
        usingDemoData: false,
        databaseReady: true,
      };
    }
  }

  return {
    events: approvedEvents,
    usingDemoData: false,
    databaseReady: true,
  };
}

export async function createSuggestedEvent(input: EventMutationInput) {
  const supabase = createSupabaseServerClient({ admin: true });

  const { data, error } = await supabase
    .from("visit_events")
    .insert(mapInput(input, { status: "pending", createdByRole: "guest" }))
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRow(data as EventRow);
}

export async function createAdminEvent(input: EventMutationInput) {
  const supabase = createSupabaseServerClient({ admin: true });

  const { data, error } = await supabase
    .from("visit_events")
    .insert(mapInput(input, { status: "approved", createdByRole: "admin" }))
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRow(data as EventRow);
}

export async function updateAdminEvent(eventId: string, input: EventMutationInput) {
  const supabase = createSupabaseServerClient({ admin: true });

  const { data, error } = await supabase
    .from("visit_events")
    .update({
      ...mapInput(input, {
        status: input.suggestedByName ? "pending" : "approved",
        createdByRole: input.suggestedByName ? "guest" : "admin",
      }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRow(data as EventRow);
}

export async function setAdminEventStatus(
  eventId: string,
  status: "approved" | "rejected",
) {
  const supabase = createSupabaseServerClient({ admin: true });

  const { data, error } = await supabase
    .from("visit_events")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRow(data as EventRow);
}

export async function getAdminEvent(eventId: string) {
  const supabase = createSupabaseServerClient({ admin: true });
  const { data, error } = await supabase
    .from("visit_events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRow(data as EventRow);
}

export async function applyApprovedRequest(requestEventId: string) {
  const requestEvent = await getAdminEvent(requestEventId);

  if (requestEvent.requestType === "remove") {
    if (!requestEvent.targetEventId) {
      throw new Error("Missing target event for removal request.");
    }

    await deleteAdminEvent(requestEvent.targetEventId);
    await deleteAdminEvent(requestEventId);

    return {
      kind: "remove" as const,
      requestEvent,
    };
  }

  if (requestEvent.requestType === "change") {
    if (!requestEvent.targetEventId) {
      throw new Error("Missing target event for change request.");
    }

    const updatedEvent = await updateAdminEvent(requestEvent.targetEventId, {
      title: requestEvent.title,
      emoji: requestEvent.emoji,
      date: requestEvent.date,
      segment: requestEvent.segment,
      attendees: requestEvent.attendees,
      location: requestEvent.location,
      notes: requestEvent.notes,
    });

    await deleteAdminEvent(requestEventId);

    return {
      kind: "change" as const,
      requestEvent,
      updatedEvent,
    };
  }

  const approvedEvent = await setAdminEventStatus(requestEventId, "approved");

  return {
    kind: "new" as const,
    requestEvent: approvedEvent,
  };
}

export async function deleteAdminEvent(eventId: string) {
  const supabase = createSupabaseServerClient({ admin: true });
  const { error } = await supabase.from("visit_events").delete().eq("id", eventId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function seedDemoEvents() {
  const supabase = createSupabaseServerClient({ admin: true });

  const rows = demoEvents.map((event) => ({
    id: event.id,
    title: event.title,
    emoji: event.emoji ?? null,
    event_date: event.date,
    segment: event.segment,
    attendees: event.attendees,
    location: event.location,
    status: event.status,
    created_by_role: event.createdByRole,
    suggested_by_name: event.suggestedByName ?? null,
    suggested_by_person: event.suggestedByPerson ?? null,
    notes: event.notes ?? null,
  }));

  const { error } = await supabase.from("visit_events").upsert(rows, {
    onConflict: "id",
  });

  if (error) {
    throw new Error(error.message);
  }
}
