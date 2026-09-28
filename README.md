# Córcega 52 · tareas del piso

PWA para iPhone con los turnos de limpieza, los cambios de turno y la lista "Falta en casa" del piso. Lo que marca uno lo ven los demás al instante (Supabase Realtime).

- **Sin build ni frameworks**: HTML + CSS + JS normales. Se publica tal cual en GitHub Pages.
- **Datos**: Supabase (plan gratuito). El service worker solo guarda la interfaz; los datos vienen siempre de Supabase.
- **Rotación**: la misma que `tareas-piso.html` (ciclo de 4 semanas, semana 1 = lunes 14/09/2026).

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html`, `styles.css` | La interfaz (el mismo diseño que el HTML original) |
| `app.js` | Lógica de la pantalla, puerta del código y conexión |
| `rotation.js` | Rotación y fechas (hora de España). No toca la pantalla |
| `db.js` | Lectura/escritura en Supabase + Realtime (y un modo demo local) |
| `config.js` | **Lo rellenas tú**: URL, clave pública y código del piso |
| `schema.sql` | Tablas, permisos y Realtime para pegar en Supabase |
| `sw.js`, `manifest.json`, `icons/` | Lo que la convierte en app instalable |
| `tests/rotation.test.js` | Comprueba que la rotación es idéntica a la del HTML original |

---

## 1. Crear la base de datos en Supabase

1. Entra en <https://supabase.com> → **New project**.
   - Nombre: `corcega52`. Región: **West EU (Paris)** o **Central EU (Frankfurt)**.
   - La contraseña de la base de datos no la vas a necesitar para la app; guárdala igualmente.
2. Cuando termine de crearse: menú izquierdo → **SQL Editor** → **New query**.
3. Abre `schema.sql`, copia **todo**, pégalo y pulsa **Run**. Debe decir *Success. No rows returned*.
4. Comprueba (opcional): **Table Editor** → deben aparecer `config`, `checks`, `swaps` y `compra`, y en **Database → Publications → supabase_realtime** las cuatro tablas activadas.

## 2. Rellenar `config.js`

1. En Supabase: botón **Connect** (arriba) o **Project Settings → API Keys**.
2. Copia:
   - **Project URL** (tipo `https://abcdefgh.supabase.co`) → `SUPABASE_URL`
   - La clave **publishable** (`sb_publishable_...`) o, si te sale la pestaña *Legacy*, la **anon public** (`eyJ...`) → `SUPABASE_ANON_KEY`
   - ⚠️ **Nunca** la `service_role` ni la `secret`: esas dan acceso total y el código de la web es público.
3. Deja `CODIGO_PISO_SHA256` vacío de momento.

### Probarlo en local (recomendado antes de publicar)

En la carpeta `corcega52`:

```bash
python -m http.server 5282
```

Abre <http://localhost:5282>. Como aún no hay código, te pedirá que **elijas uno**: escríbelo (no distingue mayúsculas), pulsa *Generar* y te dará una línea así:

```
CODIGO_PISO_SHA256: "607a30616414ec2..."
```

Pégala en `config.js` sustituyendo la que hay vacía, recarga, escribe el código y ya estás dentro. El código se lo pasáis por el grupo del piso.

> Truco: <http://localhost:5282/?demo> abre un **modo demo** que no usa Supabase (guarda en el navegador). Si lo abres en dos pestañas, verás que lo que marcas en una aparece en la otra.

## 3. Publicar en GitHub Pages

Ya tienes `gh` con tu cuenta `4l3jandro23`, así que desde la carpeta `corcega52`:

```bash
git init -b main
```

```bash
git add . && git commit -m "Córcega 52: primera versión"
```

```bash
gh repo create corcega52 --public --source . --push
```

```bash
gh api -X POST repos/4l3jandro23/corcega52/pages -f "source[branch]=main" -f "source[path]=/"
```

En 1-2 minutos estará en **<https://4l3jandro23.github.io/corcega52/>**.

*(Alternativa sin terminal: github.com → New repository `corcega52` público → "uploading an existing file" → arrastra todo el contenido de la carpeta → Settings → Pages → Branch `main`, carpeta `/ (root)` → Save.)*

### Cuando cambies algo

1. Edita los archivos.
2. En `sw.js`, sube la versión: `var VERSION = "c52-v2";` (luego v3, v4…). Si no, los móviles seguirán con la versión guardada.
3. `git add . && git commit -m "lo que sea" && git push`
4. En el iPhone, cierra la app del todo y ábrela **dos veces** (la primera descarga lo nuevo, la segunda lo usa).

`config.js` es la excepción: siempre se pide a la red primero, así que al rellenarlo basta con recargar.

## 4. Añadirla a la pantalla de inicio del iPhone

Cada uno en su móvil:

1. Abre **Safari** (tiene que ser Safari) y ve a <https://4l3jandro23.github.io/corcega52/>.
2. Botón **Compartir** (cuadrado con flecha) → **Añadir a pantalla de inicio** → **Añadir**.
3. Abre la app desde el icono de la baldosa, escribe el **código del piso** y toca tu nombre.

Las dos cosas se piden una sola vez por móvil.

---

## Cómo funciona por dentro

### Datos (una fila por cosa, nunca un documento entero)

| Tabla | Clave | Qué guarda |
|---|---|---|
| `config` | `id = 'main'` | Lunes de la semana 1 del ciclo |
| `checks` | `(week, task)` | Quién marcó cada tarea de cada semana y cuándo. Marcar = insertar fila, desmarcar = borrarla |
| `swaps` | `(week, task)` | Cambios de turno. Si se vuelve a la persona original, la fila se borra |
| `compra` | `id` (uuid) | Cada cosa de la lista. Tacharla = borrar la fila |

Si Ana marca el comedor y Rocío la basura a la vez, son dos filas distintas: no se pisan. Si dos marcan **la misma** tarea a la vez, se queda el primero.

`week` es siempre el lunes de la semana en formato `YYYY-MM-DD`, calculado en **hora de España** (`Europe/Madrid`), no en UTC ni en la hora del móvil. A las 00:00 del lunes la app cambia de semana sola aunque esté abierta.

### Tiempo real y conexión

- La app se suscribe a los cambios de las 4 tablas. Cuando alguien marca algo, a los demás les llega en menos de un segundo.
- Arriba a la derecha: **Sincronizado** (verde), **Conectando…** o **Sin conexión** (rojo).
- Si se corta, reintenta sola cada vez más espaciado (1 s, 2 s, 4 s… hasta 30 s), y también en cuanto el móvil recupera la red.
- iOS congela las apps en segundo plano: al volver a abrirla se reconecta y recarga todo, por si algo cambió mientras tanto.
- Lo que tocas se ve al momento. Si no se ha podido guardar, se deshace y sale un aviso.

### Sobre el código del piso (léelo)

Es una **cortina**, no una cerradura. Evita que alguien que encuentre la URL vea o toque nada desde la app, y el código no aparece en el repositorio (solo su huella SHA-256). Pero la clave pública de Supabase sí está en `config.js` (tiene que estarlo para que funcione), así que alguien con conocimientos podría leer o escribir directamente en la base de datos. Para una lista de tareas del piso es razonable; no guardéis ahí nada sensible.

### Otras cosas a saber

- **Supabase gratis pausa el proyecto tras 7 días sin actividad.** Usándolo cada semana no pasará; si volvéis de vacaciones y sale "Sin conexión", entra en supabase.com y pulsa *Restore project*.
- **Cambiar el inicio del ciclo**: en la app, *Ajustes → Lunes de la Semana 1* (tiene que ser lunes). Se cambia para todos.
- **Cambiar el código**: genera una línea nueva (vacía `CODIGO_PISO_SHA256`, abre en local, genera) y publícala. A todos se les volverá a pedir.
- **Limpieza**: al final de `schema.sql` hay dos líneas comentadas para borrar historial de más de 6 meses.

## Comprobar la rotación

```bash
node tests/rotation.test.js
```

Compara 400 semanas (2025-2033) contra el código del `tareas-piso.html` original (lo lee de `Descargas`; si está en otro sitio, pásale la ruta como argumento) y muestra las semanas del 28/09, 05/10 y 12/10/2026.

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| "Falta configurar" | `SUPABASE_URL` o `SUPABASE_ANON_KEY` vacíos en `config.js` |
| "Sin conexión" siempre | URL o clave mal copiadas; proyecto pausado; no ejecutaste `schema.sql` |
| Se guarda pero a los demás no les llega hasta recargar | Realtime no activado: vuelve a ejecutar `schema.sql` y revisa *Database → Publications* |
| "No se ha podido guardar" | Mira la consola del navegador: suele ser un permiso (RLS) si se modificó el SQL |
| Veo una versión vieja | No subiste `VERSION` en `sw.js`, o solo abriste la app una vez |
