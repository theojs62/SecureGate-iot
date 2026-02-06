import React, { useEffect, useState } from "react";
import { http } from "../api/http.js";

export default function Interphone() {
  const [pending, setPending] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState("");
  const [lastAction, setLastAction] = useState(null);

  const loadPending = async ({ silent = false } = {}) => {
    if (!silent) setRefreshing(true);
    try {
      const { data } = await http.get("/api/interphone/pending");
      setPending(data || null);
    } catch (e) {
      setMsg("❌ Erreur chargement interphone: " + (e.response?.data?.error || e.message));
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPending();
    const t = setInterval(() => loadPending({ silent: true }), 2500);
    return () => clearInterval(t);
  }, []);

  const send = async (autorise) => {
    if (!pending) return;
    setLoading(true);
    setMsg("");
    try {
      await http.post("/api/interphone/respond", { autorise });
      const actionText = autorise ? "Demande acceptée" : "Demande refusée";
      setLastAction({
        id: pending.id,
        device: pending.device,
        at: new Date().toISOString(),
        decision: autorise ? "ACCEPTED" : "REFUSED"
      });
      setMsg(`${actionText} pour ${pending.device || "UNKNOWN"}`);
      await loadPending({ silent: true });
    } catch (e) {
      setMsg("Erreur: " + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid">
      <div className="card kpiCard" style={{ gridColumn: "span 12" }}>
        <div className="rowBetween">
          <div>
            <h3 style={{ margin: 0 }}>Interphone</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              Gestion en temps réel des demandes visiteurs.
            </p>
          </div>
          <button className="btn" onClick={() => loadPending()} disabled={refreshing || loading}>
            {refreshing ? "Rafraîchissement..." : "Rafraîchir"}
          </button>
        </div>
      </div>

      <div className="card" style={{ gridColumn: "span 8", borderLeft: "6px solid #f59e0b" }}>
        <h3 style={{ marginTop: 0 }}>🔔 Demande en attente</h3>

        {!pending ? (
          <div className="muted">Aucune demande interphone en attente.</div>
        ) : (
          <>
            <div className="table" style={{ marginTop: 0 }}>
              <table className="table" style={{ marginTop: 0 }}>
                <tbody>
                  <tr>
                    <th style={{ width: 180 }}>ID demande</th>
                    <td>{pending.id}</td>
                  </tr>
                  <tr>
                    <th>Device</th>
                    <td>{pending.device || "UNKNOWN"}</td>
                  </tr>
                  <tr>
                    <th>Reçue le</th>
                    <td>{pending.created_at ? new Date(pending.created_at).toLocaleString() : "—"}</td>
                  </tr>
                  <tr>
                    <th>Statut</th>
                    <td><span className="badge badgeMed">PENDING</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <button className="btnPrimary" disabled={loading} onClick={() => send(true)} style={{ width: 220 }}>
                {loading ? "Envoi..." : "Autoriser l'accès"}
              </button>
              <button className="btn" disabled={loading} onClick={() => send(false)}>
                Refuser
              </button>
            </div>
          </>
        )}

        {msg && <div style={{ marginTop: 12 }} className={msg.startsWith("") ? "ok" : "error"}>{msg}</div>}
      </div>

     
    </div>
  );
}