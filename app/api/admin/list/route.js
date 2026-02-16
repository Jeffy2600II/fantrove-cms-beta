import { getGoogleSheets } from "@/lib/google";

export async function GET() {
  try {
    const sheets = getGoogleSheets();
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!C2:F1000" // จำกัดช่วงไว้ก่อน
    });
    
    const rows = response.data.values || [];
    
    const data = rows.map((row, index) => ({
      rowIndex: index + 2,
      id: row[0],
      content: row[1],
      status: row[2],
      created_at: row[3]
    }));
    
    return Response.json(
      data.filter(item => item.status === "pending")
    );
    
  } catch {
    return Response.json({ message: "Error" }, { status: 500 });
  }
}