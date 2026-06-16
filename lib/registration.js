import multer from "multer";
import { GridFSBucket, MongoClient } from "mongodb";

const dbName = process.env.MONGODB_DB || "hackfluence2026";
const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
        registrations.createIndex({ submittedAt: -1 }),
      ]);
      return db;
    });
  }

  return databasePromise;
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 900 * 1024,
    files: 4,
    fields: 30,
  },
  fileFilter: (_request, file, callback) => {
    const allowed = allowedImageTypes.has(file.mimetype);
    callback(allowed ? null : new Error("Only PNG, JPG, and WEBP screenshots are allowed."), allowed);
  },
});

function uploadScreenshot(bucket, file, teamName, memberIndex) {
  return new Promise((resolve, reject) => {
    const stream = bucket.openUploadStream(file.originalname, {
      contentType: file.mimetype,
      metadata: { teamName, memberIndex },
    });

    stream.on("error", reject);
    stream.on("finish", () => resolve(stream.id));
    stream.end(file.buffer);
  });
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function saveRegistration(request, response) {
  const db = await getDatabase();
  const registrations = db.collection("registrations");
  const screenshots = new GridFSBucket(db, { bucketName: "profileScreenshots" });
  const uploadedIds = [];

  try {
    const body = request.body || {};
    const uploadedFiles = request.files || [];
    const teamName = cleanText(body.teamName);
    const teamSize = Number(body.teamSize);
    const accuracyConfirmed = body.accuracyConfirmation === "on";

    if (!teamName || !Number.isInteger(teamSize) || teamSize < 2 || teamSize > 4 || !accuracyConfirmed) {
      return response.status(400).json({ error: "Complete every required team field and confirmation." });
    }

    if (uploadedFiles.length !== teamSize) {
      return response.status(400).json({ error: `Upload exactly one screenshot for each of the ${teamSize} members.` });
    }

    const filesByField = new Map(uploadedFiles.map((file) => [file.fieldname, file]));
    const pendingMembers = [];

    for (let index = 1; index <= teamSize; index += 1) {
      const name = cleanText(body[`member${index}Name`]);
      const email = cleanText(body[`member${index}Email`]).toLowerCase();
      const confirmed = body[`member${index}DroppConfirmation`] === "on";
      const screenshot = filesByField.get(`member${index}Screenshot`);

      if (!name || !emailPattern.test(email) || !confirmed || !screenshot) {
        return response.status(400).json({ error: `Complete all required details for member ${index}.` });
      }

      pendingMembers.push({ index, name, email, screenshot });
    }

    const members = [];

    for (const { index, name, email, screenshot } of pendingMembers) {
      const screenshotId = await uploadScreenshot(screenshots, screenshot, teamName, index);
      uploadedIds.push(screenshotId);
      members.push({
        role: index === 1 ? "leader" : "member",
        name,
        email,
        droppConfirmed: true,
        screenshot: {
          fileId: screenshotId,
          filename: screenshot.originalname,
          contentType: screenshot.mimetype,
          size: screenshot.size,
        },
      });
    }

    const result = await registrations.insertOne({
      teamName,
      teamSize,
      members,
      accuracyConfirmed: true,
      submittedAt: new Date(),
    });

    return response.status(201).json({ id: result.insertedId, message: "Registration saved." });
  } catch (error) {
    await Promise.allSettled(uploadedIds.map((id) => screenshots.delete(id)));
    throw error;
  }
}

export function sendApiError(error, response) {
  console.error(error);

  if (error instanceof multer.MulterError || error.message?.includes("allowed")) {
    return response.status(400).json({ error: error.message });
  }

  return response.status(500).json({ error: "Could not save the registration. Please try again." });
}
