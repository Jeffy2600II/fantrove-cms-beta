"use client";
import { useEffect, useState } from "react";

export default function AdminPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [adminSecret, setAdminSecret] = useState(
    typeof window !== "undefined" ? localStorage.getItem("ADMIN_SECRET") || "" : ""
  );
  
  // โหลดรายการ pending
  const loadData = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/list");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Error" }));
        setMessage(err.message || "Error loading data");
        setItems([]);
      } else {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
        if (!Array.isArray(data)) {
          setMessage("Unexpected response from server");
        }
      }
    } catch (err) {
      console.error(err);
      setMessage("Error loading data");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };
  
  // อัปเดตสถานะ (approve / reject)
  const updateStatus = async (rowIndex, status) => {
    const ok = confirm(`Are you sure you want to mark this item as "${status}"?`);
    if (!ok) return;
    
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ rowIndex, status })
      });
      
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.message || "Update failed");
      } else {
        setMessage(`Marked as ${status}`);
        await loadData();
      }
    } catch (err) {
      console.error(err);
      setMessage("Update failed");
    } finally {
      setLoading(false);
    }
  };
  
  // Sync approved ไป GitHub (ต้องมี adminSecret)
  const syncData = async () => {
    if (!adminSecret) {
      setMessage("Please enter Admin Secret before syncing");
      return;
    }
    
    const ok = confirm("Sync will push approved items to GitHub and remove them from the sheet. Continue?");
    if (!ok) return;
    
    setLoading(true);
    setMessage("Syncing...");
    
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminSecret}`
        }
      });
      
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.message || "Sync failed");
      } else {
        setMessage(data.message || "Synced successfully");
        await loadData();
      }
    } catch (err) {
      console.error(err);
      setMessage("Sync failed");
    } finally {
      setLoading(false);
    }
  };
  
  // เก็บ secret ใน localStorage (ถ้าผู้ใช้ต้องการ)
  const saveSecret = () => {
    try {
      localStorage.setItem("ADMIN_SECRET", adminSecret || "");
      setMessage("Admin secret saved (local)");
    } catch {
      setMessage("Could not save secret locally");
    }
  };
  
  const clearSecret = () => {
    try {
      localStorage.removeItem("ADMIN_SECRET");
      setAdminSecret("");
      setMessage("Admin secret cleared");
    } catch {
      setMessage("Could not clear secret");
    }
  };
  
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Admin Review Panel</h1>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", marginBottom: 6 }}>
          Admin Secret (required for Sync):
        </label>
        <input
          type="password"
          value={adminSecret}
          onChange={(e) => setAdminSecret(e.target.value)}
          placeholder="Enter admin secret"
          style={{ padding: "8px 10px", width: 360 }}
        />
        <button
          onClick={saveSecret}
          disabled={loading}
          style={{ marginLeft: 10, padding: "8px 12px" }}
        >
          Save secret
        </button>
        <button
          onClick={clearSecret}
          disabled={loading}
          style={{ marginLeft: 8, padding: "8px 12px" }}
        >
          Clear
        </button>
      </div>

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

      <button
        onClick={loadData}
        disabled={loading}
        style={{
          marginLeft: 12,
          marginBottom: 20,
          padding: "8px 12px",
          cursor: "pointer"
        }}
      >
        Refresh
      </button>

      {loading && <p>Loading...</p>}
      {message && <p>{message}</p>}

      {items.length === 0 && !loading && (
        <p>No pending items</p>
      )}

      {items.map((item) => (
        <div
          key={item.rowIndex + "-" + item.id}
          style={{
            border: "1px solid #ccc",
            padding: 15,
            marginBottom: 15,
            borderRadius: 6
          }}
        >
          <p><strong>ID:</strong> {item.id}</p>
          <p><strong>Content:</strong> {item.content}</p>
          <p><strong>Status:</strong> {item.status}</p>
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