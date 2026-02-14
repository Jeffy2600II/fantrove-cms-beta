"use client";
import { useState } from "react";

export default function Home() {
  const [content, setContent] = useState("");
  const [msg, setMsg] = useState("");
  
  const handleSubmit = async () => {
    setMsg("Updating...");
    
    const res = await fetch("/api/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer YOUR_ADMIN_SECRET"
      },
      body: JSON.stringify({ content })
    });
    
    const data = await res.json();
    setMsg(data.message);
  };
  
  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>GitHub JSON Editor</h1>

      <textarea
        rows="18"
        cols="70"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder='{"hello": "world"}'
      />

      <br /><br />
      <button onClick={handleSubmit}>Update GitHub</button>

      <p>{msg}</p>
    </div>
  );
}