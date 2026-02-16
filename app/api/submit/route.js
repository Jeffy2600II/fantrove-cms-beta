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

    // -------- ตรวจ ENV ก่อน --------
    if (
      !process.env.GOOGLE_CLIENT_EMAIL ||
      !process.env.GOOGLE_PRIVATE_KEY ||
      !process.env.GOOGLE_SHEET_ID
    ) {
      return Response.json(
        { message: "Missing Google environment variables" },
        { status: 500 }
      );
    }

    // -------- Auth --------
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    const sheets = google.sheets({ version: "v4", auth });

    // -------- Append Row --------
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A:D",
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          Date.now(),               // id
          content,                  // content
          "pending",                // status
          new Date().toISOString()  // created_at
        ]]
      }
    });

    console.log("Google append success:", response.status);

    return Response.json({
      message: "Submitted successfully ✅"
    });

  } catch (err) {

    // -------- Log แบบละเอียด --------
    console.error("GOOGLE ERROR FULL:", err);

    if (err.response && err.response.data) {
      console.error("GOOGLE RESPONSE DATA:", err.response.data);
    }

    return Response.json(
      {
        message: err.message || "Server error",
        details: err.response?.data || null
      },
      { status: 500 }
    );
  }
}