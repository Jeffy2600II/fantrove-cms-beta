"use client";
import { useEffect, useState } from "react";

export default function AdminPage() {
  const [items, setItems] = useState([]);
  
  const loadData = async () => {
    const res = await fetch("/api/admin/list");
    const data = await res.json();
    setItems(data);
  };
  
  const updateStatus = async (rowIndex, status) => {
    await fetch("/api/admin/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rowIndex, status })
    });
    
    loadData();
  };
  
  useEffect(() => {
    loadData();
  }, []);
  
  return (
    <div style={{ padding: 40 }}>
      <h1>Admin Review</h1>

      {items.length === 0 && <p>No pending items</p>}

      {items.map(item => (
        <div key={item.id} style={{
          border: "1px solid #ccc",
          padding: 10,
          marginBottom: 10
        }}>
          <p>{item.content}</p>

          <button
            onClick={() => updateStatus(item.rowIndex, "approved")}
          >
            Approve
          </button>

          <button
            onClick={() => updateStatus(item.rowIndex, "rejected")}
            style={{ marginLeft: 10 }}
          >
            Reject
          </button>
        </div>
      ))}
    </div>
  );
}