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
        registrations.createIndex({ "members.email": 1 }),
        registrations.createIndex({ "members.linkedinPostUrl": 1 }),
        registrations.createIndex({ submittedAt: -1 }),
      ]);
      return db;
    });
  }

  return databasePromise;
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
  const teamSize = Number(body.teamSize);
  const accuracyConfirmed = body.accuracyConfirmation === "on";

  if (
    !teamName ||
    !projectName ||
    !allowedTracks.has(track) ||
    !allowedThemes.has(theme) ||
    !Number.isInteger(teamSize) ||
    teamSize < 2 ||
    teamSize > 4 ||
    !accuracyConfirmed
  ) {
    return response.status(400).json({ error: "Complete every required team, project, track, theme, and confirmation field." });
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
  const result = await registrations.insertOne({
    teamName,
    projectName,
    track,
    theme,
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
