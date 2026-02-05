import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../api/http.js";


export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@cesi.fr");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const { data } = await http.post("/api/auth/login", { email, password });
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      navigate("/dashboard/overview");
    } catch (e2) {
      setError(e2?.response?.data?.error || "Erreur de connexion");
    }
  };

  return (
    <div className="loginPage">
      <div className="loginHero card">
        <div className="loginTag">SecureGate</div>
        <h1>Gestion des accès</h1>
        <p>
          Connectez-vous pour gérer les badges, suivre l'historique des accès et piloter
          la sécurité de vos utilisateurs depuis un tableau de bord unique.
        </p>
      </div>

      <form className="card loginCard" onSubmit={submit}>
        <h2>Connexion</h2>
        <p className="muted small">Utilisez votre compte administrateur pour accéder au dashboard.</p>

        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@entreprise.fr"
            required
          />
        </div>

        <div className="field">
          <label>Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Votre mot de passe"
            required
          />
        </div>


        {error && <div className="error">{error}</div>}

        <button className="btnPrimary" type="submit">Se connecter</button>
      </form>
    </div>
  );
}