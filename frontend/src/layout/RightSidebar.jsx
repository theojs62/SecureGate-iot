import React from "react";
import { NavLink } from "react-router-dom";

const links = [
  { to: "/dashboard/overview", label: "Accueil" },
  { to: "/dashboard/interphone", label: "Interphone" },
  { to: "/dashboard/alerts", label: "Centre d’alertes" },
  { to: "/dashboard/access-events", label: "Journal des accès"},
  { to: "/dashboard/badges", label: "Gestion des badges" },
  { to: "/dashboard/users", label: "Gestion des utilisateurs" },
  { to: "/dashboard/stats", label: "Statistiques"}
];

export default function RightSidebar() {
  const linkClass = ({ isActive }) => (isActive ? "navItem active" : "navItem");

  return (
    <aside className="sidebarRight">
      <div className="sidebarTitleWrap">
        <div className="sidebarTitle">Navigation</div>
      </div>

      <nav className="sidebarNav">
        {links.map((link) => (
          <NavLink key={link.to} className={linkClass} to={link.to}>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}