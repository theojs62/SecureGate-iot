import React, { useEffect, useState } from "react";
import { http } from "../api/http.js";

function InterphoneCard() {
  const [pending, setPending] = useState(null);
  const [msg, setMsg] = useState("");

  const load = async () => {
    try {
      const { data } = await http.get("/api/interphone/pending");
      setPending(data);
    } catch (e) {
      // ignore 401 etc (tu gères déjà auth ailleurs)
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 2000); // refresh auto
    return () => clearInterval(t);
  }, []);

  const respond = async (autorise) => {
    setMsg("");
    try {
      await http.post("/api/interphone/respond", { autorise });
      setMsg(autorise ? "✅ Accès accepté" : "⛔ Accès refusé");
      await load();
    } catch (e) {
      setMsg("❌ " + (e.response?.data?.error || e.message));
    }
  };

  if (!pending) {
    return (
      <div className="card">
        <h3>Interphone</h3>
        <p className="muted">Aucune demande en attente.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ borderLeft: "6px solid #f59e0b" }}>
      <h3>🔔 Demande Interphone</h3>
      <p>
        Device: <b>{pending.device}</b><br />
        Reçue: <b>{new Date(pending.created_at).toLocaleString()}</b>
      </p>

      <div className="row">
        <button className="btnPrimary" onClick={() => respond(true)}>Accepter</button>
        <button className="btn" onClick={() => respond(false)}>Refuser</button>
      </div>

      {msg && <p style={{ marginTop: 10 }}>{msg}</p>}
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
    </div>
  );
}
