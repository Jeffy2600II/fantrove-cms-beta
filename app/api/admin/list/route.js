import { google } from "googleapis";

export async function GET() {
  try {
    // ---------- AUTH ----------
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    const sheets = google.sheets({ version: "v4", auth });

    // ---------- GET ALL ROWS ----------
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A:D"
    });

    const rows = response.data.values || [];

    // ถ้าไม่มีข้อมูล หรือมีแค่ header
    if (rows.length <= 1) {
      return Response.json({ data: [] });
    }

    // ---------- MAP DATA ----------
    const data = rows.slice(1).map((row, index) => {
      const statusRaw = row[2] || "";

      return {
        rowIndex: index + 2, // row จริงใน sheet
        id: row[0] || "",
        content: row[1] || "",
        status: statusRaw.toString().trim().toLowerCase(),
        created_at: row[3] || ""
      };
    });

    // DEBUG ดูค่าจริงใน Vercel logs
    console.log("ALL ROW DATA:", data);

    // ---------- FILTER PENDING ----------
    const pending = data.filter(item => item.status === "pending");

    return Response.json({ data: pending });

  } catch (err) {
    console.error("ADMIN LIST ERROR:", err);

    return Response.json(
      {
        message: err.message || "Error loading data"
      },
      { status: 500 }
    );
  }
}