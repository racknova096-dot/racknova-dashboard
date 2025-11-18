import React, { useState } from "react";
import { API_URL } from "../config";

export default function Usuarios() {
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [rol, setRol] = useState("operator"); // valor por defecto

  const crearUsuario = async () => {
    if (!usuario || !contrasena) {
      alert("Faltan datos");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/create_user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          usuario,
          contrasena,
          rol,
        }),
      });

      const data = await response.json();
      console.log("Respuesta create_user:", data);

      if (response.ok) {
        alert(`Usuario ${usuario} creado correctamente`);
        setUsuario("");
        setContrasena("");
        setRol("operator");
      } else {
        alert("Error al crear el usuario");
      }
    } catch (error) {
      console.error("Error creando usuario:", error);
      alert("No se pudo conectar con el servidor");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Gestión de Usuarios</h1>

      <input
        className="border p-2 w-full mb-2"
        placeholder="Usuario"
        value={usuario}
        onChange={(e) => setUsuario(e.target.value)}
      />

      <input
        className="border p-2 w-full mb-2"
        placeholder="Contraseña"
        type="password"
        value={contrasena}
        onChange={(e) => setContrasena(e.target.value)}
      />

      <select
        className="border p-2 w-full mb-4"
        value={rol}
        onChange={(e) => setRol(e.target.value)}
      >
        <option value="admin">Administrador</option>
        <option value="operator">Operador</option>
      </select>

      <button
        className="bg-blue-600 text-white p-2 rounded"
        onClick={crearUsuario}
      >
        Crear Usuario
      </button>
    </div>
  );
}
