
import React, { useEffect, useMemo, useState } from "react";
import { http } from "../api/http.js";

export default function Badges() {
  const [badges, setBadges] = useState([]);
  const [users, setUsers] = useState([]);
  const [enrollRequest, setEnrollRequest] = useState(null);

  const [uid, setUid] = useState("");
  const [type, setType] = useState("permanent");
  const [expiresAt, setExpiresAt] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");

  const [msg, setMsg] = useState("");

  const getUserId = (u) => u.id ?? u._id;

  const load = async () => {
    const [b, u, enroll] = await Promise.all([
      http.get("/api/admin/badges?limit=200"),
      http.get("/api/admin/users?limit=500"),
      http.get("/api/admin/badges/enroll-request")
    ]);
    setBadges(b.data);
    setUsers(u.data);
    setEnrollRequest(enroll.data);
  };

  useEffect(() => {
    load();
    const t = setInterval(() => load().catch(() => null), 4000);
    return () => clearInterval(t);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");

    try {
      let expiresAtIso = null;

      if (type === "temporary") {
        if (!expiresAt) {
          setMsg("La date d'expiration est obligatoire pour un badge temporaire.");
          return;
        }

        const parsed = new Date(expiresAt);
        if (Number.isNaN(parsed.getTime())) {
          setMsg("La date d'expiration est invalide.");
          return;
        }

        expiresAtIso = parsed.toISOString();
      }

      await http.post("/api/admin/badges", {
        uid,
        type,
        expiresAt: expiresAtIso,
        ownerUserId: ownerUserId ? Number(ownerUserId) : null
      });

      setUid("");
      setExpiresAt("");
      setOwnerUserId("");
      setType("permanent");

      await load();
      setMsg("Badge créé avec succès.");
    } catch (err) {
      setMsg(err.response?.data?.error || err.message || "Erreur lors de la création du badge.");
    }
  };

  const assign = async (id, userId) => {
    const nextOwnerUserId = userId === "" ? null : Number(userId);
    await http.post(`/api/admin/badges/${id}/assign`, { ownerUserId: nextOwnerUserId });
    await load();
  };

  const useEnrollUid = async () => {
    if (!enrollRequest?.uid) return;
    setUid(enrollRequest.uid);
    setEnrollRequest(null);
    try {
      await http.post("/api/admin/badges/enroll-request/consume");
    } catch (err) {
      console.warn("consume enroll request failed", err?.message);
    }
  };

  const removeBadge = async (id, uidToDelete) => {
    const confirmed = window.confirm(`Supprimer définitivement le badge ${uidToDelete} ?`);
    if (!confirmed) return;

    try {
      await http.delete(`/api/admin/badges/${id}`);
      await load();
      setMsg("Badge supprimé avec succès.");
    } catch (err) {
      setMsg(err.response?.data?.error || err.message || "Suppression impossible.");
    }
  };

  const canCreate = useMemo(() => uid.trim().length > 0, [uid]);

  const existingBadge = useMemo(
    () => badges.find((b) => enrollRequest?.uid && b.uid === enrollRequest.uid),
    [badges, enrollRequest]
  );

  return (
    <div className="">
      <div className="card">
        <div className="badgeCreateHeader">
          <h3>Créer un badge</h3>
          <p className="muted small">Ajoutez un nouveau badge et assignez-le si besoin.</p>
        </div>

        <div className="enrollBox">
          <div className="small"><b>UID reçu</b></div>
          <div>{enrollRequest?.uid || "Aucun UID reçu"}</div>
          {enrollRequest?.receivedAt && (
            <div className="small muted">Reçu le {new Date(enrollRequest.receivedAt).toLocaleString()}</div>
          )}
          {existingBadge && (
            <div className="small muted">Déjà connu: {existingBadge.owner_email || "non assigné"}</div>
          )}
          {enrollRequest?.uid && (
            <button className="btnSmall" type="button" onClick={useEnrollUid}>
              Utiliser cet UID
            </button>
          )}
        </div>

        <form onSubmit={submit} className="form">
          <label>UID du badge</label>
          <input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="Ex : 4B 50 55 3E" />

          <label>Type de badge</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="permanent">Permanent</option>
            <option value="temporary">Temporaire</option>
          </select>

          {type === "temporary" && (
            <>
              <label>Date d'expiration</label>
              <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </>
          )}

          <label>Utilisateur (optionnel)</label>
          <select value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)}>
            <option value="">— non assigné —</option>
            {users.map((u) => {
              const userId = getUserId(u);
              return (
                <option key={userId} value={userId}>
                  {u.email} ({u.role})
                </option>
              );
            })}
          </select>

          <button className="btnPrimary" type="submit" disabled={!canCreate}>Créer le badge</button>
          {msg && <div className={msg.startsWith("") ? "ok" : "error"}>{msg}</div>}
        </form>
      </div>

      <div className="card">
        <div className="rowBetween">
          <h3>Badges enregistrés</h3>
          <button className="btn" onClick={load}>Rafraîchir</button>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>UID</th>
              <th>Type</th>
              <th>Expire le</th>
              <th>Assigné à</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {badges.map((b) => (
              <tr key={b.id}>
                <td>{b.uid}</td>
                <td>{b.badge_type === "temporary" ? "Temporaire" : "Permanent"}</td>
                <td>{b.expires_at ? new Date(b.expires_at).toLocaleString() : "—"}</td>
                <td>{b.owner_email || "— non assigné —"}</td>
                <td>{b.is_currently_active ? "Actif" : "Expiré"}</td>
                <td>
                  <div className="row wrapRow">
                    <select value={b.owner_user_id || ""} onChange={(e) => assign(b.id, e.target.value)}>
                      <option value="">— désassigner —</option>
                      {users.map((u) => {
                        const userId = getUserId(u);
                        return <option key={userId} value={userId}>{u.email}</option>;
                      })}
                    </select>
                    <button className="btnDanger" type="button" onClick={() => removeBadge(b.id, b.uid)}>
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {badges.length === 0 && (
              <tr><td colSpan="6" className="muted">Aucun badge</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
