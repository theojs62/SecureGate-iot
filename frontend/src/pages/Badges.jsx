import React, { useEffect, useState } from "react";
import { http } from "../api/http.js";

export default function Badges() {
  const [badges, setBadges] = useState([]);
  const [users, setUsers] = useState([]);

  const [uid, setUid] = useState("");
  const [type, setType] = useState("permanent");
  const [expiresAt, setExpiresAt] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [msg, setMsg] = useState("");

  const load = async () => {
    const [b, u] = await Promise.all([
      http.get("/api/admin/badges?limit=200"),
      http.get("/api/admin/users?limit=500")
    ]);
    setBadges(b.data);
    setUsers(u.data);
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");

    try {
      await http.post("/api/admin/badges", {
        uid,
        type,
        expiresAt: type === "temporary" ? new Date(expiresAt).toISOString() : null,
        ownerUserId: ownerUserId ? Number(ownerUserId) : null,
        isActive
      });

      setUid("");
      setExpiresAt("");
      setOwnerUserId("");
      setType("permanent");
      setIsActive(true);

      await load();
      setMsg("✅ Badge créé");
    } catch (err) {
      setMsg(" " + (err.response?.data?.error || err.message));
    }
  };

  const toggleActive = async (id, next) => {
    await http.post(`/api/admin/badges/${id}/active`, { isActive: next });
    await load();
  };

    const assign = async (id, userId) => {
    const ownerUserId = userId === "" ? null : Number(userId);
    await http.post(`/api/admin/badges/${id}/assign`, { ownerUserId });
    await load();
    };

  return (
    <div className="grid2">
      <div className="card">
        <h3>Créer un badge</h3>

        <form onSubmit={submit} className="form">
          <label>UID</label>
          <input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="ex: 4B 50 55 3E" />

          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="permanent">Permanent</option>
            <option value="temporary">Temporaire</option>
          </select>

          {type === "temporary" && (
            <>
              <label>Expire le</label>
              <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </>
          )}

          <label>Utilisateur (optionnel)</label>
          <select value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)}>
            <option value="">— non assigné —</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.email} ({u.role})
              </option>
            ))}
          </select>

          <label className="row">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Actif
          </label>

          <button className="btnPrimary" type="submit">Créer</button>
          {msg && <div className={msg.startsWith("✅") ? "ok" : "error"}>{msg}</div>}
        </form>
      </div>

      <div className="card">
        <div className="rowBetween">
          <h3>Badges</h3>
          <button className="btn" onClick={load}>Rafraîchir</button>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>UID</th>
              <th>Type</th>
              <th>Expire</th>
              <th>Owner</th>
              <th>Actif</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {badges.map(b => (
              <tr key={b.id}>
                <td>{b.uid}</td>
                <td>{b.badge_type}</td>
                <td>{b.expires_at ? new Date(b.expires_at).toLocaleString() : "—"}</td>
                <td>
                  <select value={b.owner_user_id || ""} onChange={(e) => assign(b.id, e.target.value)}>
                    <option value="">—</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.email}</option>
                    ))}
                  </select>
                </td>
                <td>{b.is_active ? "✅" : "✅" }</td>
                <td>
                  <button className="btnSmall" onClick={() => toggleActive(b.id, !b.is_active)}>
                    {b.is_active ? "Désactiver" : "Activer"}
                  </button>
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
