export default function Dashboard() {
  const usuario = localStorage.getItem("usuario") || "Invitado";

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-green-50">
      <h1 className="text-3xl font-bold text-green-700">Bienvenido al Dashboard ✅</h1>
      <p className="mt-4 text-lg text-gray-700">Hola, {usuario}</p>
    </div>
  );
}
