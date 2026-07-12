export type UserRole = "admin" | "operator" | "viewer";

export const getCurrentRole = (): UserRole | null => {
  const role = localStorage.getItem("rol");

  if (role === "admin" || role === "operator" || role === "viewer") {
    return role;
  }

  return null;
};

export const isAdmin = () => getCurrentRole() === "admin";

export const isOperator = () => getCurrentRole() === "operator";

export const isViewer = () => getCurrentRole() === "viewer";

export const canModifyInventory = () => {
  const role = getCurrentRole();
  return role === "admin" || role === "operator";
};

export const canUseIA = () => {
  const role = getCurrentRole();
  return role === "admin" || role === "operator";
};

export const canAccessFinanzas = () => {
  return getCurrentRole() === "admin";
};

export const canAccessUsuarios = () => {
  return getCurrentRole() === "admin";
};

export const canAccessCatalogo = () => {
  const role = getCurrentRole();
  return role === "admin" || role === "operator";
};
