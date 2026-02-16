import { getSheetsClient } from "../../../lib/google";

export async function POST(req) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }
    
    const sheets = getSheetsClient();
    
    // -------- 1. ดึงข้อมูลทั้งหมด (อ่านกว้างเพื่อจับ header หรือข้อมูล) --------
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A:Z"
    });
    
    const rows = response.data.values || [];
    if (rows.length === 0) {
      return Response.json({ message: "No data to sync" });
    }
    
    const firstRow = rows[0] || [];
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
    
    const approved = [];
    const remaining = header ? [firstRow] : [];
    
    dataRows.forEach((row) => {
      const statusVal = (row[statusIdx] || "").toString().toLowerCase().trim();
      if (statusVal === "approved") {
        approved.push({
          id: row[idIdx] || "",
          content: row[contentIdx] || "",
          created_at: row[createdIdx] || ""
        });
      } else {
        remaining.push(row);
      }
    });
    
    if (approved.length === 0) {
      return Response.json({ message: "No approved items" });
    }
    
    // -------- 2. ส่งไป GitHub Writer --------
    const githubRes = await fetch(
      `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/data.json`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`
        }
      }
    );
    
    const githubFile = await githubRes.json();
    
    if (!githubFile.sha) {
      return Response.json({ message: "Could not read GitHub file" }, { status: 400 });
    }
    
    const newContent = Buffer.from(
      JSON.stringify(approved, null, 2)
    ).toString("base64");
    
    await fetch(
      `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/data.json`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: `Sync approved items (${new Date().toISOString()})`,
          content: newContent,
          sha: githubFile.sha,
          branch: process.env.GITHUB_BRANCH
        })
      }
    );
    
    // -------- 3. ล้าง approved ออกจาก Sheet (เขียน remaining กลับ) --------
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A:Z",
      valueInputOption: "RAW",
      requestBody: {
        values: remaining
      }
    });
    
    return Response.json({
      message: `Synced ${approved.length} items 🚀`
    });
    
  } catch (err) {
    console.error("SYNC ERROR:", err);
    return Response.json({ message: "Sync failed" }, { status: 500 });
  }
}