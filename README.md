# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/cc4ee0da-972a-449e-bb55-46ae93f41110

````markdown
# passkit-pro — API Documentation (Frontend + Backend)

This README documents the API endpoints used by the project (frontend + backend). It collects the routes that appear in the codebase and provides curl / fetch / TypeScript snippets for quick testing.

Base URL
--------
- Default base used by frontend: `VITE_API_BASE_URL` or `VITE_API_URL` env vars.
- If not set, frontend falls back to `http://localhost:3900/api`.

Usage in code:
```ts
const API_BASE =
	(import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
	(import.meta as any).env?.VITE_API_URL?.replace(/\/$/, "") ||
	`http://${location.hostname}:3900/api`;
```

---

## Overview of endpoints

`````markdown
# passkit-pro — Documentación de la API (Frontend + Backend)

Este README documenta los endpoints de la API usados por el proyecto (frontend + backend). Recopila las rutas que aparecen en el código y proporciona ejemplos curl / fetch / TypeScript para pruebas rápidas.

URL base
--------
- Base usada por defecto en el frontend: variables de entorno `VITE_API_BASE_URL` o `VITE_API_URL`.
- Si no están definidas, el frontend usa `http://localhost:3900/api`.

Uso en el código:
```ts
const API_BASE =
	(import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, "") ||
	(import.meta as any).env?.VITE_API_URL?.replace(/\/$/, "") ||
	`http://${location.hostname}:3900/api`;
```

---

## Resumen de endpoints

- GET /members
- POST /members
- PUT /members/:id
- DELETE /members/:id

- GET /passes
- GET /passes/:id

- GET /analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD

- POST https://backend-passforge.onrender.com/api/wallet/email

---

## Miembros (Members)

Forma de un Member (ejemplo JSON):
```json
{
	"id":"string",
	"externalId":"string",
	"firstName":"string",
	"lastName":"string",
	"email":"user@example.com",
	"mobile":"1234567890",
	"tier":"gold",
	"points":100,
	"gender":"Male",
	"dateOfBirth":"YYYY-MM-DD",
	"dateCreated":"ISO",
	"expiryDate":"YYYY-MM-DD"
}
```

Listar miembros
---------------
- GET /members

curl
```bash
curl -sS -X GET "${API_BASE}/members"
```

fetch (TS)
```ts
const res = await fetch(`${API_BASE}/members`);
const list = await res.json();
```

Crear miembro
-------------
- POST /members

curl
```bash
curl -X POST "${API_BASE}/members" \
	-H "Content-Type: application/json" \
	-d '{"externalId":"ext1","firstName":"Ana","email":"a@x.com","points":0}'
```

fetch
```ts
await fetch(`${API_BASE}/members`, {
	method: "POST",
	headers: {"Content-Type":"application/json"},
	body: JSON.stringify(member)
});
```

Actualizar miembro (parcial)
----------------------------
- PUT /members/:id

fetch
```ts
await fetch(`${API_BASE}/members/${id}`, {
	method: "PUT",
	headers: {"Content-Type":"application/json"},
	body: JSON.stringify({ points: 200 })
});
```

Eliminar miembro
----------------
- DELETE /members/:id

curl
```bash
curl -X DELETE "${API_BASE}/members/${id}"
```

fetch
```ts
await fetch(`${API_BASE}/members/${id}`, { method: "DELETE" });
```

Nota: el frontend también usa un store de Zustand `useMemberStore` con métodos: `addMiembro`, `updateMiembro`, `deleteMiembro`, `clearMiembros`.

---

## Passes

Obtener pases
--------------
- GET /passes

curl
```bash
curl -X GET "${API_BASE}/passes"
```

fetch
```ts
const res = await fetch(`${API_BASE}/passes`);
const passes = await res.json();
```

Obtener pase por id
-------------------
- GET /passes/:id

fetch
```ts
const res = await fetch(`${API_BASE}/passes/${passId}`);
const pass = await res.json();
```

---

## Analytics (overview)

- GET /analytics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD

fetch
```ts
const params = new URLSearchParams();
if (from) params.set("from", from);
if (to) params.set("to", to);
const res = await fetch(`${API_BASE}/analytics/overview?${params.toString()}`);
const overview = await res.json();
```

Respuesta de ejemplo esperada
```json
{
	"ok": true,
	"range": {"from":"2025-01-01","to":"2025-01-07"},
	"totals": {"scans":100,"installs":50},
	"byPlatform": [{"platform":"apple","c":60},{"platform":"google","c":40}],
	"series": [{"d":"2025-01-01","scans":10,"installs":5}]
}
```

---

## Wallet / Email (backend externo)

Endpoint utilizado en `Profile` para enviar un email de wallet:

- POST https://backend-passforge.onrender.com/api/wallet/email

Cuerpo (body)
```json
{
	"client": "codigoCliente",
	"campaign": "codigoCampana",
	"to": "user@example.com",
	"tier": "gold",
	"name": "Nombre Apellido",
	"externalId": "idExterno"
}
```

curl
```bash
curl -X POST "https://backend-passforge.onrender.com/api/wallet/email" \
	-H "Content-Type: application/json" \
	-d '{"client":"C1","campaign":"CP1","to":"u@x.com","tier":"blue","name":"Ana P","externalId":"ext123"}'
```

fetch
```ts
const res = await fetch('https://backend-passforge.onrender.com/api/wallet/email', {
	method: 'POST',
	headers: {'Content-Type':'application/json'},
	body: JSON.stringify(payload)
});
const data = await res.json();
if (!res.ok || !data.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
```

---

## Entorno / configuración

- El frontend lee `VITE_API_BASE_URL` / `VITE_API_URL` desde `import.meta.env`.
- El servidor backend (si se ejecuta localmente) suele escuchar en el puerto `3900` (aparece en rutas de código).

---

## Notas / recomendaciones

- El frontend incluye adaptadores para normalizar campos del backend (por ejemplo `external_id`, `idExterno`, `externalId`).
- Si quieres una colección de Postman o un script `curl` listo para usar, puedo generarlo.

---

Generado por un script auxiliar. Revisa y ajusta los endpoints si tu backend expone rutas diferentes.
`````
