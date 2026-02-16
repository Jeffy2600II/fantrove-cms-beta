import { getSheetsClient } from "../../../../lib/google";

export async function POST(req) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { rowIndex, status } = await req.json();

    if (!rowIndex || !status) {
      return Response.json({ message: "Missing data" }, { status: 400 });
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

    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `Sheet1!${colLetter}${rowIndex}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[status]]
      }
    });

    return Response.json({ message: "Status updated" });
  } catch (err) {
    console.error("UPDATE STATUS ERROR:", err);
    return Response.json({ message: "Update failed" }, { status: 500 });
  }
}