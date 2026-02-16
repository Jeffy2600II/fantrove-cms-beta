import { getSheetsClient } from "../../../../lib/google";

function normalizeHeaderCell(v) {
  return (v === undefined || v === null) ? "" : String(v).toLowerCase().trim();
}

export async function GET() {
  try {
    const sheets = getSheetsClient();

    // อ่านช่วงกว้างเพื่อให้ครอบคลุมกรณีคอลัมน์เคยถูกเขียนเริ่มที่ C หรืออื่น ๆ
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A:Z"
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return Response.json([]);
    }

    const headerOriginal = rows[0];
    const header = headerOriginal.map(normalizeHeaderCell);

    const findIdx = (names, fallback) => {
      for (const n of names) {
        const i = header.indexOf(n);
        if (i >= 0) return i;
      }
      return fallback;
    };

    const idIdx = findIdx(["id"], 0);
    const contentIdx = findIdx(["content", "text", "body"], 1);
    const statusIdx = findIdx(["status"], 2);
    const createdAtIdx = findIdx(["created_at", "created at", "created"], 3);

    const data = rows.slice(1).map((row, index) => ({
      rowIndex: index + 2, // แถวใน sheet (header คือ 1)
      id: row[idIdx] || "",
      content: row[contentIdx] || "",
      status: (row[statusIdx] || "").toString(),
      created_at: row[createdAtIdx] || ""
    }));

    const pending = data.filter(item =>
      (item.status || "").toLowerCase().trim() === "pending"
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