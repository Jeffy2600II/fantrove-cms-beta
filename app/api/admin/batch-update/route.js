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

    let statusColIndex = 2; // default -> C
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

    const statusColLetter = columnToLetter(statusColIndex);

    // แยก edits เป็น updates (set status) และ deletes (row removals)
    const updates = []; // for values.batchUpdate
    const deletes = []; // for spreadsheets.batchUpdate deleteDimension requests
    for (const e of edits) {
      const row = Number(e.rowIndex);
      const newStatus = (e.newStatus || "").toString();
      if (newStatus === "") {
        // mark for delete
        deletes.push(row);
      } else {
        // update status cell
        updates.push({
          range: `Sheet1!${statusColLetter}${row}`,
          values: [[newStatus]]
        });
      }
    }

    // 1) Perform updates (change status values) first
    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        requestBody: {
          valueInputOption: "RAW",
          data: updates
        }
      });
    }

    // 2) Perform deletes: need sheetId and descending order
    if (deletes.length > 0) {
      // get spreadsheet metadata to find sheetId for "Sheet1"
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        fields: "sheets.properties"
      });

      const sheetsArr = meta.data.sheets || [];
      // try find sheet named "Sheet1" or use first sheet
      let sheetId = null;
      for (const s of sheetsArr) {
        if (s.properties && (s.properties.title === "Sheet1" || !sheetId)) {
          if (s.properties.title === "Sheet1") {
            sheetId = s.properties.sheetId;
            break;
          } else if (sheetId === null) {
            sheetId = s.properties.sheetId;
          }
        }
      }
      if (sheetId === null) {
        return Response.json({ message: "Could not determine sheetId for deletions" }, { status: 500 });
      }

      // sort deletes descending to avoid index shift issues
      const uniqueDeletes = Array.from(new Set(deletes.map(d => Number(d)))).filter(n => Number.isFinite(n) && n >= 1);
      uniqueDeletes.sort((a, b) => b - a);

      const requests = uniqueDeletes.map(row => {
        const startIndex = row - 1; // sheet rows are 0-based
        const endIndex = row; // exclusive
        return {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex,
              endIndex
            }
          }
        };
      });

      if (requests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: process.env.GOOGLE_SHEET_ID,
          requestBody: {
            requests
          }
        });
      }
    }

    return Response.json({ message: `Applied ${updates.length} updates and ${deletes.length} deletions` });
  } catch (err) {
    console.error("BATCH UPDATE ERROR:", err);
    return Response.json({ message: "Batch update failed" }, { status: 500 });
  }
}