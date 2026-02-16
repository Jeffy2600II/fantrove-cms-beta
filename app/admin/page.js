"use client";
import { useEffect, useState } from "react";

const STORAGE_KEY = "ADMIN_SECRET";
const EXPIRY_KEY = "ADMIN_SECRET_EXPIRY";
// Session TTL: 15 days
const ADMIN_SESSION_TTL_MS = 15 * 24 * 60 * 60 * 1000;

export default function AdminPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [adminSecret, setAdminSecret] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // เรียกใช้งาน API โดยแนบ Authorization ถ้ามี
  const apiFetch = async (path, opts = {}) => {
    const headers = opts.headers || {};
    const secret = getStoredSecret();
    if (secret) headers["Authorization"] = `Bearer ${secret}`;
    return fetch(path, { ...opts, headers });
  };

  // localStorage helpers
  const getStoredSecret = () => {
    if (typeof window === "undefined") return null;
    const s = localStorage.getItem(STORAGE_KEY);
    const exp = Number(localStorage.getItem(EXPIRY_KEY) || "0");
    if (!s || !exp) return null;
    if (Date.now() > exp) {
      // expired
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(EXPIRY_KEY);
      return null;
    }
    return s;
  };

  const storeSecretWithExpiry = (secret) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, secret);
    localStorage.setItem(EXPIRY_KEY, String(Date.now() + ADMIN_SESSION_TTL_MS));
  };

  const resetExpiryIfAuthenticated = () => {
    const s = getStoredSecret();
    if (s) {
      localStorage.setItem(EXPIRY_KEY, String(Date.now() + ADMIN_SESSION_TTL_MS));
    }
  };

  const clearStoredSecret = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(EXPIRY_KEY);
  };

  // ตรวจสอบว่า secret ใน localStorage ยังใช้งานได้ไหม โดยเร��ยก /api/admin/verify
  const checkAuth = async () => {
    setAuthChecked(false);
    const s = getStoredSecret();
    if (!s) {
      setShowLogin(true);
      setAuthChecked(true);
      return false;
    }
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { Authorization: `Bearer ${s}` }
      });
      if (res.ok) {
        // authenticated
        resetExpiryIfAuthenticated();
        setShowLogin(false);
        setAdminSecret(s);
        setAuthChecked(true);
        return true;
      } else {
        // invalid -> remove and show login
        clearStoredSecret();
        setShowLogin(true);
        setAuthChecked(true);
        return false;
      }
    } catch (err) {
      console.error("Auth check failed", err);
      // ถ้ามี network error ให้เปิด modal ด้วย
      clearStoredSecret();
      setShowLogin(true);
      setAuthChecked(true);
      return false;
    }
  };

  // เรียก /api/admin/list แต่จะตรวจ 401 -> แสดง modal login
  const loadData = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await apiFetch("/api/admin/list");
      if (res.status === 401) {
        // ต้องกรอก secret ใหม่
        clearStoredSecret();
        setShowLogin(true);
        setItems([]);
        setMessage("Unauthorized — please sign in");
      } else if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage(err.message || "Error loading data");
        setItems([]);
      } else {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
      setMessage("Error loading data");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // อัปเดตสถานะ (approve / reject) — แนบ Authorization
  const updateStatus = async (rowIndex, status) => {
    const ok = confirm(`Are you sure you want to mark this item as "${status}"?`);
    if (!ok) return;

    setLoading(true);
    setMessage("");
    try {
      const res = await apiFetch("/api/admin/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex, status })
      });

      if (res.status === 401) {
        clearStoredSecret();
        setShowLogin(true);
        setMessage("Unauthorized — please sign in");
      } else {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMessage(data.message || "Update failed");
        } else {
          setMessage(`Marked as ${status}`);
          await loadData();
        }
      }
    } catch (err) {
      console.error(err);
      setMessage("Update failed");
    } finally {
      setLoading(false);
    }
  };

  // Sync approved -> แนบ Authorization
  const syncData = async () => {
    const s = getStoredSecret();
    if (!s) {
      setMessage("Please sign in before syncing");
      setShowLogin(true);
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
          Authorization: `Bearer ${s}`
        }
      });

      if (res.status === 401) {
        clearStoredSecret();
        setShowLogin(true);
        setMessage("Unauthorized — please sign in");
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage(data.message || (res.ok ? "Synced successfully" : "Sync failed"));
        if (res.ok) await loadData();
      }
    } catch (err) {
      console.error(err);
      setMessage("Sync failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (enteredSecret) => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${enteredSecret}`
        }
      });
      if (res.ok) {
        storeSecretWithExpiry(enteredSecret);
        setAdminSecret(enteredSecret);
        setShowLogin(false);
        setMessage("Signed in");
        await loadData();
      } else {
        setMessage("Invalid admin secret");
      }
    } catch (err) {
      console.error(err);
      setMessage("Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    clearStoredSecret();
    setAdminSecret("");
    setItems([]);
    setShowLogin(true);
    setMessage("Signed out");
  };

  useEffect(() => {
    // เมื่อเข้ามาหน้า admin ให้ตรว��� auth ก่อน ถ้าอยู่ใน session => รีเซ็ต expiry
    (async () => {
      const ok = await checkAuth();
      if (ok) {
        await loadData();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // UI
  // ถ้ auth ยังไม่ถูกตรวจ ให้แสดง loading placeholder
  if (!authChecked) {
    return <div style={{ padding: 40 }}>Checking authentication...</div>;
  }

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Admin Review Panel</h1>

      <div style={{ marginBottom: 12 }}>
        <button onClick={syncData} disabled={loading} style={{ padding: "8px 16px" }}>Sync Approved to GitHub</button>
        <button onClick={loadData} disabled={loading} style={{ marginLeft: 12, padding: "8px 12px" }}>Refresh</button>
        <button onClick={handleSignOut} disabled={loading} style={{ marginLeft: 12, padding: "8px 12px" }}>Sign out</button>
      </div>

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

      {showLogin && (
        <LoginModal
          onSubmit={handleLogin}
          loading={loading}
        />
      )}
    </div>
  );
}

// Simple modal component for secret input (hidden after success)
function LoginModal({ onSubmit, loading }) {
  const [val, setVal] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!val) return;
    onSubmit(val);
    setVal("");
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999
    }}>
      <form onSubmit={submit} style={{ background: "#fff", padding: 24, borderRadius: 8, width: 420 }}>
        <h2>Admin sign in</h2>
        <p>Enter admin secret to continue.</p>
        <input
          autoFocus
          type="password"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="Admin secret"
          style={{ width: "100%", padding: "8px 10px", marginBottom: 12 }}
        />
        <div style={{ textAlign: "right" }}>
          <button type="submit" disabled={loading} style={{ padding: "8px 12px" }}>Sign in</button>
        </div>
      </form>
    </div>
  );
}