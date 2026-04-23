export type PersonId = "gilad" | "yaara" | "kids";

export type SegmentId = "morning" | "noon" | "evening" | "night";
export type EventComment = {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
};

export type EventPhoto = {
  id: string;
  url: string;
  caption?: string;
  addedByName?: string;
  createdAt: string;
};

export type Person = {
  id: PersonId;
  name: string;
  shortName: string;
  personEmoji: string;
  colorClass: string;
  chipClass: string;
};

export type TripEvent = {
  id: string;
  title: string;
  emoji?: string;
  date: string;
  segment: SegmentId;
  attendees: PersonId[];
  location: string;
  placeUrl?: string;
  notes?: string;
  photos?: EventPhoto[];
  comments?: EventComment[];
  status: "approved" | "pending" | "rejected";
  createdByRole: "admin" | "guest";
  suggestedByName?: string;
  suggestedByPerson?: PersonId;
  requestType?: "new" | "change" | "remove";
  targetEventId?: string;
  viewerKey?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CalendarDay = {
  date: string;
  dayName: string;
  dayNumber: string;
  monthLabel: string;
  inTripRange: boolean;
  isToday: boolean;
};

export type CalendarWeek = {
  id: string;
  label: string;
  days: CalendarDay[];
};

export const tripWindow = {
  start: "2026-06-03",
  end: "2026-06-24",
};

export const people: Person[] = [
  {
    id: "gilad",
    name: "גלעד",
    shortName: "ג",
    personEmoji: "👨",
    colorClass: "bg-teal-500",
    chipClass: "bg-teal-100 text-teal-950 border-teal-200",
  },
  {
    id: "yaara",
    name: "יערה",
    shortName: "י",
    personEmoji: "👩",
    colorClass: "bg-amber-400",
    chipClass: "bg-amber-100 text-amber-950 border-amber-200",
  },
  {
    id: "kids",
    name: "ילדים",
    shortName: "י",
    personEmoji: "🧒",
    colorClass: "bg-sky-500",
    chipClass: "bg-sky-100 text-sky-950 border-sky-200",
  },
];

export const segmentLabels: Record<SegmentId, string> = {
  morning: "בוקר",
  noon: "צהריים",
  evening: "ערב",
  night: "לילה",
};

export const segmentTimes: Record<SegmentId, string> = {
  morning: "06:00-11:00",
  noon: "11:00-15:00",
  evening: "15:00-20:00",
  night: "20:00-23:30",
};

export const eventEmojiOptions = [
  "🎉",
  "🍽️",
  "✈️",
  "🏖️",
  "🏠",
  "🚗",
  "👨‍👩‍👧‍👦",
  "🧳",
  "🎈",
  "☕",
  "🏞️",
  "🎭",
] as const;

export const hebrewWeekdays = [
  "יום ראשון",
  "יום שני",
  "יום שלישי",
  "יום רביעי",
  "יום חמישי",
  "יום שישי",
  "שבת",
] as const;

export const demoEvents: TripEvent[] = [
  {
    id: "aus-jfk-outbound",
    title: "טיסה מאוסטין לניו יורק",
    emoji: "✈️",
    date: "2026-06-03",
    segment: "morning",
    attendees: ["gilad", "yaara", "kids"],
    location: "AUS → JFK",
    notes: "El Al LY 4162 (מופעלת על ידי Delta). המראה מאוסטין ב-07:30, נחיתה בניו יורק ב-12:19.",
    status: "approved",
    createdByRole: "admin",
  },
  {
    id: "jfk-tlv-outbound",
    title: "טיסה מניו יורק לתל אביב",
    emoji: "✈️",
    date: "2026-06-03",
    segment: "evening",
    attendees: ["gilad", "yaara", "kids"],
    location: "JFK → TLV",
    notes: "El Al LY 2. המראה מניו יורק ב-17:30, נחיתה בתל אביב ב-10:50 למחרת.",
    status: "approved",
    createdByRole: "admin",
  },
  {
    id: "tlv-jfk-return",
    title: "טיסה מתל אביב לניו יורק",
    emoji: "✈️",
    date: "2026-06-24",
    segment: "night",
    attendees: ["gilad", "yaara", "kids"],
    location: "TLV → JFK",
    notes: "El Al LY 3. המראה מתל אביב ב-00:05, נחיתה בניו יורק ב-04:55.",
    status: "approved",
    createdByRole: "admin",
  },
  {
    id: "jfk-aus-return",
    title: "טיסה מניו יורק לאוסטין",
    emoji: "✈️",
    date: "2026-06-24",
    segment: "noon",
    attendees: ["gilad", "yaara", "kids"],
    location: "JFK → AUS",
    notes: "El Al LY 4165 (מופעלת על ידי Delta). המראה מניו יורק ב-11:10, נחיתה באוסטין ב-14:10.",
    status: "approved",
    createdByRole: "admin",
  },
];

const oneDay = 24 * 60 * 60 * 1000;

function createMiddayDate(date: string) {
  return new Date(`${date}T12:00:00`);
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getWeekStart(date: Date) {
  const result = new Date(date);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function getWeekEnd(date: Date) {
  const result = new Date(date);
  result.setDate(result.getDate() + (6 - result.getDay()));
  return result;
}

function isSameDate(a: Date, b: Date) {
  return toIsoDate(a) === toIsoDate(b);
}

export function getPerson(personId: PersonId) {
  return people.find((person) => person.id === personId) ?? people[0];
}

export function getPrimaryPerson(event: TripEvent) {
  return getPerson(event.attendees[0] ?? "gilad");
}

export function buildCalendarWeeks(): CalendarWeek[] {
  const tripStart = createMiddayDate(tripWindow.start);
  const tripEnd = createMiddayDate(tripWindow.end);
  const start = getWeekStart(tripStart);
  const end = getWeekEnd(tripEnd);
  const today = createMiddayDate(new Date().toISOString().slice(0, 10));

  const weeks: CalendarWeek[] = [];
  let current = new Date(start);
  let weekIndex = 1;

  while (current <= end) {
    const weekDays: CalendarDay[] = [];

    for (let offset = 0; offset < 7; offset += 1) {
      const day = new Date(current.getTime() + offset * oneDay);
      const isoDate = toIsoDate(day);
      weekDays.push({
        date: isoDate,
        dayName: hebrewWeekdays[offset],
        dayNumber: day.toLocaleDateString("he-IL", { day: "numeric" }),
        monthLabel: day.toLocaleDateString("he-IL", {
          month: "long",
          year: "numeric",
        }),
        inTripRange: day >= tripStart && day <= tripEnd,
        isToday: isSameDate(day, today),
      });
    }

    weeks.push({
      id: `week-${weekIndex}`,
      label: `שבוע ${weekIndex}`,
      days: weekDays,
    });

    current = new Date(current.getTime() + 7 * oneDay);
    weekIndex += 1;
  }

  return weeks;
}
