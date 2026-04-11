"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import {
  buildTripDays,
  demoEvents,
  getEventsForDate,
  people,
  segmentLabels,
  type PersonId,
  type SegmentId,
  type TripEvent,
} from "@/lib/trip-schedule";

type ScheduleBoardProps = {
  editable?: boolean;
};

type ScopeFilter = "all" | "shared" | "personal";

const segmentOrder: SegmentId[] = ["morning", "noon", "afternoon", "evening"];
const tripDays = buildTripDays();

function isVisibleEvent(event: TripEvent, personFilter: PersonId | "all", scope: ScopeFilter) {
  const personMatches =
    personFilter === "all" || event.attendees.includes(personFilter);
  const scopeMatches = scope === "all" || event.category === scope;

  return personMatches && scopeMatches;
}

export function ScheduleBoard({ editable = false }: ScheduleBoardProps) {
  const [personFilter, setPersonFilter] = useState<PersonId | "all">("all");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");

  const visibleCount = useMemo(
    () =>
      demoEvents.filter((event) =>
        isVisibleEvent(event, personFilter, scopeFilter),
      ).length,
    [personFilter, scopeFilter],
  );

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_20px_60px_rgba(28,25,23,0.08)] md:p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <p className="inline-flex rounded-full border border-teal-900/15 bg-teal-900/5 px-3 py-1 text-sm font-medium text-teal-950">
              June 3, 2026 to June 24, 2026
            </p>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl">
                Israel visit planner
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-[var(--muted)]">
                A calm three-week family view with shared plans, personal plans,
                and a softer rhythm of morning, noon, afternoon, and evening.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={editable ? "/" : "/admin"}
              className="inline-flex items-center justify-center rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              {editable ? "Back to viewer" : "Enter admin mode"}
            </Link>
            <Link
              href="/api/status"
              className="inline-flex items-center justify-center rounded-full border border-stone-300 bg-white/80 px-5 py-3 text-sm font-semibold text-stone-900 transition hover:border-stone-400 hover:bg-white"
            >
              Infrastructure status
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="rounded-[1.5rem] border border-stone-200 bg-white/70 p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
              People filter
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <FilterPill
                active={personFilter === "all"}
                label="Everyone"
                onClick={() => setPersonFilter("all")}
              />
              {people.map((person) => (
                <FilterPill
                  key={person.id}
                  active={personFilter === person.id}
                  label={person.name}
                  onClick={() => setPersonFilter(person.id)}
                />
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-stone-200 bg-white/70 p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
              Event scope
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <FilterPill
                active={scopeFilter === "all"}
                label="All"
                onClick={() => setScopeFilter("all")}
              />
              <FilterPill
                active={scopeFilter === "shared"}
                label="Shared only"
                onClick={() => setScopeFilter("shared")}
              />
              <FilterPill
                active={scopeFilter === "personal"}
                label="Personal only"
                onClick={() => setScopeFilter("personal")}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 rounded-[1.5rem] border border-stone-200 bg-stone-950 px-5 py-4 text-stone-50 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-stone-400">
              Current view
            </p>
            <p className="mt-1 text-lg font-medium">
              {visibleCount} events visible across the full visit window
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Legend label="Shared" tone="bg-emerald-200 text-emerald-950" />
            <Legend label="Personal" tone="bg-amber-200 text-amber-950" />
            {editable ? (
              <Legend label="Admin mode" tone="bg-sky-200 text-sky-950" />
            ) : null}
          </div>
        </div>
      </section>

      {editable ? (
        <section className="grid gap-4 lg:grid-cols-[0.7fr_1.3fr]">
          <div className="rounded-[1.75rem] border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-[0_12px_40px_rgba(28,25,23,0.06)]">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
              Admin mode
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-stone-950">
              Editing shell is unlocked
            </h2>
            <p className="mt-3 text-sm leading-7 text-stone-700">
              This version focuses on the structure and flow. The next step is
              to connect these controls to Supabase so new events, edits, and
              drag-and-drop changes persist for the trip.
            </p>
            <div className="mt-5 space-y-3">
              <ActionCard title="Create shared event" copy="Dinner, trip day, relative visit, airport run." />
              <ActionCard title="Create personal event" copy="Work meeting, one-on-one coffee, kids-only plan." />
              <ActionCard title="Set visibility" copy="Keep public view simple while preserving admin control." />
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-[0_12px_40px_rgba(28,25,23,0.06)]">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
              Editing notes
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-stone-700">
              <li>The public schedule remains open and read-only.</li>
              <li>Admin mode is intended for a single password-only editor.</li>
              <li>Google Calendar sync can layer in after the data model is stable.</li>
            </ul>
          </div>
        </section>
      ) : null}

      <section className="space-y-6">
        {["Week 1", "Week 2", "Week 3", "Week 4"].map((weekLabel) => {
          const weekDays = tripDays.filter((day) => day.weekLabel === weekLabel);

          if (weekDays.length === 0) {
            return null;
          }

          return (
            <div
              key={weekLabel}
              className="rounded-[2rem] border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-[0_16px_50px_rgba(28,25,23,0.06)] md:p-6"
            >
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
                    {weekLabel}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-stone-950">
                    {weekDays[0]?.shortDate} to {weekDays[weekDays.length - 1]?.shortDate}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {weekDays.map((day) => {
                  const visibleEvents = getEventsForDate(day.date).filter((event) =>
                    isVisibleEvent(event, personFilter, scopeFilter),
                  );

                  return (
                    <article
                      key={day.date}
                      className={`rounded-[1.5rem] border p-4 ${
                        day.isWeekend
                          ? "border-amber-200 bg-amber-50/70"
                          : "border-stone-200 bg-white/75"
                      }`}
                    >
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm uppercase tracking-[0.18em] text-stone-500">
                            {day.dayLabel}
                          </p>
                          <h3 className="mt-1 text-2xl font-semibold text-stone-950">
                            {day.shortDate}
                          </h3>
                        </div>
                        <span className="rounded-full bg-stone-950 px-3 py-1 text-xs font-semibold text-white">
                          {visibleEvents.length} item{visibleEvents.length === 1 ? "" : "s"}
                        </span>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        {segmentOrder.map((segment) => {
                          const segmentEvents = visibleEvents.filter(
                            (event) => event.segment === segment,
                          );

                          return (
                            <div
                              key={segment}
                              className="rounded-[1.25rem] border border-stone-200 bg-stone-50/90 p-3"
                            >
                              <div className="mb-3 flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-stone-700">
                                  {segmentLabels[segment]}
                                </p>
                                {editable ? (
                                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-900">
                                    add later
                                  </span>
                                ) : null}
                              </div>

                              <div className="space-y-2">
                                {segmentEvents.length > 0 ? (
                                  segmentEvents.map((event) => (
                                    <EventCard key={event.id} event={event} />
                                  ))
                                ) : (
                                  <div className="rounded-2xl border border-dashed border-stone-300 px-3 py-4 text-sm text-stone-500">
                                    Open slot
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function FilterPill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
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
      {label}
    </button>
  );
}

function Legend({ label, tone }: { label: string; tone: string }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}

function ActionCard({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-[1.25rem] border border-stone-200 bg-white/80 p-4">
      <p className="font-semibold text-stone-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-stone-600">{copy}</p>
    </div>
  );
}

function EventCard({ event }: { event: TripEvent }) {
  const attendeeNames = people
    .filter((person) => event.attendees.includes(person.id))
    .map((person) => person.name)
    .join(", ");

  return (
    <div
      className={`rounded-[1.1rem] border px-3 py-3 shadow-sm ${
        event.category === "shared"
          ? "border-emerald-200 bg-emerald-50"
          : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-stone-900">{event.title}</p>
          {event.location ? (
            <p className="mt-1 text-sm text-stone-600">{event.location}</p>
          ) : null}
        </div>
        <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-700">
          {event.category}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-stone-600">{attendeeNames}</p>
      {event.notes ? (
        <p className="mt-2 text-xs leading-5 text-stone-500">{event.notes}</p>
      ) : null}
    </div>
  );
}
