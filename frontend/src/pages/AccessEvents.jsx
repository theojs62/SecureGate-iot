import React, { useEffect, useState, useCallback } from "react";
import { http } from "../api/http.js";

export default function AccessEvents() {
  const [rows, setRows] = useState([]);
  const [limit, setLimit] = useState(100);

  const load = useCallback(async () => {
    const { data } = await http.get(`/api/dashboard/access-events?limit=${limit}`);
    setRows(data);
  }, [limit]);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="card">
      <div className="rowBetween">
        <h3>Accès badges</h3>
        <div className="row">
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
          <button className="btn" onClick={load}>Rafraîchir</button>
        </div>
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
            const u = r.userId;
            const userName = u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : "-";
            const email = u?.email || "-";

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
              <td colSpan={5} className="muted">Aucun événement</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
