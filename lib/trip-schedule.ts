export type PersonId = "gilad" | "yaara" | "kids";

export type SegmentId = "morning" | "noon" | "evening" | "night";
export type RecurrencePattern = "none" | "daily" | "weekly";
export type RecurrenceConfig = {
  pattern: RecurrencePattern;
  until?: string;
  weekdays?: number[];
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
  notes?: string;
  status: "approved" | "pending" | "rejected";
  createdByRole: "admin" | "guest";
  suggestedByName?: string;
  suggestedByPerson?: PersonId;
  seriesId?: string;
  recurrenceLabel?: string;
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
    id: "arrival",
    title: "נחיתה ואיסוף משדה התעופה",
    emoji: "✈️",
    date: "2026-06-03",
    segment: "evening",
    attendees: ["gilad", "yaara", "kids"],
    location: "נתב\"ג",
    notes: "זמן התאוששות מהטיסה, מזוודות ונסיעה הביתה.",
    status: "approved",
    createdByRole: "admin",
  },
  {
    id: "first-breakfast",
    title: "ארוחת בוקר רגועה עם המשפחה",
    emoji: "☕",
    date: "2026-06-04",
    segment: "morning",
    attendees: ["gilad", "yaara", "kids"],
    location: "בסיס השהות",
    status: "approved",
    createdByRole: "admin",
  },
  {
    id: "gilad-meeting",
    title: "פגישת עבודה",
    emoji: "💼",
    date: "2026-06-04",
    segment: "evening",
    attendees: ["gilad"],
    location: "תל אביב",
    status: "approved",
    createdByRole: "admin",
  },
  {
    id: "yaara-family",
    title: "קפה עם המשפחה",
    emoji: "☕",
    date: "2026-06-05",
    segment: "noon",
    attendees: ["yaara"],
    location: "כפר סבא",
    status: "approved",
    createdByRole: "admin",
  },
  {
    id: "park",
    title: "פארק וארוחת ערב",
    emoji: "🌳",
    date: "2026-06-07",
    segment: "evening",
    attendees: ["gilad", "yaara", "kids"],
    location: "פארק רעננה",
    status: "approved",
    createdByRole: "admin",
  },
  {
    id: "kids-play",
    title: "מפגש משחק לילדים",
    emoji: "🎈",
    date: "2026-06-08",
    segment: "evening",
    attendees: ["kids"],
    location: "בית של חברים",
    status: "approved",
    createdByRole: "admin",
  },
  {
    id: "beach",
    title: "יום ים",
    emoji: "🏖️",
    date: "2026-06-10",
    segment: "noon",
    attendees: ["gilad", "yaara", "kids"],
    location: "חוף הרצליה",
    status: "approved",
    createdByRole: "admin",
  },
  {
    id: "dinner",
    title: "ארוחת ערב אצל קרובים",
    emoji: "🍽️",
    date: "2026-06-12",
    segment: "night",
    attendees: ["gilad", "yaara", "kids"],
    location: "ירושלים",
    status: "approved",
    createdByRole: "admin",
  },
  {
    id: "gilad-friends",
    title: "פגישה עם חבר ותיק",
    emoji: "🤝",
    date: "2026-06-14",
    segment: "morning",
    attendees: ["gilad"],
    location: "רמת גן",
    status: "approved",
    createdByRole: "admin",
  },
  {
    id: "museum",
    title: "מוזיאון",
    emoji: "🎭",
    date: "2026-06-15",
    segment: "morning",
    attendees: ["gilad", "yaara", "kids"],
    location: "מוזיאון תל אביב",
    status: "approved",
    createdByRole: "admin",
  },
  {
    id: "yaara-lunch",
    title: "צהריים עם יערה והמשפחה",
    emoji: "🍽️",
    date: "2026-06-17",
    segment: "noon",
    attendees: ["yaara"],
    location: "הוד השרון",
    status: "approved",
    createdByRole: "admin",
  },
  {
    id: "north-trip",
    title: "טיול לצפון",
    emoji: "🏞️",
    date: "2026-06-18",
    segment: "morning",
    attendees: ["gilad", "yaara", "kids"],
    location: "הגליל",
    status: "approved",
    createdByRole: "admin",
  },
  {
    id: "north-dinner",
    title: "ארוחת ערב בדרך חזרה",
    emoji: "🍽️",
    date: "2026-06-18",
    segment: "night",
    attendees: ["gilad", "yaara", "kids"],
    location: "חיפה",
    status: "approved",
    createdByRole: "admin",
  },
  {
    id: "shabbat",
    title: "ארוחת שישי",
    emoji: "🕯️",
    date: "2026-06-19",
    segment: "night",
    attendees: ["gilad", "yaara", "kids"],
    location: "בית המשפחה",
    status: "approved",
    createdByRole: "admin",
  },
  {
    id: "kids-pool",
    title: "בריכה לילדים",
    emoji: "🏊",
    date: "2026-06-22",
    segment: "evening",
    attendees: ["kids"],
    location: "קאנטרי קלאב",
    status: "approved",
    createdByRole: "admin",
  },
  {
    id: "packing",
    title: "אריזות וסידורים לפני הטיסה",
    emoji: "🧳",
    date: "2026-06-23",
    segment: "night",
    attendees: ["gilad", "yaara", "kids"],
    location: "בסיס השהות",
    status: "approved",
    createdByRole: "admin",
  },
  {
    id: "departure",
    title: "יציאה לשדה",
    emoji: "🚗",
    date: "2026-06-24",
    segment: "morning",
    attendees: ["gilad", "yaara", "kids"],
    location: "נתב\"ג",
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
