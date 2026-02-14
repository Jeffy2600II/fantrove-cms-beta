import { useState } from "react";

export default function Home() {
  const [content, setContent] = useState("");
  
  const handleSubmit = async () => {
    const res = await fetch("/api/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });
    
    const data = await res.json();
    alert(data.message);
  };
  
  return (
    <div style={{ padding: 40 }}>
      <h1>GitHub JSON Editor</h1>

      <textarea
        rows="15"
        cols="60"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      <br />
      <button onClick={handleSubmit}>Update GitHub</button>
    </div>
  );
}