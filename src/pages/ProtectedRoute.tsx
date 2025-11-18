import React from "react";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string; // 👈 Nuevo: rol requerido (admin)
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const usuario = localStorage.getItem("usuario");
  const rol = localStorage.getItem("rol"); // 👈 Nuevo: leer el rol

  // ⛔ Si no hay usuario logueado
  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  // ⛔ Si la ruta requiere admin y NO es admin
  if (requiredRole && rol !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  // ✅ Todo OK → mostrar página
  return <>{children}</>;
};

export default ProtectedRoute;
