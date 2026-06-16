import { MongoClient } from "mongodb";

const dbName = process.env.MONGODB_DB || "hackfluence2026";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedDroppHosts = new Set(["ondropp.app", "www.ondropp.app"]);
const droppProfilePathPattern = /^\/profile\/[a-z0-9][a-z0-9_-]*$/i;

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
        registrations.createIndex({ "members.email": 1 }),
        registrations.createIndex(
          { "members.droppUsernameNormalized": 1 },
          {
            unique: true,
            partialFilterExpression: { "members.droppUsernameNormalized": { $exists: true } },
          },
        ),
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

function parseDroppProfileUrl(value) {
  const rawUrl = cleanText(value);

  try {
    const url = new URL(rawUrl);
    url.hash = "";

    const isAllowedHost = allowedDroppHosts.has(url.hostname.toLowerCase());
    const path = url.pathname.replace(/\/+$/, "");
    const isProfilePath = droppProfilePathPattern.test(path);

    if (url.protocol !== "https:" || !isAllowedHost || !isProfilePath) {
      return null;
    }

    const droppUsername = path.split("/").at(-1);

    return {
      droppProfileUrl: url.toString(),
      droppUsername,
      droppUsernameNormalized: droppUsername.toLowerCase(),
    };
  } catch {
    return null;
  }
}

export async function saveRegistration(request, response) {
  const body = getRequestBody(request);
  const teamName = cleanText(body.teamName);
  const teamSize = Number(body.teamSize);
  const accuracyConfirmed = body.accuracyConfirmation === "on";

  if (!teamName || !Number.isInteger(teamSize) || teamSize < 2 || teamSize > 4 || !accuracyConfirmed) {
    return response.status(400).json({ error: "Complete every required team field and confirmation." });
  }

  const members = [];
  const seenDroppUsernames = new Set();

  for (let index = 1; index <= teamSize; index += 1) {
    const name = cleanText(body[`member${index}Name`]);
    const email = cleanText(body[`member${index}Email`]).toLowerCase();
    const droppProfile = parseDroppProfileUrl(body[`member${index}DroppProfileUrl`]);
    const confirmed = body[`member${index}DroppConfirmation`] === "on";

    if (!name || !emailPattern.test(email) || !droppProfile || !confirmed) {
      return response.status(400).json({
        error: `Complete member ${index} with a valid Dropp profile URL and checkpoint.`,
      });
    }

    if (seenDroppUsernames.has(droppProfile.droppUsernameNormalized)) {
      return response.status(400).json({
        error: "Each team member must use a unique Dropp username.",
      });
    }
    seenDroppUsernames.add(droppProfile.droppUsernameNormalized);

    members.push({
      role: index === 1 ? "leader" : "member",
      name,
      email,
      ...droppProfile,
      droppConfirmed: true,
    });
  }

  const db = await getDatabase();
  const registrations = db.collection("registrations");
  const existingDroppProfile = await registrations.findOne(
    { "members.droppUsernameNormalized": { $in: [...seenDroppUsernames] } },
    { projection: { _id: 1 } },
  );

  if (existingDroppProfile) {
    return response.status(400).json({ error: "One of these Dropp usernames is already registered." });
  }

  const result = await registrations.insertOne({
    teamName,
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
    return response.status(400).json({ error: "One of these Dropp usernames is already registered." });
  }

  return response.status(500).json({ error: "Could not save the registration. Please try again." });
}
