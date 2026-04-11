"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import {
  buildCalendarWeeks,
  demoEvents,
  getPerson,
  getPrimaryPerson,
  people,
  segmentLabels,
  segmentTimes,
  tripWindow,
  type PersonId,
  type SegmentId,
  type TripEvent,
} from "@/lib/trip-schedule";

type ScheduleBoardProps = {
  editable?: boolean;
};

type FilterValue = "all" | PersonId;

const weeks = buildCalendarWeeks();
const segments: SegmentId[] = ["morning", "noon", "evening", "night"];

function canSeeEvent(event: TripEvent, filter: FilterValue) {
  return filter === "all" || event.attendees.includes(filter);
}

export function ScheduleBoard({ editable = false }: ScheduleBoardProps) {
  const [selectedFilter, setSelectedFilter] = useState<FilterValue>("all");
  const [events, setEvents] = useState<TripEvent[]>(demoEvents);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === activeEventId) ?? null,
    [activeEventId, events],
  );

  const visibleEvents = useMemo(
    () => events.filter((event) => canSeeEvent(event, selectedFilter)),
    [events, selectedFilter],
  );

  const currentMonthLabel = useMemo(() => {
    const firstActiveDay = weeks
      .flatMap((week) => week.days)
      .find((day) => day.inTripRange);

    return firstActiveDay?.monthLabel ?? "יוני 2026";
  }, []);

  function moveEvent(eventId: string, date: string, segment: SegmentId) {
    setEvents((currentEvents) =>
      currentEvents.map((event) =>
        event.id === eventId ? { ...event, date, segment } : event,
      ),
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <section className="rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-[0_20px_60px_rgba(28,25,23,0.08)] md:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-4">
            <p className="inline-flex rounded-full border border-teal-900/15 bg-teal-900/5 px-3 py-1 text-sm font-medium text-teal-950">
              {tripWindow.start} עד {tripWindow.end}
            </p>
            <div className="space-y-2">
              <h1 className="text-balance text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl">
                לוח הביקור בישראל
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-[var(--muted)]">
                תצוגה שבועית בעברית, מראשון עד שבת, עם מקטעים רחבים של בוקר,
                צהריים, ערב ולילה. כל מי שפותח את האתר רואה את התוכנית, ורק מצב
                אדמין מאפשר לערוך.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={editable ? "/" : "/admin"}
              className="inline-flex items-center justify-center rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              {editable ? "חזרה לצפייה" : "כניסה למצב אדמין"}
            </Link>
            <Link
              href="/api/status"
              className="inline-flex items-center justify-center rounded-full border border-stone-300 bg-white/80 px-5 py-3 text-sm font-semibold text-stone-900 transition hover:border-stone-400 hover:bg-white"
            >
              מצב המערכת
            </Link>
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-4 rounded-[1.5rem] border border-stone-200 bg-white/70 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
                {currentMonthLabel}
              </p>
              <p className="mt-1 text-xl font-semibold text-stone-950">
                תצוגה שבועית מלאה עם ימים מחוץ לטווח באפור
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <FilterButton
                active={selectedFilter === "all"}
                onClick={() => setSelectedFilter("all")}
              >
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
            {editable ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-950">
                ניתן לגרור אירועים בין ימים ומקטעים
              </span>
            ) : null}
          </div>
        </div>
      </section>

      {editable ? (
        <section className="rounded-[1.75rem] border border-sky-200 bg-sky-50 p-4 text-sky-950 shadow-[0_12px_40px_rgba(28,25,23,0.05)]">
          <p className="font-semibold">מצב אדמין פעיל</p>
          <p className="mt-1 text-sm leading-7">
            אפשר לגרור אירועים בין ימים ומקטעים. לחיצה על אירוע פותחת את פרטי
            האירוע. השלב הבא יהיה לשמור את השינויים ב-Supabase.
          </p>
        </section>
      ) : null}

      <section className="space-y-5">
        {weeks.map((week) => (
          <div
            key={week.id}
            className="overflow-hidden rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel)] shadow-[0_18px_60px_rgba(28,25,23,0.06)]"
          >
            <div className="border-b border-stone-200 bg-white/65 px-5 py-4">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
                {week.label}
              </p>
            </div>

            <div className="overflow-x-auto" dir="ltr">
              <div className="min-w-[1100px]">
                <div className="grid grid-cols-[100px_repeat(7,minmax(0,1fr))] border-b border-stone-200 bg-white/75">
                  <div className="border-l border-stone-200 px-3 py-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                    חלק ביום
                  </div>
                  {week.days.map((day) => (
                    <div
                      key={day.date}
                      className={`border-l border-stone-200 px-3 py-4 ${
                        day.inTripRange ? "bg-white/70" : "bg-stone-200/50"
                      }`}
                    >
                      <div className="space-y-1 text-center" dir="rtl">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                          {day.dayName}
                        </p>
                        <p className="text-3xl font-semibold text-stone-950">
                          {day.dayNumber}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {segments.map((segment) => (
                  <div
                    key={segment}
                    className="grid grid-cols-[100px_repeat(7,minmax(0,1fr))] border-b border-stone-200 last:border-b-0"
                  >
                    <div className="border-l border-stone-200 bg-white/70 px-3 py-4" dir="rtl">
                      <p className="text-sm font-semibold text-stone-800">
                        {segmentLabels[segment]}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {segmentTimes[segment]}
                      </p>
                    </div>

                    {week.days.map((day) => {
                      const dayEvents = visibleEvents.filter(
                        (event) =>
                          event.date === day.date && event.segment === segment,
                      );

                      return (
                        <div
                          key={`${day.date}-${segment}`}
                          onDragOver={(event) => {
                            if (editable && day.inTripRange) {
                              event.preventDefault();
                            }
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (editable && day.inTripRange && draggedEventId) {
                              moveEvent(draggedEventId, day.date, segment);
                              setDraggedEventId(null);
                            }
                          }}
                          className={`min-h-36 border-l border-stone-200 px-2 py-2 align-top ${
                            day.inTripRange
                              ? "bg-white/75"
                              : "bg-stone-200/45"
                          }`}
                        >
                          <div className="flex h-full flex-col gap-2" dir="rtl">
                            {dayEvents.length > 0 ? (
                              dayEvents.map((event) => (
                                <button
                                  key={event.id}
                                  type="button"
                                  draggable={editable}
                                  onDragStart={() => setDraggedEventId(event.id)}
                                  onDragEnd={() => setDraggedEventId(null)}
                                  onClick={() => setActiveEventId(event.id)}
                                  className={`rounded-2xl border p-3 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                                    day.inTripRange
                                      ? "border-white/70 bg-white/95"
                                      : "border-stone-300 bg-stone-100"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="font-semibold text-stone-900">
                                        {event.title}
                                      </p>
                                      <p className="mt-1 text-xs text-stone-600">
                                        {event.location}
                                      </p>
                                    </div>
                                    <span
                                      className={`mt-0.5 h-3 w-3 shrink-0 rounded-full ${getPrimaryPerson(
                                        event,
                                      ).colorClass}`}
                                    />
                                  </div>

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
                                </button>
                              ))
                            ) : (
                              <div
                                className={`flex h-full min-h-28 items-center justify-center rounded-2xl border border-dashed text-sm ${
                                  day.inTripRange
                                    ? "border-stone-300 text-stone-400"
                                    : "border-stone-300/60 text-stone-400/80"
                                }`}
                                dir="rtl"
                              >
                                {day.inTripRange ? "פנוי" : "מחוץ לטווח הביקור"}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </section>

      {selectedEvent ? (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => setActiveEventId(null)}
        />
      ) : null}
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
        active
          ? "bg-stone-950 text-white"
          : "bg-stone-200/80 text-stone-700 hover:bg-stone-300/80"
      }`}
    >
      {children}
    </button>
  );
}

function EventDetailsModal({
  event,
  onClose,
}: {
  event: TripEvent;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 px-4 py-8">
      <button
        type="button"
        aria-label="close"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div
        className="relative z-10 w-full max-w-lg rounded-[2rem] border border-[var(--panel-border)] bg-white p-6 shadow-[0_30px_90px_rgba(28,25,23,0.18)]"
        dir="rtl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
              פרטי אירוע
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-stone-950">
              {event.title}
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

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Detail label="תאריך" value={event.date} />
          <Detail label="חלק ביום" value={segmentLabels[event.segment]} />
          <Detail label="מיקום" value={event.location} />
          <Detail
            label="משתתפים"
            value={event.attendees.map((personId) => getPerson(personId).name).join(", ")}
          />
        </div>

        {event.notes ? (
          <div className="mt-5 rounded-2xl bg-stone-100 px-4 py-3 text-sm leading-7 text-stone-700">
            {event.notes}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
        {label}
      </p>
      <p className="mt-1 font-medium text-stone-900">{value}</p>
    </div>
  );
}
