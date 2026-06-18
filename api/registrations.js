import { getRegistrationAvailability, saveRegistration, sendApiError } from "../lib/registration.js";

export default async function handler(request, response) {
  if (request.method === "GET") {
    try {
      return await getRegistrationAvailability(request, response);
    } catch (availabilityError) {
      return sendApiError(availabilityError, response);
    }
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  try {
    return await saveRegistration(request, response);
  } catch (saveError) {
    return sendApiError(saveError, response);
  }
}
