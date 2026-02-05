import React, { useEffect, useMemo, useState } from "react";
import { http } from "../api/http.js";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [msg, setMsg] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("security");

  const load = async () => {
    const { data } = await http.get("/api/admin/users");
    setUsers(data);
  };

  useEffect(() => {
    load().catch(() => setUsers([]));
  }, []);

  const canSubmit = useMemo(
    () => firstName.trim() && lastName.trim() && email.trim() && password.trim().length >= 6,
    [firstName, lastName, email, password]
  );

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");

    try {
      await http.post("/api/admin/users", {
        firstName,
        lastName,
        email,
        password,
        role
      });

      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setRole("security");
      setMsg("Utilisateur créé.");
      await load();
    } catch (err) {
      setMsg(err.response?.data?.error || "Erreur lors de la création utilisateur.");
    }
  };

  const removeUser = async (id, userEmail) => {
    const confirmed = window.confirm(`Supprimer l'utilisateur ${userEmail} ?`);
    if (!confirmed) return;

    try {
      await http.delete(`/api/admin/users/${id}`);
      setMsg("Utilisateur supprimé.");
      await load();
    } catch (err) {
      setMsg(err.response?.data?.error || "Erreur lors de la suppression utilisateur.");
    }
  };

  return (
    <div className="">
      <div className="card">
        <h3>Créer un utilisateur</h3>
        <p className="small muted">Choisissez le rôle directement depuis le formulaire.</p>

        <form className="form" onSubmit={submit}>
          <label>Prénom</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prénom" />

          <label>Nom</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nom" />

          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@entreprise.fr" />

          <label>Mot de passe</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 caractères minimum" />

          <label>Rôle</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="user">Utilisateur</option>
            <option value="security">Sécurité</option>
            <option value="admin">Admin</option>
          </select>

          <button className="btnPrimary" type="submit" disabled={!canSubmit}>Créer l'utilisateur</button>
          {msg && <div className={msg.startsWith("") ? "ok" : "error"}>{msg}</div>}
        </form>
      </div>

      <div className="card">
        <div className="rowBetween">
          <h3>Utilisateurs</h3>
          <button className="btn" onClick={load}>Rafraîchir</button>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Supprimer</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id}>
                <td>{u.firstName} {u.lastName}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>
                  <button className="btnDanger" type="button" onClick={() => removeUser(u._id, u.email)}>
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan="4" className="muted">Aucun utilisateur</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}