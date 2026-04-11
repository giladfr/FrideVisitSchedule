export type PersonId =
  | "gilad"
  | "maya"
  | "yoav"
  | "noa"
  | "ella";

export type SegmentId = "morning" | "noon" | "afternoon" | "evening";

export type Person = {
  id: PersonId;
  name: string;
  color: string;
};

export type TripEvent = {
  id: string;
  title: string;
  date: string;
  segment: SegmentId;
  attendees: PersonId[];
  category: "shared" | "personal";
  location?: string;
  notes?: string;
};

export type TripDay = {
  date: string;
  dayLabel: string;
  shortDate: string;
  weekLabel: string;
  isWeekend: boolean;
};

export const tripWindow = {
  start: "2026-06-03",
  end: "2026-06-24",
};

export const people: Person[] = [
  { id: "gilad", name: "Gilad", color: "bg-teal-600" },
  { id: "maya", name: "Maya", color: "bg-amber-500" },
  { id: "yoav", name: "Yoav", color: "bg-sky-500" },
  { id: "noa", name: "Noa", color: "bg-rose-500" },
  { id: "ella", name: "Ella", color: "bg-violet-500" },
];

export const segmentLabels: Record<SegmentId, string> = {
  morning: "Morning",
  noon: "Noon",
  afternoon: "Afternoon",
  evening: "Evening",
};

export const demoEvents: TripEvent[] = [
  {
    id: "arrival",
    title: "Arrival and airport pickup",
    date: "2026-06-03",
    segment: "evening",
    attendees: people.map((person) => person.id),
    category: "shared",
    location: "Ben Gurion Airport",
    notes: "Landing day buffer and luggage recovery.",
  },
  {
    id: "recovery-breakfast",
    title: "Slow breakfast with family",
    date: "2026-06-04",
    segment: "morning",
    attendees: people.map((person) => person.id),
    category: "shared",
    location: "Home base",
  },
  {
    id: "gilad-work",
    title: "Work catch-up meeting",
    date: "2026-06-04",
    segment: "afternoon",
    attendees: ["gilad"],
    category: "personal",
    location: "Tel Aviv cafe",
  },
  {
    id: "park-evening",
    title: "Neighborhood park and dinner",
    date: "2026-06-05",
    segment: "evening",
    attendees: people.map((person) => person.id),
    category: "shared",
    location: "Local park",
  },
  {
    id: "shabbat-dinner",
    title: "Shabbat dinner with relatives",
    date: "2026-06-06",
    segment: "evening",
    attendees: people.map((person) => person.id),
    category: "shared",
    location: "Jerusalem",
  },
  {
    id: "gilad-coffee",
    title: "Coffee with old friend",
    date: "2026-06-08",
    segment: "morning",
    attendees: ["gilad"],
    category: "personal",
    location: "Ramat Gan",
  },
  {
    id: "beach-day",
    title: "Beach afternoon",
    date: "2026-06-09",
    segment: "afternoon",
    attendees: people.map((person) => person.id),
    category: "shared",
    location: "Herzliya beach",
  },
  {
    id: "maya-cousin",
    title: "Lunch with cousin",
    date: "2026-06-10",
    segment: "noon",
    attendees: ["maya"],
    category: "personal",
    location: "Kfar Saba",
  },
  {
    id: "museum",
    title: "Museum visit",
    date: "2026-06-12",
    segment: "morning",
    attendees: people.map((person) => person.id),
    category: "shared",
    location: "Tel Aviv Museum",
  },
  {
    id: "family-lunch",
    title: "Extended family lunch",
    date: "2026-06-14",
    segment: "noon",
    attendees: people.map((person) => person.id),
    category: "shared",
    location: "Modiin",
  },
  {
    id: "kids-playdate",
    title: "Kids playdate",
    date: "2026-06-16",
    segment: "afternoon",
    attendees: ["yoav", "noa", "ella"],
    category: "personal",
    location: "Neighbor's home",
  },
  {
    id: "gilad-business",
    title: "Business meeting",
    date: "2026-06-17",
    segment: "morning",
    attendees: ["gilad"],
    category: "personal",
    location: "Tel Aviv",
  },
  {
    id: "galilee-day",
    title: "Day trip north",
    date: "2026-06-18",
    segment: "morning",
    attendees: people.map((person) => person.id),
    category: "shared",
    location: "Galilee",
  },
  {
    id: "galilee-evening",
    title: "Dinner on the way back",
    date: "2026-06-18",
    segment: "evening",
    attendees: people.map((person) => person.id),
    category: "shared",
    location: "Haifa",
  },
  {
    id: "shabbat-two",
    title: "Second Shabbat dinner",
    date: "2026-06-20",
    segment: "evening",
    attendees: people.map((person) => person.id),
    category: "shared",
    location: "Family home",
  },
  {
    id: "packing",
    title: "Packing and goodbye rounds",
    date: "2026-06-23",
    segment: "afternoon",
    attendees: people.map((person) => person.id),
    category: "shared",
    location: "Home base",
  },
  {
    id: "departure",
    title: "Departure day",
    date: "2026-06-24",
    segment: "morning",
    attendees: people.map((person) => person.id),
    category: "shared",
    location: "Ben Gurion Airport",
  },
];

const oneDay = 24 * 60 * 60 * 1000;

export function buildTripDays(): TripDay[] {
  const start = new Date(`${tripWindow.start}T12:00:00`);
  const end = new Date(`${tripWindow.end}T12:00:00`);
  const days: TripDay[] = [];

  for (let current = start; current <= end; current = new Date(current.getTime() + oneDay)) {
    const iso = current.toISOString().slice(0, 10);
    const dayLabel = current.toLocaleDateString("en-US", { weekday: "long" });
    const shortDate = current.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    const tripDayNumber = Math.floor((current.getTime() - start.getTime()) / oneDay);
    const weekNumber = Math.floor(tripDayNumber / 7) + 1;

    days.push({
      date: iso,
      dayLabel,
      shortDate,
      weekLabel: `Week ${weekNumber}`,
      isWeekend: current.getDay() === 5 || current.getDay() === 6,
    });
  }

  return days;
}

export function getEventsForDate(date: string) {
  return demoEvents.filter((event) => event.date === date);
}
