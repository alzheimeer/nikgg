# 🏆 nikBrackets Pro — Plataforma Enterprise de Torneos eSports, Circuitos de 6 Meses & Motor DAG OBF v1.0

```
╔══════════════════════════════════════════════════════════════════════════════════════════════╗
║                                     nikBrackets Pro v2026                                    ║
║        Arquitectura Competitiva al Estilo Start.gg · Open Bracket Format (OBF v1.0)          ║
║   Motor DAG O(1) · WebGL 3D Spatial Canvas · Google Meet API · Match Check-In · 3,000+ Pools ║
╚══════════════════════════════════════════════════════════════════════════════════════════════╝
```

**nikBrackets Pro** es una plataforma integral de gestión de torneos competitivos de eSports (*Fighting Games*, *Shooters Tácticos*, *MOBA*, *Sports & Battle Royale*) diseñada bajo el estándar **Open Bracket Format (OBF v1.0)** y el modelo de control de acceso contextual (**RBAC estilo Start.gg**).

Soporta desde torneos relámpago locales hasta **eventos masivos de más de 3,000 participantes** divididos en *Waves & Pools* con **renderizado espacial 3D WebGL (Three.js)** y **Ligas/Circuitos de 6 meses** con tabla acumulada, descarte de peores fechas (*Best of X Drops*) y clasificación automática a *Season Finals*.

---

## 📑 Tabla de Contenidos

1. [Visión General de la Arquitectura](#-1-visión-general-de-la-arquitectura)
2. [Guía Paso a Paso: Registro, Login y Perfil Competitivo](#-2-guía-paso-a-paso-registro-login-y-perfil-competitivo)
3. [Modelo de Roles y Permisos Dinámicos por Torneo (Start.gg RBAC)](#-3-modelo-de-roles-y-permisos-dinámicos-por-torneo-startgg-rbac)
4. [Guía Paso a Paso: Creación de Torneos, Eventos y Formatos OBF v1.0](#-4-guía-paso-a-paso-creación-de-torneos-eventos-y-formatos-obf-v10)
5. [Inscripción Inteligente (Smart Self-Enrollment) y Tesorería QR](#-5-inscripción-inteligente-smart-self-enrollment-y-tesorería-qr)
6. [Motor de Brackets DAG O(1), Visor 2D SVG y Lienzo Espacial 3D WebGL](#-6-motor-de-brackets-dag-o1-visor-2d-svg-y-lienzo-espacial-3d-webgl)
7. [Check-In a Nivel de Pelea/Set, Timers y Descalificación Automática (DQ / Double DQ)](#-7-check-in-a-nivel-de-peleaset-timers-y-descalificación-automática-dq--double-dq)
8. [Reporte de Resultados, Avance de Ganadores y Gran Final Bracket Reset](#-8-reporte-de-resultados-avance-de-ganadores-y-gran-final-bracket-reset)
9. [Integración con Google Meet Oficial y Chat en Vivo con Brackets 2D/Texto](#-9-integración-con-google-meet-oficial-y-chat-en-vivo-con-brackets-2dtexto)
10. [Circuitos de 6 Meses y Arquitectura para Torneos Masivos (3,000+ Jugadores)](#-10-circuitos-de-6-meses-y-arquitectura-para-torneos-masivos-3000-jugadores)
11. [Analítica en Tiempo Real, Caché Redis O(1), Auditoría y Backups](#-11-analítica-en-tiempo-real-caché-redis-o1-auditoría-y-backups)
12. [Estructura del Proyecto, Base de Datos (PostgreSQL / Drizzle / Prisma) y API REST + WebSockets](#-12-estructura-del-proyecto-base-de-datos-postgresql--drizzle--prisma-y-api-rest--websockets)

---

## 🏛️ 1. Visión General de la Arquitectura

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  FRONTEND SPA (React 19 + TypeScript)                        │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────┐  │
│  │  Hub Start.gg      │  │ Brackets 2D SVG &  │  │ Consola Árbitro &  │  │ Circuitos 6M & │  │
│  │  & Google Meet     │  │ 3D WebGL Three.js  │  │ Match Check-In     │  │ Pools 3,000+   │  │
│  └─────────┬──────────┘  └─────────┬──────────┘  └─────────┬──────────┘  └────────┬───────┘  │
└────────────┼───────────────────────┼───────────────────────┼──────────────────────┼──────────┘
             │ REST API (/api/*)     │ WebSocket (/ws)       │ OAuth 2.0 Bearer     │
             ▼                       ▼                       ▼                      ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                             BACKEND SERVER (Node.js + Express + ws)                          │
│  ┌──────────────────────────┐  ┌──────────────────────────┐  ┌────────────────────────────┐  │
│  │ Motor nikBracketsEngine  │  │ Watchdog de Check-In &   │  │ Proxy Google Meet API v2   │  │
│  │ (Grafo Dirigido Acíclico)│  │ Cola Auto-DQ / Double DQ │  │ & Chat c/ Bracket Snapshot │  │
│  └────────────┬─────────────┘  └────────────┬─────────────┘  └─────────────┬──────────────┘  │
└───────────────┼─────────────────────────────┼──────────────────────────────┼─────────────────┘
                ▼                             ▼                              ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐ ┌────────────────────────────┐
│ PostgreSQL (Cloud SQL)       │ │ Caché de Baja Latencia O(1)  │ │ Firebase Auth & Google     │
│ Usuarios, Roles, Pagos, Logs │ │ Telemetría & Snapshots OBF   │ │ Workspace OAuth 2.0        │
└──────────────────────────────┘ └──────────────────────────────┘ └────────────────────────────┘
```

### Estructura del Menú Superior (2 Filas Fijas sin Colisión)
La barra superior está dividida en **dos filas fijas (`sticky top-0`)** para garantizar que al iniciar sesión nunca se superpongan los controles de usuario con las vistas del sistema:

1. **Fila 1 (Identidad y Sesión):**
   - Logo `nikBrackets Pro [Start.gg OBF]` + Indicador en tiempo real de la **Vista Activa**.
   - **Sin sesión:** `Modo Espectador` · `Iniciar Sesión` · `Registrarse`.
   - **Con sesión:** `Administración de Usuario` · `+ Crear Torneo` · `Perfil (GamerTag)` · `Cerrar Sesión`.
2. **Fila 2 (Navegación Principal de 7 Módulos):**
   - `🧭 Hub Start.gg (Mis Torneos)` *(o `Inicio & Torneos` sin login)*
   - `⚔️ Brackets en Vivo` *(Visor 2D DAG + Lienzo Espacial 3D WebGL + Simulador What-If)*
   - `👥 Participantes` *(Check-in general, Seeds Elo/Glicko-2, Búsqueda de rivales)*
   - `▶️ Consola Árbitro` *(Check-In por Pelea, Reporte de Juegos, Stage Striking Bo3/Bo5)*
   - `✨ Circuitos 6M & Masivos 3000+` *(Temporadas de 6 meses, Regla Best-of-X Drops, Waves/Pools)*
   - `🎚️ Analítica & DAG` *(Benchmark O(1), Telemetría Redis, Auditoría de Integridad)*
   - `🛡️ Admin Usuarios & Roles` *(Ficha de Jugador, IDs PS5/Steam/Riot, Staff RBAC, Tesorería QR, 2FA, Backups)*

---

## 🔐 2. Guía Paso a Paso: Registro, Login y Perfil Competitivo

La plataforma implementa **exclusivamente dos métodos de autenticación oficiales** para máxima seguridad y simplicidad:
1. **Usuario y Contraseña (Email/Password)** respaldado en PostgreSQL.
2. **Google Sign-In Oficial** mediante Firebase Authentication / Google OAuth.

```
         ┌──────────────────────────────────────────────────────────┐
         │       USUARIO ACCEDE A nikBrackets Pro (Modo Espectador) │
         └────────────────────────────┬─────────────────────────────┘
                                      │
                   ¿Hace clic en "Iniciar Sesión" o "Registrarse"?
                          ┌───────────┴───────────┐
                          ▼                       ▼
             [OPCIÓN 1: EMAIL Y CONTRASEÑA]  [OPCIÓN 2: CONTINUAR CON GOOGLE]
                          │                       │
                          ▼                       ▼
              POST /api/auth/register     Popup Oficial de Google
              o /api/auth/login-email     + POST /api/auth/sync
                          │                       │
                          └───────────┬───────────┘
                                      ▼
         ┌──────────────────────────────────────────────────────────┐
         │      SESIÓN ACTIVA + TOKEN EN MEMORIA + ROL DINÁMICO     │
         │   Se habilita "Hub Start.gg", "Crear Torneo" y "Admin"   │
         └──────────────────────────────────────────────────────────┘
```

### Paso 2.1: Cómo Registrarse con Correo y Contraseña
1. En la esquina superior derecha, haz clic en el botón **`Registrarse`**.
2. Completa los campos del formulario:
   - **Nombre Completo / Display Name** *(ej. `Mauricio Niklauss`)*.
   - **GamerTag Competitivo** *(ej. `Niklauss#777`)*.
   - **Correo Electrónico** y **Contraseña**.
   - **País / Región**, **Equipo / Clan** *(o `Free Agent`)* y **Personaje Principal (`MAIN`)**.
   - **Plataforma y ID de Consola/PC** *(PSN, Steam, Riot ID, CFN, Tekken ID, etc.)*.
3. Haz clic en **`Crear Cuenta Competitiva`**. Quedarás autenticado automáticamente.

### Paso 2.2: Cómo Iniciar Sesión (Email/Password o Google)
1. Haz clic en **`Iniciar Sesión`** en la barra superior.
2. **Con Correo y Contraseña:** Ingresa tu email y contraseña y pulsa **`Entrar a la Plataforma`**.
3. **Con Google:** Haz clic en **`Continuar con Google`** para autenticar tu cuenta Google y sincronizar automáticamente tu perfil en PostgreSQL.
4. **Cambio Rápido de Cuenta Demo (Testing):** En el modal de Login o en el Hub principal dispones de botones de acceso rápido en 1 clic (`Super Admin`, `Árbitro`, `Jugador Inscrito`, `Espectador`) para probar instantáneamente los permisos de cada rol.

### Paso 2.3: Cómo Completar o Actualizar tus Datos de Jugador e IDs de Consola
1. Una vez iniciada la sesión, haz clic en **`Administración de Usuario`** (en la fila superior) o en la pestaña **`Admin Usuarios & Roles`**.
2. En la tarjeta **"Ficha Completa de Datos del Jugador e IDs por Juego/Consola"**:
   - Actualiza tu **GamerTag**, **Personaje Main**, **Personaje Secundario**, **Teléfono/WhatsApp**, **Discord** y **Twitch**.
   - Vincula múltiples **IDs por plataforma** (`PS5`, `PC_STEAM`, `XBOX_SERIES`, `SWITCH`, `EPIC`, `RIOT`, `BATTLE_NET`) para que tus rivales y árbitros te encuentren de inmediato en torneos online o presenciales.
3. Pulsa **`Guardar Datos del Usuario`**.

---

## 🛡️ 3. Modelo de Roles y Permisos Dinámicos por Torneo (Start.gg RBAC)

Al igual que en **Start.gg**, **un mismo usuario puede tener distintos roles según el torneo que esté visualizando**:
- Puede ser **Director del Torneo (TO)** en el torneo que él mismo creó.
- Puede ser **Jugador Competidor (`PLAYER`)** en otro torneo donde se inscribió al bracket.
- Puede ser **Árbitro de Mesa (`REFEREE`)** en un tercer torneo donde el organizador lo asignó al staff.
- Y es **Espectador (`SPECTATOR`)** en cualquier torneo público donde no esté inscrito ni sea parte del staff.

```
┌──────────────────────┬───────────────────────┬────────────────────────────────────────────────────────┐
│ Rol Contextual       │ Código Estándar       │ Permisos Efectivos en el Torneo Seleccionado           │
├──────────────────────┼───────────────────────┼────────────────────────────────────────────────────────┤
│ Super Administrador  │ SUPER_ADMIN           │ Control total global, cambio de roles, API keys y DB   │
│ Director de Torneo   │ TOURNAMENT_DIRECTOR   │ Edita formato OBF, semillas, Check-In, DQ, Meet y QR   │
│ Árbitro Oficial      │ REFEREE               │ Valida Check-In en estación, reporta sets y aplica DQ  │
│ Broadcast / Streamer │ STREAMER              │ Lectura WebSocket de baja latencia + Lobby Google Meet │
│ Tesorero QR          │ PAY_EDITOR            │ Audita y aprueba pagos de entradas y premios por QR    │
│ Jugador Inscrito     │ PLAYER                │ Hace Check-In, reporta SU propio match y entra a Meet  │
│ Espectador           │ SPECTATOR             │ Solo lectura de brackets 2D/3D + Predicciones Pick-ems │
└──────────────────────┴───────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 🏗️ 4. Guía Paso a Paso: Creación de Torneos, Eventos y Formatos OBF v1.0

Cualquier usuario con sesión iniciada puede organizar su propio torneo y convertirse automáticamente en su **`TOURNAMENT_DIRECTOR`**.

### Paso 4.1: Asistente de Creación de Torneo (Wizard en 2 Pasos)
1. Inicia sesión y haz clic en el botón **`+ Crear Torneo`** en la barra superior.
2. **Paso 1 — Datos del Evento y Formato Competitivo:**
   - **Nombre del Torneo:** Ej. ` Lima Salty Major 2026`.
   - **Videojuego Oficial:** Selecciona del catálogo eSports (*Street Fighter 6, Tekken 8, Guilty Gear Strive, Mortal Kombat 1, 2XKO, Super Smash Bros. Ultimate, Valorant, Rocket League, League of Legends, EA Sports FC 26*, etc.).
   - **Formato del Bracket (OBF v1.0):**
     - `two_stage`: Fase de Grupos Suiza + Playoffs de Doble Eliminación.
     - `double_elimination`: Cuadro de Ganadores (*Winners*) + Cuadro de Perdedores (*Losers*) + *Grand Final Reset*.
     - `single_elimination`: Eliminación directa $2^k$ con cálculo automático de *Byes*.
     - `swiss`: Emparejamientos por récord similar sin repetir rivales + desempate *Buchholz*.
     - `round_robin`: Todos contra todos mediante Tablas Algorítmicas de Berger.
     - `free_for_all`: Lobbies multijugador con puntuación por posición.
     - `leaderboard`: Clasificación por tiempo/puntaje (*Time Trial / Speedrun*).
   - **Cantidad Inicial de Participantes** y **Bolsa de Premios (USD)**.
3. **Paso 2 — Reglas de Check-In por Pelea y Auto-DQ:**
   - Activa o desactiva el **Check-In obligatorio por Pelea (`enableMatchCheckIn`)**.
   - Ajusta el **Tiempo Límite del Temporizador (`matchCheckInTimeoutMinutes`)** entre **2 y 30 minutos** (por defecto: `5 min`).
   - Elige la **Regla ante Descalificación Doble (`doubleDqRule`)**:
     - `AUTO_BYE_NEXT_ROUND`: Avance automático con *BYE* en la siguiente ronda para que el bracket nunca se detenga.
     - `REQUIRE_ADMIN_INTERVENTION`: Congela el slot y notifica al árbitro/TO.
   - Define la **Penalización en Winners Bracket (`losersBracketDqPenalty`)**:
     - `DROP_TO_LOSERS`: Cae al cuadro de perdedores (estándar FGC / Start.gg).
     - `INSTANT_ELIMINATION`: Eliminación total inmediata del torneo.
4. Haz clic en **`Crear Torneo y Generar DAG`**. El motor construye el grafo completo y abre el bracket en vivo.

---

## 🎟️ 5. Inscripción Inteligente (Smart Self-Enrollment) y Tesorería QR

### Cómo Inscribirse como Jugador en un Torneo
1. En el **`Hub Start.gg (Mis Torneos)`** o dentro del panel de **Google Meet / Participantes**, haz clic en **`Inscribirme en este Torneo`**.
2. Se abrirá el **Modal de Inscripción Inteligente**:
   - Detecta automáticamente el videojuego del torneo y verifica si ya tienes un ID de consola/PC registrado para ese título.
   - Te permite elegir tu **Personaje Principal (`MAIN`)** y **Secundario** del roster oficial del juego.
   - Te permite confirmar tu **Método de Pago QR Instantáneo** (*Yape, Plin, Nequi, Pix, Binance Pay, Stripe QR*).
3. Al confirmar:
   - Tu `gamerTag` se inserta en el bracket OBF v1.0.
   - Tu rol contextual en ese torneo pasa inmediatamente de `SPECTATOR` a **`PLAYER`**.
   - Se desbloquea tu acceso al **Lobby Oficial de Google Meet**, al **Chat Competitivo** y al **Reporte de tus Partidas**.

---

## 🕸️ 6. Motor de Brackets DAG O(1), Visor 2D SVG y Lienzo Espacial 3D WebGL

En la pestaña **`Brackets en Vivo`** puedes alternar en tiempo real entre dos motores de visualización sincronizados:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                           MODOS DE VISUALIZACIÓN DE BRACKETS                           │
├───────────────────────────────────────────┬────────────────────────────────────────────┤
│        1. VISOR 2D SVG INTERACTIVO        │      2. LIENZO ESPACIAL 3D WEBGL           │
│  • Curvas Bézier cúbicas entre sets       │  • Motor Three.js / WebGL con cámara       │
│  • Filtros por Fase (Swiss, Winners,      │    orbital 360°, Pan y Zoom                │
│    Losers, Grand Finals)                  │  • Capas en Z para Winners (Azul),         │
│  • Simulador Predictivo "What-If"         │    Losers (Ámbar) y Grand Final (Oro)      │
│    (Pick-ems para espectadores)           │  • Tuberías luminosas de avance de         │
│  • Clic directo en cualquier nodo para    │    ganadores y caída a Losers              │
│    abrir la Consola de Reporte            │  • Instancing para torneos de 3,000+       │
└───────────────────────────────────────────┴────────────────────────────────────────────┘
```

- **Búsqueda y Resaltado Instantáneo:** Escribe el nombre de cualquier jugador, personaje o estación en la barra superior para filtrar los nodos activos.
- **Modo Simulador Predictivo (*Pick-ems*):** Activa el interruptor **"Modo Simulador What-If"** en el visor 2D para predecir ganadores ronda por ronda sin alterar los datos oficiales del servidor.

---

## ⏱️ 7. Check-In a Nivel de Pelea/Set, Timers y Descalificación Automática (DQ / Double DQ)

Para evitar que un torneo competitivo se congele esperando a jugadores ausentes, cada partida lista para jugarse pasa por la **Máquina de Estados de Match Check-In**:

```
                       [SET_READY / WAITING_CHECKIN]
                      (Ambos rivales están definidos)
                                    │
               ┌────────────────────┴────────────────────┐
               │                                         │
    (Jugador A hace Check-In)               (Expira el Temporizador)
               │                                         │
               ▼                                         ▼
      [PARTIAL_CHECKIN]                       ¿Hizo alguno Check-In?
     (Cuenta regresiva MM:SS)                     /             \
               │                              (NINGUNO)      (SOLO UNO)
     ┌─────────┴─────────┐                        │               │
     │                   │                        ▼               ▼
(Jugador B hace)   (B NO llega a tiempo)    [DOUBLE_DQ]      [SINGLE_DQ]
     │                   │                 (Ambos 0 - 0)    (Walkover 2 - 0)
     ▼                   ▼                 (Avanza BYE      (Gana y avanza
[IN_PROGRESS]       [SINGLE_DQ]             a siguiente      el jugador que
(Se habilita       (Gana Jugador A          ronda o pide     sí estuvo listo)
 Score Reporter)    por Walkover)           intervención)
```

### Cómo Funciona Paso a Paso:
1. **Banner Flotante en Vivo y Alerta Visual:** Cuando tu partida está lista en una estación física o virtual (ej. `EST-01`), aparece un banner ámbar con cuenta regresiva `MM:SS` en la parte superior del dashboard y en la **Consola Árbitro**.
2. **Confirmación de Presencia (`Check-In`):**
   - Cada jugador pulsa su botón **`Hacer Check-In (Jugador 1 / Jugador 2)`**.
   - Cuando el primero confirma, el estado cambia a **`PARTIAL_CHECKIN`** `[LISTO vs PENDIENTE]`.
   - Cuando ambos confirman dentro del tiempo límite, el set pasa a **`IN_PROGRESS`** y desbloquea los controles de marcador y baneo de escenarios.
3. **Resolución Automática al Expirar el Timer (Watchdog Servidor + Motor Local):**
   - **Escenario 1 — Single DQ (1 Presente, 1 Ausente):** El jugador ausente recibe estado **`DQ`**, y el jugador presente gana automáticamente por **Walkover (`2 - 0`)** avanzando en el DAG.
   - **Escenario 2 — Double DQ (Ambos Ausentes):** Ambos quedan marcados como **`DOUBLE_DQ`** y el sistema aplica la regla configurada por el TO (`AUTO_BYE_NEXT_ROUND` o `REQUIRE_ADMIN_INTERVENTION`).
4. **Controles Manuales del Árbitro / Director del Torneo:**
   - Desde la **Consola Árbitro**, el staff dispone de botones de intervención inmediata:
     - `Forzar Check-In J1`, `Forzar Check-In J2`, `Forzar Ambos Check-In`.
     - `+2 Min Tiempo Extra` (extiende el deadline en caliente).
     - `Declarar DQ J1`, `Declarar DQ J2`, `Declarar Double DQ`.
     - `Revertir DQ / Reiniciar Check-In` (si un jugador justificó su demora técnica).

---

## 🎮 8. Reporte de Resultados, Avance de Ganadores y Gran Final Bracket Reset

En la pestaña **`Consola Árbitro`** (`SingleScreenScoreReporter`):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                       CONSOLA DE REPORTE DE SET (BO3 / BO5 / FT3)                      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  1. STAGE STRIKING (Baneo de Mapas Oficiales):                                         │
│     Haz clic sobre los escenarios (ej. Final Destination, Battlefield, Mishima Dojo)   │
│     para tacharlos en orden 1-2-1 hasta definir el escenario activo del juego.         │
│                                                                                        │
│  2. REGISTRO JUEGO POR JUEGO (Game-by-Game Audit):                                     │
│     Selecciona personajes usados y quién ganó cada Game individual o ajusta el         │
│     marcador global con los botones [-] / [+].                                         │
│                                                                                        │
│  3. PROPAGACIÓN O(1) EN EL GRAFO DAG:                                                  │
│     • El ganador avanza automáticamente al slot correspondiente de la siguiente ronda. │
│     • En Doble Eliminación, el perdedor de Winners desciende al slot exacto de Losers. │
│     • En Gran Final, si el campeón de Losers derrota al invicto de Winners en el Set 1,│
│       el motor activa automáticamente el SET DE BRACKET RESET (GF-RESET).              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Seguridad de Reporte Contextual:**
  - Un **`PLAYER`** únicamente puede hacer Check-In y reportar el resultado de **su propia partida** donde participa su `gamerTag`.
  - Un **`REFEREE`**, **`TOURNAMENT_DIRECTOR`** o **`SUPER_ADMIN`** puede auditar y reportar cualquier estación del torneo.
  - Un **`SPECTATOR`** o **`STREAMER`** visualiza la consola en modo lectura en tiempo real vía WebSocket.

---

## 📹 9. Integración con Google Meet Oficial y Chat en Vivo con Brackets 2D/Texto

En la vista principal **`Hub Start.gg (Mis Torneos)`** (y disponible al pie de todas las vistas internas), cada torneo cuenta con su **Lobby de Coordinación en Tiempo Real**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│               SALA GOOGLE MEET OFICIAL + CHAT DEL TORNEO CON BRACKETS                  │
├───────────────────────────────────────────┬────────────────────────────────────────────┤
│       PANEL GOOGLE MEET API v2            │    CHAT EN VIVO + SNAPSHOT DE BRACKETS     │
│  • Creación de salas reales vía           │  • Apenas se crea el torneo o la sala, el  │
│    Google Meet REST API                   │    chat publica automáticamente el         │
│    (meetings.space.created)               │    BRACKET COMPLETO (Quién contra Quién).  │
│  • Configuración de acceso:               │  • Selector de vista dentro del chat:      │
│    OPEN / TRUSTED / RESTRICTED            │    [2D Gráfico] · [Texto ASCII] · [Ambos]  │
│  • Acceso exclusivo para jugadores        │  • Filtro por Fase y botón "Copiar         │
│    inscritos en ese torneo y Staff.       │    Bracket en Texto" para Discord/WhatsApp │
│  • Conexión 100% opcional en 1 clic.      │  • Clic en cualquier llave del chat para   │
│                                           │    ir directo a esa partida.               │
└───────────────────────────────────────────┴────────────────────────────────────────────┘
```

### Paso a Paso para Usar Google Meet y el Chat del Torneo:
1. **Conectar Google Meet (Directores de Torneo / Super Admin):**
   - Haz clic en **`Configurar / Crear Sala Google Meet`**.
   - Autoriza con tu cuenta de Google Workspace/Gmail (flujo OAuth 2.0 en cliente) para crear un espacio real en `https://meet.googleapis.com/v2/spaces` o vincula una sala instantánea.
2. **Unirse a la Videollamada (Opcional para Inscritos):**
   - Si estás inscrito en el torneo activo (`PLAYER`) o eres parte del staff, verás el botón verde **`Unirse a Google Meet (Opcional)`** junto con el código de reunión copiable.
   - Si aún no estás inscrito, el panel te mostrará el botón **`Inscribirme Ahora para Desbloquear Meet & Chat`**.
3. **Consultar Quién Contra Quién en el Chat del Torneo:**
   - Al abrir el **Chat de la Sala del Torneo**, el primer mensaje fijado contiene **todas las llaves del torneo** tanto en **tarjetas visuales 2D por ronda** como en **formato de texto estructurado** (`#SetID [ESTACIÓN] Jugador 1 vs Jugador 2`).
   - Cada vez que el Director del Torneo publica una actualización o se reportan partidas, se puede publicar un nuevo snapshot actualizado en el chat con un solo clic en **`Publicar Bracket en Chat`**.

---

## 🌐 10. Circuitos de 6 Meses y Arquitectura para Torneos Masivos (3,000+ Jugadores)

En la pestaña **`Circuitos 6M & Masivos 3000+`** se gestionan las dos escalas más exigentes del eSports profesional:

### A. Ligas y Circuitos de Larga Duración (Temporadas de 6 Meses)
```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│            CIRCUITO DE TEMPORADA (Ej. Capcom Pro Tour / Tekken World Tour)             │
│                  12 Fechas Quincenales (6 Meses) · Tabla Global Acumulada              │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
        ┌───────────────────────────────────┼───────────────────────────────────┐
        ▼                                   ▼                                   ▼
┌───────────────────┐               ┌───────────────────┐               ┌───────────────────┐
│  Fecha #1 - Mayo  │               │  Fecha #2 - Mayo  │      ...      │ Fecha #12 - Oct   │
│ 1º=100p, 2º=75p   │               │ 1º=100p, 2º=75p   │               │ 1º=100p, 2º=75p   │
└─────────┬─────────┘               └─────────┬─────────┘               └─────────┬─────────┘
          └───────────────────────────────────┼───────────────────────────────────┘
                                              ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  • Regla Best of X Drops (ej. Cuenta los mejores 8 de 12 torneos de cada jugador)      │
│  • Clasificación Automática del Top 8 / Top 16 al Torneo "Season Finals"               │
│  • Estadísticas Comparativas: Head-to-Head (H2H), Evolutivo Elo y Character Meta Share │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Simulador de Temporada y Drops:** Ajusta en vivo el número de fechas válidas (*Best of 8 / Best of 10*) y recalcula automáticamente quiénes clasifican al **Top 8 / Top 16 Season Finals**.
- **Generador de Playoffs Finales:** Haz clic en **`Generar Torneo Season Finals (Top 8/16)`** para lanzar automáticamente el evento final con los clasificados.
- **Matriz Head-to-Head (H2H) y Evolución Elo:** Compara el historial acumulado entre dos jugadores a lo largo de los 6 meses y la distribución de personajes (*Character Meta Share*).

### B. Arquitectura para Torneos Masivos (3,000+ Participantes)
Para evitar que un bracket de 3,072 jugadores colapse la pantalla o los horarios físicos, el sistema particiona el evento en **3 Capas Jerárquicas**:
1. **Capa 1 — Waves (Oleadas Horarias):** `Wave A (10:00 AM)`, `Wave B (12:00 PM)`, `Wave C (02:00 PM)`, `Wave D (04:00 PM)`.
2. **Capa 2 — Pools (96 Grupos de 32 Jugadores):** `Pool A1..A24`, `Pool B1..B24`, etc., asignados a clusters de estaciones físicas.
3. **Capa 3 — Top 192 → Top 64 → Top 8 Final:** Los 2 mejores de cada Pool (1º por Winners y 2º por Losers) avanzan al cuadro final consolidado.
4. **Algoritmo Anti-Colisión Geográfica y de Clanes (*Seed Dispersion*):** Separa automáticamente en distintos Pools a jugadores del mismo país/ciudad o del mismo equipo (`teamName`) para evitar que se eliminen en Ronda 1.

---

## 📊 11. Analítica en Tiempo Real, Caché Redis O(1), Auditoría y Backups

En las pestañas **`Analítica & DAG`** y **`Admin Usuarios & Roles`**:
- **Benchmark Matemático O(1) vs O(n log n):** Ejecuta pruebas de estrés en vivo calculando emparejamientos, *Byes* ($B = 2^{\lceil \log_2 n \rceil} - n$), rondas suizas ($\lceil \log_2 n \rceil$) y desempates *Buchholz / OMW%*.
- **Telemetría de Caché Redis en Memoria:** Monitorea *Hit Ratio*, memoria utilizada, latencia en sub-milisegundos y vaciado selectivo (`Flush Cache`).
- **Seguridad 2FA (TOTP), Tokens Efímeros de Árbitro y Backups Cloud:**
  - Generación de **Tokens Efímeros** por estación (`EST-01`, `EST-02`) con alcance restringido para tablets de árbitros.
  - Creación y restauración en 1 clic de **Snapshots completos del torneo** (`Cloud Backups`).
- **Exportación Oficial:** Descarga en cualquier momento el **Reporte CSV de Standings** o el **Informe Ejecutivo PDF / Imprimible** desde la barra de herramientas del torneo.

---

## 🗄️ 12. Estructura del Proyecto, Base de Datos (PostgreSQL / Drizzle / Prisma) y API REST + WebSockets

### Árbol de Directorios Principal
```text
/
├── server.ts                                    # Servidor Full-Stack Express + WebSocket (/ws) + PostgreSQL + Watchdog Auto-DQ
├── prisma/
│   └── schema.prisma                            # Esquema Prisma: Circuit, CircuitStanding, MassivePool, Tournament, MatchSet, User
├── src/
│   ├── App.tsx                                  # Shell principal, Header de 2 filas, RBAC contextual y sincronización WS
│   ├── db/
│   │   ├── index.ts                             # Conexión Drizzle ORM + PostgreSQL (Cloud SQL Unix Socket / TCP)
│   │   └── schema.ts                            # Tablas SQL: users, user_game_accounts, tournament_roles, payments, audit_logs
│   ├── engine/
│   │   └── nikBracketsEngine.ts                 # Motor matemático DAG OBF v1.0, Check-In State Machine, Elo/Glicko-2, Exportadores
│   ├── services/
│   │   └── googleWorkspace.ts                   # Cliente OAuth 2.0 y llamadas directas a Google Meet REST API v2
│   └── components/
│       ├── PublicLandingAndStartHub.tsx         # Landing Pública + Hub Start.gg de Mis Torneos y Roles
│       ├── TournamentGoogleMeetPanel.tsx        # Sala Google Meet + Chat en Vivo con Brackets 2D y Texto
│       ├── BracketDagVisualizer.tsx             # Visor 2D SVG con curvas Bézier y Simulador Predictivo Pick-ems
│       ├── BracketCanvasWebGL3D.tsx             # Lienzo Espacial 3D WebGL (Three.js) con soporte de Pools Masivos
│       ├── ParticipantsAndRefereeView.tsx       # Gestión de Participantes + Consola Árbitro + Match Check-In & Stage Striking
│       ├── CircuitsAndMassiveScaleView.tsx      # Ligas de 6 Meses (Best of X Drops, H2H, Meta) + Arquitectura 3,000+ Pools
│       ├── SmartTournamentEnrollmentModal.tsx   # Modal de Auto-Inscripción Inteligente + Validación de ID de Consola + QR
│       ├── AuthAndUsersModal.tsx                # Modal de Login/Registro (Email + Google) + Panel Admin Usuarios & Tesorería
│       ├── AnalyticsAndBenchmarkView.tsx        # Analítica en Vivo, Benchmark DAG y Telemetría Redis
│       └── AdminAndSecurityView.tsx             # Configuración de Match Check-In, 2FA, Tokens Efímeros y Cloud Backups
```

### Principales Endpoints REST (`/api/*`) y Eventos WebSocket (`/ws`)
| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/bootstrap` | Carga el documento OBF v1.0 activo, lista de torneos, telemetría Redis y roles |
| `POST` | `/api/auth/register` | Registro con Correo, Contraseña, GamerTag e ID de consola |
| `POST` | `/api/auth/login-email` | Inicio de sesión con Correo y Contraseña |
| `POST` | `/api/auth/sync` | Sincronización de sesión Google / Firebase Auth con PostgreSQL |
| `PATCH` | `/api/auth/profile` | Actualización de ficha competitiva del jugador y personajes |
| `POST` | `/api/auth/game-accounts` | Vinculación de IDs de consola/PC por videojuego |
| `POST` | `/api/tournaments` | Creación de un nuevo torneo OBF v1.0 con reglas de Match Check-In |
| `POST` | `/api/tournaments/:slug/self-register` | Auto-inscripción inteligente de jugador + generación de pago QR |
| `POST` | `/api/tournaments/:slug/sets/:setId/checkin` | Confirmación de Check-In por pelea (`slot: 1 \| 2 \| 'BOTH'`) |
| `POST` | `/api/tournaments/:slug/sets/:setId/checkin-admin` | Intervención de árbitro (`FORCE_BOTH`, `EXTEND_TIME`, `DQ_P1`, `DOUBLE_DQ`, `RESET_CHECKIN`) |
| `POST` | `/api/tournaments/:slug/sets/:setId/report` | Reporte oficial de marcador, avance de ganadores y caída a Losers |
| `PUT` | `/api/tournaments/:slug/meet` | Creación/actualización de la sesión Google Meet y publicación del Bracket en Chat |
| `POST` | `/api/tournaments/:slug/chat` | Envío de mensajes en tiempo real y snapshots 2D/Texto del bracket |
| `WS` | `/ws` | Canal WebSocket en vivo (`match:updated`, `tournament:created`, `notification:push`, `presence:updated`) |

---

## 🚀 Ejecución Local y Despliegue en Producción

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor full-stack de desarrollo (Express + Vite + WebSocket en puerto 3000)
npm run dev

# 3. Verificar tipado estático TypeScript
npm run lint

# 4. Compilar bundle optimizado de producción
npm run build

# 5. Iniciar en producción (Cloud Run / Contenedor Node.js)
npm start
```
