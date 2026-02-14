export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }
  
  try {
    const { content } = req.body;
    
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH;
    const token = process.env.GITHUB_TOKEN;
    
    const path = "data.json"; // ไฟล์ที่ต้องการแก้
    
    // 1. ดึงไฟล์เดิมเพื่อเอา sha
    const getFile = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    
    const fileData = await getFile.json();
    
    if (!fileData.sha) {
      return res.status(400).json({ message: "File not found" });
    }
    
    // 2. แปลง content เป็น base64
    const encodedContent = Buffer.from(content).toString("base64");
    
    // 3. PUT อัปเดตไฟล์
    const updateFile = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Update data.json from Vercel",
          content: encodedContent,
          sha: fileData.sha,
          branch: branch,
        }),
      }
    );
    
    const updateData = await updateFile.json();
    
    if (updateData.commit) {
      return res.status(200).json({ message: "Updated successfully 🚀" });
    } else {
      return res.status(500).json({ message: "Update failed" });
    }
    
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
}