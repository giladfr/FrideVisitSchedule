import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  demoEvents,
  tripWindow,
  type RecurrenceConfig,
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
  recurrence?: RecurrenceConfig;
};

function mapRow(row: EventRow): TripEvent {
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
    recurrenceLabel: extractStoredMetadata(row.notes).recurrenceLabel,
    notes: extractStoredMetadata(row.notes).notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInput(
  input: EventMutationInput,
  options: {
    status: TripEvent["status"];
    createdByRole: TripEvent["createdByRole"];
    recurrenceLabel?: string | null;
  },
) {
  return {
    title: input.title,
    emoji: input.emoji?.trim() ? input.emoji.trim() : null,
    event_date: input.date,
    segment: input.segment,
    attendees: input.attendees,
    location: input.location,
    notes: buildStoredNotes(input.notes, options.recurrenceLabel),
    status: options.status,
    created_by_role: options.createdByRole,
    suggested_by_name: input.suggestedByName?.trim() || null,
    suggested_by_person: input.suggestedByPerson ?? null,
  };
}

function extractStoredMetadata(notes: string | null) {
  if (!notes) {
    return {
      notes: null,
      recurrenceLabel: undefined as string | undefined,
    };
  }

  const lines = notes.split("\n");
  const firstLine = lines[0]?.trim();
  const match = firstLine?.match(/^\[\[fride:recurrence=(.+)\]\]$/);

  if (!match) {
    return {
      notes,
      recurrenceLabel: undefined,
    };
  }

  const remainingNotes = lines.slice(1).join("\n").trim();

  return {
    notes: remainingNotes || null,
    recurrenceLabel: match[1],
  };
}

function buildStoredNotes(notes: string | undefined, recurrenceLabel?: string | null) {
  const cleanedNotes = notes?.trim() || "";
  const cleanedLabel = recurrenceLabel?.trim() || "";

  if (!cleanedLabel) {
    return cleanedNotes || null;
  }

  return `[[fride:recurrence=${cleanedLabel}]]${cleanedNotes ? `\n${cleanedNotes}` : ""}`;
}

function addDays(date: string, count: number) {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + count);
  return next.toISOString().slice(0, 10);
}

function getIsraeliWeekday(date: string) {
  const jsDay = new Date(`${date}T12:00:00`).getDay();
  return jsDay;
}

function buildRecurrenceLabel(config?: RecurrenceConfig) {
  if (!config || config.pattern === "none") {
    return null;
  }

  if (config.pattern === "daily") {
    return "חוזר כל יום";
  }

  return "חוזר כל שבוע";
}

function expandRecurringInputs(input: EventMutationInput) {
  const recurrence = input.recurrence;

  if (!recurrence || recurrence.pattern === "none" || !recurrence.until || recurrence.until <= input.date) {
    return [{ ...input, recurrence: undefined }];
  }

  const until = recurrence.until > tripWindow.end ? tripWindow.end : recurrence.until;
  const dates: string[] = [];

  if (recurrence.pattern === "daily") {
    for (let cursor = input.date; cursor <= until; cursor = addDays(cursor, 1)) {
      dates.push(cursor);
    }
  } else {
    const weekdaySet = new Set(
      (recurrence.weekdays?.length ? recurrence.weekdays : [getIsraeliWeekday(input.date)])
        .filter((value) => value >= 0 && value <= 6),
    );

    for (let cursor = input.date; cursor <= until; cursor = addDays(cursor, 1)) {
      if (weekdaySet.has(getIsraeliWeekday(cursor))) {
        dates.push(cursor);
      }
    }
  }

  return dates.map((date) => ({
    ...input,
    date,
    recurrence: undefined,
  }));
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
}): Promise<ScheduleSnapshot> {
  const supabase = createSupabaseServerClient({
    admin: options?.admin,
    viewerName: options?.viewerName,
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

  return {
    events: sortEvents((data as EventRow[]).map(mapRow)),
    usingDemoData: false,
    databaseReady: true,
  };
}

export async function createSuggestedEvent(input: EventMutationInput) {
  const supabase = createSupabaseServerClient({
    viewerName: input.suggestedByName,
  });
  const expandedInputs = expandRecurringInputs(input);
  const recurrenceLabel = buildRecurrenceLabel(input.recurrence);

  const { data, error } = await supabase
    .from("visit_events")
    .insert(
      expandedInputs.map((entry) =>
        mapInput(entry, {
          status: "pending",
          createdByRole: "guest",
          recurrenceLabel,
        }),
      ),
    )
    .select("*")
    .order("event_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as EventRow[]).map(mapRow);
}

export async function createAdminEvent(input: EventMutationInput) {
  const supabase = createSupabaseServerClient({ admin: true });
  const expandedInputs = expandRecurringInputs(input);
  const recurrenceLabel = buildRecurrenceLabel(input.recurrence);

  const { data, error } = await supabase
    .from("visit_events")
    .insert(
      expandedInputs.map((entry) =>
        mapInput(entry, {
          status: "approved",
          createdByRole: "admin",
          recurrenceLabel,
        }),
      ),
    )
    .select("*")
    .order("event_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as EventRow[]).map(mapRow);
}

export async function updateAdminEvent(eventId: string, input: EventMutationInput) {
  const supabase = createSupabaseServerClient({ admin: true });
  const { data: existingRow, error: existingError } = await supabase
    .from("visit_events")
    .select("notes")
    .eq("id", eventId)
    .single();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const { data, error } = await supabase
    .from("visit_events")
    .update({
      ...mapInput(input, {
        status: input.suggestedByName ? "pending" : "approved",
        createdByRole: input.suggestedByName ? "guest" : "admin",
        recurrenceLabel: extractStoredMetadata(
          (existingRow as { notes: string | null } | null)?.notes ?? null,
        ).recurrenceLabel ?? null,
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
    notes: buildStoredNotes(event.notes, event.recurrenceLabel),
  }));

  const { error } = await supabase.from("visit_events").upsert(rows, {
    onConflict: "id",
  });

  if (error) {
    throw new Error(error.message);
  }
}
