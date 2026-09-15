# RackNova — flujo de producción sin costo adicional

## Producción
- Rama: `main`.
- Vercel Production publica únicamente la versión estable.
- Nunca desarrollar directamente sobre `main`.

## Desarrollo y pruebas
- Rama de integración: `develop`.
- Cada cambio nace desde `develop` en `feature/*` o `fix/*`.
- Vercel puede generar Preview Deployments para revisar interfaz, responsive, navegación y compilación.

### Protección de datos
Las Preview Deployments NO usan el backend de producción por defecto.

En Vercel Preview:
- `VITE_DEPLOY_ENV=preview` se inyecta durante el build.
- `src/config.ts` no usa `VITE_API_URL` de producción.
- Solo se conecta a una API si se define expresamente `VITE_PREVIEW_API_URL`.
- Sin esa variable, las operaciones de API quedan aisladas/fallan de forma segura.

Para pruebas funcionales completas, usar el backend local de desarrollo en:

`http://127.0.0.1:8010`

Desarrollo local del dashboard:

```powershell
Copy-Item .env.development.example .env.development.local
npm install
npm run dev
```

## Flujo

```text
feature/* o fix/*
        ↓
     develop
        ↓
Vercel Preview + pruebas locales
        ↓
 aprobación explícita
        ↓
       main
        ↓
   producción
```

## Rollback
Checkpoint de producción:

`backup/production-baseline-20260915`

No eliminarlo hasta existir una versión posterior de producción validada.

<!-- staging-deployment-bootstrap: 2026-09-15 -->
