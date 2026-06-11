import { saveRegistration, sendApiError, upload } from "../lib/registration.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  return new Promise((resolve) => {
    upload.any()(request, response, async (error) => {
      if (error) {
        sendApiError(error, response);
        return resolve();
      }

      try {
        await saveRegistration(request, response);
      } catch (saveError) {
        sendApiError(saveError, response);
      }

      resolve();
    });
  });
}
