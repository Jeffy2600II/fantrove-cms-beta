import { getSheetsClient } from "../../../lib/google";

function normalizeHeaderCell(v) {
  return (v === undefined || v === null) ? "" : String(v).toLowerCase().trim();
}
function colIndexToLetter(index) {
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
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }

    const sheets = getSheetsClient();

    // ดึงข้อมูลช่วงกว้างให้ครอบคลุมคอลัมน์เพิ่มเติม (ถ้ามี)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A:Z"
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return Response.json({ message: "No data to sync" });
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

    const dataRows = rows.slice(1);

    const approved = [];
    const remaining = [headerOriginal];

    dataRows.forEach(row => {
      const cellStatus = (row[statusIdx] || "").toString().toLowerCase().trim();
      if (cellStatus === "approved") {
        approved.push({
          id: row[idIdx] || "",
          content: row[contentIdx] || "",
          created_at: row[createdAtIdx] || ""
        });
      } else {
        // เก็บแถวเดิมทั้งหมด (ไม่ปรับ column order) — เพื่อไม่ให้ข้อมูลหาย
        remaining.push(row);
      }
    });

    if (approved.length === 0) {
      return Response.json({ message: "No approved items" });
    }

    // ---------- ส่งไป GitHub ----------
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

    // -------- ล้าง approved ออกจาก Sheet (เขียนแถว remaining กลับ) --------
    // เราอ่าน A:Z ดังนั้นจะเขียนกลับด้วยช่วง A:Z เพื่อครอบคลุมคอลัมน์ทั้งหมดที่มีอยู่
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