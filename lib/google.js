import { google } from "googleapis";

let sheetsInstance = null;

export function getGoogleSheets() {
  if (sheetsInstance) return sheetsInstance;
  
  const auth = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/spreadsheets"]
  );
  
  sheetsInstance = google.sheets({ version: "v4", auth });
  return sheetsInstance;
}