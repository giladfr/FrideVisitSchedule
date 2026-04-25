import { NextResponse } from "next/server";

import { buildGoogleMapsSearchUrl } from "@/lib/maps";
import { fetchScheduleSnapshot } from "@/lib/schedule-store";
import { segmentLabels, type SegmentId } from "@/lib/trip-schedule";

const CALENDAR_NAME = "ביקור פרידאים בישראל - קיץ 2026";
const CALENDAR_DESCRIPTION = "לוח הביקור המשותף של משפחת פרידאים בישראל.";
const CALENDAR_TIMEZONE = "Asia/Jerusalem";

const segmentTimeRanges: Record<SegmentId, { start: string; end: string }> = {
  morning: { start: "060000", end: "110000" },
  noon: { start: "110000", end: "150000" },
  evening: { start: "150000", end: "200000" },
  night: { start: "200000", end: "233000" },
};

function escapeIcsText(value: string | undefined) {
  if (!value) {
    return "";
  }

  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatUtcStamp(value: string | undefined) {
  const date = value ? new Date(value) : new Date();
  const iso = date.toISOString().replace(/[-:]/g, "");
  return `${iso.slice(0, 15)}Z`;
}

function formatLocalDateTime(date: string, time: string) {
  return `${date.replace(/-/g, "")}T${time}`;
}

function toIcsEvent(baseUrl: string, event: Awaited<ReturnType<typeof fetchScheduleSnapshot>>["events"][number]) {
  if (!event.date || !event.segment) {
    return null;
  }

  const times = segmentTimeRanges[event.segment];
  const mapsUrl = buildGoogleMapsSearchUrl(event.location);
  const descriptionParts = [
    event.notes?.trim(),
    `חלק ביום: ${segmentLabels[event.segment]}`,
    mapsUrl ? `מפה: ${mapsUrl}` : undefined,
    `נוצר דרך לוח הביקור: ${baseUrl}`,
  ].filter(Boolean);

  return [
    "BEGIN:VEVENT",
    `UID:${event.id}@fride-visit-schedule.vercel.app`,
    `DTSTAMP:${formatUtcStamp(event.updatedAt ?? event.createdAt)}`,
    `DTSTART;TZID=${CALENDAR_TIMEZONE}:${formatLocalDateTime(event.date, times.start)}`,
    `DTEND;TZID=${CALENDAR_TIMEZONE}:${formatLocalDateTime(event.date, times.end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `LOCATION:${escapeIcsText(event.location)}`,
    `DESCRIPTION:${escapeIcsText(descriptionParts.join("\n"))}`,
    `STATUS:CONFIRMED`,
    `URL:${baseUrl}`,
    "END:VEVENT",
  ].join("\r\n");
}

export async function GET(request: Request) {
  try {
    const snapshot = await fetchScheduleSnapshot();
    const approvedEvents = snapshot.events.filter((event) => event.status === "approved");
    const baseUrl = new URL("/", request.url).toString().replace(/\/$/, "");

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "PRODID:-//Fride Visit Schedule//Shared Calendar//EN",
      `X-WR-CALNAME:${escapeIcsText(CALENDAR_NAME)}`,
      `X-WR-CALDESC:${escapeIcsText(CALENDAR_DESCRIPTION)}`,
      `X-WR-TIMEZONE:${CALENDAR_TIMEZONE}`,
      ...approvedEvents
        .map((event) => toIcsEvent(baseUrl, event))
        .filter((event): event is string => Boolean(event)),
      "END:VCALENDAR",
      "",
    ];

    return new NextResponse(lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="fride-visit-schedule.ics"',
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build calendar feed." },
      { status: 500 },
    );
  }
}
