"use client";
import { useEffect, useState } from "react";

export default function AdminPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  
  const ADMIN_SECRET = "YOUR_ADMIN_SECRET"; // ใส่ให้ตรงกับ ENV
  
  // โหลดรายการ pending
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/list");
      const data = await res.json();
      setItems(data);
    } catch {
      setMessage("Error loading data");
    }
    setLoading(false);
  };
  
  // อัปเดตสถานะ (approve / reject)
  const updateStatus = async (rowIndex, status) => {
    setLoading(true);
    try {
      await fetch("/api/admin/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ rowIndex, status })
      });
      
      setMessage(`Marked as ${status}`);
      await loadData();
    } catch {
      setMessage("Update failed");
    }
    setLoading(false);
  };
  
  // Sync approved ไป GitHub
  const syncData = async () => {
    setLoading(true);
    setMessage("Syncing...");
    
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ADMIN_SECRET}`
        }
      });
      
      const data = await res.json();
      setMessage(data.message);
      await loadData();
    } catch {
      setMessage("Sync failed");
    }
    
    setLoading(false);
  };
  
  useEffect(() => {
    loadData();
  }, []);
  
  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Admin Review Panel</h1>

      <button
        onClick={syncData}
        disabled={loading}
        style={{
          marginBottom: 20,
          padding: "8px 16px",
          cursor: "pointer"
        }}
      >
        Sync Approved to GitHub
      </button>

      {loading && <p>Loading...</p>}
      {message && <p>{message}</p>}

      {items.length === 0 && !loading && (
        <p>No pending items</p>
      )}

      {items.map((item) => (
        <div
          key={item.id}
          style={{
            border: "1px solid #ccc",
            padding: 15,
            marginBottom: 15,
            borderRadius: 6
          }}
        >
          <p><strong>ID:</strong> {item.id}</p>
          <p><strong>Content:</strong> {item.content}</p>
          <p><small>{item.created_at}</small></p>

          <div style={{ marginTop: 10 }}>
            <button
              onClick={() =>
                updateStatus(item.rowIndex, "approved")
              }
              disabled={loading}
              style={{
                marginRight: 10,
                padding: "6px 12px",
                cursor: "pointer"
              }}
            >
              Approve
            </button>

            <button
              onClick={() =>
                updateStatus(item.rowIndex, "rejected")
              }
              disabled={loading}
              style={{
                padding: "6px 12px",
                cursor: "pointer"
              }}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}