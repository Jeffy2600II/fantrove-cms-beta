"use client";
import { useState } from "react";

export default function SubmitPage() {
  const [content, setContent] = useState("");
  const [msg, setMsg] = useState("");
  
  const handleSubmit = async () => {
    setMsg("Submitting...");
    
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });
    
    const data = await res.json();
    setMsg(data.message);
    setContent("");
  };
  
  return (
    <div style={{ padding: 40 }}>
      <h1>Submit Content</h1>

      <textarea
        rows="10"
        cols="60"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="ใส่เนื้อหาที่ต้องการส่ง"
      />

      <br /><br />
      <button onClick={handleSubmit}>Submit</button>

      <p>{msg}</p>
    </div>
  );
}