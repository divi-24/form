import { saveRegistration, sendApiError } from "../lib/registration.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    return await saveRegistration(request, response);
  } catch (saveError) {
    return sendApiError(saveError, response);
  }
}
