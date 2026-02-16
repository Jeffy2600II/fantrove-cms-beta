"use client";
import { useEffect, useState } from "react";

const STORAGE_KEY = "ADMIN_SECRET";
const EXPIRY_KEY = "ADMIN_SECRET_EXPIRY";
// Session TTL: 15 days
const ADMIN_SESSION_TTL_MS = 15 * 24 * 60 * 60 * 1000;

export default function AdminPage() {
  const [items, setItems] = useState([]); // ทั้งหมด
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [adminSecret, setAdminSecret] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // edits: map rowIndex -> { rowIndex, oldStatus, newStatus }
  const [edits, setEdits] = useState({});

  // API helper แนบ Authorization ถ้ามี
  const apiFetch = async (path, opts = {}) => {
    const headers = opts.headers ? { ...opts.headers } : {};
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

  // ตรวจสอบว่า secret ใน localStorage ยังใช้งานได้ไหม โดยเรียก /api/admin/verify
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
      clearStoredSecret();
      setShowLogin(true);
      setAuthChecked(true);
      return false;
    }
  };

  // โหลดข้อมูลทั้งหมดจาก server (ไม่กรอง)
  const loadData = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await apiFetch("/api/admin/list");
      if (res.status === 401) {
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
        // /api/admin/list ส่ง { items, hasHeader } แต่เราสนใจ items
        const list = Array.isArray(data.items) ? data.items : [];
        setItems(list);
        setEdits({});
      }
    } catch (err) {
      console.error(err);
      setMessage("Error loading data");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // เมื่อเปลี่ยนสถานะใน UI ให้เก็บไว้ใน edits buffer (ยังไม่บันทึกกลับ sheet)
  // newStatus === "" หมายถึง "ลบแถว"
  const changeStatusLocal = (rowIndex, oldStatus, newStatus) => {
    setEdits(prev => {
      const next = { ...prev };
      if (newStatus === oldStatus) {
        delete next[rowIndex];
      } else {
        next[rowIndex] = { rowIndex, oldStatus, newStatus };
      }
      return next;
    });

    // Update items array view
    setItems(prevItems => prevItems.map(it => it.rowIndex === rowIndex ? { ...it, status: newStatus } : it));
  };

  // Toggle mark-for-delete (set newStatus = "")
  const toggleDelete = (rowIndex, oldStatus) => {
    const currentlyMarked = edits[rowIndex] && edits[rowIndex].newStatus === "";
    if (currentlyMarked) {
      // unmark -> restore to oldStatus
      changeStatusLocal(rowIndex, oldStatus, oldStatus);
    } else {
      // mark for deletion
      changeStatusLocal(rowIndex, oldStatus, "");
    }
  };

  // ยกเลิกการเปลี่ยนแปลงทั้งหมด (clear buffer and reload)
  const cancelEdits = async () => {
    setEdits({});
    await loadData();
    setMessage("Changes cancelled");
  };

  // Save changes (batch update to Google Sheets) — ไม่ sync ขึ้น GitHub
  const saveChanges = async () => {
    const editsArr = Object.values(edits);
    if (editsArr.length === 0) {
      setMessage("No changes to save");
      return;
    }

    const ok = confirm(`Save ${editsArr.length} changes to sheet? (Deletions will remove rows)`);
    if (!ok) return;

    setLoading(true);
    setMessage("Saving changes...");

    try {
      const res = await apiFetch("/api/admin/batch-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edits: editsArr })
      });

      if (res.status === 401) {
        clearStoredSecret();
        setShowLogin(true);
        setMessage("Unauthorized — please sign in");
      } else if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.message || "Save failed");
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage(data.message || "Saved changes");
        // หลัง save ให้เคลียร์ buffer แล้ว reload เพื่อความแน่ใจ
        setEdits({});
        await loadData();
      }
    } catch (err) {
      console.error(err);
      setMessage("Save failed");
    } finally {
      setLoading(false);
    }
  };

  // Save changes + Sync (batch update then call /api/sync)
  const saveAndSync = async () => {
    const editsArr = Object.values(edits);
    const proceed = confirm("This will save changes to sheet and then sync approved items to GitHub. Continue?");
    if (!proceed) return;

    setLoading(true);
    setMessage("Saving changes and syncing...");

    try {
      // 1) ถ้ามี edits ให้บันทึกก่อน
      if (editsArr.length > 0) {
        const res1 = await apiFetch("/api/admin/batch-update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ edits: editsArr })
        });

        if (res1.status === 401) {
          clearStoredSecret();
          setShowLogin(true);
          setMessage("Unauthorized — please sign in");
          setLoading(false);
          return;
        } else if (!res1.ok) {
          const d = await res1.json().catch(() => ({}));
          setMessage(d.message || "Save failed");
          setLoading(false);
          return;
        }
      }

      // 2) เรียก /api/sync (ต้องมี admin secret)
      const s = getStoredSecret();
      if (!s) {
        setMessage("Please sign in before syncing");
        setShowLogin(true);
        setLoading(false);
        return;
      }

      const res2 = await fetch("/api/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${s}` }
      });

      if (res2.status === 401) {
        clearStoredSecret();
        setShowLogin(true);
        setMessage("Unauthorized — please sign in");
      } else {
        const d2 = await res2.json().catch(() => ({}));
        setMessage(d2.message || (res2.ok ? "Synced successfully" : "Sync failed"));
        if (res2.ok) {
          setEdits({});
          await loadData();
        }
      }
    } catch (err) {
      console.error(err);
      setMessage("Save & Sync failed");
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
    (async () => {
      const ok = await checkAuth();
      if (ok) {
        await loadData();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!authChecked) {
    return <div style={{ padding: 40 }}>Checking authentication...</div>;
  }

  // จำนวนการเปลี่ยนแปลงใน buffer
  const editCount = Object.keys(edits).length;

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>Admin Review Panel</h1>

      <div style={{ marginBottom: 12 }}>
        <button onClick={saveAndSync} disabled={loading} style={{ padding: "8px 16px" }}>Save & Sync</button>
        <button onClick={saveChanges} disabled={loading || editCount === 0} style={{ marginLeft: 12, padding: "8px 12px" }}>
          Save changes ({editCount})
        </button>
        <button onClick={cancelEdits} disabled={loading || editCount === 0} style={{ marginLeft: 12, padding: "8px 12px" }}>
          Cancel changes
        </button>
        <button onClick={loadData} disabled={loading} style={{ marginLeft: 12, padding: "8px 12px" }}>Refresh</button>
        <button onClick={handleSignOut} disabled={loading} style={{ marginLeft: 12, padding: "8px 12px" }}>Sign out</button>
      </div>

      {loading && <p>Loading...</p>}
      {message && <p>{message}</p>}

      {items.length === 0 && !loading && (
        <p>No items found</p>
      )}

      {items.map((item) => {
        const oldStatus = item.status || "";
        const isMarkedDelete = edits[item.rowIndex] && edits[item.rowIndex].newStatus === "";
        return (
          <div
            key={item.rowIndex + "-" + item.id}
            style={{
              border: "1px solid #ccc",
              padding: 15,
              marginBottom: 12,
              borderRadius: 6,
              opacity: isMarkedDelete ? 0.6 : 1,
              position: "relative"
            }}
          >
            <p><strong>Row:</strong> {item.rowIndex} &nbsp; <strong>ID:</strong> {item.id}</p>
            <p><strong>Content:</strong> {item.content}</p>
            <p>
              <strong>Status:</strong>{" "}
              {oldStatus === "" && !isMarkedDelete ? (
                <em style={{ color: "#b00" }}>(empty)</em>
              ) : null}
              <select
                value={isMarkedDelete ? "" : (item.status || "")}
                onChange={(e) => changeStatusLocal(item.rowIndex, oldStatus, e.target.value)}
                style={{ marginLeft: 8 }}
              >
                {/* ไม่มี option ว่าง — ผู้ใช้ต้องเลือก 1 ใน 3 ค่า */}
                <option value="pending">pending</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
              </select>

              <button
                onClick={() => toggleDelete(item.rowIndex, oldStatus)}
                style={{ marginLeft: 12, padding: "6px 10px" }}
                title="Mark row for deletion (this will remove the entire row on Save)"
              >
                {isMarkedDelete ? "Unmark delete" : "Delete row"}
              </button>
            </p>
            <p><small>{item.created_at}</small></p>
            {isMarkedDelete && (
              <div style={{ position: "absolute", top: 10, right: 10, color: "#900" }}>
                Marked for deletion
              </div>
            )}
          </div>
        );
      })}
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