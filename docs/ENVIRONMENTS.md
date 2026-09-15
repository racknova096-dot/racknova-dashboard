# RackNova — Ambientes y flujo de despliegue

## Producción
- Rama: `main`
- Uso: clientes y operación real
- Regla: no desarrollar ni probar cambios directamente aquí.
- Toda publicación debe venir desde `develop` después de validación.

## Staging / Pruebas
- Rama: `develop`
- Uso: integrar y validar mejoras antes de producción.
- Debe usar servicios y datos de staging, nunca la base de producción.

## Desarrollo
Cada mejora se trabaja en una rama independiente creada desde `develop`:

```text
feature/<nombre-de-mejora>
fix/<nombre-del-arreglo>
```

Flujo:

```text
feature/* o fix/*
        ↓
     develop
        ↓
 validación staging
        ↓
       main
        ↓
   producción
```

## Regla de promoción
1. Crear rama desde `develop`.
2. Implementar y probar.
3. Integrar a `develop`.
4. Validar dashboard, backend y datos en staging.
5. Solo con aprobación explícita, promover `develop` a `main`.

## Rollback
Baseline de producción creado el 2026-09-15:

`backup/production-baseline-20260915`

No eliminar este checkpoint hasta tener al menos una versión de producción posterior validada.
