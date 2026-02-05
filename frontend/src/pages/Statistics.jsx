import React, { useEffect, useMemo, useState } from "react";
import { http } from "../api/http.js";

function weekdayLabel(dateIso) {
  const d = new Date(dateIso);
  return d.toLocaleDateString("fr-FR", { weekday: "short" });
}

function hourLabel(dateIso) {
  const d = new Date(dateIso);
  const h = d.getHours();
  return `${String(h).padStart(2, "0")}h`;
}

function DonutChart({ percent, label, sublabel }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className="donutWrap">
      <div
        className="donut"
        style={{ background: `conic-gradient(#0f172a 0 ${p}%, #e2e8f0 ${p}% 100%)` }}
      >
        <div className="donutInner">
          <b>{p}%</b>
          <span>{label}</span>
        </div>
      </div>
      <div className="muted small">{sublabel}</div>
    </div>
  );
}

function VerticalBars({ rows, colorClass }) {
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="vChartWrap">
      {rows.map((r) => (
        <div key={r.label} className="vBarItem">
          <div className="vBarValue">{r.value}</div>
          <div className="vBarTrack">
            <div
              className={`vBarFill ${colorClass || ""}`}
              style={{ height: `${Math.max(6, Math.round((r.value / max) * 100))}%` }}
            />
          </div>
          <div className="vBarLabel">{r.label}</div>
        </div>
      ))}
    </div>
  );
}

function HorizontalBars({ rows, colorClass }) {
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="barChart">
      {rows.map((row) => (
        <div key={row.label} className="barRow">
          <div className="barMeta">
            <span>{row.label}</span>
            <b>{row.value}</b>
          </div>
          <div className="barTrack">
            <div
              className={`barFill ${colorClass || ""}`}
              style={{ width: `${Math.max(5, Math.round((row.value / max) * 100))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Statistics() {
  const [accessLogs, setAccessLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [logsRes, alertsRes, badgesRes] = await Promise.all([
        http.get("/api/dashboard/access-logs?limit=300"),
        http.get("/api/dashboard/alerts"),
        http.get("/api/admin/badges?limit=500")
      ]);

      setAccessLogs(Array.isArray(logsRes.data) ? logsRes.data : []);
      setAlerts(Array.isArray(alertsRes.data) ? alertsRes.data : []);
      setBadges(Array.isArray(badgesRes.data) ? badgesRes.data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const totalAccess = accessLogs.length;
    const deniedCount = accessLogs.filter((l) => l.status !== "GRANTED").length;
    const deniedRate = totalAccess ? Math.round((deniedCount / totalAccess) * 100) : 0;

    const openAlerts = alerts.filter((a) => a.status === "OPEN").length;

    const badgesTotal = badges.length;
    const assignedBadges = badges.filter((b) => Boolean(b.owner_user_id)).length;
    const unassignedBadges = badgesTotal - assignedBadges;
    const assignedRate = badgesTotal ? Math.round((assignedBadges / badgesTotal) * 100) : 0;

    const weekdaysOrdered = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
    const weekdayMap = accessLogs.reduce((acc, log) => {
      const label = weekdayLabel(log.createdAt);
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});
    const accessByWeekday = weekdaysOrdered.map((label) => ({ label, value: weekdayMap[label] || 0 }));

    const hourMap = accessLogs.reduce((acc, log) => {
      const label = hourLabel(log.createdAt);
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});
    const accessByHour = Array.from({ length: 24 }, (_, h) => {
      const label = `${String(h).padStart(2, "0")}h`;
      return { label, value: hourMap[label] || 0 };
    });

    const severityMap = alerts.reduce((acc, alert) => {
      const key = alert.severity || "UNKNOWN";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const statusMap = alerts.reduce((acc, alert) => {
      const key = alert.status || "UNKNOWN";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const toRows = (obj) =>
      Object.entries(obj)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);

    return {
      totalAccess,
      deniedCount,
      deniedRate,
      openAlerts,
      assignedRate,
      assignedBadges,
      badgesTotal,
      unassignedBadges,
      accessByWeekday,
      accessByHour,
      severityRows: toRows(severityMap),
      statusRows: toRows(statusMap)
    };
  }, [accessLogs, alerts, badges]);

  if (loading) return <div className="card">Chargement des statistiques…</div>;

  return (
    <div className="statsPage">
      <div className="rowBetween">
        <h2>Statistiques sécurité</h2>
        <button className="btn" onClick={load}>Rafraîchir</button>
      </div>

      <div className="grid statsKpis">
        <div className="card kpiCard">
          <div className="kpiLabel">Taux de refus</div>
          <div className="kpiValue">{stats.deniedRate}%</div>
          <div className="muted small">sur {stats.totalAccess} accès analysés</div>
        </div>
        <div className="card kpiCard">
          <div className="kpiLabel">Alertes ouvertes</div>
          <div className="kpiValue">{stats.openAlerts}</div>
          <div className="muted small">alertes actuellement en statut OPEN</div>
        </div>
        <div className="card kpiCard">
          <div className="kpiLabel">Refus d'accès</div>
          <div className="kpiValue">{stats.deniedCount}</div>
          <div className="muted small">événements refusés détectés</div>
        </div>
      </div>

      <div className="statsGrid">
        <div className="card">
          <h3>Donut: taux de badges assignés</h3>
          <DonutChart
            percent={stats.assignedRate}
            label="assignés"
            sublabel={`${stats.assignedBadges} assignés / ${stats.badgesTotal} badges (${stats.unassignedBadges} non assignés)`}
          />
        </div>

       
       

        <div className="card">
          <h3>Sévérité et statut des alertes</h3>
          <div className="alertsDualGrid">
            <div>
              <div className="small muted" style={{ marginBottom: 8 }}>Par sévérité</div>
              {stats.severityRows.length > 0 ? (
                <HorizontalBars rows={stats.severityRows} colorClass="barFillOrange" />
              ) : (
                <p className="muted">Aucune alerte</p>
              )}
            </div>
            <div>
              <div className="small muted" style={{ marginBottom: 8 }}>Par statut</div>
              {stats.statusRows.length > 0 ? (
                <HorizontalBars rows={stats.statusRows} colorClass="barFillRed" />
              ) : (
                <p className="muted">Aucune alerte</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}