export async function POST(req) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }
    return Response.json({ message: "OK" });
  } catch (err) {
    console.error("VERIFY ERROR:", err);
    return Response.json({ message: "Server error" }, { status: 500 });
  }
}