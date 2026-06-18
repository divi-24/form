import "dotenv/config";
import { MongoClient } from "mongodb";

const dbName = process.env.MONGODB_DB || "hackfluence2026";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedTracks = new Set(["engineering", "b-school"]);
const allowedThemes = new Set([
  "ai-for-creator-tools",
  "creator-economy",
  "digital-marketing",
  "social-commerce",
  "brand-creator-collaboration",
  "creator-growth-monetization",
  "influencer-discovery-campaign-management",
  "creator-brand-challenges",
]);
const mentorSlots = [
  {
    id: "19-afternoon",
    label: "19 June Afternoon",
    time: "1:00 PM - 3:30 PM",
    minutes: 150,
  },
  {
    id: "19-evening",
    label: "19 June Evening",
    time: "5:00 PM - 10:00 PM",
    minutes: 300,
  },
  {
    id: "20-morning",
    label: "20 June Morning",
    time: "10:00 AM - 1:00 PM",
    minutes: 180,
  },
  {
    id: "20-afternoon",
    label: "20 June Afternoon",
    time: "3:00 PM - 6:00 PM",
    minutes: 180,
  },
  {
    id: "20-evening",
    label: "20 June Evening",
    time: "7:00 PM - 11:00 PM",
    minutes: 240,
  },
].map((slot) => ({
  ...slot,
  capacity: Math.floor(slot.minutes / 6),
}));
const allowedMentorSlots = new Set(mentorSlots.map((slot) => slot.id));

let databasePromise;

function getDatabase() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required.");
  }

  if (!databasePromise) {
    const client = new MongoClient(process.env.MONGODB_URI);
    databasePromise = client.connect().then(async () => {
      const db = client.db(dbName);
      const registrations = db.collection("registrations");
      await Promise.all([
        registrations.createIndex({ teamName: 1 }),
        registrations.createIndex({ projectName: 1 }),
        registrations.createIndex({ track: 1, theme: 1 }),
        registrations.createIndex({ mentorSlot: 1 }),
        registrations.createIndex({ "members.email": 1 }),
        registrations.createIndex({ "members.linkedinPostUrl": 1 }),
        registrations.createIndex({ submittedAt: -1 }),
      ]);
      return db;
    });
  }

  return databasePromise;
}

async function getSlotAvailability(db) {
  const registrations = db.collection("registrations");
  const slotCounts = await registrations
    .aggregate([
      { $match: { mentorSlot: { $in: mentorSlots.map((slot) => slot.id) } } },
      { $group: { _id: "$mentorSlot", taken: { $sum: 1 } } },
    ])
    .toArray();
  const takenBySlot = new Map(slotCounts.map((slot) => [slot._id, slot.taken]));

  return mentorSlots.map((slot) => {
    const taken = takenBySlot.get(slot.id) || 0;
    const remaining = Math.max(0, slot.capacity - taken);

    return {
      ...slot,
      taken,
      remaining,
      full: remaining === 0,
    };
  });
}

export async function getRegistrationAvailability(_request, response) {
  const db = await getDatabase();

  return response.status(200).json({
    pitchMinutes: 6,
    slots: await getSlotAvailability(db),
  });
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getRequestBody(request) {
  if (typeof request.body !== "string") return request.body || {};

  try {
    return JSON.parse(request.body);
  } catch {
    return {};
  }
}

function parseLinkedinPostUrl(value) {
  const rawUrl = cleanText(value);

  try {
    const url = new URL(rawUrl);
    url.hash = "";

    const hostname = url.hostname.toLowerCase();
    const isLinkedinHost = hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");

    if (url.protocol !== "https:" || !isLinkedinHost) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export async function saveRegistration(request, response) {
  const body = getRequestBody(request);
  const teamName = cleanText(body.teamName);
  const projectName = cleanText(body.projectName);
  const track = cleanText(body.track);
  const theme = cleanText(body.theme);
  const mentorSlot = cleanText(body.mentorSlot);
  const teamSize = Number(body.teamSize);
  const accuracyConfirmed = body.accuracyConfirmation === "on";

  if (
    !teamName ||
    !projectName ||
    !allowedTracks.has(track) ||
    !allowedThemes.has(theme) ||
    !allowedMentorSlots.has(mentorSlot) ||
    !Number.isInteger(teamSize) ||
    teamSize < 2 ||
    teamSize > 4 ||
    !accuracyConfirmed
  ) {
    return response.status(400).json({ error: "Complete every required team, project, track, theme, mentorship slot, and confirmation field." });
  }

  const members = [];

  for (let index = 1; index <= teamSize; index += 1) {
    const name = cleanText(body[`member${index}Name`]);
    const email = cleanText(body[`member${index}Email`]).toLowerCase();
    const linkedinPostUrl = parseLinkedinPostUrl(body[`member${index}LinkedinPostUrl`]);

    if (!name || !emailPattern.test(email) || !linkedinPostUrl) {
      return response.status(400).json({
        error: `Complete member ${index} with a valid name, email, and LinkedIn post URL.`,
      });
    }

    members.push({
      role: index === 1 ? "leader" : "member",
      name,
      email,
      linkedinPostUrl,
    });
  }

  const db = await getDatabase();
  const registrations = db.collection("registrations");
  const selectedSlot = mentorSlots.find((slot) => slot.id === mentorSlot);
  const bookedInSlot = await registrations.countDocuments({ mentorSlot });

  if (bookedInSlot >= selectedSlot.capacity) {
    return response.status(400).json({ error: "This mentorship slot is full. Please choose another slot." });
  }

  const result = await registrations.insertOne({
    teamName,
    projectName,
    track,
    theme,
    mentorSlot,
    mentorSlotLabel: `${selectedSlot.label}, ${selectedSlot.time}`,
    teamSize,
    members,
    accuracyConfirmed: true,
    submittedAt: new Date(),
  });

  return response.status(201).json({ id: result.insertedId, message: "Registration saved." });
}

export function sendApiError(error, response) {
  console.error(error);

  if (error?.code === 11000) {
    return response.status(400).json({ error: "This response conflicts with an existing registration." });
  }

  return response.status(500).json({ error: "Could not save the registration. Please try again." });
}
