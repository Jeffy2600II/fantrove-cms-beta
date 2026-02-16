import { google } from "googleapis";

export async function POST(req) {
  try {
    const { content } = await req.json();

    if (!content) {
      return Response.json(
        { message: "No content provided" },
        { status: 400 }
      );
    }

    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    const sheets = google.sheets({ version: "v4", auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A:D",
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          Date.now(),      // id
          content,         // content
          "pending",       // status
          new Date().toISOString() // created_at
        ]]
      }
    });

    return Response.json({ message: "Submitted successfully ✅" });

  } catch (err) {
    return Response.json(
      { message: "Server error" },
      { status: 500 }
    );
  }
}