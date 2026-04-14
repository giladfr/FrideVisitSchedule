"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  buildCalendarWeeks,
  eventEmojiOptions,
  getPerson,
  people,
  segmentLabels,
  segmentTimes,
  tripWindow,
  type CalendarDay,
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
  name: string;
  personId: PersonId;
};
type DropTarget = {
  date: string;
  segment: SegmentId;
};
type ModalState =
  | { type: "details"; eventId: string }
  | { type: "form"; mode: "admin" | "suggest"; event?: TripEvent; date: string; segment: SegmentId }
  | null;
type EventDraft = {
  title: string;
  emoji: string;
  date: string;
  segment: SegmentId;
  location: string;
  notes: string;
  attendees: PersonId[];
  suggestedByName: string;
  suggestedByPerson: PersonId;
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

function defaultIdentity(): ViewerIdentity {
  return {
    name: "",
    personId: "gilad",
  };
}

function createDraft(
  mode: "admin" | "suggest",
  options: {
    date: string;
    segment: SegmentId;
    identity: ViewerIdentity;
    event?: TripEvent;
  },
): EventDraft {
  const event = options.event;

  return {
    title: event?.title ?? "",
    emoji: event?.emoji ?? "🎉",
    date: event?.date ?? options.date,
    segment: event?.segment ?? options.segment,
    location: event?.location ?? "",
    notes: event?.notes ?? "",
    attendees: event?.attendees ?? [options.identity.personId],
    suggestedByName:
      mode === "suggest"
        ? event?.suggestedByName ?? options.identity.name
        : event?.suggestedByName ?? "",
    suggestedByPerson:
      mode === "suggest"
        ? event?.suggestedByPerson ?? options.identity.personId
        : event?.suggestedByPerson ?? options.identity.personId,
  };
}

function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${date}T12:00:00`));
}

function sortEvents(events: TripEvent[]) {
  return [...events].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    const segmentOrder = segments.indexOf(left.segment) - segments.indexOf(right.segment);
    if (segmentOrder !== 0) {
      return segmentOrder;
    }

    return (left.createdAt ?? "").localeCompare(right.createdAt ?? "");
  });
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
    return filter !== "all" && filter === event.suggestedByPerson;
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
      return;
    }

    const raw = window.localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as ViewerIdentity;
      if (parsed.name && parsed.personId) {
        setViewerIdentity(parsed);
        setSelectedFilter(parsed.personId);
      }
    } catch {
      window.localStorage.removeItem(IDENTITY_STORAGE_KEY);
    }
  }, [editable]);

  useEffect(() => {
    if (editable || !viewerIdentity.name.trim()) {
      return;
    }

    window.localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(viewerIdentity));
  }, [editable, viewerIdentity]);

  const refreshSchedule = useCallback(async (identityName?: string) => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const params =
        !editable && identityName?.trim()
          ? `?viewerName=${encodeURIComponent(identityName.trim())}`
          : "";
      const response = await fetch(`/api/events${params}`, { cache: "no-store" });
      const payload = await readJson<SnapshotResponse>(response);
      setEvents(sortEvents(payload.events));
      setDatabaseReady(payload.databaseReady);
      setUsingDemoData(payload.usingDemoData);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "לא הצלחנו לטעון את האירועים.");
    } finally {
      setLoading(false);
    }
  }, [editable]);

  useEffect(() => {
    void refreshSchedule(editable ? undefined : viewerIdentity.name);
  }, [editable, refreshSchedule, viewerIdentity.name]);

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

  const pendingSuggestions = useMemo(
    () => sortEvents(events.filter((event) => event.status === "pending")),
    [events],
  );

  const rejectedSuggestions = useMemo(
    () => sortEvents(events.filter((event) => event.status === "rejected")),
    [events],
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
        events: filteredEvents.filter((event) => event.date === day.date),
      }))
      .filter((entry) => entry.events.length > 0);
  }, [filteredEvents]);

  const selectedWeek = useMemo(
    () => weeks.find((week) => week.days.some((day) => day.date === selectedDay)) ?? weeks[0],
    [selectedDay],
  );

  function openNewEvent(date: string, segment: SegmentId) {
    setSelectedDay(date);
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
      await refreshSchedule(editable ? undefined : viewerIdentity.name);
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
      notes: draft.notes,
      attendees: draft.attendees,
      suggestedByName: editable ? existingEvent?.suggestedByName : draft.suggestedByName,
      suggestedByPerson: editable ? existingEvent?.suggestedByPerson : draft.suggestedByPerson,
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

      if (!editable) {
        const nextIdentity = {
          name: draft.suggestedByName,
          personId: draft.suggestedByPerson,
        };
        setViewerIdentity(nextIdentity);
        setSelectedFilter(nextIdentity.personId);
        window.localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(nextIdentity));
      }

      await refreshSchedule(editable ? undefined : draft.suggestedByName);
      setNotice(editable ? "האירוע נשמר." : "ההצעה נשלחה לאישור האדמין.");
      setModalState(null);
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
      await refreshSchedule(undefined);
      setNotice("האירוע נמחק.");
      setModalState(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "מחיקת האירוע נכשלה.");
    } finally {
      setActionPending(false);
    }
  }

  async function handleDecision(eventId: string, status: "approved" | "rejected") {
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

    await patchEvent(
      eventId,
      {
        title: event.title,
        emoji: event.emoji ?? "",
        date,
        segment,
        location: event.location,
        notes: event.notes ?? "",
        attendees: event.attendees,
        suggestedByName: event.suggestedByName,
        suggestedByPerson: event.suggestedByPerson,
      },
      "האירוע הועבר בלוח.",
    );
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
      await refreshSchedule(undefined);
      setNotice("אירועי הדמו הועלו ל-Supabase.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "טעינת הדמו נכשלה.");
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
          <div className={`space-y-4 ${editable ? "" : ""}`}>
            <div className="flex flex-wrap gap-2">
              <p className="inline-flex rounded-full border border-teal-900/15 bg-teal-900/5 px-3 py-1 text-sm font-medium text-teal-950">
                {tripWindow.start} עד {tripWindow.end}
              </p>
              <p className="inline-flex rounded-full border border-stone-300 bg-white/80 px-3 py-1 text-sm font-medium text-stone-700">
                {editable ? "אישור וניהול אדמין" : "צפייה ושיגור הצעות"}
              </p>
              {databaseReady ? (
                <p className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-900">
                  מחובר ל-Supabase
                </p>
              ) : (
                <p className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-900">
                  מצב דמו עד שסכימת ה-DB תופעל
                </p>
              )}
            </div>

            <div className="space-y-2">
              <h1
                className={`text-balance font-semibold tracking-tight text-stone-950 ${
                  editable ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl"
                }`}
              >
                {editable ? "מרכז ניהול הביקור" : "לוח הביקור בישראל"}
              </h1>
              <p className={`text-[var(--muted)] ${editable ? "max-w-4xl text-base leading-7" : "max-w-3xl text-lg leading-8"}`}>
                {editable
                  ? "ניהול מהיר של האירועים, אישור הצעות, עריכה וגרירה של לוח הזמנים המשפחתי."
                  : "לוח משפחתי בעברית עם תצוגה שבועית, מצב מובייל, הצעות לאישור, ופאנל אדמין שמרכז את כל מה שממתין לטיפול."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <StatsCard label="שבועות" value={`${weeks.length}`} />
              <StatsCard label="ימי ביקור" value={`${tripDays.length}`} />
              <StatsCard label="אירועים מוצגים" value={`${filteredEvents.length}`} />
            </div>
          </div>

          <div className={`flex flex-col gap-3 sm:flex-row ${editable ? "" : "xl:flex-col"}`}>
            <Link
              href={editable ? "/" : "/admin"}
              className="inline-flex items-center justify-center rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              {editable ? "חזרה לצפייה הציבורית" : "כניסה למצב אדמין"}
            </Link>
            <Link
              href="/api/status"
              className="inline-flex items-center justify-center rounded-full border border-stone-300 bg-white/80 px-5 py-3 text-sm font-semibold text-stone-900 transition hover:border-stone-400 hover:bg-white"
            >
              מצב המערכת
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
                שבועות מלאים, יום בודד, או תצוגה מרוכזת של כל הביקור
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
                className="md:hidden"
              >
                שבוע נייד
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
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${person.chipClass}`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${person.colorClass}`} />
                  {person.name}
                </span>
              ))}
            </div>
          </div>

          {!editable ? (
            <div className="flex flex-col gap-3 rounded-[1.25rem] border border-stone-200 bg-white/80 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-stone-900">מי מציע/ה אירועים?</p>
                <p className="mt-1 text-sm text-stone-600">
                  כדי לראות הצעות ממתינות של אותו אדם ולשלוח הצעה חדשה, כדאי להזדהות בשם ובבן
                  המשפחה הרלוונטי.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openNewEvent(selectedDay, "morning")}
                  className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
                >
                  הצעת אירוע חדשה
                </button>
                {viewerIdentity.name ? (
                  <span className="inline-flex items-center rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700">
                    מזוהה בתור {viewerIdentity.name} · {getPerson(viewerIdentity.personId).name}
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
              <p className="font-semibold">מצב אדמין פעיל</p>
              <p className="mt-1 text-sm leading-7">
                כאן אפשר לגרור אירועים, לאשר או לדחות הצעות, ולנהל את הלוח המשותף מתוך פאנל אחד.
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
                {isEditing ? "מצב עריכה פעיל" : "הפעלת מצב עריכה"}
              </button>
              <button
                type="button"
                onClick={() => openNewEvent(selectedDay, "morning")}
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
                  events={filteredEvents}
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
                    events={filteredEvents.filter(
                      (event) => event.date === selectedDayData.date && event.segment === segment,
                    )}
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
                week={selectedWeek}
                events={filteredEvents}
                editable={editable}
                isEditing={isEditing}
                draggedEventId={draggedEventId}
                dropTarget={dropTarget}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
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
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-[0_16px_50px_rgba(28,25,23,0.06)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                הצעות שממתינות לאישור
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
                        {formatDateLabel(event.date)} · {segmentLabels[event.segment]}
                      </p>
                      <p className="mt-1 text-sm text-stone-600">
                        הוצע על ידי {event.suggestedByName} עבור {getPerson(event.suggestedByPerson ?? "gilad").name}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={actionPending}
                          onClick={() => handleDecision(event.id, "approved")}
                          className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                        >
                          אישור
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
                    אין כרגע הצעות שממתינות לאישור.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-[0_16px_50px_rgba(28,25,23,0.06)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                מצב מסד הנתונים
              </p>
              <div className="mt-4 space-y-3 text-sm text-stone-700">
                <p>
                  {databaseReady
                    ? "סכימת Supabase זמינה והאפליקציה שומרת וקוראת מה-DB."
                    : "עדיין אין טבלת visit_events פעילה, ולכן האפליקציה מציגה דמו. יש להפעיל את supabase/schema.sql."}
                </p>
                <p>
                  {usingDemoData
                    ? "כרגע מוצגים אירועי דמו מקומיים."
                    : "כרגע מוצגים נתונים חיים מתוך Supabase."}
                </p>
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
          onClose={() => setModalState(null)}
          onEdit={() => openEditEvent(selectedEvent)}
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
  week,
  events,
  editable,
  isEditing,
  draggedEventId,
  dropTarget,
  selectedDay,
  onSelectDay,
  onOpenEvent,
  onOpenCreateEvent,
  onDragStart,
  onDragEnd,
  onSetDropTarget,
  onMoveEvent,
}: {
  week: (typeof weeks)[number];
  events: TripEvent[];
  editable: boolean;
  isEditing: boolean;
  draggedEventId: string | null;
  dropTarget: DropTarget | null;
  selectedDay: string;
  onSelectDay: (date: string) => void;
  onOpenEvent: (eventId: string) => void;
  onOpenCreateEvent: (date: string, segment: SegmentId) => void;
  onDragStart: (eventId: string) => void;
  onDragEnd: () => void;
  onSetDropTarget: (target: DropTarget | null) => void;
  onMoveEvent: (eventId: string, date: string, segment: SegmentId) => Promise<void>;
}) {
  return (
    <div className="space-y-4 md:hidden">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">{week.label}</p>
          <h2 className="mt-1 text-xl font-semibold text-stone-950">שבוע מלא במבט נייד</h2>
        </div>
        <div className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-600">
          7 ימים יחד
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 rounded-[1.5rem] border border-stone-200 bg-white/80 p-2">
        {week.days.map((day) => (
          <button
            key={day.date}
            type="button"
            onClick={() => onSelectDay(day.date)}
            className={`rounded-2xl px-1 py-2 text-center transition ${
              day.inTripRange
                ? selectedDay === day.date
                  ? "bg-stone-950 text-white"
                  : "bg-stone-50 text-stone-900"
                : "bg-stone-100/70 text-stone-400"
            }`}
          >
            <p className="text-[10px] font-semibold">{day.dayName.replace("יום ", "")}</p>
            <p className="mt-1 text-2xl font-semibold leading-none">{day.dayNumber}</p>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {segments.map((segment) => (
          <MobileAgendaRow
            key={segment}
            week={week}
            segment={segment}
            events={events}
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
  );
}

function MobileAgendaRow({
  week,
  segment,
  events,
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
    <div className="rounded-[1.5rem] border border-stone-200 bg-white/85 p-2">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-stone-900">{segmentLabels[segment]}</p>
          <p className="text-[11px] text-stone-500">{segmentTimes[segment]}</p>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
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
              className={`min-h-28 rounded-[1.1rem] border p-1 transition ${
                day.inTripRange
                  ? isActiveDropTarget
                    ? "border-teal-400 bg-teal-50"
                    : "border-stone-200 bg-stone-50/80"
                  : "border-stone-200 bg-stone-100/70"
              }`}
            >
              {cellEvents.length > 0 ? (
                <div className="space-y-1">
                  {cellEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      draggable={editable && isEditing && event.status !== "rejected"}
                      onDragStart={() => onDragStart(event.id)}
                      onDragEnd={onDragEnd}
                      onClick={() => onOpenEvent(event.id)}
                      className="w-full rounded-xl border border-white/80 bg-white px-1.5 py-1 text-right shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] leading-none">{event.emoji ?? "•"}</span>
                        <AttendeeMarkers attendees={event.attendees} compact />
                      </div>
                      <p
                        className="mt-1 text-[11px] font-semibold leading-4 text-stone-900"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {event.title}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!day.inTripRange}
                  onClick={() => onOpenCreateEvent(day.date, segment)}
                  className={`flex h-full min-h-24 w-full items-center justify-center rounded-[1rem] border border-dashed px-1 text-center text-[11px] ${
                    day.inTripRange
                      ? isActiveDropTarget
                        ? "border-teal-500 bg-teal-50 text-teal-900"
                        : "border-stone-300 text-stone-400"
                      : "border-stone-300/60 text-stone-300"
                  }`}
                >
                  {day.inTripRange ? (isActiveDropTarget ? "שחרור" : editable ? "+" : "פנוי") : "—"}
                </button>
              )}
            </div>
          );
        })}
      </div>
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
  compact,
  draggable,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  event: TripEvent;
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
        event.status === "pending"
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
            {event.location} · {segmentLabels[event.segment]}
          </p>
          {event.suggestedByName ? (
            <p className="mt-0.5 text-[11px] text-stone-500">הציע/ה: {event.suggestedByName}</p>
          ) : null}
        </div>
      ) : (
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {event.emoji ? <span className="text-lg leading-none">{event.emoji}</span> : null}
                <p className="text-base font-semibold leading-7 text-stone-900">{event.title}</p>
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
              </div>
              <p className="mt-1 text-sm text-stone-600">{event.location}</p>
              <p className="mt-1 text-xs font-medium text-stone-500">{segmentLabels[event.segment]}</p>
              {event.suggestedByName ? (
                <p className="mt-1 text-xs text-stone-500">הציע/ה: {event.suggestedByName}</p>
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
                className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${person.chipClass}`}
              >
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
  return (
    <div className={`flex shrink-0 items-center ${compact ? "-space-x-1.5 pt-0.5" : "-space-x-2 mt-1"}`} aria-hidden="true">
      {attendees.map((personId) => {
        const person = getPerson(personId);
        return (
          <span
            key={personId}
            className={`rounded-full ring-2 ring-white ${compact ? "h-4 w-4" : "h-5 w-5"} ${person.colorClass}`}
            title={person.name}
          />
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
  onClose,
  onEdit,
}: {
  event: TripEvent;
  editable: boolean;
  isEditing: boolean;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 px-4 py-8">
      <button type="button" aria-label="close" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div
        className="relative z-10 w-full max-w-lg rounded-[2rem] border border-[var(--panel-border)] bg-white p-6 shadow-[0_30px_90px_rgba(28,25,23,0.18)]"
        dir="rtl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">פרטי אירוע</p>
            <h2 className="mt-2 flex items-center gap-2 text-3xl font-semibold text-stone-950">
              {event.emoji ? <span>{event.emoji}</span> : null}
              <span>{event.title}</span>
            </h2>
          </div>
          <div className="flex gap-2">
            {editable && isEditing ? (
              <button
                type="button"
                onClick={onEdit}
                className="rounded-full border border-stone-300 px-3 py-1.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
              >
                עריכה
              </button>
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

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Detail label="תאריך" value={formatDateLabel(event.date)} />
          <Detail label="חלק ביום" value={segmentLabels[event.segment]} />
          <Detail label="מיקום" value={event.location} />
          <Detail label="סטטוס" value={event.status === "approved" ? "מאושר" : event.status === "pending" ? "ממתין לאישור" : "נדחה"} />
          <Detail label="משתתפים" value={event.attendees.map((personId) => getPerson(personId).name).join(", ")} />
          <Detail label="הוצע על ידי" value={event.suggestedByName ?? "אדמין"} />
        </div>

        {event.notes ? (
          <div className="mt-5 rounded-2xl bg-stone-100 px-4 py-3 text-sm leading-7 text-stone-700">{event.notes}</div>
        ) : null}
      </div>
    </div>
  );
}

function EventFormModal({
  mode,
  draft,
  existingEvent,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  mode: "admin" | "suggest";
  draft: EventDraft;
  existingEvent?: TripEvent;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: EventDraft, existingEvent?: TripEvent) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [formState, setFormState] = useState<EventDraft>(draft);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 px-4 py-8">
      <button type="button" aria-label="close" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div
        className="relative z-10 w-full max-w-2xl rounded-[2rem] border border-[var(--panel-border)] bg-white p-6 shadow-[0_30px_90px_rgba(28,25,23,0.18)]"
        dir="rtl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
              {mode === "admin" ? (existingEvent ? "עריכת אירוע" : "יצירת אירוע") : "הצעת אירוע"}
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-stone-950">
              {existingEvent
                ? `${existingEvent.emoji ? `${existingEvent.emoji} ` : ""}${existingEvent.title}`
                : mode === "admin"
                  ? "אירוע חדש בלוח"
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

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="כותרת">
            <input
              value={formState.title}
              onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
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
                    onClick={() => setFormState((current) => ({ ...current, emoji }))}
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-xl transition ${
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
              className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-950 outline-none transition focus:border-stone-950"
              placeholder="למשל ירושלים"
            />
          </Field>

          <Field label="תאריך">
            <input
              type="date"
              value={formState.date}
              onChange={(event) => setFormState((current) => ({ ...current, date: event.target.value }))}
              className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-950 outline-none transition focus:border-stone-950"
            />
          </Field>

          <Field label="חלק ביום">
            <select
              value={formState.segment}
              onChange={(event) =>
                setFormState((current) => ({ ...current, segment: event.target.value as SegmentId }))
              }
              className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-950 outline-none transition focus:border-stone-950"
            >
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
                    onClick={() => toggleAttendee(person.id)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? person.chipClass
                        : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    {person.name}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>

        <div className="mt-4">
          <Field label="הערות">
            <textarea
              value={formState.notes}
              onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
              rows={4}
              className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-stone-950 outline-none transition focus:border-stone-950"
              placeholder="פרטים נוספים, כתובת מלאה, תזכורת, מה להביא..."
            />
          </Field>
        </div>

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
              {mode === "admin" ? "שמירת אירוע" : "שליחת הצעה"}
            </button>
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
