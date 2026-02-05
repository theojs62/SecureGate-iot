import React, { useEffect, useState, useCallback } from "react";
import { http } from "../api/http.js";

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState("OPEN");

  const load = useCallback(async () => {
    const { data } = await http.get(`/api/dashboard/alerts?status=${status}`);
    setAlerts(data);
  }, [status]);

  useEffect(() => {
    load();

    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  const ack = async (id) => {
    await http.post(`/api/dashboard/alerts/${id}/ack`);
    await load();
  };

  const close = async (id) => {
    await http.post(`/api/dashboard/alerts/${id}/close`);
    await load();
  };

  return (
    <div className="card">
      <div className="rowBetween">
        <h3>Alertes</h3>
        <div className="row">
          <button className="btn" onClick={load}>Rafraîchir</button>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Gravité</th>
            <th>Message</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((a) => (
            <tr key={a._id}>
              <td>{new Date(a.createdAt).toLocaleString()}</td>
              <td>{a.type}</td>
              <td className={a.severity === "HIGH" ? "bad" : ""}>{a.severity}</td>
              <td>{a.message}</td>
              <td>
                {a.status === "OPEN" ? (
                  <>
                    <button className="btnSmall" onClick={() => close(a._id)}>CLOSE</button>
                  </>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
            </tr>
          ))}
          {alerts.length === 0 && (
            <tr><td colSpan={6} className="muted">Aucune alerte</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
