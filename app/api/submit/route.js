import { getGoogleSheets } from "@/lib/google";

export async function POST(req) {
  try {
    const { content } = await req.json();
    if (!content) {
      return Response.json({ message: "No content" }, { status: 400 });
    }

    const sheets = getGoogleSheets();

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!C:F",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[
          Date.now(),
          content,
          "pending",
          new Date().toISOString()
        ]]
      }
    });

    return Response.json({ message: "Submitted ✅" });

  } catch {
    return Response.json({ message: "Server error" }, { status: 500 });
  }
}