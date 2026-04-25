"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { buildGoogleMapsSearchUrl, buildWazeSearchUrl } from "@/lib/maps";
import {
  buildCalendarWeeks,
  eventEmojiOptions,
  getPerson,
  people,
  segmentLabels,
  segmentTimes,
  tripWindow,
  undatedHint,
  undatedLabel,
  type CalendarDay,
  type EventComment,
  type EventPhoto,
  type PersonId,
  type SegmentId,
  type TripEvent,
} from "@/lib/trip-schedule";

type ScheduleBoardProps = {
  editable?: boolean;
};

type FilterValue = "all" | PersonId;
type ViewMode = "weeks" | "day" | "trip" | "mobileWeek";
type ViewerIdentity = {
  key: string;
  name: string;
  personId: PersonId;
};
type DropTarget = {
  date: string;
  segment: SegmentId;
};
type ModalState =
  | { type: "details"; eventId: string }
  | {
      type: "form";
      mode: "admin" | "suggest" | "change" | "remove";
      event?: TripEvent;
      date: string | null;
      segment: SegmentId | null;
      targetEvent?: TripEvent;
    }
  | null;
type EventDraft = {
  title: string;
  emoji: string;
  date: string | null;
  segment: SegmentId | null;
  location: string;
  placeUrl: string;
  notes: string;
  photos: EventPhoto[];
  comments: EventComment[];
  attendees: PersonId[];
  suggestedByName: string;
  suggestedByPerson: PersonId;
  requestType: "new" | "change" | "remove";
  targetEventId?: string;
  viewerKey: string;
};
type SnapshotResponse = {
  events: TripEvent[];
  usingDemoData: boolean;
  databaseReady: boolean;
  error?: string;
};

const IDENTITY_STORAGE_KEY = "fride-visit-identity";
const weeks = buildCalendarWeeks();
const segments: SegmentId[] = ["morning", "noon", "evening", "night"];
const tripDays = weeks.flatMap((week) => week.days).filter((day) => day.inTripRange);
type CalendarWeek = ReturnType<typeof buildCalendarWeeks>[number];

function defaultIdentity(): ViewerIdentity {
  return {
    key:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `viewer-${Date.now()}`,
    name: "",
    personId: "gilad",
  };
}

function createDraft(
  mode: "admin" | "suggest" | "change" | "remove",
  options: {
    date: string | null;
    segment: SegmentId | null;
    identity: ViewerIdentity;
    event?: TripEvent;
    targetEvent?: TripEvent;
  },
): EventDraft {
  const event = options.event ?? options.targetEvent;
  const requestType =
    mode === "change" ? "change" : mode === "remove" ? "remove" : "new";

  return {
    title: event?.title ?? "",
    emoji: event?.emoji ?? "🎉",
    date: event?.date ?? options.date,
    segment: event?.segment ?? options.segment,
    location: event?.location ?? "",
    placeUrl: event?.placeUrl ?? "",
    notes: event?.notes ?? "",
    photos: event?.photos ?? [],
    comments: event?.comments ?? [],
    attendees: event?.attendees ?? [options.identity.personId],
    suggestedByName:
      mode === "suggest"
        ? event?.suggestedByName ?? options.identity.name
        : event?.suggestedByName ?? "",
    suggestedByPerson:
      mode === "suggest"
        ? event?.suggestedByPerson ?? options.identity.personId
        : event?.suggestedByPerson ?? options.identity.personId,
    requestType,
    targetEventId: options.targetEvent?.id,
    viewerKey: options.identity.key,
  };
}

function getRequestTypeLabel(requestType: TripEvent["requestType"]) {
  if (requestType === "change") {
    return "בקשת שינוי";
  }

  if (requestType === "remove") {
    return "בקשת הסרה";
  }

  return "הצעה חדשה";
}

function isRequestEvent(event: TripEvent) {
  return event.requestType === "change" || event.requestType === "remove";
}

function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));
}

function formatEventDateLabel(date: string | null) {
  return date ? formatDateLabel(date) : undatedLabel;
}

function getEventSegmentLabel(segment: SegmentId | null) {
  return segment ? segmentLabels[segment] : undatedHint;
}

function isUndatedEvent(event: TripEvent) {
  return !event.date || !event.segment;
}

function getAttendeeSummary(event: TripEvent) {
  return event.attendees.map((personId) => getPerson(personId).name).join(" · ");
}

function isFullFamily(attendees: PersonId[]) {
  return (
    attendees.length === people.length &&
    people.every((person) => attendees.includes(person.id))
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

    const leftSegmentOrder = left.segment ? segments.indexOf(left.segment) : Number.MAX_SAFE_INTEGER;
    const rightSegmentOrder = right.segment ? segments.indexOf(right.segment) : Number.MAX_SAFE_INTEGER;
    const segmentOrder = leftSegmentOrder - rightSegmentOrder;
    if (segmentOrder !== 0) {
      return segmentOrder;
    }

    return (left.createdAt ?? "").localeCompare(right.createdAt ?? "");
  });
}

function buildConflictMap(events: TripEvent[]) {
  const conflicts = new Set<string>();
  const activeEvents = events.filter(
    (event) =>
      event.status !== "rejected" &&
      (event.status === "approved" || event.requestType === "new" || !event.requestType),
  );

  for (let index = 0; index < activeEvents.length; index += 1) {
    const left = activeEvents[index];

    for (let nextIndex = index + 1; nextIndex < activeEvents.length; nextIndex += 1) {
      const right = activeEvents[nextIndex];

      if (!left.date || !left.segment || !right.date || !right.segment) {
        continue;
      }

      if (left.date !== right.date || left.segment !== right.segment) {
        continue;
      }

      if (left.attendees.some((personId) => right.attendees.includes(personId))) {
        conflicts.add(left.id);
        conflicts.add(right.id);
      }
    }
  }

  return conflicts;
}

function canSeeEvent(
  event: TripEvent,
  filter: FilterValue,
  editable: boolean,
) {
  if (event.status === "rejected") {
    return false;
  }

  if (event.status === "pending" && !editable) {
    return true;
  }

  if (filter === "all") {
    return event.status !== "pending" || editable;
  }

  return event.attendees.includes(filter) || event.suggestedByPerson === filter;
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

export function ScheduleBoard({ editable = false }: ScheduleBoardProps) {
  const [selectedFilter, setSelectedFilter] = useState<FilterValue>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("weeks");
  const [selectedDay, setSelectedDay] = useState<string>(tripWindow.start);
  const [events, setEvents] = useState<TripEvent[]>([]);
  const [modalState, setModalState] = useState<ModalState>(null);
  const [viewerIdentity, setViewerIdentity] = useState<ViewerIdentity>(defaultIdentity);
  const [identityReady, setIdentityReady] = useState(editable);
  const [isEditing, setIsEditing] = useState(editable);
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [databaseReady, setDatabaseReady] = useState(false);
  const [usingDemoData, setUsingDemoData] = useState(false);

  useEffect(() => {
    if (editable) {
      setIdentityReady(true);
      return;
    }

    const raw = window.localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as ViewerIdentity;
      if (parsed.personId) {
        const nextIdentity = {
          ...defaultIdentity(),
          ...parsed,
        };
        setViewerIdentity(nextIdentity);
        if (nextIdentity.name) {
          setSelectedFilter(nextIdentity.personId);
        }
      }
    } catch {
      window.localStorage.removeItem(IDENTITY_STORAGE_KEY);
    }

    setIdentityReady(true);
  }, [editable]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.innerWidth < 640) {
      setViewMode("mobileWeek");
    }
  }, []);

  useEffect(() => {
    if (editable || !identityReady) {
      return;
    }

    window.localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(viewerIdentity));
  }, [editable, identityReady, viewerIdentity]);

  const refreshSchedule = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/events", { cache: "no-store" });
      const payload = await readJson<SnapshotResponse>(response);
      setEvents(sortEvents(payload.events));
      setDatabaseReady(payload.databaseReady);
      setUsingDemoData(payload.usingDemoData);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "לא הצלחנו לטעון את האירועים.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSchedule();
  }, [refreshSchedule]);

  const selectedEvent = useMemo(() => {
    if (modalState?.type !== "details") {
      return null;
    }

    return events.find((event) => event.id === modalState.eventId) ?? null;
  }, [events, modalState]);

  const filteredEvents = useMemo(
    () => sortEvents(events.filter((event) => canSeeEvent(event, selectedFilter, editable))),
    [editable, events, selectedFilter],
  );
  const undatedEvents = useMemo(
    () => sortEvents(filteredEvents.filter((event) => isUndatedEvent(event))),
    [filteredEvents],
  );
  const scheduledEvents = useMemo(
    () => filteredEvents.filter((event) => !isUndatedEvent(event)),
    [filteredEvents],
  );

  const conflictIds = useMemo(() => buildConflictMap(events), [events]);

  const pendingSuggestions = useMemo(
    () => sortEvents(events.filter((event) => event.status === "pending")),
    [events],
  );

  const rejectedSuggestions = useMemo(
    () => sortEvents(events.filter((event) => event.status === "rejected")),
    [events],
  );

  const conflictingEvents = useMemo(
    () => sortEvents(events.filter((event) => conflictIds.has(event.id))),
    [conflictIds, events],
  );

  const currentMonthLabel = useMemo(() => {
    const firstActiveDay = weeks.flatMap((week) => week.days).find((day) => day.inTripRange);
    return firstActiveDay?.monthLabel ?? "יוני 2026";
  }, []);

  const selectedDayData = useMemo(
    () => tripDays.find((day) => day.date === selectedDay) ?? tripDays[0],
    [selectedDay],
  );

  const groupedTripEvents = useMemo(() => {
    return tripDays
      .map((day) => ({
        day,
        events: scheduledEvents.filter((event) => event.date === day.date),
      }))
      .filter((entry) => entry.events.length > 0);
  }, [scheduledEvents]);

  const selectedWeek = useMemo(
    () => weeks.find((week) => week.days.some((day) => day.date === selectedDay)) ?? weeks[0],
    [selectedDay],
  );

  function openNewEvent(date: string | null, segment: SegmentId | null) {
    if (date) {
      setSelectedDay(date);
    }
    setModalState({
      type: "form",
      mode: editable ? "admin" : "suggest",
      date,
      segment,
    });
  }

  function openEditEvent(event: TripEvent) {
    setModalState({
      type: "form",
      mode: editable ? "admin" : "suggest",
      event,
      date: event.date,
      segment: event.segment,
    });
  }

  function openChangeRequest(event: TripEvent) {
    if (event.date) {
      setSelectedDay(event.date);
    }
    setModalState({
      type: "form",
      mode: "change",
      date: event.date,
      segment: event.segment,
      targetEvent: event,
    });
  }

  function openRemoveRequest(event: TripEvent) {
    if (event.date) {
      setSelectedDay(event.date);
    }
    setModalState({
      type: "form",
      mode: "remove",
      date: event.date,
      segment: event.segment,
      targetEvent: event,
    });
  }

  async function patchEvent(
    eventId: string,
    payload: Record<string, unknown>,
    successMessage: string,
  ) {
    setActionPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      await readJson<{ event?: TripEvent }>(response);
      await refreshSchedule();
      setNotice(successMessage);
      setModalState(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "הפעולה נכשלה.");
    } finally {
      setActionPending(false);
    }
  }

  async function handleSaveEvent(draft: EventDraft, existingEvent?: TripEvent) {
    setActionPending(true);
    setErrorMessage(null);

    const payload = {
      title: draft.title,
      emoji: draft.emoji,
      date: draft.date,
      segment: draft.segment,
      location: draft.location,
      placeUrl: draft.placeUrl,
      notes: draft.notes,
      photos: draft.photos,
      comments: draft.comments,
      attendees: draft.attendees,
      suggestedByName: editable ? existingEvent?.suggestedByName : draft.suggestedByName,
      suggestedByPerson: editable ? existingEvent?.suggestedByPerson : draft.suggestedByPerson,
      requestType: draft.requestType,
      targetEventId: draft.targetEventId,
      viewerKey: draft.viewerKey,
    };

    try {
      const response = await fetch(existingEvent ? `/api/events/${existingEvent.id}` : "/api/events", {
        method: existingEvent && editable ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      await readJson<{ event?: TripEvent }>(response);
      setModalState(null);

      if (!editable) {
        const nextIdentity = {
          key: draft.viewerKey,
          name: draft.suggestedByName,
          personId: draft.suggestedByPerson,
        };
        setViewerIdentity(nextIdentity);
        setSelectedFilter(nextIdentity.personId);
        window.localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(nextIdentity));
      }

      await refreshSchedule();
      setNotice(
        editable
          ? "האירוע נשמר."
          : draft.requestType === "change"
            ? "בקשת השינוי נשלחה לאישור."
            : draft.requestType === "remove"
              ? "בקשת ההסרה נשלחה לאישור."
              : "ההצעה נשלחה לאישור האדמין.",
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "שמירת האירוע נכשלה.");
    } finally {
      setActionPending(false);
    }
  }

  async function handleDeleteEvent(eventId: string) {
    setActionPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
      });
      await readJson<{ ok: true }>(response);
      await refreshSchedule();
      setNotice("האירוע נמחק.");
      setModalState(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "מחיקת האירוע נכשלה.");
    } finally {
      setActionPending(false);
    }
  }

  async function handleDecision(eventId: string, status: "approved" | "rejected") {
    const pendingEvent = events.find((event) => event.id === eventId);
    if (!pendingEvent) {
      return;
    }

    if (status === "approved" && isRequestEvent(pendingEvent)) {
      await patchEvent(
        eventId,
        { action: "approve-request" },
        pendingEvent.requestType === "remove" ? "בקשת ההסרה אושרה." : "בקשת השינוי אושרה.",
      );
      return;
    }

    await patchEvent(
      eventId,
      { action: "set-status", status },
      status === "approved" ? "האירוע אושר." : "ההצעה נדחתה.",
    );
  }

  async function handleMoveEvent(eventId: string, date: string, segment: SegmentId) {
    const event = events.find((current) => current.id === eventId);
    if (!event) {
      return;
    }

    const previousEvents = events;
    const movedEvent: TripEvent = {
      ...event,
      date,
      segment,
      updatedAt: new Date().toISOString(),
    };

    setErrorMessage(null);
    setEvents((current) =>
      sortEvents(current.map((item) => (item.id === eventId ? movedEvent : item))),
    );

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: event.title,
          emoji: event.emoji ?? "",
          date,
          segment,
          location: event.location,
          placeUrl: event.placeUrl ?? "",
          notes: event.notes ?? "",
          photos: event.photos ?? [],
          comments: event.comments ?? [],
          attendees: event.attendees,
          suggestedByName: event.suggestedByName,
          suggestedByPerson: event.suggestedByPerson,
        }),
      });

      const payload = await readJson<{ event?: TripEvent }>(response);
      if (payload.event) {
        setEvents((current) =>
          sortEvents(current.map((item) => (item.id === eventId ? payload.event! : item))),
        );
      }
      setNotice("האירוע הועבר בלוח.");
    } catch (error) {
      setEvents(previousEvents);
      setErrorMessage(error instanceof Error ? error.message : "העברת האירוע נכשלה.");
    }
  }

  async function handleSeedDemo() {
    setActionPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "seed-demo" }),
      });

      await readJson<{ ok: true }>(response);
      await refreshSchedule();
      setNotice("אירועי הדמו הועלו ל-Supabase.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "טעינת הדמו נכשלה.");
    } finally {
      setActionPending(false);
    }
  }

  async function handleAddComment(eventId: string, authorName: string, text: string) {
    setActionPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "add-comment",
          authorName,
          text,
        }),
      });

      const payload = await readJson<{ event?: TripEvent }>(response);
      if (payload.event) {
        setEvents((current) => sortEvents(current.map((item) => (item.id === eventId ? payload.event! : item))));
      }
      setNotice("התגובה נוספה.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "הוספת התגובה נכשלה.");
    } finally {
      setActionPending(false);
    }
  }

  async function handleAddPhoto(eventId: string, authorName: string, url: string, caption: string) {
    setActionPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "add-photo",
          authorName,
          url,
          caption,
        }),
      });

      const payload = await readJson<{ event?: TripEvent }>(response);
      if (payload.event) {
        setEvents((current) => sortEvents(current.map((item) => (item.id === eventId ? payload.event! : item))));
      }
      setNotice("התמונה נוספה.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "הוספת התמונה נכשלה.");
    } finally {
      setActionPending(false);
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <section className="overflow-hidden rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-[0_24px_80px_rgba(28,25,23,0.08)] md:p-7">
        <div
          className={`relative flex flex-col gap-6 ${
            editable ? "lg:gap-5" : "xl:flex-row xl:items-end xl:justify-between"
          }`}
        >
          <div className="pointer-events-none absolute left-0 top-0 flex h-14 w-20 items-center justify-center rounded-br-[1.5rem] rounded-tl-[1.25rem] border-b border-r border-sky-200/80 bg-white/85 shadow-sm">
            <span className="text-2xl leading-none" aria-hidden="true">
              🇮🇱
            </span>
          </div>

          <div className={`space-y-4 ${editable ? "" : ""}`}>
            <div className="flex flex-wrap gap-2">
              <p className="inline-flex rounded-full border border-teal-900/15 bg-teal-900/5 px-3 py-1 text-sm font-medium text-teal-950">
                {tripWindow.start} עד {tripWindow.end}
              </p>
              {editable ? (
                <p className="inline-flex rounded-full border border-stone-300 bg-white/80 px-3 py-1 text-sm font-medium text-stone-700">
                  עריכה ואישור
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <h1
                className={`text-balance font-semibold tracking-tight text-stone-950 ${
                  editable ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl"
                }`}
              >
                {editable ? "עדכון וניהול הביקור" : "ביקור פרידאים בישראל - קיץ 2026"}
              </h1>
              <p className={`text-[var(--muted)] ${editable ? "max-w-4xl text-base leading-7" : "max-w-3xl text-lg leading-8"}`}>
                {editable
                  ? "כאן אפשר לעדכן את הלוח, לאשר הצעות, להזיז אירועים ולשמור על סדר לכולם."
                  : "כל מה שמתוכנן לביקור במקום אחד — מפגשים, ארוחות, טיולים, וכל שאר הבלגן המשפחתי הטוב."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <StatsCard label="שבועות בביקור" value={`${weeks.length}`} />
              <StatsCard label="ימי ביקור" value={`${tripDays.length}`} />
              <StatsCard label="אירועים בלוח" value={`${scheduledEvents.length}`} />
            </div>
          </div>

          <div className={`flex flex-col gap-3 sm:flex-row ${editable ? "" : "xl:flex-col"}`}>
            <Link
              href={editable ? "/" : "/admin"}
              className="inline-flex items-center justify-center rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              {editable ? "חזרה ללוח המשותף" : "כניסה לעריכה"}
            </Link>
          </div>
        </div>

        <div className="relative mt-7 flex flex-col gap-4 rounded-[1.5rem] border border-stone-200 bg-white/70 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
                {currentMonthLabel}
              </p>
              <p className="mt-1 text-xl font-semibold text-stone-950">
                אפשר לעבור בין תצוגת שבוע, יום בודד, מבט על כל הביקור ושבוע אג׳נדה
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <ViewButton active={viewMode === "weeks"} onClick={() => setViewMode("weeks")}>
                שבועות
              </ViewButton>
              <ViewButton active={viewMode === "day"} onClick={() => setViewMode("day")}>
                יום בודד
              </ViewButton>
              <ViewButton active={viewMode === "trip"} onClick={() => setViewMode("trip")}>
                כל הביקור
              </ViewButton>
              <ViewButton
                active={viewMode === "mobileWeek"}
                onClick={() => setViewMode("mobileWeek")}
              >
                שבוע אג׳נדה
              </ViewButton>
            </div>
          </div>

          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              <FilterButton active={selectedFilter === "all"} onClick={() => setSelectedFilter("all")}>
                כל המשפחה
              </FilterButton>
              {people.map((person) => (
                <FilterButton
                  key={person.id}
                  active={selectedFilter === person.id}
                  onClick={() => setSelectedFilter(person.id)}
                >
                  {person.name}
                </FilterButton>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {people.map((person) => (
                <span
                  key={person.id}
                  className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-800"
                >
                  <span className="text-sm leading-none" aria-hidden="true">
                    {person.personEmoji}
                  </span>
                  {person.name}
                </span>
              ))}
            </div>
          </div>

          {!editable ? (
            <div className="flex flex-col gap-3 rounded-[1.25rem] border border-stone-200 bg-white/85 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-stone-900">רוצים להוסיף משהו ללוח?</p>
                <p className="mt-1 text-sm text-stone-600">
                  אפשר להזדהות פעם אחת, להציע אירוע חדש, או לבקש שינוי או הסרה של אירוע
                  קיים. כל הבקשות מגיעות לאישור לפני שהלוח מתעדכן.
                </p>
                <p className="mt-1 text-sm text-stone-500">
                  רוצים לשנות משהו קיים? לחצו על האירוע עצמו ומשם אפשר לשלוח בקשת שינוי או
                  הסרה.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openNewEvent(null, null)}
                  className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
                >
                  הוספת הצעה חדשה
                </button>
                {viewerIdentity.name ? (
                  <span className="inline-flex items-center rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700">
                    כרגע מזוהה: {viewerIdentity.name} · {getPerson(viewerIdentity.personId).name}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {viewMode === "day" ? (
            <div className="flex snap-x gap-2 overflow-x-auto pb-1">
              {tripDays.map((day) => (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDay(day.date)}
                  className={`min-w-fit snap-start rounded-2xl border px-4 py-3 text-right transition ${
                    selectedDay === day.date
                      ? "border-stone-950 bg-stone-950 text-white"
                      : "border-stone-200 bg-white text-stone-800 hover:border-stone-300"
                  }`}
                >
                  <p className="text-xs font-semibold text-current/75">{day.dayName}</p>
                  <p className="mt-1 text-sm font-semibold">{formatDateLabel(day.date)}</p>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {notice ? (
        <section className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {notice}
        </section>
      ) : null}

      {errorMessage ? (
        <section className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {errorMessage}
        </section>
      ) : null}

      {editable ? (
        <section className="rounded-[1.75rem] border border-sky-200 bg-sky-50 p-4 text-sky-950 shadow-[0_12px_40px_rgba(28,25,23,0.05)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-semibold">מצב עריכה פעיל</p>
              <p className="mt-1 text-sm leading-7">
                כאן אפשר להזיז אירועים, לעדכן פרטים, ולאשר או לדחות הצעות שנשלחו למשפחה.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsEditing((current) => !current)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isEditing
                    ? "bg-sky-950 text-white hover:bg-sky-900"
                    : "border border-sky-300 bg-white text-sky-950 hover:bg-sky-100"
                }`}
              >
                {isEditing ? "עריכה פעילה" : "הפעלת עריכה"}
              </button>
              <button
                type="button"
                onClick={() => openNewEvent(null, null)}
                className="rounded-full border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-950 transition hover:bg-sky-100"
              >
                אירוע חדש
              </button>
              {!databaseReady || (databaseReady && usingDemoData) ? (
                <button
                  type="button"
                  onClick={handleSeedDemo}
                  className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 transition hover:bg-stone-100"
                >
                  טעינת אירועי דמו
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {undatedEvents.length > 0 ? (
        <section className="rounded-[1.75rem] border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-[0_16px_50px_rgba(28,25,23,0.06)]">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                רעיונות לפני שיבוץ
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-stone-950">אירועים שעדיין בלי תאריך</h2>
              <p className="mt-1 text-sm text-stone-600">
                כולם רואים את ההצעות האלה. במצב עריכה אפשר לגרור כל אחת מהן ישר אל יום וחלק ביום בלוח.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openNewEvent(null, null)}
              className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
            >
              {editable ? "רעיון חדש" : "הצעת רעיון חדש"}
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {undatedEvents.map((event) => (
              <EventCard
                key={`undated-${event.id}`}
                event={event}
                hasConflict={false}
                compact={false}
                draggable={editable && isEditing && event.status !== "rejected"}
                onDragStart={() => setDraggedEventId(event.id)}
                onDragEnd={() => {
                  setDraggedEventId(null);
                  setDropTarget(null);
                }}
                onClick={() => setModalState({ type: "details", eventId: event.id })}
              />
            ))}
          </div>
        </section>
      ) : null}

      <div
        className={`grid gap-6 ${
          editable
            ? viewMode === "weeks"
              ? "grid-cols-1"
              : "xl:grid-cols-[minmax(0,1fr)_340px]"
            : ""
        }`}
      >
        <div className="min-w-0 space-y-5">
          {loading ? (
            <section className="rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel)] p-6 text-center text-stone-600">
              טוען את לוח הזמנים...
            </section>
          ) : null}

          {!loading && viewMode === "weeks" ? (
            <section className="min-w-0 space-y-5">
              {weeks.map((week) => (
                <WeekSection
                  key={week.id}
                  week={week}
                  events={scheduledEvents}
                  conflictIds={conflictIds}
                  editable={editable}
                  isEditing={isEditing}
                  draggedEventId={draggedEventId}
                  dropTarget={dropTarget}
                  selectedDay={selectedDay}
                  onSelectDay={setSelectedDay}
                  onDragStart={setDraggedEventId}
                  onDragEnd={() => {
                    setDraggedEventId(null);
                    setDropTarget(null);
                  }}
                  onSetDropTarget={setDropTarget}
                  onMoveEvent={handleMoveEvent}
                  onOpenEvent={(eventId) => setModalState({ type: "details", eventId })}
                  onOpenCreateEvent={openNewEvent}
                />
              ))}
            </section>
          ) : null}

          {!loading && viewMode === "day" ? (
            <section className="rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-[0_18px_60px_rgba(28,25,23,0.06)] md:p-6">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                    יום נבחר
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-stone-950">
                    {formatDateLabel(selectedDayData.date)}
                  </h2>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
                  {selectedDayData.dayName} · בתוך טווח הביקור
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {segments.map((segment) => (
                  <SegmentPanel
                    key={segment}
                    day={selectedDayData}
                    segment={segment}
                    events={scheduledEvents.filter(
                      (event) => event.date === selectedDayData.date && event.segment === segment,
                    )}
                    conflictIds={conflictIds}
                    editable={editable}
                    isEditing={isEditing}
                    draggedEventId={draggedEventId}
                    dropTarget={dropTarget}
                    onOpenEvent={(eventId) => setModalState({ type: "details", eventId })}
                    onOpenCreateEvent={openNewEvent}
                    onDragStart={setDraggedEventId}
                    onDragEnd={() => {
                      setDraggedEventId(null);
                      setDropTarget(null);
                    }}
                    onSetDropTarget={setDropTarget}
                    onMoveEvent={handleMoveEvent}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {!loading && viewMode === "mobileWeek" ? (
            <section className="rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-[0_18px_60px_rgba(28,25,23,0.06)] md:p-6">
              <MobileWeekAgenda
                weeks={weeks}
                week={selectedWeek}
                selectedWeekIndex={weeks.findIndex((week) => week.id === selectedWeek.id)}
                events={scheduledEvents}
                conflictIds={conflictIds}
                editable={editable}
                isEditing={isEditing}
                draggedEventId={draggedEventId}
                dropTarget={dropTarget}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
                onChangeWeek={(nextWeek) => {
                  const preferredDay =
                    nextWeek.days.find((day) => day.inTripRange) ?? nextWeek.days[0];
                  setSelectedDay(preferredDay.date);
                }}
                onOpenEvent={(eventId) => setModalState({ type: "details", eventId })}
                onOpenCreateEvent={openNewEvent}
                onDragStart={setDraggedEventId}
                onDragEnd={() => {
                  setDraggedEventId(null);
                  setDropTarget(null);
                }}
                onSetDropTarget={setDropTarget}
                onMoveEvent={handleMoveEvent}
              />
            </section>
          ) : null}

          {!loading && viewMode === "trip" ? (
            <section className="space-y-4">
              {groupedTripEvents.map(({ day, events: dayEvents }) => (
                <div
                  key={day.date}
                  className="rounded-[1.75rem] border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-[0_16px_50px_rgba(28,25,23,0.06)]"
                >
                  <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                        {day.dayName}
                      </p>
                      <h2 className="text-xl font-semibold text-stone-950">
                        {formatDateLabel(day.date)}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => openNewEvent(day.date, "morning")}
                      className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 transition hover:bg-stone-100"
                    >
                      {editable ? "אירוע חדש ליום זה" : "הצעת אירוע ליום זה"}
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {dayEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        hasConflict={conflictIds.has(event.id)}
                        compact={false}
                        draggable={editable && isEditing && event.status !== "rejected"}
                        onDragStart={() => setDraggedEventId(event.id)}
                        onDragEnd={() => setDraggedEventId(null)}
                        onClick={() => setModalState({ type: "details", eventId: event.id })}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ) : null}
        </div>

        {editable ? (
          <aside className="space-y-4">
            <div className="rounded-[1.75rem] border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-[0_16px_50px_rgba(28,25,23,0.06)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                מרכז ניהול
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <MiniStat label="ממתינים" value={`${pendingSuggestions.length}`} />
                <MiniStat label="נדחו" value={`${rejectedSuggestions.length}`} />
                <MiniStat label="מאושרים" value={`${events.filter((event) => event.status === "approved").length}`} />
                <MiniStat label="קונפליקטים" value={`${conflictingEvents.length}`} />
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-[0_16px_50px_rgba(28,25,23,0.06)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                הצעות שמחכות לאישור
              </p>
              <div className="mt-4 space-y-3">
                {pendingSuggestions.length > 0 ? (
                  pendingSuggestions.map((event) => (
                    <div key={event.id} className="rounded-[1.25rem] border border-stone-200 bg-white p-3">
                      <p className="flex items-center gap-2 font-semibold text-stone-950">
                        {event.emoji ? <span>{event.emoji}</span> : null}
                        <span>{event.title}</span>
                      </p>
                      <p className="mt-1 text-sm text-stone-600">
                        {formatEventDateLabel(event.date)} · {getEventSegmentLabel(event.segment)}
                      </p>
                      <p className="mt-1 text-sm text-stone-600">
                        {getRequestTypeLabel(event.requestType)} מאת {event.suggestedByName} עבור{" "}
                        {getPerson(event.suggestedByPerson ?? "gilad").name}
                      </p>
                      {event.targetEventId ? (
                        <p className="mt-1 text-sm text-stone-500">
                          מתייחס ל:{" "}
                          {events.find((candidate) => candidate.id === event.targetEventId)?.title ??
                            "אירוע קיים"}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={actionPending}
                          onClick={() => handleDecision(event.id, "approved")}
                          className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                        >
                          {event.requestType === "remove"
                            ? "אישור הסרה"
                            : event.requestType === "change"
                              ? "אישור שינוי"
                              : "אישור"}
                        </button>
                        <button
                          type="button"
                          disabled={actionPending}
                          onClick={() => handleDecision(event.id, "rejected")}
                          className="rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
                        >
                          דחייה
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditEvent(event)}
                          className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-100"
                        >
                          עריכה
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.25rem] border border-dashed border-stone-300 bg-white/70 px-4 py-6 text-sm text-stone-500">
                    אין כרגע הצעות שמחכות לאישור.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-[0_16px_50px_rgba(28,25,23,0.06)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                התנגשויות בלוח
              </p>
              <div className="mt-4 space-y-3">
                {conflictingEvents.length > 0 ? (
                  conflictingEvents.map((event) => (
                    <button
                      key={`conflict-${event.id}`}
                      type="button"
                      onClick={() => setModalState({ type: "details", eventId: event.id })}
                      className="w-full rounded-[1.25rem] border border-rose-200 bg-rose-50 p-3 text-right transition hover:bg-rose-100"
                    >
                      <p className="font-semibold text-rose-950">
                        {event.emoji ? `${event.emoji} ` : ""}
                        {event.title}
                      </p>
                      <p className="mt-1 text-sm text-rose-800">
                        {formatEventDateLabel(event.date)} · {getEventSegmentLabel(event.segment)}
                      </p>
                      <p className="mt-1 text-sm text-rose-700">{getAttendeeSummary(event)}</p>
                    </button>
                  ))
                ) : (
                  <div className="rounded-[1.25rem] border border-dashed border-stone-300 bg-white/70 px-4 py-6 text-sm text-stone-500">
                    אין כרגע התנגשויות בין אירועים.
                  </div>
                )}
              </div>
            </div>

          </aside>
        ) : null}
      </div>

      {selectedEvent ? (
        <EventDetailsModal
          event={selectedEvent}
          editable={editable}
          isEditing={isEditing}
          actionPending={actionPending}
          defaultName={viewerIdentity.name}
          onClose={() => setModalState(null)}
          onEdit={() => openEditEvent(selectedEvent)}
          onRequestChange={() => openChangeRequest(selectedEvent)}
          onRequestRemove={() => openRemoveRequest(selectedEvent)}
          onAddComment={handleAddComment}
          onAddPhoto={handleAddPhoto}
        />
      ) : null}

      {modalState?.type === "form" ? (
        <EventFormModal
          mode={modalState.mode}
          draft={createDraft(modalState.mode, {
            date: modalState.date,
            segment: modalState.segment,
            identity: viewerIdentity,
            event: modalState.event,
          })}
          existingEvent={modalState.event}
          targetEvent={modalState.targetEvent}
          saving={actionPending}
          onClose={() => setModalState(null)}
          onSave={handleSaveEvent}
          onDelete={
            editable && modalState.event ? () => handleDeleteEvent(modalState.event!.id) : undefined
          }
        />
      ) : null}
    </div>
  );
}

function WeekSection({
  week,
  events,
  conflictIds,
  editable,
  isEditing,
  draggedEventId,
  dropTarget,
  selectedDay,
  onSelectDay,
  onDragStart,
  onDragEnd,
  onSetDropTarget,
  onMoveEvent,
  onOpenEvent,
  onOpenCreateEvent,
}: {
  week: (typeof weeks)[number];
  events: TripEvent[];
  conflictIds: Set<string>;
  editable: boolean;
  isEditing: boolean;
  draggedEventId: string | null;
  dropTarget: DropTarget | null;
  selectedDay: string;
  onSelectDay: (date: string) => void;
  onDragStart: (eventId: string) => void;
  onDragEnd: () => void;
  onSetDropTarget: (target: DropTarget | null) => void;
  onMoveEvent: (eventId: string, date: string, segment: SegmentId) => Promise<void>;
  onOpenEvent: (eventId: string) => void;
  onOpenCreateEvent: (date: string, segment: SegmentId) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel)] shadow-[0_18px_60px_rgba(28,25,23,0.06)]">
      <div className="border-b border-stone-200 bg-white/65 px-5 py-4">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">{week.label}</p>
      </div>

      <div className="hidden overflow-x-auto md:block" dir="rtl">
        <div className="min-w-[860px] xl:min-w-[1020px]">
          <div className="grid grid-cols-[96px_repeat(7,minmax(0,1fr))] border-b border-stone-200 bg-white/75">
            <div className="border-s border-stone-200 px-2 py-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
              חלק ביום
            </div>
            {week.days.map((day) => (
              <DayHeaderCell
                key={day.date}
                day={day}
                selected={selectedDay === day.date}
                onClick={() => onSelectDay(day.date)}
              />
            ))}
          </div>

          {segments.map((segment) => (
            <div
              key={segment}
              className="grid grid-cols-[96px_repeat(7,minmax(0,1fr))] border-b border-stone-200 last:border-b-0"
            >
              <div className="border-s border-stone-200 bg-white/70 px-2 py-4" dir="rtl">
                <p className="text-sm font-semibold text-stone-800">{segmentLabels[segment]}</p>
                <p className="mt-1 text-xs text-stone-500">{segmentTimes[segment]}</p>
              </div>
              {week.days.map((day) => (
                <ScheduleDropZone
                  key={`${day.date}-${segment}`}
                  day={day}
                  segment={segment}
                  events={events.filter((event) => event.date === day.date && event.segment === segment)}
                  conflictIds={conflictIds}
                  editable={editable}
                  isEditing={isEditing}
                  draggedEventId={draggedEventId}
                  dropTarget={dropTarget}
                  onOpenEvent={onOpenEvent}
                  onOpenCreateEvent={onOpenCreateEvent}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onSetDropTarget={onSetDropTarget}
                  onMoveEvent={onMoveEvent}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 p-4 md:hidden">
        {week.days.map((day) => (
          <div
            key={day.date}
            className={`rounded-[1.5rem] border p-4 ${
              day.inTripRange ? "border-stone-200 bg-white/85" : "border-stone-200 bg-stone-100/70"
            }`}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-stone-500">{day.dayName}</p>
                <h3 className="mt-1 text-xl font-semibold text-stone-950">{formatDateLabel(day.date)}</h3>
              </div>
              <button
                type="button"
                onClick={() => onSelectDay(day.date)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  selectedDay === day.date
                    ? "bg-stone-950 text-white"
                    : "border border-stone-300 bg-white text-stone-700"
                }`}
              >
                מיקוד יום
              </button>
            </div>

            <div className="grid gap-3">
              {segments.map((segment) => (
                <SegmentPanel
                  key={`${day.date}-${segment}`}
                  day={day}
                  segment={segment}
                  events={events.filter((event) => event.date === day.date && event.segment === segment)}
                  conflictIds={conflictIds}
                  editable={editable}
                  isEditing={isEditing}
                  draggedEventId={draggedEventId}
                  dropTarget={dropTarget}
                  onOpenEvent={onOpenEvent}
                  onOpenCreateEvent={onOpenCreateEvent}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onSetDropTarget={onSetDropTarget}
                  onMoveEvent={onMoveEvent}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileWeekAgenda({
  weeks,
  week,
  selectedWeekIndex,
  events,
  conflictIds,
  editable,
  isEditing,
  draggedEventId,
  dropTarget,
  selectedDay,
  onSelectDay,
  onChangeWeek,
  onOpenEvent,
  onOpenCreateEvent,
  onDragStart,
  onDragEnd,
  onSetDropTarget,
  onMoveEvent,
}: {
  weeks: CalendarWeek[];
  week: CalendarWeek;
  selectedWeekIndex: number;
  events: TripEvent[];
  conflictIds: Set<string>;
  editable: boolean;
  isEditing: boolean;
  draggedEventId: string | null;
  dropTarget: DropTarget | null;
  selectedDay: string;
  onSelectDay: (date: string) => void;
  onChangeWeek: (week: CalendarWeek) => void;
  onOpenEvent: (eventId: string) => void;
  onOpenCreateEvent: (date: string, segment: SegmentId) => void;
  onDragStart: (eventId: string) => void;
  onDragEnd: () => void;
  onSetDropTarget: (target: DropTarget | null) => void;
  onMoveEvent: (eventId: string, date: string, segment: SegmentId) => Promise<void>;
}) {
  const canGoPrevious = selectedWeekIndex > 0;
  const canGoNext = selectedWeekIndex < weeks.length - 1;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">{week.label}</p>
          <h2 className="mt-1 text-xl font-semibold text-stone-950">שבוע מלא במבט נייד</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canGoPrevious}
            onClick={() => canGoPrevious && onChangeWeek(weeks[selectedWeekIndex - 1])}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-lg font-semibold text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="previous week"
          >
            ‹
          </button>
          <button
            type="button"
            disabled={!canGoNext}
            onClick={() => canGoNext && onChangeWeek(weeks[selectedWeekIndex + 1])}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-lg font-semibold text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="next week"
          >
            ›
          </button>
        </div>
      </div>

      <div className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-600">
        שבוע שלם עם גלילה אופקית קלה כדי לשמור על קריאות נוחה
      </div>

      <div className="overflow-x-auto pb-2" dir="rtl">
        <div className="min-w-[740px] overflow-hidden rounded-[1.5rem] border border-stone-200 bg-white/85">
          <div className="grid grid-cols-[88px_repeat(7,minmax(88px,1fr))] border-b border-stone-200 bg-stone-50/90">
            <div className="border-s border-stone-200 px-2 py-3 text-center text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
              חלק ביום
            </div>
            {week.days.map((day) => (
              <button
                key={day.date}
                type="button"
                onClick={() => onSelectDay(day.date)}
                className={`border-s border-stone-200 px-2 py-3 text-center transition ${
                  day.inTripRange
                    ? selectedDay === day.date
                      ? "bg-stone-950 text-white"
                      : "bg-white text-stone-900 hover:bg-stone-100"
                    : "bg-stone-100/80 text-stone-400"
                }`}
              >
                <p className="text-[11px] font-semibold">{day.dayName.replace("יום ", "")}</p>
                <p className="mt-1 text-3xl font-semibold leading-none">{day.dayNumber}</p>
              </button>
            ))}
          </div>

          {segments.map((segment) => (
            <MobileAgendaRow
              key={segment}
              week={week}
              segment={segment}
              events={events}
              conflictIds={conflictIds}
              editable={editable}
              isEditing={isEditing}
              draggedEventId={draggedEventId}
              dropTarget={dropTarget}
              onOpenEvent={onOpenEvent}
              onOpenCreateEvent={onOpenCreateEvent}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onSetDropTarget={onSetDropTarget}
              onMoveEvent={onMoveEvent}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileAgendaRow({
  week,
  segment,
  events,
  conflictIds,
  editable,
  isEditing,
  draggedEventId,
  dropTarget,
  onOpenEvent,
  onOpenCreateEvent,
  onDragStart,
  onDragEnd,
  onSetDropTarget,
  onMoveEvent,
}: {
  week: (typeof weeks)[number];
  segment: SegmentId;
  events: TripEvent[];
  conflictIds: Set<string>;
  editable: boolean;
  isEditing: boolean;
  draggedEventId: string | null;
  dropTarget: DropTarget | null;
  onOpenEvent: (eventId: string) => void;
  onOpenCreateEvent: (date: string, segment: SegmentId) => void;
  onDragStart: (eventId: string) => void;
  onDragEnd: () => void;
  onSetDropTarget: (target: DropTarget | null) => void;
  onMoveEvent: (eventId: string, date: string, segment: SegmentId) => Promise<void>;
}) {
  return (
    <div className="grid grid-cols-[88px_repeat(7,minmax(88px,1fr))] border-b border-stone-200 last:border-b-0">
      <div className="border-s border-stone-200 bg-white px-2 py-3">
        <p className="text-sm font-semibold text-stone-900">{segmentLabels[segment]}</p>
        <p className="mt-1 text-[11px] text-stone-500">{segmentTimes[segment]}</p>
      </div>

      {week.days.map((day) => {
        const cellEvents = events.filter(
          (event) => event.date === day.date && event.segment === segment,
        );
        const isActiveDropTarget =
          draggedEventId !== null &&
          dropTarget?.date === day.date &&
          dropTarget?.segment === segment;

        return (
          <div
            key={`${day.date}-${segment}`}
            onDragOver={(event) => {
              if (editable && isEditing && day.inTripRange) {
                event.preventDefault();
                onSetDropTarget({ date: day.date, segment });
              }
            }}
            onDragEnter={(event) => {
              if (editable && isEditing && day.inTripRange) {
                event.preventDefault();
                onSetDropTarget({ date: day.date, segment });
              }
            }}
            onDragLeave={(event) => {
              if (editable && isEditing && isActiveDropTarget && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
                onSetDropTarget(null);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (editable && isEditing && day.inTripRange && draggedEventId) {
                void onMoveEvent(draggedEventId, day.date, segment);
                onDragEnd();
              }
            }}
            className={`border-s border-stone-200 p-2 transition ${
              day.inTripRange
                ? isActiveDropTarget
                  ? "bg-teal-50"
                  : "bg-stone-50/55"
                : "bg-stone-100/70"
            }`}
          >
            <div
              className={`min-h-28 rounded-[1.15rem] border p-2 ${
                day.inTripRange
                  ? isActiveDropTarget
                    ? "border-dashed border-teal-400 bg-teal-50 shadow-[inset_0_0_0_1px_rgba(20,184,166,0.15)]"
                    : "border-stone-200 bg-white"
                  : "border-stone-200 bg-stone-50/70"
              }`}
            >
              {cellEvents.length > 0 ? (
                <div className="space-y-2">
                  {cellEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      draggable={editable && isEditing && event.status !== "rejected"}
                      onDragStart={() => onDragStart(event.id)}
                      onDragEnd={onDragEnd}
                      onClick={() => onOpenEvent(event.id)}
                      className={`w-full rounded-[1rem] bg-white px-2 py-2 text-right shadow-sm transition hover:border-stone-300 ${
                        conflictIds.has(event.id)
                          ? "border border-rose-300 bg-rose-50/70"
                          : "border border-stone-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <AttendeeMarkers attendees={event.attendees} compact />
                        <span className="text-lg leading-none">{event.emoji ?? "📌"}</span>
                      </div>
                      <p className="mt-2 line-clamp-3 text-sm font-semibold leading-5 text-stone-950">
                        {event.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-stone-500">
                        {[event.location, getAttendeeSummary(event)].filter(Boolean).join(" · ")}
                      </p>
                      {conflictIds.has(event.id) ? (
                        <p className="mt-1 text-[10px] font-semibold text-rose-700">התנגשות בלו״ז</p>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : day.inTripRange && editable && isEditing ? (
                <button
                  type="button"
                  onClick={() => onOpenCreateEvent(day.date, segment)}
                  className={`flex min-h-full w-full items-center justify-center rounded-[0.95rem] border border-dashed px-2 text-center text-xs font-medium transition ${
                    isActiveDropTarget
                      ? "border-teal-400 bg-teal-100 text-teal-900"
                      : "border-stone-300 bg-stone-50 text-stone-500 hover:border-stone-400 hover:bg-stone-100"
                  }`}
                >
                  {isActiveDropTarget ? "שחרור כאן" : "הוספת אירוע"}
                </button>
              ) : (
                <div className="flex min-h-full items-center justify-center rounded-[0.95rem] border border-dashed border-stone-200 px-2 text-center text-sm text-stone-400">
                  {day.inTripRange ? "פנוי" : "מחוץ לטווח"}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayHeaderCell({
  day,
  selected,
  onClick,
}: {
  day: CalendarDay;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-s border-stone-200 px-3 py-4 text-center transition ${
        day.inTripRange
          ? selected
            ? "bg-stone-950 text-white"
            : "bg-white/70 hover:bg-stone-100"
          : "bg-stone-200/50 text-stone-500"
      }`}
    >
      <div className="space-y-1" dir="rtl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-current/70">{day.dayName}</p>
        <p className="text-3xl font-semibold">{day.dayNumber}</p>
      </div>
    </button>
  );
}

function ScheduleDropZone({
  day,
  segment,
  events,
  conflictIds,
  editable,
  isEditing,
  draggedEventId,
  dropTarget,
  onOpenEvent,
  onOpenCreateEvent,
  onDragStart,
  onDragEnd,
  onSetDropTarget,
  onMoveEvent,
}: {
  day: CalendarDay;
  segment: SegmentId;
  events: TripEvent[];
  conflictIds: Set<string>;
  editable: boolean;
  isEditing: boolean;
  draggedEventId: string | null;
  dropTarget: DropTarget | null;
  onOpenEvent: (eventId: string) => void;
  onOpenCreateEvent: (date: string, segment: SegmentId) => void;
  onDragStart: (eventId: string) => void;
  onDragEnd: () => void;
  onSetDropTarget: (target: DropTarget | null) => void;
  onMoveEvent: (eventId: string, date: string, segment: SegmentId) => Promise<void>;
}) {
  const isActiveDropTarget =
    draggedEventId !== null &&
    dropTarget?.date === day.date &&
    dropTarget?.segment === segment;

  return (
    <div
      onDragOver={(event) => {
        if (editable && isEditing && day.inTripRange) {
          event.preventDefault();
          onSetDropTarget({ date: day.date, segment });
        }
      }}
      onDragEnter={(event) => {
        if (editable && isEditing && day.inTripRange) {
          event.preventDefault();
          onSetDropTarget({ date: day.date, segment });
        }
      }}
      onDragLeave={(event) => {
        if (editable && isEditing && isActiveDropTarget && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onSetDropTarget(null);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (editable && isEditing && day.inTripRange && draggedEventId) {
          void onMoveEvent(draggedEventId, day.date, segment);
          onDragEnd();
        }
      }}
      className={`min-h-40 border-s border-stone-200 px-2 py-2 align-top ${
        day.inTripRange
          ? isActiveDropTarget
            ? "bg-teal-50/80"
            : "bg-white/75"
          : "bg-stone-200/45"
      }`}
    >
      <div
        className={`relative flex h-full flex-col gap-2 rounded-[1.1rem] transition ${
          isActiveDropTarget ? "ring-2 ring-teal-400 ring-offset-2 ring-offset-teal-50/60" : ""
        }`}
        dir="rtl"
      >
        {isActiveDropTarget ? (
          <div className="pointer-events-none absolute inset-0 rounded-[1.1rem] border-2 border-dashed border-teal-400 bg-teal-100/35" />
        ) : null}
        {isActiveDropTarget ? (
          <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-teal-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
            שחרור כאן
          </div>
        ) : null}
        {events.length > 0 ? (
          events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              hasConflict={conflictIds.has(event.id)}
              compact
              draggable={editable && isEditing && event.status !== "rejected"}
              onDragStart={() => onDragStart(event.id)}
              onDragEnd={onDragEnd}
              onClick={() => onOpenEvent(event.id)}
            />
          ))
        ) : (
          <button
            type="button"
            disabled={!day.inTripRange}
            onClick={() => onOpenCreateEvent(day.date, segment)}
            className={`flex h-full min-h-28 items-center justify-center rounded-2xl border border-dashed px-3 text-sm transition ${
              day.inTripRange
                ? isActiveDropTarget
                  ? "border-teal-500 bg-teal-50 text-teal-900"
                  : "border-stone-300 text-stone-500 hover:border-stone-500 hover:bg-stone-100/60"
                : "border-stone-300/60 text-stone-400/80"
            }`}
          >
            {day.inTripRange
              ? editable
                ? isEditing
                  ? "לחצו להוספת אירוע"
                  : "פנוי"
                : "לחצו להצעת אירוע"
              : "מחוץ לטווח הביקור"}
          </button>
        )}
      </div>
    </div>
  );
}

function SegmentPanel({
  day,
  segment,
  events,
  conflictIds,
  editable,
  isEditing,
  draggedEventId,
  dropTarget,
  onOpenEvent,
  onOpenCreateEvent,
  onDragStart,
  onDragEnd,
  onSetDropTarget,
  onMoveEvent,
}: {
  day: CalendarDay;
  segment: SegmentId;
  events: TripEvent[];
  conflictIds: Set<string>;
  editable: boolean;
  isEditing: boolean;
  draggedEventId: string | null;
  dropTarget: DropTarget | null;
  onOpenEvent: (eventId: string) => void;
  onOpenCreateEvent: (date: string, segment: SegmentId) => void;
  onDragStart: (eventId: string) => void;
  onDragEnd: () => void;
  onSetDropTarget: (target: DropTarget | null) => void;
  onMoveEvent: (eventId: string, date: string, segment: SegmentId) => Promise<void>;
}) {
  const isActiveDropTarget =
    draggedEventId !== null &&
    dropTarget?.date === day.date &&
    dropTarget?.segment === segment;

  return (
    <div
      onDragOver={(event) => {
        if (editable && isEditing && day.inTripRange) {
          event.preventDefault();
          onSetDropTarget({ date: day.date, segment });
        }
      }}
      onDragEnter={(event) => {
        if (editable && isEditing && day.inTripRange) {
          event.preventDefault();
          onSetDropTarget({ date: day.date, segment });
        }
      }}
      onDragLeave={(event) => {
        if (editable && isEditing && isActiveDropTarget && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
          onSetDropTarget(null);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (editable && isEditing && day.inTripRange && draggedEventId) {
          void onMoveEvent(draggedEventId, day.date, segment);
          onDragEnd();
        }
      }}
      className={`rounded-[1.5rem] border p-3 ${
        day.inTripRange
          ? isActiveDropTarget
            ? "border-teal-400 bg-teal-50/80 shadow-[0_0_0_3px_rgba(45,212,191,0.15)]"
            : "border-stone-200 bg-white"
          : "border-stone-200 bg-stone-100/70"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-stone-900">{segmentLabels[segment]}</p>
          <p className="text-xs text-stone-500">{segmentTimes[segment]}</p>
        </div>
        <button
          type="button"
          onClick={() => onOpenCreateEvent(day.date, segment)}
          className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-semibold text-stone-700 transition hover:bg-stone-100"
        >
          {editable ? "הוסף" : "הצע"}
        </button>
      </div>

      <div className="grid gap-2">
        {events.length > 0 ? (
          events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              hasConflict={conflictIds.has(event.id)}
              compact={false}
              draggable={editable && isEditing && event.status !== "rejected"}
              onDragStart={() => onDragStart(event.id)}
              onDragEnd={onDragEnd}
              onClick={() => onOpenEvent(event.id)}
            />
          ))
        ) : (
          <button
            type="button"
            disabled={!day.inTripRange}
            onClick={() => onOpenCreateEvent(day.date, segment)}
            className={`rounded-2xl border border-dashed px-4 py-6 text-sm ${
              day.inTripRange
                ? isActiveDropTarget
                  ? "border-teal-500 bg-teal-50 text-teal-900"
                  : "border-stone-300 text-stone-500 hover:bg-stone-50"
                : "border-stone-300/60 text-stone-400/80"
            }`}
          >
            {day.inTripRange
              ? isActiveDropTarget
                ? "שחררו כאן את האירוע"
                : editable
                  ? "לחצו ליצירת אירוע חדש"
                  : "לחצו להצעת אירוע"
              : "מחוץ לטווח הביקור"}
          </button>
        )}
      </div>
    </div>
  );
}

function EventCard({
  event,
  hasConflict,
  compact,
  draggable,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  event: TripEvent;
  hasConflict: boolean;
  compact: boolean;
  draggable: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  const attendeeNames = event.attendees.map((personId) => getPerson(personId).name).join(" · ");

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`rounded-2xl border bg-white/95 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        compact ? "p-2.5" : "p-3"
      } ${
        hasConflict
          ? "border-rose-300 bg-rose-50/70"
          : event.status === "pending"
          ? "border-amber-300 border-dashed"
          : event.status === "rejected"
            ? "border-rose-200 bg-rose-50"
            : "border-white/70"
      }`}
    >
      {compact ? (
        <div className="min-w-0">
          <div className="flex items-center justify-end gap-1.5">
            {event.emoji ? <span className="text-base leading-none">{event.emoji}</span> : null}
            <AttendeeMarkers attendees={event.attendees} compact />
            {event.requestType && event.requestType !== "new" ? (
              <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold text-stone-700">
                {getRequestTypeLabel(event.requestType)}
              </span>
            ) : null}
            {event.status !== "approved" ? (
              <span
                className={`rounded-full font-semibold ${
                  compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"
                } ${
                  event.status === "pending"
                    ? "bg-amber-100 text-amber-950"
                    : "bg-rose-100 text-rose-900"
                }`}
              >
                {event.status === "pending" ? "ממתין לאישור" : "נדחה"}
              </span>
            ) : null}
            {hasConflict ? (
              <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-900">
                התנגשות
              </span>
            ) : null}
          </div>
          <p
            className="mt-1 text-sm font-semibold leading-5 text-stone-900"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {event.title}
          </p>
          <p className="mt-0.5 text-[11px] text-stone-600">
            {[event.location, event.date ? getEventSegmentLabel(event.segment) : undatedLabel].join(" · ")}
          </p>
          {event.suggestedByName ? (
            <p className="mt-0.5 text-[11px] text-stone-500">
              {event.requestType && event.requestType !== "new"
                ? `${getRequestTypeLabel(event.requestType)}: ${event.suggestedByName}`
                : `הציע/ה: ${event.suggestedByName}`}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {event.emoji ? <span className="text-lg leading-none">{event.emoji}</span> : null}
                <p className="text-base font-semibold leading-7 text-stone-900">{event.title}</p>
                {event.requestType && event.requestType !== "new" ? (
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-700">
                    {getRequestTypeLabel(event.requestType)}
                  </span>
                ) : null}
                {event.status !== "approved" ? (
                  <span
                    className={`rounded-full font-semibold px-2 py-0.5 text-[11px] ${
                      event.status === "pending"
                        ? "bg-amber-100 text-amber-950"
                        : "bg-rose-100 text-rose-900"
                    }`}
                  >
                    {event.status === "pending" ? "ממתין לאישור" : "נדחה"}
                  </span>
                ) : null}
                {hasConflict ? (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-900">
                    התנגשות
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-stone-600">{event.location}</p>
              <p className="mt-1 text-xs font-medium text-stone-500">
                {event.date
                  ? `${formatEventDateLabel(event.date)} · ${getEventSegmentLabel(event.segment)}`
                  : undatedHint}
              </p>
              {event.suggestedByName ? (
                <p className="mt-1 text-xs text-stone-500">
                  {event.requestType && event.requestType !== "new"
                    ? `${getRequestTypeLabel(event.requestType)}: ${event.suggestedByName}`
                    : `הציע/ה: ${event.suggestedByName}`}
                </p>
              ) : null}
            </div>
            <AttendeeMarkers attendees={event.attendees} compact={false} />
          </div>
        </div>
      )}

      {compact ? (
        <p
          className="mt-1.5 text-[10px] font-medium text-stone-500"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 1,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {attendeeNames}
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {event.attendees.map((personId) => {
            const person = getPerson(personId);
            return (
              <span
                key={personId}
                className="rounded-full border border-stone-200 bg-white px-2 py-1 text-[11px] font-semibold text-stone-800"
              >
                <span className="ml-1" aria-hidden="true">
                  {person.personEmoji}
                </span>
                {person.name}
              </span>
            );
          })}
        </div>
      )}
    </button>
  );
}

function AttendeeMarkers({
  attendees,
  compact,
}: {
  attendees: PersonId[];
  compact: boolean;
}) {
  if (isFullFamily(attendees)) {
    return (
      <div className={`flex shrink-0 items-center ${compact ? "pt-0.5" : "mt-1"}`} aria-hidden="true">
        <span
          className={`inline-flex items-center justify-center gap-0.5 rounded-full border border-white bg-white ring-2 ring-white shadow-sm ${
            compact ? "h-5 px-1.5 text-[10px]" : "h-7 px-2 text-xs"
          }`}
          title="כל המשפחה"
        >
          <span>👨</span>
          <span>👩</span>
          <span>🧒</span>
        </span>
      </div>
    );
  }

  return (
    <div className={`flex shrink-0 items-center ${compact ? "-space-x-1.5 pt-0.5" : "-space-x-2 mt-1"}`} aria-hidden="true">
      {attendees.map((personId) => {
        const person = getPerson(personId);
        return (
          <span
            key={personId}
            className={`inline-flex items-center justify-center rounded-full border border-white bg-white ring-2 ring-white shadow-sm ${compact ? "h-5 w-5 text-[11px]" : "h-7 w-7 text-sm"}`}
            title={person.name}
          >
            {person.personEmoji}
          </span>
        );
      })}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active ? "bg-stone-950 text-white" : "bg-stone-200/80 text-stone-700 hover:bg-stone-300/80"
      }`}
    >
      {children}
    </button>
  );
}

function ViewButton({
  active,
  onClick,
  className,
  children,
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active ? "bg-teal-950 text-white" : "border border-teal-100 bg-teal-50 text-teal-950 hover:bg-teal-100"
      } ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

function StatsCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[120px] rounded-[1.25rem] border border-stone-200 bg-white/80 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-stone-950">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-stone-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-stone-950">{value}</p>
    </div>
  );
}

function EventDetailsModal({
  event,
  editable,
  isEditing,
  actionPending,
  defaultName,
  onClose,
  onEdit,
  onRequestChange,
  onRequestRemove,
  onAddComment,
  onAddPhoto,
}: {
  event: TripEvent;
  editable: boolean;
  isEditing: boolean;
  actionPending: boolean;
  defaultName: string;
  onClose: () => void;
  onEdit: () => void;
  onRequestChange: () => void;
  onRequestRemove: () => void;
  onAddComment: (eventId: string, authorName: string, text: string) => Promise<void>;
  onAddPhoto: (eventId: string, authorName: string, url: string, caption: string) => Promise<void>;
}) {
  const mapsUrl = buildGoogleMapsSearchUrl(event.location);
  const wazeUrl = buildWazeSearchUrl(event.location);
  const [commentAuthor, setCommentAuthor] = useState(defaultName);
  const [commentText, setCommentText] = useState("");
  const [photoAuthor, setPhotoAuthor] = useState(defaultName);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoCaption, setPhotoCaption] = useState("");

  async function submitComment() {
    if (!commentAuthor.trim() || !commentText.trim()) {
      return;
    }

    await onAddComment(event.id, commentAuthor.trim(), commentText.trim());
    setCommentText("");
  }

  async function submitPhoto() {
    if (!photoUrl.trim()) {
      return;
    }

    await onAddPhoto(event.id, photoAuthor.trim(), photoUrl.trim(), photoCaption.trim());
    setPhotoUrl("");
    setPhotoCaption("");
  }

  useEffect(() => {
    function handleKeyDown(keyboardEvent: KeyboardEvent) {
      if (keyboardEvent.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-950/45 px-3 py-4 sm:px-4 sm:py-8">
      <button type="button" aria-label="close" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div
        className="relative z-10 my-auto w-full max-w-lg rounded-[1.75rem] border border-[var(--panel-border)] bg-white shadow-[0_30px_90px_rgba(28,25,23,0.18)] sm:rounded-[2rem]"
        dir="rtl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-[1.75rem] border-b border-stone-200 bg-white px-4 py-4 sm:rounded-t-[2rem] sm:px-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">פרטי אירוע</p>
            <h2 className="mt-2 flex items-center gap-2 text-3xl font-semibold text-stone-950">
              {event.emoji ? <span>{event.emoji}</span> : null}
              <span>{event.title}</span>
            </h2>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {editable && isEditing ? (
              <button
                type="button"
                onClick={onEdit}
                className="rounded-full border border-stone-300 px-3 py-1.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
              >
                עריכה
              </button>
            ) : null}
            {!editable && event.status === "approved" ? (
              <>
                <button
                  type="button"
                  onClick={onRequestChange}
                  className="rounded-full border border-stone-300 px-3 py-1.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                >
                  בקשת שינוי
                </button>
                <button
                  type="button"
                  onClick={onRequestRemove}
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-900 transition hover:bg-rose-100"
                >
                  בקשת הסרה
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-stone-300 px-3 py-1.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
            >
              סגור
            </button>
          </div>
        </div>

        <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto px-4 py-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Detail label="תאריך" value={formatEventDateLabel(event.date)} />
            <Detail label="חלק ביום" value={getEventSegmentLabel(event.segment)} />
            <Detail label="מיקום" value={event.location} />
            <Detail label="סטטוס" value={event.status === "approved" ? "מאושר" : event.status === "pending" ? "ממתין לאישור" : "נדחה"} />
            <Detail label="משתתפים" value={event.attendees.map((personId) => getPerson(personId).name).join(", ")} />
            <Detail label="הוצע על ידי" value={event.suggestedByName ?? "אדמין"} />
            {event.requestType && event.requestType !== "new" ? (
              <Detail label="סוג בקשה" value={getRequestTypeLabel(event.requestType)} />
            ) : null}
          </div>

          {mapsUrl || wazeUrl || event.placeUrl ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900 transition hover:bg-sky-100"
                >
                  Google Maps
                </a>
              ) : null}
              {wazeUrl ? (
                <a
                  href={wazeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
                >
                  Waze
                </a>
              ) : null}
              {event.placeUrl ? (
                <a
                  href={event.placeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
                >
                  קישור למקום
                </a>
              ) : null}
            </div>
          ) : null}

          {event.photos && event.photos.length > 0 ? (
            <div className="mt-5">
              <p className="text-sm font-semibold text-stone-700">תמונות וקישורים חזותיים</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {event.photos.map((photo) => (
                  <a
                    key={photo.id}
                    href={photo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="overflow-hidden rounded-[1.25rem] border border-stone-200 bg-stone-50"
                  >
                    <img
                      src={photo.url}
                      alt={photo.caption ?? event.title}
                      className="h-40 w-full object-cover"
                    />
                    <div className="px-3 py-2 text-sm text-stone-700">
                      {photo.caption ? <p className="font-medium text-stone-900">{photo.caption}</p> : null}
                      {photo.addedByName ? <p className="mt-1 text-xs text-stone-500">נוסף על ידי {photo.addedByName}</p> : null}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          {event.notes ? (
            <div className="mt-5 rounded-2xl bg-stone-100 px-4 py-3 text-sm leading-7 text-stone-700">{event.notes}</div>
          ) : null}

          <div className="mt-5 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-semibold text-stone-900">תגובות</p>
            <div className="mt-3 space-y-3">
              {event.comments && event.comments.length > 0 ? (
                event.comments.map((comment) => (
                  <div key={comment.id} className="rounded-[1.25rem] border border-stone-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-stone-900">{comment.authorName}</p>
                      <p className="text-xs text-stone-500">
                        {new Intl.DateTimeFormat("he-IL", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(comment.createdAt))}
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-stone-700">{comment.text}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-stone-300 bg-white px-4 py-5 text-sm text-stone-500">
                  עדיין אין תגובות לאירוע הזה.
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr]">
              <input
                value={commentAuthor}
                onChange={(currentEvent) => setCommentAuthor(currentEvent.target.value)}
                className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-950 outline-none transition focus:border-stone-950"
                placeholder="השם שלך"
              />
              <textarea
                value={commentText}
                onChange={(currentEvent) => setCommentText(currentEvent.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-950 outline-none transition focus:border-stone-950"
                placeholder="אפשר להוסיף עדכון, הערה, או משהו שכדאי לזכור..."
              />
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={actionPending || !commentAuthor.trim() || !commentText.trim()}
                onClick={() => void submitComment()}
                className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-60"
              >
                הוספת תגובה
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-semibold text-stone-900">שיתוף תמונה</p>
            <div className="mt-3 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={photoAuthor}
                  onChange={(currentEvent) => setPhotoAuthor(currentEvent.target.value)}
                  className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-950 outline-none transition focus:border-stone-950"
                  placeholder="השם שלך"
                />
                <input
                  value={photoCaption}
                  onChange={(currentEvent) => setPhotoCaption(currentEvent.target.value)}
                  className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-950 outline-none transition focus:border-stone-950"
                  placeholder="כיתוב קצר"
                />
              </div>
              <input
                value={photoUrl}
                onChange={(currentEvent) => setPhotoUrl(currentEvent.target.value)}
                className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-950 outline-none transition focus:border-stone-950"
                placeholder="קישור ישיר לתמונה"
              />
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={actionPending || !photoUrl.trim()}
                onClick={() => void submitPhoto()}
                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100 disabled:opacity-60"
              >
                הוספת תמונה
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventFormModal({
  mode,
  draft,
  existingEvent,
  targetEvent,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  mode: "admin" | "suggest" | "change" | "remove";
  draft: EventDraft;
  existingEvent?: TripEvent;
  targetEvent?: TripEvent;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: EventDraft, existingEvent?: TripEvent) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [formState, setFormState] = useState<EventDraft>(draft);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const isUndated = !formState.date || !formState.segment;

  function toggleAttendee(personId: PersonId) {
    setFormState((current) => {
      const exists = current.attendees.includes(personId);
      const nextAttendees = exists
        ? current.attendees.filter((value) => value !== personId)
        : [...current.attendees, personId];

      return {
        ...current,
        attendees: nextAttendees.length > 0 ? nextAttendees : current.attendees,
      };
    });
  }

  useEffect(() => {
    function handleKeyDown(keyboardEvent: KeyboardEvent) {
      if (keyboardEvent.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-950/45 px-3 py-4 sm:px-4 sm:py-8">
      <button type="button" aria-label="close" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div
        className="relative z-10 my-auto w-full max-w-2xl rounded-[1.75rem] border border-[var(--panel-border)] bg-white shadow-[0_30px_90px_rgba(28,25,23,0.18)] sm:rounded-[2rem]"
        dir="rtl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-[1.75rem] border-b border-stone-200 bg-white px-4 py-4 sm:rounded-t-[2rem] sm:px-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
              {mode === "admin"
                ? existingEvent
                  ? "עריכת אירוע"
                  : "יצירת אירוע"
                : mode === "change"
                  ? "בקשת שינוי"
                  : mode === "remove"
                    ? "בקשת הסרה"
                    : "הצעת אירוע"}
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-stone-950">
              {existingEvent
                ? `${existingEvent.emoji ? `${existingEvent.emoji} ` : ""}${existingEvent.title}`
                : mode === "admin"
                  ? "אירוע חדש בלוח"
                  : mode === "change"
                    ? "איזה שינוי תרצו לבקש?"
                    : mode === "remove"
                      ? "בקשה להסרת אירוע"
                      : "הצעה חדשה לאדמין"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-stone-300 px-3 py-1.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
          >
            סגור
          </button>
        </div>

        <div className="max-h-[min(88dvh,820px)] overflow-y-auto px-4 py-4 sm:px-6">
          {mode !== "admin" && targetEvent ? (
            <div className="mb-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
              <p className="font-semibold text-stone-900">האירוע המקורי</p>
              <p className="mt-1">
                {targetEvent.emoji ? `${targetEvent.emoji} ` : ""}
                {targetEvent.title} · {formatEventDateLabel(targetEvent.date)} · {getEventSegmentLabel(targetEvent.segment)}
              </p>
              <p className="mt-1 text-stone-600">{targetEvent.location}</p>
            </div>
          ) : null}

          <div className="mb-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
            <label className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-stone-900">עדיין בלי תאריך?</p>
                <p className="mt-1 text-sm text-stone-600">
                  אפשר לשמור את האירוע כרעיון פתוח, והוא יופיע באזור מיוחד עד שישובץ בלוח.
                </p>
              </div>
              <input
                type="checkbox"
                checked={isUndated}
                disabled={mode === "remove"}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    date: event.target.checked ? null : current.date ?? tripWindow.start,
                    segment: event.target.checked ? null : current.segment ?? "morning",
                  }))
                }
                className="h-5 w-5 rounded border-stone-300 text-stone-950 focus:ring-stone-900"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="כותרת">
              <input
                value={formState.title}
                onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
                disabled={mode === "remove"}
                className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-950 outline-none transition focus:border-stone-950"
                placeholder="למשל ארוחת ערב משפחתית"
              />
            </Field>

            <Field label="אימוג'י">
              <div className="flex flex-wrap gap-2 rounded-2xl border border-stone-300 bg-stone-50 p-3">
                {eventEmojiOptions.map((emoji) => {
                  const active = formState.emoji === emoji;
                  return (
                    <button
                      key={emoji}
                      type="button"
                      disabled={mode === "remove"}
                      onClick={() => setFormState((current) => ({ ...current, emoji }))}
                      className={`flex h-10 w-10 items-center justify-center rounded-2xl border text-lg transition ${
                        active
                          ? "border-stone-950 bg-stone-950 text-white"
                          : "border-stone-200 bg-white hover:border-stone-400"
                      }`}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="מיקום">
              <input
                value={formState.location}
                onChange={(event) => setFormState((current) => ({ ...current, location: event.target.value }))}
                disabled={mode === "remove"}
                className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-950 outline-none transition focus:border-stone-950"
                placeholder="למשל ירושלים"
              />
            </Field>

            <Field label="תאריך">
              <input
                type="date"
                value={formState.date ?? ""}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    date: event.target.value || null,
                  }))
                }
                disabled={mode === "remove" || isUndated}
                className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-950 outline-none transition focus:border-stone-950"
              />
            </Field>

            <Field label="חלק ביום">
              <select
                value={formState.segment ?? ""}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    segment: (event.target.value as SegmentId) || null,
                  }))
                }
                disabled={mode === "remove" || isUndated}
                className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-950 outline-none transition focus:border-stone-950"
              >
                <option value="">בחרו חלק ביום</option>
                {segments.map((segment) => (
                  <option key={segment} value={segment}>
                    {segmentLabels[segment]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {mode === "suggest" ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="מי מציע/ה?">
                <input
                  value={formState.suggestedByName}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, suggestedByName: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-950 outline-none transition focus:border-stone-950"
                  placeholder="למשל גלעד"
                />
              </Field>

              <Field label="האירוע שייך בעיקר ל">
                <select
                  value={formState.suggestedByPerson}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      suggestedByPerson: event.target.value as PersonId,
                    }))
                  }
                  className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-950 outline-none transition focus:border-stone-950"
                >
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}

          <div className="mt-4">
            <Field label="משתתפים">
              <div className="flex flex-wrap gap-2">
                {people.map((person) => {
                  const active = formState.attendees.includes(person.id);
                  return (
                    <button
                      key={person.id}
                      type="button"
                      disabled={mode === "remove"}
                      onClick={() => toggleAttendee(person.id)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      active
                          ? "border-stone-950 bg-stone-950 text-white"
                          : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    <span className="ml-1" aria-hidden="true">
                      {person.personEmoji}
                    </span>
                    {person.name}
                  </button>
                );
                })}
              </div>
            </Field>
          </div>

          <div className="mt-4">
            <Field label={mode === "remove" ? "למה להסיר?" : "הערות"}>
              <textarea
                value={formState.notes}
                onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
                rows={3}
                className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-950 outline-none transition focus:border-stone-950"
                placeholder={
                  mode === "remove"
                    ? "למשל האירוע בוטל, לא רלוונטי יותר, או הוחלט לוותר עליו"
                    : "פרטים נוספים, כתובת מלאה, תזכורת, מה להביא..."
                }
              />
            </Field>
          </div>

          {mode === "admin" ? (
            <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
              <button
                type="button"
                onClick={() => setShowAdvanced((current) => !current)}
                className="flex w-full items-center justify-between text-right text-sm font-semibold text-stone-800"
              >
                <span>אפשרויות מתקדמות</span>
                <span>{showAdvanced ? "−" : "+"}</span>
              </button>

              {showAdvanced ? (
                <div className="mt-4 space-y-4">
                  <Field label="קישור למקום">
                    <input
                      value={formState.placeUrl}
                      onChange={(event) => setFormState((current) => ({ ...current, placeUrl: event.target.value }))}
                      className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-950 outline-none transition focus:border-stone-950"
                      placeholder="https://..."
                    />
                  </Field>

                  <Field label="קישורי תמונות (שורה נפרדת לכל תמונה)">
                    <textarea
                      value={formState.photos.map((photo) => photo.url).join("\n")}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          photos: event.target.value
                            .split("\n")
                            .map((url) => url.trim())
                            .filter(Boolean)
                            .map((url, index) => ({
                              id: `photo-${index}-${Date.now()}`,
                              url,
                              createdAt: new Date().toISOString(),
                            })),
                        }))
                      }
                      rows={3}
                      className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-950 outline-none transition focus:border-stone-950"
                      placeholder="https://example.com/image1.jpg"
                    />
                  </Field>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {onDelete ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void onDelete()}
                  className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-900 transition hover:bg-rose-100 disabled:opacity-60"
                >
                  מחיקת אירוע
                </button>
              ) : null}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
              >
                ביטול
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void onSave(formState, existingEvent)}
                className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-60"
              >
                {mode === "admin"
                  ? "שמירת אירוע"
                  : mode === "change"
                    ? "שליחת בקשת שינוי"
                    : mode === "remove"
                      ? "שליחת בקשת הסרה"
                      : "שליחת הצעה"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <p className="mb-2 text-sm font-semibold text-stone-700">{label}</p>
      {children}
    </label>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{label}</p>
      <p className="mt-1 font-medium text-stone-900">{value}</p>
    </div>
  );
}
