import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchPlaceImagePreview } from "@/lib/place-preview";
import {
  demoEvents,
  type EventComment,
  type EventPhoto,
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
  date: string | null;
  segment: SegmentId | null;
  attendees: PersonId[];
  location: string;
  placeUrl?: string;
  notes?: string;
  photos?: EventPhoto[];
  comments?: EventComment[];
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
  placeUrl?: string;
  photos?: EventPhoto[];
  comments?: EventComment[];
  undated?: boolean;
};

const UNDATED_EVENT_DATE = "9999-12-31";
const UNDATED_EVENT_SEGMENT: SegmentId = "morning";

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
    date: meta.undated ? null : row.event_date,
    segment: meta.undated ? null : row.segment,
    attendees: row.attendees,
    location: row.location,
    placeUrl: meta.placeUrl,
    status: row.status,
    createdByRole: row.created_by_role,
    suggestedByName: row.suggested_by_name ?? undefined,
    suggestedByPerson: row.suggested_by_person ?? undefined,
    notes: visibleNotes,
    photos: meta.photos ?? [],
    comments: meta.comments ?? [],
    requestType: meta.requestType ?? "new",
    targetEventId: meta.targetEventId,
    viewerKey: meta.viewerKey,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function mapInput(
  input: EventMutationInput,
  options: {
    status: TripEvent["status"];
    createdByRole: TripEvent["createdByRole"];
  },
) {
  const normalizedPhotos = [...(input.photos ?? [])];
  const normalizedPlaceUrl = input.placeUrl?.trim() || undefined;

  if (normalizedPlaceUrl && normalizedPhotos.length === 0) {
    const previewUrl = await fetchPlaceImagePreview(normalizedPlaceUrl);
    if (previewUrl) {
      normalizedPhotos.push({
        id: `photo-${Date.now()}`,
        url: previewUrl,
        caption: "תמונה מהקישור",
        createdAt: new Date().toISOString(),
      });
    }
  }

  return {
    title: input.title,
    emoji: input.emoji?.trim() ? input.emoji.trim() : null,
    event_date: input.date ?? UNDATED_EVENT_DATE,
    segment: input.segment ?? UNDATED_EVENT_SEGMENT,
    attendees: input.attendees,
    location: input.location,
    notes: packNotesPayload(input.notes, {
      undated: !input.date || !input.segment,
      requestType: input.requestType,
      targetEventId: input.targetEventId,
      viewerKey: input.viewerKey,
      placeUrl: normalizedPlaceUrl,
      photos: normalizedPhotos,
      comments: input.comments ?? [],
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
    if (left.date === null && right.date !== null) {
      return 1;
    }

    if (left.date !== null && right.date === null) {
      return -1;
    }

    if (left.date && right.date && left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    const leftTime = left.createdAt ?? "";
    const rightTime = right.createdAt ?? "";
    return leftTime.localeCompare(rightTime);
  });
}

export async function fetchScheduleSnapshot(options?: {
  admin?: boolean;
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

  if (!options?.admin) {
    const adminSupabase = createSupabaseServerClient({ admin: true });
    const { data: pendingData, error: pendingError } = await adminSupabase
      .from("visit_events")
      .select("*")
      .eq("status", "pending");

    if (!pendingError && pendingData) {
      const pendingEvents = (pendingData as EventRow[]).map(mapRow);

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
  const row = await mapInput(input, { status: "pending", createdByRole: "guest" });

  const { data, error } = await supabase
    .from("visit_events")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRow(data as EventRow);
}

export async function createAdminEvent(input: EventMutationInput) {
  const supabase = createSupabaseServerClient({ admin: true });
  const row = await mapInput(input, { status: "approved", createdByRole: "admin" });

  const { data, error } = await supabase
    .from("visit_events")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRow(data as EventRow);
}

export async function updateAdminEvent(eventId: string, input: EventMutationInput) {
  const supabase = createSupabaseServerClient({ admin: true });
  const row = await mapInput(input, {
    status: input.suggestedByName ? "pending" : "approved",
    createdByRole: input.suggestedByName ? "guest" : "admin",
  });

  const { data, error } = await supabase
    .from("visit_events")
    .update({
      ...row,
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
      placeUrl: requestEvent.placeUrl,
      notes: requestEvent.notes,
      photos: requestEvent.photos,
      comments: requestEvent.comments,
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

export async function addEventComment(eventId: string, comment: EventComment) {
  const supabase = createSupabaseServerClient({ admin: true });
  const event = await getAdminEvent(eventId);
  const nextComments = [...(event.comments ?? []), comment];

  const { data, error } = await supabase
    .from("visit_events")
    .update({
      notes: packNotesPayload(event.notes, {
        requestType: event.requestType,
        targetEventId: event.targetEventId,
        viewerKey: event.viewerKey,
        placeUrl: event.placeUrl,
        photos: event.photos ?? [],
        comments: nextComments,
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

export async function addEventPhoto(eventId: string, photo: EventPhoto) {
  const supabase = createSupabaseServerClient({ admin: true });
  const event = await getAdminEvent(eventId);
  const nextPhotos = [...(event.photos ?? []), photo];

  const { data, error } = await supabase
    .from("visit_events")
    .update({
      notes: packNotesPayload(event.notes, {
        requestType: event.requestType,
        targetEventId: event.targetEventId,
        viewerKey: event.viewerKey,
        placeUrl: event.placeUrl,
        photos: nextPhotos,
        comments: event.comments ?? [],
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
