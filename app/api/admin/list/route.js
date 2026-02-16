import { google } from "googleapis";

export async function GET() {
  try {
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A:D"
    });

    const rows = response.data.values || [];

    if (rows.length <= 1) {
      return Response.json([]);
    }

    const header = rows[0];

    const data = rows.slice(1).map((row, index) => ({
      rowIndex: index + 2, // เพราะแถว 1 คือ header
      id: row[0] || "",
      content: row[1] || "",
      status: (row[2] || "").toString(),
      created_at: row[3] || ""
    }));

    // 🔥 filter แบบกัน space / case mismatch
    const pending = data.filter(item =>
      item.status.toLowerCase().trim() === "pending"
    );

    return Response.json(pending);

  } catch (err) {
    console.error("ADMIN LIST ERROR:", err);
    return Response.json(
      { message: "Error loading data" },
      { status: 500 }
    );
  }
}