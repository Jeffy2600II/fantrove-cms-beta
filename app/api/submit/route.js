import { getSheetsClient } from "../../../lib/google";

export async function POST(req) {
  try {
    const { content } = await req.json();
    if (!content) {
      return Response.json({ message: "No content" }, { status: 400 });
    }

    const sheets = getSheetsClient();

    // สร้าง id สำหรับ��ถวใหม่ (ใช้ timestamp เป็นตัวอย่าง)
    const id = Date.now().toString();

    // เขียนลงคอลัมน์ A:D => [id, content, status, created_at]
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A:D",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[
          id,
          content,
          "pending",
          new Date().toISOString()
        ]]
      }
    });

    return Response.json({ message: "Submitted ✅" });

  } catch (err) {
    console.error("SUBMIT ERROR:", err);
    return Response.json({ message: "Server error" }, { status: 500 });
  }
}