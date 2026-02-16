import { google } from "googleapis";

export async function POST(req) {
  try {
    const { rowIndex, status } = await req.json();

    if (!rowIndex || !status) {
      return Response.json(
        { message: "Missing data" },
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

    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `Sheet1!C${rowIndex}`, // column C = status
      valueInputOption: "RAW",
      requestBody: {
        values: [[status]]
      }
    });

    return Response.json({ message: "Updated" });

  } catch (err) {
    console.error(err);
    return Response.json(
      { message: "Update failed" },
      { status: 500 }
    );
  }
}