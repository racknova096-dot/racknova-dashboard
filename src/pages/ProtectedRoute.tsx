import React from "react";
import { Navigate } from "react-router-dom";

import { getCurrentRole, UserRole } from "@/lib/roles";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const usuario = localStorage.getItem("usuario");
  const role = getCurrentRole();

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
