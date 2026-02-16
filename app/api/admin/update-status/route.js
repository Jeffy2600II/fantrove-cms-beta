import { getSheetsClient } from "../../../../lib/google";

function normalizeHeaderCell(v) {
  return (v === undefined || v === null) ? "" : String(v).toLowerCase().trim();
}

function colIndexToLetter(index) {
  // 0 -> A, 25 -> Z, 26 -> AA ...
  let s = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export async function POST(req) {
  try {
    const { rowIndex, status } = await req.json();

    if (!rowIndex || !status) {
      return Response.json(
        { message: "Missing data" },
        { status: 400 }
      );
    }

    const sheets = getSheetsClient();

    // อ่าน header เพื่อหา column ของ status แบบ dynamic
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!1:1"
    });
    const headerRow = (headerRes.data.values && headerRes.data.values[0]) || [];
    const header = headerRow.map(normalizeHeaderCell);
    const statusIdx = header.indexOf("status") >= 0 ? header.indexOf("status") : 2; // default C (index 2)

    const colLetter = colIndexToLetter(statusIdx);
    const range = `Sheet1!${colLetter}${rowIndex}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range,
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