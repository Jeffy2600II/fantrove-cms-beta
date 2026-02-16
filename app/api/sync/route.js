import { google } from "googleapis";

export async function POST(req) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }
    
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/spreadsheets"]
    );
    
    const sheets = google.sheets({ version: "v4", auth });
    
    // -------- 1. ดึงข้อมูลทั้งหมด --------
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A:D"
    });
    
    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return Response.json({ message: "No data to sync" });
    }
    
    const header = rows[0];
    const dataRows = rows.slice(1);
    
    const approved = [];
    const remaining = [header];
    
    dataRows.forEach(row => {
      if (row[2] === "approved") {
        approved.push({
          id: row[0],
          content: row[1],
          created_at: row[3]
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
    
    // -------- 3. ล้าง approved ออกจาก Sheet --------
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A:D",
      valueInputOption: "RAW",
      requestBody: {
        values: remaining
      }
    });
    
    return Response.json({
      message: `Synced ${approved.length} items 🚀`
    });
    
  } catch (err) {
    return Response.json({ message: "Sync failed" }, { status: 500 });
  }
}