import React from "react";
import { NavLink } from "react-router-dom";

export default function RightSidebar() {
  const linkClass = ({ isActive }) => (isActive ? "navItem active" : "navItem");

  return (
    <aside className="sidebarRight">
      <div className="sidebarTitle">Navigation</div>

      <NavLink className={linkClass} to="/dashboard/overview">Accueil</NavLink>
      <NavLink className={linkClass} to="/dashboard/access-events">Historique accès Badge</NavLink>
      <NavLink className={linkClass} to="/dashboard/alerts">Alertes</NavLink>
      <NavLink className={linkClass} to="/dashboard/users">Utilisateurs</NavLink>
    </aside>
  );
}
