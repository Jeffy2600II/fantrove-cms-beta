export async function POST(req) {
  try {

    // ---------- AUTH ----------
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
      return Response.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    // ---------- GET BODY ----------
    const { content } = await req.json();

    if (!content) {
      return Response.json(
        { message: "No content provided" },
        { status: 400 }
      );
    }

    // ---------- JSON VALIDATION ----------
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return Response.json(
        { message: "Invalid JSON format" },
        { status: 400 }
      );
    }

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH;
    const token = process.env.GITHUB_TOKEN;
    const path = "data.json";

    // ---------- GET SHA ----------
    const getFile = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const fileData = await getFile.json();

    if (!fileData.sha) {
      return Response.json(
        { message: "Could not read file SHA" },
        { status: 400 }
      );
    }

    // ---------- ENCODE ----------
    const encodedContent = Buffer.from(
      JSON.stringify(parsed, null, 2)
    ).toString("base64");

    // ---------- UPDATE FILE ----------
    const updateFile = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Update data.json (${new Date().toISOString()})`,
          content: encodedContent,
          sha: fileData.sha,
          branch: branch,
        }),
      }
    );

    const updateData = await updateFile.json();

    if (updateData.commit) {
      return Response.json({ message: "Updated successfully 🚀" });
    }

    return Response.json(
      { message: "GitHub rejected update" },
      { status: 500 }
    );

  } catch (err) {
    return Response.json(
      { message: "Server error" },
      { status: 500 }
    );
  }
}