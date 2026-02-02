import React, { useEffect, useState } from "react";
import { http } from "../api/http.js";

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
    </div>
  );
}
