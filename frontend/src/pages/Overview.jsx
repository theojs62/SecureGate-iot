import React, { useEffect, useState } from "react";
import { http } from "../api/http.js";
import { useNavigate } from "react-router-dom";

function InterphoneCard() {
  const [pending, setPending] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const { data } = await http.get("/api/interphone/pending");
      setPending(data); // null si rien, sinon objet demande
    } catch (e) {
      // ignore (401 etc)
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, []);

  const openCount = pending ? 1 : 0;

  return (
    <div className="card kpiCard">
      <div className="kpiLabel">Interphone</div>

      <div className={openCount > 0 ? "kpiValue" : "kpiValue"}>
        {loading ? "…" : openCount}
      </div>

      <div className="muted small">
        {pending ? "Demande d’accès en attente" : "Aucune demande en attente"}
      </div>
      </div>
  );
}

function LatestAccessEventsCard() {
  const [rows, setRows] = useState([]);

  const load = async () => {
    const { data } = await http.get("/api/dashboard/access-events?limit=5");
    setRows(data);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="card" style={{ gridColumn: "span 12" }}>
      <div className="rowBetween">
        <h3>10 derniers accès badges</h3>
        <button className="btn" onClick={load}>Rafraîchir</button>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Utilisateur</th>
            <th>Email</th>
            <th>UID Badge</th>
            <th>Résultat</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const user = r.userId;
            const userName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "-";
            const email = user?.email || "-";

            return (
              <tr key={r._id}>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
                <td>{userName || "-"}</td>
                <td>{email}</td>
                <td>{r.badgeUid}</td>
                <td className={r.result ? "" : "bad"}>{r.result ? "OK" : "REFUSÉ"}</td>
              </tr>
            );
          })}

          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">Aucun événement récent</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function Overview() {
  const [data, setData] = useState(null);

  const load = async () => {
    const r = await http.get("/api/dashboard/overview");
    setData(r.data);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  if (!data) return <div className="card">Chargement…</div>;

  return (
    <div className="grid">
      <div className="card kpiCard">
        <div className="kpiLabel">Alertes ouvertes</div>
        <div className={data.kpis.openAlerts > 0 ? "kpiValue" : "kpiValue"}>
          {data.kpis.openAlerts}
        </div>
        <div className="muted small">Sécurité / anomalies non traitées</div>
      </div>

      <InterphoneCard />
      <LatestAccessEventsCard />
    </div>
  );
}
