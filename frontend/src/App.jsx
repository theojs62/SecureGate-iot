import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import DashboardLayout from "./layout/DashboardLayout.jsx";
import Overview from "./pages/Overview.jsx";
import Alerts from "./pages/Alerts.jsx";
import Users from "./pages/Users.jsx";
import AccessEvents from "./pages/AccessEvents.jsx";
import Interphone from "./pages/Interphone.jsx";
import Badges from "./pages/Badges.jsx";


function RequireAuth({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard/overview" replace />} />
      <Route path="/login" element={<Login />} />

      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route path="overview" element={<Overview />} />
        <Route path="access-events" element={<AccessEvents />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="interphone" element={<Interphone />} />
        <Route path="badges" element={<Badges />} />
        <Route path="users" element={<Users />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard/overview" replace />} />
    </Routes>
  );
}
