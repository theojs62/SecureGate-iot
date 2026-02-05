import React, { useEffect, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import RightSidebar from "./RightSidebar.jsx";
import { http } from "../api/http.js";

function NotificationCenter({ items, onClear }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="notifWrap">
      <button className="btn notifBtn" onClick={() => setOpen((v) => !v)}>
        🔔 Notifications {items.length > 0 ? `(${items.length})` : ""}
      </button>

      {open && (
        <div className="notifPanel card">
          <div className="rowBetween" style={{ marginBottom: 8 }}>
            <b>Dernières notifications</b>
            <button className="btnSmall" onClick={onClear}>Tout effacer</button>
          </div>

          {items.length === 0 ? (
            <div className="muted">Aucune nouvelle notification.</div>
          ) : (
            <div className="notifList">
              {items.map((item) => (
                <div key={item.id} className="notifItem">
                  <div>{item.text}</div>
                  <div className="muted small">{new Date(item.at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);

  const knownAlertIdsRef = useRef(new Set());
  const knownBadgeIdsRef = useRef(new Set());
  const knownPendingInterphoneIdRef = useRef(null);
  const initializedRef = useRef(false);

  const pushNotification = (text, key) => {
    setNotifications((prev) => {
      if (prev.some((n) => n.id === key)) return prev;
      return [{ id: key, text, at: Date.now() }, ...prev].slice(0, 20);
    });
  };

  useEffect(() => {
    let stopped = false;

    const poll = async () => {
      try {
        const [alertsRes, badgesRes, interphoneRes] = await Promise.all([
          http.get("/api/dashboard/alerts?status=OPEN"),
          http.get("/api/admin/badges?limit=30"),
          http.get("/api/interphone/pending")
        ]);

        const alerts = Array.isArray(alertsRes.data) ? alertsRes.data : [];
        const badges = Array.isArray(badgesRes.data) ? badgesRes.data : [];
        const pending = interphoneRes.data || null;

        const alertIds = new Set(alerts.map((a) => a._id ?? a.id));
        const badgeIds = new Set(badges.map((b) => b.id));
        const pendingId = pending?.id ?? null;

        if (!initializedRef.current) {
          knownAlertIdsRef.current = alertIds;
          knownBadgeIdsRef.current = badgeIds;
          knownPendingInterphoneIdRef.current = pendingId;
          initializedRef.current = true;
          return;
        }

        alerts.forEach((a) => {
          const id = a._id ?? a.id;
          if (!knownAlertIdsRef.current.has(id)) {
            pushNotification(`🚨 Nouvelle alerte: ${a.type} (${a.severity})`, `alert-${id}`);
          }
        });

        badges.forEach((b) => {
          if (!knownBadgeIdsRef.current.has(b.id)) {
            pushNotification(`🪪 Nouveau badge créé: ${b.uid}`, `badge-${b.id}`);
          }
        });

        if (pendingId && pendingId !== knownPendingInterphoneIdRef.current) {
          pushNotification(`📞 Nouvelle demande interphone (${pending.device || "UNKNOWN"})`, `interphone-${pendingId}`);
        }

        knownAlertIdsRef.current = alertIds;
        knownBadgeIdsRef.current = badgeIds;
        knownPendingInterphoneIdRef.current = pendingId;
      } catch (e) {
        if (!stopped) {
          console.warn("Notification polling error:", e?.response?.data || e.message);
        }
      }
    };

    poll();
    const timer = setInterval(poll, 4000);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const user = JSON.parse(localStorage.getItem("user") || "null");

  return (
    <div className="appShell">
      <main className="mainArea">
        <header className="topBar">
          <div>
            <div className="title">SecureGate</div>
            <div className="subtitle">
              {user ? `${user.firstName} ${user.lastName} — ${user.role}` : ""}
            </div>
          </div>

          <div className="row">
            <NotificationCenter items={notifications} onClear={() => setNotifications([])} />
            <button className="btn" onClick={logout}>Se déconnecter</button>
          </div>
        </header>

        <section className="content">
          <Outlet />
        </section>
      </main>

      <RightSidebar />
    </div>
  );
}