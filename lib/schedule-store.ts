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
    notes: row.notes ?? undefined,
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
    notes: input.notes?.trim() ? input.notes.trim() : null,
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
      .eq("status", "pending")
      .ilike("suggested_by_name", options.viewerName.trim());

    if (!pendingError && pendingData) {
      const merged = sortEvents([
        ...approvedEvents,
        ...(pendingData as EventRow[]).map(mapRow),
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
  const supabase = createSupabaseServerClient();

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
