import React, { useState } from "react";
import { http } from "../api/http.js";

export default function Interphone() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const send = async (autorise) => {
    setLoading(true);
    setMsg("");
    try {
      await http.post("/api/interphone/respond", { autorise });
      setMsg(` Réponse envoyée: autorise=${autorise}`);
    } catch (e) {
      setMsg(" Erreur: " + (e.response?.data?.error || e.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h3>Interphone</h3>
      <p className="muted">
        Répondre à une demande interphone. Le backend publie sur <b>CESI/Response/Interphone</b>.
      </p>

      <div className="row">
        <button className="btnPrimary" disabled={loading} onClick={() => send(true)}>
          Accepter
        </button>
        <button className="btn" disabled={loading} onClick={() => send(false)}>
          Refuser
        </button>
      </div>

      {msg && <div style={{ marginTop: 12 }} className={msg.startsWith("✅") ? "ok" : "error"}>{msg}</div>}
    </div>
  );
}
