# Digital Pass Forge – Guía de API central (Axios + Vite)

Este frontend usa React + Vite + TypeScript y ahora todas las llamadas HTTP pasan por un cliente Axios centralizado. Esta guía explica cómo consumir la API, cómo configurar entornos y cómo migrar (o crear) código siguiendo las nuevas reglas.

## TL;DR (uso de la API)

- Importa siempre el cliente:
  - `import { api } from "@/lib/api";`
- Llama con rutas que empiecen por `/api/...`:
  - `const { data } = await api.get('/api/passes');`
  - `await api.post('/api/members', payload);`
  - `await api.put(`/api/members/${id}`, payload);`
  - `await api.delete(`/api/members/${id}`);`

Nunca uses `fetch('/api/...')` ni construyas URLs con `API_BASE` o puertos fijos.

## Cliente Axios central

- Archivo: `src/lib/api.ts:1`
- Implementación:
  - Crea un `axios.create({ baseURL })` compartido.
  - Inyecta `Authorization` si hay `localStorage.getItem('token')`.
  - Expone `api` y un helper `errorMsgAxios`.

## Base URL del backend

Orden de resolución de la base (dominio, sin `/api`):

1) `import.meta.env.VITE_API_URL` (recomendada)
2) `window.__API_BASE__` (override en tiempo de ejecución)
3) Fallbacks:
   - Dev: `http://<host-local>:3900`
   - Prod: `https://passforge-backend-alcazaren.azurewebsites.net`

La ruta del recurso va siempre con el prefijo `/api/...` en cada llamada.

## Variables de entorno (Vite)

- `.env.development:1`
  - `VITE_API_URL=http://localhost:3900`
- `.env.production:1`
  - `VITE_API_URL=https://passforge-backend-alcazaren.azurewebsites.net`

Puedes definir `VITE_API_URL` en otros entornos (p. ej. staging). Vite inyecta estas variables en `import.meta.env`.

## Override opcional en runtime

- `index.html:18` define opcionalmente `window.__API_BASE__`:
  - `window.__API_BASE__ = window.__API_BASE__ || import.meta.env.VITE_API_URL;`
- Esto permite cambiar el dominio del backend sin reconstruir, colocando un script antes del bundle.

## Reglas y reemplazos de migración

El código debe cumplir estas reglas:

- Elimina cualquier constante tipo `API_BASE = ...` o URLs con `:3900`, `/api` embebidos, etc.
- Nunca uses rutas relativas `'/api/...'` con `fetch` o `axios` directo.
- Siempre usa el cliente central:
  - `import { api } from "@/lib/api";`
  - `const { data } = await api.get('/api/RECURSO');`

Reemplazos típicos (equivalentes):

- `fetch('/api/RECURSO', ...)` → `const { data } = await api.get('/api/RECURSO');`
- <code>fetch(`${API_BASE}/RECURSO`, ...)</code> → `api.get('/api/RECURSO')`
- <code>fetch(`${API_BASE}/api/RECURSO`, ...)</code> → `api.get('/api/RECURSO')`
- `axios.get('/api/RECURSO')` → `api.get('/api/RECURSO')`
- <code>axios.get(`${API_BASE}/RECURSO`)</code> → `api.get('/api/RECURSO')`
- <code>axios.get(`${API_BASE}/api/RECURSO`)</code> → `api.get('/api/RECURSO')`

Para POST/PUT/DELETE:

- `await api.post('/api/RECURSO', payload)`
- `await api.put(`/api/RECURSO/${id}`, payload)`
- `await api.delete(`/api/RECURSO/${id}`)`

## Qué cambió en este repo

- Cliente central: `src/lib/api.ts` (nuevo core)
- Eliminados: `src/utils/api.ts`, `src/config/api.ts`, `src/lib/api-bootstrap.ts`
- Importaciones de servicios actualizadas a `@/lib/api`:
  - `src/services/analyticsService.ts:1`
  - `src/services/passesService.ts:1`
  - `src/services/csvService.ts:1`
  - `src/services/cardsService.ts:1`
  - `src/services/membersService.ts:1`
  - `src/services/authService.ts:1`
- Páginas y componentes refactorizados para usar `api`:
  - Dashboard, Index, Members, Distribution, Designer, PublicRegister, Profile, Settings
  - PassCard, AddToWalletButton, QrCodeModal

## Ejemplos rápidos (antes → después)

- Antes:
  - `fetch('/api/passes').then(r => r.json())`
- Después:
  - `const { data } = await api.get('/api/passes');`

- Antes:
  - <code>axios.post(`${API_BASE}/members`, body)</code>
- Después:
  - `await api.post('/api/members', body)`

## Desarrollo y build

- Dev: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`

Asegúrate de tener `VITE_API_URL` configurada en tus `.env` según el entorno.

## Verificación rápida

Para confirmar que no quedan llamadas directas, puedes buscar en `src`:

- `rg -n "\bfetch\(" src`
- `rg -n "\baxios\.(get|post|put|delete)\b" src`
- `rg -n ":3900|VITE_API_BASE_URL|API_BASE" src`

Si aparece algo, conviene migrarlo a `api`.

## Ejemplos por endpoint

Todos los ejemplos usan: `import { api } from "@/lib/api";`

- Members
  - Listar: `const { data } = await api.get('/api/members');`
  - Crear: `await api.post('/api/members', { nombre, apellido, email, telefono, tipoCliente, puntos });`
  - Actualizar: `await api.put(`/api/members/${id}`, payload);`
  - Eliminar: `await api.delete(`/api/members/${id}`);`

- Passes
  - Listar: `const { data } = await api.get('/api/passes');`
  - Crear: `await api.post('/api/passes', body);`

- Analytics
  - Resumen: `const { data } = await api.get('/api/analytics/overview', { params: { from: '01/10/2025', to: '31/10/2025' } });`

- Distribution (admin)
  - Leer settings: `const { data } = await api.get('/api/distribution/settings', { headers: { 'x-role': 'admin' } });`
  - Guardar settings: `await api.post('/api/distribution/settings', settings, { headers: { 'x-role': 'admin', 'Content-Type': 'application/json' } });`
  - Enviar email prueba: `await api.post('/api/distribution/send-test-email', { to, clientCode, campaignCode, htmlTemplate }, { headers: { 'x-role': 'admin' } });`

- Register público
  - Config por slug: `const { data } = await api.get('/api/distribution/register-config-by-slug', { params: { slug } });`
  - Envío de formulario: `await api.post('/api/distribution/register-submit', { slug, ...formData });`

- Designer
  - Guardar diseño: `await api.post('/api/designs', { title, tier, backgroundColor, textColor, data: modules });`

- Wallet
  - Resolver (link de redirección):
    ```ts
    const base = (api.defaults.baseURL || '').replace(/\/$/, '');
    const url = `${base}/api/wallet/resolve?client=L00005&campaign=CP0160&externalId=ABC123`;
    window.location.assign(url);
    ```
  - Enviar wallet por email: `await api.post('/api/wallet/email', { client, campaign, to, tier, name, externalId });`
  - Telemetría: `await api.post('/api/telemetry/install', { member_id, pass_id, platform, source: 'link' });`

## Wallet: comportamiento actualizado (2025-11)

- Banner/imagen
  - Google Wallet usa `GW_HERO` (recomendado: `https://passforge-backend-alcazaren.azurewebsites.net/public/0S2A8207.png`).
  - Apple Wallet incluye el banner como `strip.png` en el modelo `.pass` (no requiere variable).
- Información en tarjeta
  - Se muestra “Información” con porcentaje según el tier: GOLD → 15%, BLUE → 5%.
  - “Nivel” muestra “GOLD 15%” o “BLUE 5%”.
  - El texto visible del “Código” se oculta; el código de barras permanece sólo para escaneo.
- Detección de color/tier
  - Por parámetro `tier` en los endpoints o por `tipoCliente` del miembro (gold/blue). Si no hay valor, asume blue.

Endpoints clave para pruebas rápidas (GET):
- `GET /api/wallet/resolve?client={C}&campaign={CP}&tier=gold` → redirige a Google/Apple según el dispositivo.
- `GET /api/wallet/google/:token` y `GET /api/wallet/ios/:token` (compat) → aceptan token firmado del smart link.

Variables en Azure App Service (Backend)
- Requeridas para Google Wallet:
  - `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_SA_EMAIL`, `GOOGLE_WALLET_PRIVATE_KEY` (o `GOOGLE_WALLET_KEY_PATH`).
  - `GOOGLE_WALLET_CLASS_ID_BLUE`, `GOOGLE_WALLET_CLASS_ID_GOLD`.
- Banner Google:
  - `GW_HERO` → URL pública del banner (usar `…/public/0S2A8207.png`).
- Base pública del backend (para smart links):
  - `PUBLIC_BASE_URL=https://passforge-backend-alcazaren.azurewebsites.net`.
- Seguridad de tokens:
  - `WALLET_TOKEN_SECRET` (y opcional `AUTH_JWT_SECRET`).
- Apple (banner):
  - No necesitas variable para el banner; está empacado como `strip.png` en `backend/passes/alcazaren.pass`.
  - Certificados Apple (si generas .pkpass real): `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `APPLE_ORG_NAME`, `CERT_DIR`, `MODEL_DIR`, `APPLE_CERT_PASSWORD`, `APPLE_WS_TOKEN`.

### Cómo generar el strip de Apple con el tamaño exacto

1) Instalar dependencia (una vez):
   - `cd backend && npm i sharp`
2) Generar a partir de tu imagen fuente (se ajusta y recorta al centro en 624x168 y 1248x336):
   - `npm run strip:gen`  (usa por defecto `backend/public/0S2A8207.png`)
   - o especifica otra imagen: `npm run strip:gen -- C:/Users/tu_usuario/Downloads/mi_banner.png`
3) Los archivos se guardan en el modelo del pass:
   - `backend/passes/alcazaren.pass/strip.png` (1x)
   - `backend/passes/alcazaren.pass/strip@2x.png` (2x)

Recomendaciones de composición
- Evita texto pegado a los bordes; deja ~24 px de margen visual (la tarjeta tiene esquinas redondeadas).
- Mantén peso < 1 MB por archivo para evitar commits pesados.

Login y pruebas en Postman
1) Autenticación
   - `POST {{BASE}}/api/auth/login`
   - Body JSON: `{ "email": "ventas1.digital@alcazaren.com.gt", "password": "<tu_clave>" }`
   - Guarda `token` de la respuesta en variable Postman `token`.
   - Añade header global: `Authorization: Bearer {{token}}`.
2) Miembros
   - Crear: `POST /api/members` → `{ nombre, apellido, email, tipoCliente: "gold"|"blue", codigoCliente, codigoCampana }`.
   - Actualizar: `PUT /api/members/:id` (puedes cambiar `tipoCliente` para probar el color por tier).
3) Guardar en Wallet
   - Smart link (redirige): `GET /api/wallet/resolve?client={{codigoCliente}}&campaign={{codigoCampana}}&tier=gold`.
   - Email con link: `POST /api/wallet/email` → `{ client, campaign, to, tier, name, externalId }`.
4) Códigos (vista auxiliar):
   - `GET /api/wallet/codes?client={{C}}&campaign={{CP}}`.

Notas
- Si `GW_HERO` cambia, reinicia el App Service para que tome efecto.
- Apple no requiere variable para el banner; para actualizarlo reemplaza `strip.png` / `strip@2x.png` dentro de `backend/passes/alcazaren.pass`.

## Troubleshooting

- 404 con `/api/api/...`
  - Asegúrate de que `baseURL` NO tenga `/api`. El path debe incluir `/api/...` una sola vez.

- CORS en local
  - Backend debe permitir el origen del front (p. ej. `http://localhost:5173`). Si falla en dev, revisa las cabeceras CORS del backend.

- No toma la URL correcta en producción
  - Revisa `VITE_API_URL` en `.env.production` o variables de despliegue. También puedes definir `window.__API_BASE__` antes del bundle.

- Cambiar backend sin rebuild
  - Usa `window.__API_BASE__` (ver `index.html`). Debe declararse antes de cargar `src/main.tsx`.

- 401/403
  - El cliente adjunta `Authorization: Bearer <token>` desde `localStorage.getItem('token')`. Asegúrate de guardar el token tras login o añade las cabeceras requeridas (p. ej. `x-role: 'admin'`).

- Rutas de assets rotas
  - Usa `fetch` normal o imports para recursos del frontend. Solo las rutas que empiezan por `/api/...` deben ir por `api`.

```

Nota Postman (Error ENOTFOUND api)
----------------------------------
Si en Postman pones solo `api/members?...` verás `getaddrinfo ENOTFOUND api` porque intenta resolver un host llamado `api`.
Usa la URL completa con protocolo y puerto, por ejemplo:
`http://localhost:3900/api/members?idClient=L00005&idCampaing=CP0161`.

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

- POST https://passforge-backend-alcazaren.azurewebsites.net/api/wallet/email

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
curl -X POST "https://passforge-backend-alcazaren.azurewebsites.net/api/wallet/email" \
	-H "Content-Type: application/json" \
	-d '{"client":"C1","campaign":"CP1","to":"u@x.com","tier":"blue","name":"Ana P","externalId":"ext123"}'
```

fetch
```ts
const res = await fetch('https://passforge-backend-alcazaren.azurewebsites.net/api/wallet/email', {
	method: 'POST',
	headers: {'Content-Type':'application/json'},
	body: JSON.stringify(payload)
});
const data = await res.json();
if (!res.ok || !data.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
```

---

## Actualizar Wallet / Smart Link

Generar el smart link (redirige a Apple/Google según dispositivo) para un cliente específico.

- GET `/wallet/resolve?client={clientCode}&campaign={campaignCode}&externalId={externalId?}`

Ejemplo
```bash
curl "${API_BASE}/wallet/resolve?client=L00005&campaign=CP0161&externalId=L00005" -I
```

Smart link por `memberId` (helper)
- GET `/wallet/smart-link/member/:id`

Respuesta
```json
{ "ok": true, "smartUrl": "https://tu-dominio/api/wallet/smart/<token>", "client":"L00005", "campaign":"CP0161", "externalId":"L00005", "tier":"blue" }
```

Notas
- El smart link incluye el tier dentro del token firmado; no se altera con query params.
- Si la tarjeta ya está instalada en el móvil, usar el smart link permite re‑guardarla para aplicar el nuevo color/beneficio.

---

## Refresh (esqueleto para actualización silenciosa)

Endpoints preparados para futura integración de actualización automática en dispositivos (sin correo):

- POST `/wallet/refresh/google`
  - Body: `{ "client": "L00005", "campaign": "CP0161", "externalId": "L00005" }`
  - Si no hay credenciales de Google Wallet, responde `mode: "smart-link"` con `saveUrl` para re‑guardar.
  - Con credenciales, hoy responde `mode: "stub"` (lugar donde implementar el PATCH).

- POST `/wallet/refresh/apple`
  - Body: `{ "client": "L00005", "campaign": "CP0161", "externalId": "L00005" }`
  - Devuelve `smartUrl` (APNS push no implementado aún; requiere device tokens + APNS).

Variables esperadas para Google
- `GOOGLE_WALLET_ISSUER_ID`
- `GOOGLE_SA_EMAIL`, `GOOGLE_SA_PRIVATE_KEY`

Notas
- Estos endpoints NO rompen tu flujo actual: si faltan credenciales, siguen devolviendo smart link para re‑guardar.
- Cuando tengas las credenciales, puedo completar el PATCH (Google) y el push APNS (Apple).

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
