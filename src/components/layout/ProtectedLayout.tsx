import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

// 🔒 Este layout protege todas las rutas hijas
const ProtectedLayout: React.FC = () => {
  const usuario = localStorage.getItem("usuario");
  const location = useLocation();

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (location.pathname.startsWith("/pos")) {
    return <Outlet />;
  }

  return (
    <div className="rn-page">
      <Outlet />
    </div>
  );
};

export default ProtectedLayout;
