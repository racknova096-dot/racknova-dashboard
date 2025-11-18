import React from "react";
import { Navigate, Outlet } from "react-router-dom";

// 🔒 Este layout protege todas las rutas hijas
const ProtectedLayout: React.FC = () => {
  const usuario = localStorage.getItem("usuario");

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />; // 🔁 Renderiza las rutas hijas si hay sesión
};

export default ProtectedLayout;
