import { getSheetsClient } from "../../../../lib/google";

export async function POST(req) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { edits } = await req.json();
    if (!Array.isArray(edits) || edits.length === 0) {
      return Response.json({ message: "No edits provided" }, { status: 400 });
    }

    const sheets = getSheetsClient();

    // อ่าน header แถวแรก เพื่อตรวจหาตำแหน่งคอลัมน์ "status"
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A1:Z1"
    });

    const header = (headerRes.data.values && headerRes.data.values[0]) || [];
    const headerLower = header.map(h => (h || "").toString().toLowerCase().trim());

    // หา index ของคอลัมน์ status ถ้าไม่พบให้ default เป็น index 2 (คอลัมน์ C)
    let statusColIndex = 2;
    const found = headerLower.findIndex(h => h === "status" || h.includes("status"));
    if (found !== -1) statusColIndex = found;

    // แปลง index เป็นตัวอักษรคอลัมน์ (0 -> A)
    const columnToLetter = (index) => {
      let num = index + 1;
      let letter = "";
      while (num > 0) {
        const mod = (num - 1) % 26;
        letter = String.fromCharCode(65 + mod) + letter;
        num = Math.floor((num - 1) / 26);
      }
      return letter;
    };

    const colLetter = columnToLetter(statusColIndex);

    // สร้าง payload สำหรับ batch update
    const data = edits.map(e => {
      const row = Number(e.rowIndex);
      const status = (e.status || "").toString();
      return {
        range: `Sheet1!${colLetter}${row}`,
        values: [[status]]
      };
    });

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      requestBody: {
        valueInputOption: "RAW",
        data
      }
    });

    return Response.json({ message: `Updated ${edits.length} rows` });
  } catch (err) {
    console.error("BATCH UPDATE ERROR:", err);
    return Response.json({ message: "Batch update failed" }, { status: 500 });
  }
}