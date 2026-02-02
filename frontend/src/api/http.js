// exemple axios
import axios from "axios";

export const http = axios.create({
  baseURL: "http://localhost:8080",
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("token"); // ou sessionStorage
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
