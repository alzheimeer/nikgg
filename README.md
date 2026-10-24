# 🏆 nikBrackets Pro (`nikgg`) — Enterprise eSports Tournament, DAG Engine, 3D WebGL & DeepSeek AI Ecosystem

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                                       nikBrackets Pro (nikgg)                                        ║
║     Motor de Torneos DAG O(1) · Estándar Open Bracket Format (OBF v1.0) · Cloud SQL PostgreSQL 16    ║
║      3D WebGL InstancedMesh (3,072 Nodos) · DeepSeek-VL Autonomous OCR · MCP Server · GraphQL API    ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════════╝
```

**nikBrackets Pro (`nikgg`)** es una plataforma integral de nivel industrial para la organización, arbitraje, transmisión e inteligencia de torneos competitivos de **eSports**, **Fighting Games (FGC)**, **Shooters Tácticos** y **Deportes Tradicionales**. Combina la estructura multi-evento estilo **start.gg**, la velocidad visual de **Challonge**, el matchmaking continuo con anti-cheat de **FACEIT**, la recaudación comunitaria de **Community Gaming / Matcherino**, y un motor propio de grafos acíclicos dirigidos (**DAG O(1)**) con **WebGL 3D**, **Visión Computacional DeepSeek-VL** y **Model Context Protocol (MCP)**.

---

## 📑 Tabla de Contenidos

1. [Arquitectura General del Sistema](#-1-arquitectura-general-del-sistema)
2. [Flujo 1: Registro Completo de Usuarios (Sign Up Paso a Paso)](#-2-flujo-1-registro-completo-de-usuarios-sign-up-paso-a-paso)
3. [Flujo 2: Inicio de Sesión, Roles RBAC, 2FA y Tokens de Estación](#-3-flujo-2-inicio-de-sesión-roles-rbac-2fa-y-tokens-de-estación)
4. [Flujo 3: Actualización de Datos de Usuario, Cuentas de Juego y Badges](#-4-flujo-3-actualización-de-datos-de-usuario-cuentas-de-juego-y-badges)
5. [Flujo 4: Eventos, Circuitos de 6 Meses y Torneos Masivos (3,072+ Jugadores)](#-5-flujo-4-eventos-circuitos-de-6-meses-y-torneos-masivos-3072-jugadores)
6. [Flujo 5: Ciclo de Vida Completo de un Torneo (De Creación a Campeón)](#-6-flujo-5-ciclo-de-vida-completo-de-un-torneo-de-creación-a-campeón)
7. [Flujo 6: Máquina de Estados de Match Check-In y Descalificación Automática (DQ / Double DQ)](#-7-flujo-6-máquina-de-estados-de-match-check-in-y-descalificación-automática-dq--double-dq)
8. [Flujo 7: Verificación e Inteligencia Artificial con DeepSeek (Cada Característica al Detalle)](#-8-flujo-7-verificación-e-inteligencia-artificial-con-deepseek-cada-característica-al-detalle)
   - [7.1 Configuración de Clave API DeepSeek](#71-configuración-de-clave-api-deepseek-servidor-y-panel-admin)
   - [7.2 Característica DeepSeek #1: Worker Autónomo de Visión Multimodal (DeepSeek-VL OCR)](#72-característica-deepseek-1-worker-autónomo-de-visión-multimodal-deepseek-vl-ocr)
   - [7.3 Característica DeepSeek #2: Narrador / Caster de eSports en Vivo](#73-característica-deepseek-2-narrador--caster-de-esports-en-vivo)
   - [7.4 Característica DeepSeek #3: Auditoría Algorítmica de Brackets y Predicción de Campeón](#74-característica-deepseek-3-auditoría-algorítmica-de-brackets-y-predicción-de-campeón)
9. [Flujo 8: Ecosistema Enterprise & Quality of Life (GraphQL, MCP, Matchmaking, Auto-Payouts, Pick-ems, LAN)](#-9-flujo-8-ecosistema-enterprise--quality-of-life)
10. [Referencia Completa de Endpoints (REST, GraphQL y MCP)](#-10-referencia-completa-de-endpoints-rest-graphql-y-mcp)
11. [Instalación, Variables de Entorno y Ejecución](#-11-instalación-variables-de-entorno-y-ejecución)

---

## 🏗️ 1. Arquitectura General del Sistema

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   FRONTEND SPA (React 19 + Vite)                                     │
│  ┌────────────────────┐ ┌────────────────────┐ ┌───────────────────────┐ ┌────────────────────────┐  │
│  │  Start.gg Hub &    │ │ 2D SVG / 3D WebGL  │ │ Consola de Árbitro &  │ │ Enterprise Ecosystem   │  │
│  │  Circuitos 6 Meses │ │ InstancedMesh 3072 │ │ DeepSeek-VL OCR Queue │ │ GraphQL · MCP · Payout │  │
│  └─────────┬──────────┘ └─────────┬──────────┘ └───────────┬───────────┘ └───────────┬────────────┘  │
└────────────┼──────────────────────┼────────────────────────┼─────────────────────────┼───────────────┘
             │                      │                        │                         │
             ▼                      ▼                        ▼                         ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             BACKEND GATEWAY (Express + TypeScript + WebSockets)                      │
│  ┌────────────────────┐ ┌────────────────────┐ ┌───────────────────────┐ ┌────────────────────────┐  │
│  │ Better-Auth +      │ │ Motor DAG O(1)     │ │ DeepSeek AI Service   │ │ BullMQ + Redis Streams │  │
│  │ Firebase Bridge    │ │ Punteros Atómicos  │ │ Vision OCR · Caster   │ │ Check-in DQ · Sync LAN │  │
│  └─────────┬──────────┘ └─────────┬──────────┘ └───────────┬───────────┘ └───────────┬────────────┘  │
└────────────┼──────────────────────┼────────────────────────┼─────────────────────────┼───────────────┘
             │                      │                        │                         │
             ▼                      ▼                        ▼                         ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                         CAPA DE PERSISTENCIA HÍBRIDA & PROTOCOLOS EXTERNOS                           │
│  [Cloud SQL PostgreSQL 16 + Drizzle ORM]  ·  [Firestore Realtime]  ·  [MCP Server STDIO / JSON-RPC]  │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📝 2. Flujo 1: Registro Completo de Usuarios (Sign Up Paso a Paso)

El sistema ofrece un registro híbrido respaldado por **Google Cloud SQL (PostgreSQL 16)** y **Better-Auth**, creando simultáneamente la identidad de autenticación, el perfil competitivo de jugador y el monedero de puntos de temporada.

### Diagrama del Flujo de Registro

```
[Usuario abre Modal de Acceso]
       │
       ├──► Opción A: Registro con Email + Contraseña + GamerTag
       │         │
       │         ▼
       │    POST /api/auth/register
       │         ├── 1. Valida formato de email y longitud de contraseña (mín. 6 caracteres)
       │         ├── 2. Genera Hash criptográfico (scrypt + salt aleatorio)
       │         ├── 3. Inserta registro en tabla `users` y `accounts` (Cloud SQL PostgreSQL)
       │         ├── 4. Crea sesión activa en tabla `sessions` (Token Bearer de 7 días)
       │         └── 5. Inicializa perfil competitivo con GamerTag, Personaje Main y Región
       │
       └──► Opción B: Registro Instantáneo con Google OAuth (Firebase Auth Bridge)
                 │
                 ▼
            POST /api/auth/sync-firebase
                 ├── 1. Recibe UID, email, displayName y photoURL desde Google Sign-In
                 ├── 2. Sincroniza o crea el usuario en Cloud SQL PostgreSQL (`users`)
                 └── 3. Asigna Rol RBAC (`super_admin` para el propietario o `player` por defecto)
```

### Paso a Paso: Cómo Registrar una Cuenta Nueva

1. **Abrir el Panel de Identidad:**
   - En la esquina superior derecha de la barra de navegación, haz clic en el botón **"Iniciar Sesión / Registro"** (o en el selector de cuenta si estás en modo invitado).
2. **Seleccionar la Pestaña "Crear Cuenta (Sign Up)":**
   - Cambia del modo *Login* al modo *Registro*.
3. **Completar los Datos Básicos y Competitivos:**
   - **Nombre Completo / Nickname:** Tu nombre o alias público (ej. `Carlos Mendoza`).
   - **GamerTag Oficial:** Tu identificador único en los brackets (ej. `ShadowFighter_CO`).
   - **Correo Electrónico:** Dirección válida (ej. `shadow@fgclatam.gg`).
   - **Contraseña:** Mínimo 6 caracteres (almacenada con hash `scrypt` en PostgreSQL).
   - **País / Región (ISO):** Selecciona tu bandera (ej. `CO`, `MX`, `AR`, `ES`, `US`, `JP`) para que el motor de *Geographic Seeding* evite cruces entre compatriotas en Ronda 1.
   - **Equipo / Clan (Opcional):** Prefijo de tu organización (ej. `T1`, `KRU`, `INF`).
   - **Personaje Principal (*Main Character*):** Ejemplo: `Jin Kazama`, `Juri`, `Jett`, `Fennec`.
4. **Confirmación y Creación de Sesión:**
   - Al pulsar **"Crear Cuenta Competitiva"**, el backend ejecuta una transacción en Cloud SQL PostgreSQL, devuelve el `sessionToken` y te autentica automáticamente sin recargar la página.

---

## 🔐 3. Flujo 2: Inicio de Sesión, Roles RBAC, 2FA y Tokens de Estación

`nikBrackets Pro` soporta **4 mecanismos de autenticación** diseñados para distintos actores dentro de un torneo presencial u online:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             MATRIZ DE ACCESO Y ROLES (RBAC)                                     │
├──────────────────────┬──────────────────────────────────────────────────────────────────────────┤
│ Rol                  │ Permisos en la Plataforma                                                │
├──────────────────────┼──────────────────────────────────────────────────────────────────────────┤
│ 👑 super_admin       │ Control total: Crear/eliminar torneos, configurar API Keys (DeepSeek),   │
│                      │ gestionar roles de usuarios, ejecutar Auto-Payouts, Cascade Reset DAG.   │
├──────────────────────┼──────────────────────────────────────────────────────────────────────────┤
│ 🛡️ organizer (TO)    │ Crear torneos, aprobar pagos QR, configurar reglas de Check-In/DQ,       │
│                      │ sembrar brackets (Seeding), imprimir hojas PDF vectoriales.              │
├──────────────────────┼──────────────────────────────────────────────────────────────────────────┤
│ ⚖️ referee (Árbitro) │ Validar sets en vivo, usar el Worker OCR DeepSeek-VL, resolver disputas, │
│                      │ descalificar por inasistencia (Single/Double DQ), asignar estaciones.    │
├──────────────────────┼──────────────────────────────────────────────────────────────────────────┤
│ 🎮 player (Jugador)  │ Auto-inscribirse en eventos, subir comprobante de pago, hacer Check-In   │
│                      │ en su partida, proponer marcadores, votar en Pick-ems, comentar en sets. │
└──────────────────────┴──────────────────────────────────────────────────────────────────────────┘
```

### Paso a Paso: Cómo Iniciar Sesión en cada Modalidad

#### A. Login con Correo y Contraseña (Cloud SQL Nativo)
1. Haz clic en **"Iniciar Sesión"** en la barra superior.
2. Ingresa tu **Email** y **Contraseña**.
3. El endpoint `POST /api/auth/login` verifica el hash `scrypt` contra la tabla `accounts` de Cloud SQL PostgreSQL y emite un token de sesión activo.

#### B. Login con Google (1-Click OAuth)
1. Haz clic en **"Continuar con Google"**.
2. Una vez autenticado, el puente `POST /api/auth/sync-firebase` vincula tu cuenta con PostgreSQL y carga tus torneos e historial competitivo.

#### C. Selector Rápido de Roles Demo (Para Pruebas de Arbitraje y Administración)
1. En la barra superior derecha encontrarás el conmutador de vista de rol (**Admin / Organizador / Árbitro / Jugador**).
2. Al cambiar de rol, la interfaz adapta dinámicamente los permisos y desbloquea herramientas exclusivas (como la **Consola de Árbitro**, el **Panel de Usuarios & Roles**, o el **Configurador de DeepSeek API Key**).

#### D. Tokens Efímeros de Estación / Tablet (`Station QR Login`)
Para torneos presenciales (LAN) donde hay 32 o 64 consolas/PCs y no se desea iniciar sesión con una cuenta de administrador en cada máquina:
1. El Organizador entra a **"Consola Árbitro"** → **"Estaciones Físicas"**.
2. Genera un **PIN / QR de Estación** atado exclusivamente a la `Estación #04` con expiración de 4 horas.
3. El juez de mesa escanea el QR y solo puede reportar marcadores de las peleas asignadas a la `Estación #04`.

---

## 👤 4. Flujo 3: Actualización de Datos de Usuario, Cuentas de Juego y Badges

Los jugadores pueden actualizar su perfil competitivo en cualquier momento y vincular sus identificadores de múltiples plataformas para que el **Seeding Automático** y el **Matchmaking Anti-Cheat** consulten su rango real.

### Paso a Paso: Cómo Actualizar los Datos de Usuario

1. **Abrir el Perfil Competitivo / Modal de Jugador:**
   - Haz clic en tu **Avatar / GamerTag** en la barra superior o entra a la pestaña **"Participantes"** y selecciona **"Editar Mi Perfil Competitivo"**.
2. **Actualizar Información General y Personajes:**
   - Modifica tu **GamerTag**, **Equipo/Clan**, **País (Bandera ISO)**, **Personaje Principal (*Main*)** y **Personaje Secundario (*Pocket/Sub*)**.
   - Define tu **Nota de Matchup / Estilo de Juego** (ej. *"Rushdown agresivo, especialista en whiff punish"*).
3. **Vincular Cuentas de Juego Externas (*Game Account IDs*):**
   - Añade tus identificadores oficiales:
     - **Riot ID** (`GamerTag#LAS` para Valorant / League of Legends / 2XKO)
     - **Steam Friend Code / SteamID64** (Counter-Strike 2 / Tekken 8 / SF6 PC)
     - **CFN (Capcom Fighters Network ID)** (Street Fighter 6)
     - **TEKKEN Prowess ID** (Tekken 8)
     - **PSN Online ID / Xbox Gamertag / Epic Games ID**
   - El sistema valida y etiqueta el rango detectado (ej. `Tekken God Supreme`, `Master 1850 MR`, `Radiant`).
4. **Guardar Cambios en Tiempo Real:**
   - Al hacer clic en **"Guardar Perfil"**, los datos se persisten en PostgreSQL (`users`) y se propagan instantáneamente a todos los brackets activos donde participes.

### Sistema de Badges de Gamificación y Logros de Perfil

Cada perfil muestra medallas verificadas automáticamente por el motor de torneos:

| Badge | Nombre del Logro | Condición de Desbloqueo Automático |
| :---: | :--- | :--- |
| 🏆 | **Grand Champion** | Ganar el 1.º puesto en un torneo oficial sin caer a Losers Bracket. |
| 🔥 | **Lower Bracket Demon** | Avanzar 4 o más rondas consecutivas en el cuadro de perdedores (*Losers Run*). |
| ⚡ | **Speedster Check-In** | Realizar el Check-In de partida en menos de 15 segundos en todos los sets del torneo. |
| 🎯 | **Pick-em Oracle** | Acertar más del 85% de las predicciones en el *Pick-em Challenge* público. |
| 💎 | **Community Patron** | Contribuir al *Prize Pool* comunitario mediante el módulo de Crowdfunding. |
| 🛡️ | **Verified Fair Play** | 100% de sets completados con verificación limpia de Anti-Cheat y cero disputas. |

---

## 🌐 5. Flujo 4: Eventos, Circuitos de 6 Meses y Torneos Masivos (3,072+ Jugadores)

Para cubrir tanto eventos de fin de semana como circuitos mundiales (al estilo **Capcom Pro Tour**, **TEKKEN World Tour** o **Evo**), `nikBrackets Pro` separa la jerarquía en **3 niveles**:

```
NIVEL 1: CIRCUITO / TEMPORADA (6 Meses - Ej. "Latam FGC Pro Circuit 2026")
  │  ├── Tabla de Posiciones Acumulada (Global Season Leaderboard)
  │  ├── Regla de Descarte ("Best of 8 of 12 Stops" - Mejores N Fechas)
  │  └── Clasificación Automática al Top 8 / Top 16 Season Finals
  │
  └──► NIVEL 2: EVENTO / PARADA QUINCENAL (Ej. "Parada #4 - Bogotá Major")
         │  ├── Sede / Fechas / Crowdfunding / Sala Google Meet & Stream
         │
         └──► NIVEL 3: TORNEOS / CATEGORÍAS (Multi-Game Events)
                ├── Street Fighter 6 (3,072 Jugadores -> 128 Pools -> Top 256 -> Top 64 -> Top 8)
                ├── Tekken 8 (Double Elimination - 64 Jugadores)
                └── Valorant 5v5 (Swiss System + Playoffs)
```

### Paso a Paso: Cómo Usar el Módulo de Circuitos de 6 Meses y Torneos Masivos (3,000+)

1. **Ir a la Pestaña "Circuitos 6M & Masivos 3000+":**
   - En el menú de navegación superior, haz clic en **"Circuitos 6M & Masivos 3000+"**.
2. **Gestionar la Temporada de 6 Meses (*Circuit Standings*):**
   - **Selector de Regla de Descarte (*Best of X Drops*):** Ajusta el control deslizante (por ejemplo, *"Contabilizar las mejores 6 de 8 fechas"*). Verás cómo la tabla general recalcula en tiempo real los puntos netos de cada competidor descartando sus peores resultados o ausencias.
   - **Simular Nueva Fecha Quincenal:** Haz clic en **"+ Simular Nueva Parada Quincenal"** para generar resultados de una nueva fecha del circuito y observar cómo cambian los clasificados al *Season Finals* (marcados con insignia **QUALIFIED TOP 8**).
   - **Comparativa Head-to-Head (H2H) y Evolución de Personajes:** Selecciona a dos jugadores del circuito para inspeccionar su historial acumulado de enfrentamientos directos durante los 6 meses y su tasa de victoria por personaje.
3. **Operar un Torneo Masivo de 3,072 Participantes (*Architecture Funnel*):**
   - Cambia a la sub-pestaña **"Arquitectura Masiva 3,072 Jugadores (Pools & Waves)"**.
   - **Embudo de Progresión en 4 Fases:**
     - **Fase 1 (128 Pools de 24 jugadores):** Distribución en **8 Oleadas Horarias (*Waves A–H*)** de 16 pools simultáneos para no saturar las estaciones físicas ni los servidores.
     - **Fase 2 (Top 256):** Clasifican los 2 mejores de cada Pool (1.º por *Winners*, 2.º por *Losers*).
     - **Fase 3 (Top 64):** Embudo intermedio de alta competencia.
     - **Fase 4 (Top 8 Finals):** Escenario principal (*Main Stage*).
   - **Buscador Instantáneo de Pool y Oleada:** Escribe cualquier número de semilla o nombre de jugador (entre los 3,072 inscritos) para localizar al instante su **Pool asignado (P001–P128)**, su **Wave horaria (ej. Wave C - 14:00 HS)** y su **Estación física**.
   - **Proyección en el Lienzo 3D GPU (`THREE.InstancedMesh`):** Ve a **"Brackets en Vivo"** → Activa **"Vista 3D Espacial"** → Activa el botón **"🚀 Modo 3,072 Nodos (InstancedMesh)"** para explorar los 3,072 nodos renderizados en una sola llamada de dibujo GPU (*1 Draw Call*) a 60 FPS.

---

## 🏆 6. Flujo 5: Ciclo de Vida Completo de un Torneo (De Creación a Campeón)

A continuación se detalla el recorrido completo desde que un Organizador crea un torneo hasta la coronación del campeón y la dispersión de premios.

### Paso 1: Creación del Torneo (Wizard Multi-Formato OBF v1.0)
1. En la vista **"Hub Start.gg (Mis Torneos)"** o en la barra superior, haz clic en **"+ Nuevo Torneo"**.
2. Configura los parámetros del torneo:
   - **Nombre y Juego:** Ej. *" Latam Masters - Tekken 8"*.
   - **Formato Competitivo (Estándar OBF v1.0):**
     - `Single Elimination` (Eliminación Directa con opción a partido por el 3.º puesto).
     - `Double Elimination` (Cuadro de Ganadores + Cuadro de Perdedores + *Grand Finals* con *Bracket Reset*).
     - `Swiss System` (Rondas emparejadas por récord similar + desempate Buchholz).
     - `Round Robin` (Todos contra todos con desempate Sonneborn-Berger).
     - `Compass Draw` (Cuadro de 8 puntos cardinales donde nadie queda eliminado temprano).
     - `Single Game / Casual Exhibition` (Partida única rápida).
   - **Reglas de Check-In y DQ:** Define el tiempo límite de presentación (ej. `5 minutos`), activa/desactiva el `Auto-DQ` y elige la política de `Double DQ`.
   - **Costo de Inscripción y Tesorería QR (Opcional):** Define si es gratuito o de pago y sube las instrucciones de pago (Nequi / MercadoPago / Binance Pay / PayPal QR).
   - **Sala de Video / Lobby:** Vincula un enlace de **Google Meet / Discord / Twitch** para que los jugadores se reúnan con un clic.

### Paso 2: Inscripción Progresiva (*Smart Self-Enrollment*) y Pagos QR
1. El jugador entra al torneo en el **Hub Start.gg** y pulsa **"Inscribirme al Torneo"**.
2. El formulario detecta automáticamente los datos que ya existen en su perfil y solo solicita lo específico de ese juego (Personaje Main para este torneo, ID de plataforma y comprobante de pago si aplica).
3. El Organizador revisa en **"Participantes"** las inscripciones pendientes y aprueba el comprobante con un clic.

### Paso 3: Seeding Inteligente (Evitar Choques de Clanes y Regiones en Ronda 1)
1. Antes de iniciar el bracket, ve a **"Participantes"** → **"Motor de Seeding Inteligente"**.
2. Ejecuta **"Auto-Seed por ELO + Restricción Geográfica/Clan"**.
3. El algoritmo ordena las semillas (`Seed #1` vs `Seed #N`) y permuta automáticamente los cruces de Primera Ronda si detecta que dos miembros del mismo equipo (`[T1] vs [T1]`) o del mismo país se enfrentarían prematuramente.

### Paso 4: Visualización del Bracket en el Chat, 2D SVG, 3D WebGL y PDF Vectorial
- **Al Iniciar el Torneo (Anuncio Automático en Chat):**
  - Apenas se crea o inicia el torneo, el **Chat en Vivo del Torneo** publica automáticamente la **Matriz Completa del Bracket en Texto/2D** indicando exactamente quién juega contra quién en cada ronda (`Ronda 1: Seed #1 vs Seed #8`, estación asignada y estado).
- **Vista 2D SVG Interactiva:**
  - En **"Brackets en Vivo"**, explora el cuadro con curvas Bézier dinámicas que iluminan el camino de cada jugador al pasar el cursor.
- **Vista 3D WebGL Espacial (`Three.js`):**
  - Haz clic en **"Vista 3D Espacial"** para navegar en 3D con cámara orbital por las capas de *Winners Bracket*, *Losers Bracket* y *Grand Finals*.
- **Exportación / Impresión en PDF Vectorial (Hojas Físicas de Mesa):**
  - En la barra de herramientas del bracket, haz clic en **"🖨️ Exportar / Imprimir PDF Vectorial"**.
  - Elige el tamaño de página (**A4**, **A3 Poster** o **Carta**) y orientación, previsualiza el diagrama vectorial con casillas físicas para firmas de jugadores y códigos QR de estación, y descarga el **SVG Vectorial** o imprime el **PDF de Alta Resolución (300 DPI)** listo para pegar en el salón del evento.

### Paso 5: Reporte de Marcadores O(1) DAG y *Cascade Reset* (Reversión en Cascada)
1. Haz clic sobre cualquier partida activa en el bracket o ábrela desde la **"Consola Árbitro"**.
2. Registra el marcador de juegos individuales (ej. `2 - 1`) y los personajes utilizados en cada juego.
3. **Avance Atómico O(1):** Al confirmar el resultado, el motor DAG inyecta instantáneamente al ganador en el nodo `nextWinNodeId` y al perdedor en `nextLossNodeId` (si es *Double Elimination*) sin recalcular el árbol entero.
4. **Reversión Segura en Cascada (*Cascade Reset*):** Si hubo un error administrativo en una ronda previa, el Árbitro puede pulsar **"Revertir Resultado (Cascade Reset)"**, lo que limpia de forma segura únicamente los nodos hijos dependientes que aún no se hayan bloqueado.

---

## ⏱️ 7. Flujo 6: Máquina de Estados de Match Check-In y Descalificación Automática (DQ / Double DQ)

Para evitar que un torneo competitivo se detenga por jugadores ausentes (*No-Show*), cada partida definida ejecuta una máquina de estados determinista gobernada por temporizadores sincronizados y colas de trabajo **BullMQ**.

### Diagrama de la Máquina de Estados del Match Check-In

```
                       [SET_READY / MATCH_DEFINED]
                   (Ambos rivales definidos en el nodo)
                                    │
               ┌────────────────────┴────────────────────┐
               │                                         │
    (Jugador A hace Check-In)               (Expira el Timer sin ambos)
               │                                         │
               ▼                                         ▼
      [PARTIAL_CHECKIN]                      ¿Hizo alguno Check-In?
   (Inicia cuenta regresiva)                        /           \
               │                                 (NO)         (SÓLO UNO)
     ┌─────────┴─────────┐                        │               │
     │                   │                        ▼               ▼
(Jugador B hace)   (Expira Timer)           [DOUBLE_DQ]      [SINGLE_DQ]
     │                   │                 (Ambos fuera;    (Gana quien sí
     ▼                   ▼                  avance BYE)     hizo Check-In 2-0)
[IN_PROGRESS]       [SINGLE_DQ]
(Pelea activa)    (Gana Jugador A)
```

### Paso a Paso: Cómo Operar el Match Check-In y los 3 Escenarios

1. **Abrir una Pelea Lista (`SET_READY`):**
   - Ve a **"Consola Árbitro"** o haz clic directamente en cualquier partida con ambos jugadores listos en **"Brackets en Vivo"**.
2. **Configurar los Parámetros del Timer (Panel de Reglas de Check-In):**
   - Ajusta la duración del temporizador (ej. `3 min`, `5 min`, `10 min` o `Modo Demo 15 seg` para probar en vivo la descalificación automática).
   - Elige la política de **Double DQ** (*Avance por Vacante/BYE* vs *Intervención Manual del TO*).
3. **Probar los 3 Escenarios en Tiempo Real:**
   - **Escenario 1 — OK (Ambos hacen Check-In a tiempo):**
     - Haz clic en **"Check-In Jugador A"** y luego en **"Check-In Jugador B"** antes de que el reloj llegue a `00:00`.
     - El estado cambia a `IN_PROGRESS` (verde) y se desbloquea el marcador `<SingleScreenScoreReporter />`.
   - **Escenario 2 — Single DQ (Solo un jugador se presenta):**
     - Haz clic únicamente en **"Check-In Jugador A"** y deja que el temporizador expire (o pulsa **"⚡ Forzar Expiración de Timer"**).
     - El Jugador B recibe automáticamente el estado **`DQ` (Forfeit)**, el Jugador A gana por **Walkover (`2 - 0`)** y avanza de inmediato a la siguiente ronda del DAG.
   - **Escenario 3 — Double DQ (Ninguno se presenta):**
     - Si el reloj expira con `0/2 Check-Ins`, ambos jugadores quedan marcados como **`DOUBLE_DQ`** y el nodo siguiente recibe un avance por vacante (*BYE*) para que el torneo jamás se congele.
   - **Reversión Administrativa (*Admin Override*):**
     - Si un jugador tuvo un problema técnico justificado, el Árbitro dispone del botón **"🔄 Revertir DQ / Reabrir Check-In"** en la misma tarjeta del set.

---

## 🤖 8. Flujo 7: Verificación e Inteligencia Artificial con DeepSeek (Cada Característica al Detalle)

`nikBrackets Pro` integra un motor completo de inteligencia artificial basado en **DeepSeek (`deepseek-chat` / `deepseek-reasoner` / `DeepSeek-VL`)**, diseñado con una arquitectura **Resiliente Dual**:
- **Modo Live DeepSeek API:** Cuando hay una clave `DEEPSEEK_API_KEY` configurada, realiza inferencia real contra `https://api.deepseek.com/v1/chat/completions`.
- **Modo Determinista / Heurístico Local:** Si aún no se ha configurado la clave o se opera en modo LAN sin internet, el servidor ejecuta un motor heurístico matemático e inspección determinista de respaldo para que ninguna función falle jamás.

---

### 7.1 Configuración de Clave API DeepSeek (Servidor y Panel Admin)

Existen dos formas seguras de configurar la integración con DeepSeek:

#### Opción A: Variable de Entorno en el Servidor (`.env`)
Añade en el archivo `.env` del servidor:
```env
DEEPSEEK_API_KEY=sk-tu-clave-oficial-de-deepseek
```

#### Opción B: Configuración en Caliente desde la Interfaz de Administrador
1. Asegúrate de tener seleccionado el rol **Admin (`super_admin`)**.
2. Abre el panel **"Analítica & DAG"** o la **"Consola Árbitro"** → sección **DeepSeek AI Engine**.
3. El sistema consulta `GET /api/admin/deepseek-status` y muestra si la clave está activa y enmascarada (ej. `sk-9f8a...3b1c`).
4. Si deseas actualizarla en caliente, envíala mediante el panel de configuración (`POST /api/admin/deepseek-key`), quedando guardada exclusivamente en la memoria segura del servidor backend (nunca expuesta en el cliente).

---

### 7.2 Característica DeepSeek #1: Worker Autónomo de Visión Multimodal (`DeepSeek-VL` OCR)

Esta característica evita el fraude en torneos online y acelera el arbitraje presencial: el jugador o árbitro sube una **foto o captura de pantalla del final de la partida** (HUD de *Street Fighter 6*, *Tekken 8*, *Valorant*, *Rocket League*, *EA FC*, etc.) y el worker extrae automáticamente quién ganó, el marcador exacto y los personajes utilizados.

```
[Captura de Pantalla / Foto del HUD Final]
                 │
                 ▼
    POST /api/ai/vision-referee
                 │
                 ├── 1. Encola trabajo asíncrono en BullMQ (`deepseek-vl-ocr-queue`)
                 ├── 2. Ejecuta pipeline multimodal DeepSeek-VL (Inspección OCR de HUD)
                 ├── 3. Extrae:
                 │      • GamerTag Jugador 1 vs GamerTag Jugador 2
                 │      • Marcador de Rondas / Sets (ej. 2 - 1)
                 │      • Personajes detectados en pantalla (ej. Jin Kazama vs Reina)
                 │      • Detección de pantalla de "WIN / K.O. / VICTORY"
                 │      • Nivel de Confianza Estadística (ej. 99.2%)
                 │
                 ▼
   ¿Confianza >= 98% y Auto-Apply Activo?
        ├── SÍ ──► Avanza automáticamente al ganador en el Grafo DAG O(1)
        └── NO ──► Marca el Set para revisión de 1 clic por el Árbitro humano
```

#### Paso a Paso: Cómo Verificar un Resultado con DeepSeek-VL OCR

1. **Ir a la "Consola Árbitro":**
   - Haz clic en **"Consola Árbitro"** en el menú principal.
2. **Ubicar el Panel "DeepSeek-VL Autonomous Vision OCR Worker":**
   - Selecciona en el desplegable el **Set / Partida activa** que deseas verificar.
3. **Cargar o Seleccionar la Captura de Evidencia:**
   - Puedes subir una imagen desde tu dispositivo (`PNG / JPG / WEBP`) o hacer clic en cualquiera de las **Capturas de Prueba Pre-cargadas (Tekken 8 HUD / Street Fighter 6 K.O. / Valorant Scoreboard)** para probar el flujo al instante.
4. **Activar o Desactivar "Auto-Apply en DAG si Confianza > 98%":**
   - Si activas esta casilla, cuando el modelo confirme una confianza superior al 98%, el marcador se escribirá directamente en el bracket y avanzará al ganador sin intervención manual.
5. **Ejecutar el Escaneo (`Escanear Captura con DeepSeek-VL`):**
   - Observa en vivo el identificador del Job en la cola **BullMQ (`deepseek-vl-ocr-queue`)** pasando por los estados `queued` → `processing_hud_ocr` → `completed`.
6. **Inspeccionar el Dictamen Estructurado:**
   - El panel mostrará:
     - **Ganador Detectado** y **Marcador Extraído** (`Score P1 - Score P2`).
     - **Personajes Reconocidos** en el HUD.
     - **Porcentaje de Confianza (`Confidence %`)** y **Telemetría de Integridad Visual** (verificando que la imagen no tenga manipulación de píxeles).
   - Si no tenías el *Auto-Apply* activado, pulsa **"✅ Aplicar Marcador Extraído al Bracket"** para confirmar el avance en 1 clic.

---

### 7.3 Característica DeepSeek #2: Narrador / Caster de eSports en Vivo (`AI Broadcast Caster`)

Diseñado para streamers, comentaristas y pantallas de estadio: genera crónicas *play-by-play*, análisis de *matchups* de personajes y probabilidades de victoria en tiempo real a medida que avanza el bracket.

#### Paso a Paso: Cómo Usar y Verificar el Narrador Caster de DeepSeek

1. **Dónde Encontrarlo:**
   - Disponible tanto en el panel lateral de **"Brackets en Vivo"** como en la pestaña **"Analítica & DAG"**.
2. **Seleccionar Estilo de Narración:**
   - Elige el tono del caster (ej. *Hype FGC Latino*, *Analista Técnico de Frame Data*, o *Transmisión Oficial eSports*).
3. **Generar Crónica en Vivo (`POST /api/ai/caster-narrative`):**
   - Haz clic en **"🎙️ Generar Narrativa Caster con DeepSeek"**.
   - El motor analiza el estado exacto del torneo (quiénes están en *Winners Semifinals*, quién viene haciendo un *Losers Bracket Run* épico, qué personajes se enfrentan y las rachas de victorias).
4. **Resultado Entregado:**
   - **Titular de Transmisión (*Broadcast Headline*)** listo para el *Lower Third* de OBS/vMix.
   - **Narrativa Play-by-Play** comentando las partidas clave del momento.
   - **Predicción de Momentum** indicando qué jugador tiene ventaja estadística en el siguiente cruce.

---

### 7.4 Característica DeepSeek #3: Auditoría Algorítmica de Brackets y Predicción de Campeón (`AI Bracket Audit`)

Antes de iniciar un torneo o durante su desarrollo, los organizadores pueden ejecutar una auditoría profunda del grafo DAG combinada con razonamiento de DeepSeek para detectar anomalías competitivas.

#### Paso a Paso: Cómo Ejecutar y Verificar la Auditoría de Bracket con DeepSeek

1. **Ir a la Pestaña "Analítica & DAG":**
   - En el menú superior, haz clic en **"Analítica & DAG"**.
2. **Ejecutar "🔍 Auditar Integridad del Bracket con DeepSeek (`POST /api/ai/bracket-audit`)":**
   - El sistema envía la topología completa del DAG, las semillas (*Seeds*), los países/clanes de los participantes y los tiempos de estación al motor de auditoría.
3. **Qué Verifica Exactamente esta Característica:**
   - **Detección de Colisiones Prematuras (Seeding & Clanes):** Verifica si dos jugadores de alto ELO o del mismo equipo/país chocan en Ronda 1 o Ronda 2 debido a un mal acomodo manual.
   - **Cuellos de Botella en Estaciones (*Station Bottlenecks*):** Identifica si el *Losers Bracket* tiene retraso de rondas respecto al *Winners Bracket* y sugiere qué partidas priorizar en las estaciones libres.
   - **Cálculo de Desempates Matemáticos:** Verifica los coeficientes **Buchholz** (para formato Suizo) y **Sonneborn-Berger** (para Round Robin).
   - **Simulación de Probabilidad de Campeón:** Entrega el Top 3 de favoritos al título con su porcentaje de probabilidad y los posibles *upsets* (sorpresas del torneo).

---

## 🚀 9. Flujo 8: Ecosistema Enterprise & Quality of Life

Todas estas herramientas se encuentran centralizadas en la pestaña **"🚀 Ecosistema Enterprise & QoL"** del menú principal (además de sus integraciones directas en el lienzo 3D y en la consola de arbitraje).

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                         MÓDULOS DEL ECOSISTEMA ENTERPRISE & QOL                                  │
├──────────────────────────────────────────────────┬───────────────────────────────────────────────┤
│ 🚨 CORE ENTERPRISE                               │ 🔹 QUALITY OF LIFE (QoL)                      │
├──────────────────────────────────────────────────┼───────────────────────────────────────────────┤
│ 1. API Pública GraphQL & Developer Portal        │ 1. Exportación / Impresión en PDF Vectorial   │
│ 2. Worker Autónomo DeepSeek-VL (Visión OCR)      │ 2. Tabla de Posiciones Pública de Pick-ems    │
│ 3. Servidor MCP (Model Context Protocol) Nativo  │ 3. Módulo de Tienda / Merchandising / Crowdf. │
│ 4. Cliente Ejecutable LAN / Offline-First        │ 4. Sistema de Comentarios y Discusión en Set  │
│ 5. Dispersión Automática de Pagos (Auto-Payouts) │ 5. Badges de Gamificación / Logros de Perfil  │
│ 6. Matchmaking Continuo & Anti-Cheat Queue       │ 6. Renderizado GPU 3,072 Nodos InstancedMesh  │
└──────────────────────────────────────────────────┴───────────────────────────────────────────────┘
```

### 8.1 API Pública GraphQL & Developer Portal (Emisión de API Keys)
Permite que desarrolladores externos, bots de Discord o dashboards de televisión consulten torneos y brackets igual que en la API de **start.gg**.
- **Cómo usarlo paso a paso:**
  1. Entra a **"🚀 Ecosistema Enterprise & QoL"** → pestaña **"GraphQL & Dev Portal"**.
  2. Escribe el nombre de tu aplicación (ej. `Bot Discord FGC Colombia`) y selecciona los permisos (`read:tournaments`, `write:scores`, `read:standings`).
  3. Haz clic en **"Generar Nueva API Key"**. Recibirás una clave con formato `nikgg_live_...` que se inyecta automáticamente en la cabecera `X-API-Key` del Playground.
  4. En el **GraphQL Playground Interactivo**, selecciona una consulta de ejemplo (o escribe la tuya) y pulsa **"▶ Ejecutar Query GraphQL"** contra `POST /api/graphql`.

### 8.2 Servidor MCP Nativo (`mcp-server.ts` STDIO + JSON-RPC 2.0 Web Bridge)
Permite que agentes de IA externos (**Claude Desktop, Cursor, Windsurf, OpenAI Agents**) controlen el torneo mediante el estándar **Model Context Protocol (MCP)**.
- **Herramientas MCP Expuestas (`tools/list` & `tools/call`):**
  - `list_tournaments`: Lista todos los torneos activos, juegos, inscritos y bolsas de premios.
  - `get_bracket_state`: Devuelve el estado del grafo DAG y las partidas pendientes de un torneo.
  - `report_match_score`: Registra el marcador de un set y avanza al ganador en O(1).
  - `trigger_dq_check`: Ejecuta una verificación de inasistencia (*Single/Double DQ*) sobre un set.
  - `generate_seeding`: Reordena las semillas evitando conflictos de país o clan en Ronda 1.
- **Cómo usarlo en la Web o en Consola:**
  - **En la Web:** Ve a **"🚀 Ecosistema Enterprise & QoL"** → **"Servidor MCP Nativo"**. Puedes invocar cualquier herramienta con clic directo o escribir una orden en lenguaje natural (ej. *"Avanza a Jin Kazama en el set m-101 por 2-0"*).
  - **Por Terminal (STDIO para Claude Desktop / Cursor):**
    ```bash
    npx tsx mcp-server.ts
    ```

### 8.3 Cola de Matchmaking Continuo (ELO/Glicko-2) & Verificación Anti-Cheat
Además de torneos por llaves, los jugadores pueden buscar partidas clasificatorias instantáneas 24/7 al estilo **FACEIT**.
- **Cómo usarlo paso a paso:**
  1. Ve a **"🚀 Ecosistema Enterprise & QoL"** → **"Matchmaking & Anti-Cheat"**.
  2. Ingresa tu GamerTag, tu ELO actual (ej. `1850`), región (`LATAM-North`), personaje y activa el **Escudo Kernel Anti-Cheat + Telemetría de Ping/Jitter**.
  3. Pulsa **"Entrar a la Cola Competitiva"**.
  4. Pulsa **"⚡ Ejecutar Emparejamiento ELO/Glicko-2"** para que el motor empareje a los jugadores con menor diferencia de MMR y menor latencia, generando un Lobby Verificado.

### 8.4 Dispersión Automática de Premios (*Auto-Payouts*)
Liquida automáticamente el *Prize Pool* al finalizar un torneo con auditoría criptográfica.
- **Cómo usarlo paso a paso:**
  1. Ve a **"🚀 Ecosistema Enterprise & QoL"** → **"Auto-Payouts & Tienda Crowdfunding"**.
  2. Revisa el reparto automático (**50% para el 1.º puesto, 30% para el 2.º puesto, 20% para el 3.º puesto**).
  3. Elige el riel de pago: **Web3 Smart Contract (USDC en Polygon)**, **Stripe Connect Instant Payout**, o **Transferencia QR Local**.
  4. Pulsa **"💸 Ejecutar Dispersión Automática de Premios"**. El sistema genera los recibos de liquidación con su respectivo `txHash` de verificación.

### 8.5 Tienda de Merchandising y Crowdfunding Comunitario (Estilo Matcherino)
Cada compra de productos oficiales del evento incrementa automáticamente el *Prize Pool* de los jugadores en tiempo real.
- **Cómo usarlo paso a paso:**
  1. En la sección **"Tienda Oficial & Crowdfunding"**, explora los artículos (ej. *Hoodie Oficial Pro Tour*, *Arcade Fightstick Custom Plate*, *Supporter Bundle*).
  2. Cada artículo muestra qué porcentaje (ej. `70%` o `100%`) va directo al pozo de premios.
  3. Haz clic en **"Comprar y Aportar al Prize Pool"**: verás cómo el pozo total del torneo sube instantáneamente en toda la aplicación y el comprador recibe el badge **💎 Community Patron**.

### 8.6 Tabla Pública de Pick-ems (Predicciones) y Comentarios en cada Set
- **Pick-em Challenge:** En la **"Consola Árbitro"** o en **"🚀 Ecosistema Enterprise & QoL"**, cualquier usuario puede pronosticar su **Campeón (1.º), Subcampeón (2.º), 3.º Puesto y Jugador Revelación (*Dark Horse*)**, sumando puntos en la tabla pública de predictores.
- **Comentarios y Discusión por Set:** Cada partida del torneo cuenta con su propio hilo de comentarios en tiempo real con etiquetas de rol (`Player`, `Referee`, `Caster`, `Spectator`) para coordinar lobbies o comentar jugadas.

### 8.7 Cliente LAN / Offline-First Local Cache y Monitor BullMQ + Redis Streams
Pensado para eventos masivos en centros de convenciones donde el internet puede fallar:
- **Cómo usarlo paso a paso:**
  1. Ve a **"🚀 Ecosistema Enterprise & QoL"** → **"Cliente LAN Offline-First & Colas BullMQ"**.
  2. Pulsa **"📦 Descargar Snapshot Cifrado LAN (`localStorage`)"** para guardar todo el torneo localmente.
  3. Activa el interruptor **"Modo Torneo LAN Sin Internet (Offline Queue)"**. Todos los marcadores reportados se guardarán en la cola de mutaciones local.
  4. Cuando regrese la conexión, pulsa **"🔄 Sincronizar Cola LAN con el Servidor (`Replay Mutations`)"** para aplicar todos los avances en lote sin perder un solo dato.

---

## 📡 10. Referencia Completa de Endpoints (REST, GraphQL y MCP)

| Categoría | Método y Ruta | Descripción |
| :--- | :--- | :--- |
| **Autenticación & Usuarios** | `POST /api/auth/register` | Registro nativo en Cloud SQL PostgreSQL (`scrypt` + sesión). |
| **Autenticación & Usuarios** | `POST /api/auth/login` | Inicio de sesión nativo con email y contraseña. |
| **Autenticación & Usuarios** | `POST /api/auth/sync-firebase` | Puente híbrido Google OAuth ↔ Cloud SQL PostgreSQL. |
| **Autenticación & Usuarios** | `GET /api/users` | Lista todos los usuarios registrados y sus roles RBAC (Admin). |
| **Autenticación & Usuarios** | `PATCH /api/users/:id/role` | Actualiza el rol (`super_admin`, `organizer`, `referee`, `player`). |
| **DeepSeek AI & Visión** | `GET /api/admin/deepseek-status` | Verifica el estado de configuración de `DEEPSEEK_API_KEY`. |
| **DeepSeek AI & Visión** | `POST /api/admin/deepseek-key` | Configura en caliente la clave `DEEPSEEK_API_KEY` en el servidor. |
| **DeepSeek AI & Visión** | `POST /api/ai/vision-referee` | Worker OCR `DeepSeek-VL` con cola BullMQ y Auto-Apply en DAG. |
| **DeepSeek AI & Visión** | `POST /api/ai/caster-narrative` | Genera narración *play-by-play* de eSports con DeepSeek. |
| **DeepSeek AI & Visión** | `POST /api/ai/bracket-audit` | Audita el bracket DAG, desempates y predice probabilidades. |
| **API GraphQL & Dev Portal** | `POST /api/graphql` | Endpoint público GraphQL (soporta `X-API-Key`). |
| **API GraphQL & Dev Portal** | `GET / POST /api/dev/keys` | Emite y revoca API Keys para desarrolladores externos. |
| **Model Context Protocol** | `POST /api/mcp` | Servidor MCP JSON-RPC 2.0 (`tools/list`, `tools/call`, NL Agent). |
| **Matchmaking & Anti-Cheat** | `POST /api/matchmaking/enqueue` | Ingresa un jugador a la cola continua ELO/Glicko-2 con Anti-Cheat. |
| **Matchmaking & Anti-Cheat** | `POST /api/matchmaking/pair` | Empareja jugadores óptimos por MMR y latencia regional. |
| **Pagos & Crowdfunding** | `POST /api/tournaments/:slug/payouts/disperse` | Ejecuta dispersión automática 50%/30%/20% (Web3 / Stripe / QR). |
| **Pagos & Crowdfunding** | `POST /api/tournaments/:slug/crowdfunding/contribute` | Compra merchandising oficial e incrementa el `prizePool` en vivo. |
| **Comunidad & QoL** | `POST /api/tournaments/:slug/pickems/vote` | Registra predicciones en el *Pick-em Challenge* público. |
| **Comunidad & QoL** | `POST /api/tournaments/:slug/sets/:setId/comments` | Publica comentarios en el hilo de discusión de una partida. |
| **LAN Offline & Colas** | `GET /api/offline/sync-bundle` | Descarga el paquete completo para operación LAN Offline-First. |
| **LAN Offline & Colas** | `POST /api/offline/replay-mutations` | Sincroniza mutaciones acumuladas fuera de línea con el DAG. |
| **LAN Offline & Colas** | `GET /api/queues/status` | Telemetría en tiempo real de colas BullMQ y Redis Streams. |

---

## ⚙️ 11. Instalación, Variables de Entorno y Ejecución

### 1. Variables de Entorno (`.env`)
Crea un archivo `.env` basado en `.env.example`:

```env
# Base de Datos Relacional (Google Cloud SQL PostgreSQL 16)
DATABASE_URL=postgresql://postgres:password@localhost:5432/nikbrackets

# Inteligencia Artificial Multimodal y Razonamiento
DEEPSEEK_API_KEY=sk-tu-clave-deepseek

# Seguridad de Sesiones Better-Auth
BETTER_AUTH_SECRET=tu-secreto-criptografico-seguro
```

### 2. Comandos de Desarrollo y Producción

```bash
# Instalar dependencias
npm install

# Iniciar servidor Full-Stack (Express API + WebSockets + Vite React SPA en puerto 3000)
npm run dev

# Ejecutar el Servidor MCP Nativo por STDIO (para Claude Desktop / Cursor)
npx tsx mcp-server.ts

# Verificar tipado TypeScript y compilar para producción
npm run lint
npm run build
```
