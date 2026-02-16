import { getSheetsClient } from "../../../../lib/google";

export async function GET(req) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }
    
    const sheets = getSheetsClient();
    
    // อ่านช่วงกว้างให้จับได้ทุกคอลัมน์
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A:Z"
    });
    
    const rows = response.data.values || [];
    if (rows.length === 0) {
      return Response.json([]);
    }
    
    const firstRow = rows[0] || [];
    
    // ตรวจว่าแถวแรกเป็น header หรือไม่ (มีคำว่า id/content/status/created_at อยู่)
    const headerLooksLikeHeader = firstRow.some(cell =>
      typeof cell === "string" && /id|content|status|created_at/i.test(cell)
    );
    
    let header = null;
    let dataRows = [];
    
    if (headerLooksLikeHeader) {
      header = firstRow.map(h => (h || "").toString().toLowerCase().trim());
      dataRows = rows.slice(1);
    } else {
      dataRows = rows;
    }
    
    const getIndex = (name) => {
      if (header) {
        const exact = header.findIndex(h => h === name);
        if (exact !== -1) return exact;
        const fuzzy = header.findIndex(h => h.includes(name));
        if (fuzzy !== -1) return fuzzy;
      }
      const defaults = { id: 0, content: 1, status: 2, created_at: 3 };
      return defaults[name];
    };
    
    const idIdx = getIndex("id");
    const contentIdx = getIndex("content");
    const statusIdx = getIndex("status");
    const createdIdx = getIndex("created_at");
    
    const data = dataRows.map((row, i) => {
      const sheetRowIndex = header ? i + 2 : i + 1;
      return {
        rowIndex: sheetRowIndex,
        id: row[idIdx] || "",
        content: row[contentIdx] || "",
        status: (row[statusIdx] || "").toString(),
        created_at: row[createdIdx] || ""
      };
    });
    
    const pending = data.filter(item =>
      item.status.toLowerCase().trim() === "pending"
    );
    
    return Response.json(pending);
  } catch (err) {
    console.error("ADMIN LIST ERROR:", err);
    return Response.json({ message: "Error loading data" }, { status: 500 });
  }
}