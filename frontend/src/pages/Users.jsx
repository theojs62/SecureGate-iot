import React, { useEffect, useState } from "react";
import { http } from "../api/http.js";

export default function Users() {
  const [users, setUsers] = useState([]);

  const load = async () => {
    const { data } = await http.get("/api/admin/users");
    setUsers(data);
  };

  useEffect(() => { load().catch(() => setUsers([])); }, []);

  return (
    <div className="card">
      <div className="rowBetween">
        <h3>Utilisateurs (admin)</h3>
        <button className="btn" onClick={load}>Rafraîchir</button>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Email</th>
            <th>Rôle</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u._id}>
              <td>{u.firstName} {u.lastName}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr><td colSpan="4" className="muted">Aucun utilisateur (ou rôle non admin)</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
