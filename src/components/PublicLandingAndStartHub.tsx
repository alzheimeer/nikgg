/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Landing Page Pública (Modo Espectador sin Login) + Hub Estilo Start.gg / alzheimeer/start
 * con Roles Dinámicos por Torneo (Admin Creador, Reporteador Asignado, Participante solo en su Match).
 */

import React from 'react';
import {
  OBFEntrant,
  OBFEventMetadata,
  OBFSet,
  UserRole,
} from '../engine/nikBracketsEngine';
import {
  AuthenticatedUser,
  TournamentRoleAssignment,
} from './AuthAndUsersModal';
import {
  Award,
  Eye,
  Gamepad2,
  Lock,
  LogIn,
  LogOut,
  Play,
  Plus,
  Shield,
  Sliders,
  Swords,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';

export interface TournamentSummaryCardData {
  slug?: string;
  tournamentSlug?: string;
  name?: string;
  gameName?: string;
  gameSlug?: string;
  format?: string;
  prizePool?: number;
  numberEntrants?: number;
  totalSetsCount?: number;
  event?: OBFEventMetadata;
  entrantsCount?: number;
  setsCount?: number;
  completedSetsCount?: number;
  readySetsCount?: number;
  inProgressSetsCount?: number;
  topEntrants?: Array<{
    entrantID: string;
    entrantTag: string;
    initialSeed: number;
    eloRating: number;
    mainCharacter?: string;
    country?: string;
    teamName?: string;
  }>;
  entrantTags?: string[];
  featuredSet?: {
    setID: string;
    roundLabel: string;
    status: string;
    bestOf: number;
    station: string;
    p1Tag: string;
    p2Tag: string;
    score1: number;
    score2: number;
  } | null;
  entrants?: OBFEntrant[];
  sets?: OBFSet[];
}

interface PublicLandingAndStartHubProps {
  currentUser: AuthenticatedUser | null;
  tournamentSummaries: TournamentSummaryCardData[];
  activeTournamentSlug: string;
  allTournamentRoles: TournamentRoleAssignment[];
  tournamentCreators: Record<string, string>;
  getEffectiveRoleForTournament: (slug: string, entrants?: OBFEntrant[]) => {
    role: UserRole;
    reason: string;
    assignedStation?: string | null;
    myEntrant?: OBFEntrant | null;
  };
  onSelectTournamentAndNavigate: (
    slug: string,
    targetTab: 'brackets' | 'participants' | 'reporter' | 'analytics' | 'admin',
    targetSetID?: string
  ) => void;
  onOpenAuthModal: (mode: 'login' | 'register' | 'profile') => void;
  onQuickSwitchAccount: (email: string) => Promise<void>;
  onOpenCreateTournament: () => void;
  onOpenUsersAdminModal: (slug?: string) => void;
  onSelfEnrollInTournament: (slug: string) => Promise<void>;
  onLogout: () => Promise<void>;
}

const FORMAT_LABELS: Record<string, string> = {
  two_stage: 'Two-Stage (Suizo + Doble Eliminación)',
  double_elim: 'Doble Eliminación (Winners & Losers)',
  double_elimination: 'Doble Eliminación (Winners & Losers)',
  single_elim: 'Eliminación Directa',
  single_elimination: 'Eliminación Directa',
  swiss: 'Sistema Suizo Puro',
  round_robin: 'Round Robin (Todos contra Todos)',
  free_for_all: 'Free-For-All Multi-Lobby',
  leaderboard: 'Leaderboard / Time Trial',
};

const ROLE_DISPLAY_META: Record<
  UserRole,
  { label: string; codeStandard: string; badgeClass: string; capabilities: string }
> = {
  SUPER_ADMIN: {
    label: 'SUPER_ADMIN (Global)',
    codeStandard: 'SUPER_ADMIN',
    badgeClass: 'border-sky-400/50 bg-sky-500/15 text-sky-300',
    capabilities:
      'Control total del software, monitoreo de servidores, moderación global, API DeepSeek y métricas financieras.',
  },
  USER: {
    label: 'USER (Usuario Base / Jugador)',
    codeStandard: 'USER',
    badgeClass: 'border-slate-500/50 bg-slate-800 text-slate-200',
    capabilities:
      'Rol por defecto al registrarse. Vincula Riot ID / SteamID, crea sus propios torneos o se inscribe a competencias.',
  },
  TOURNAMENT_DIRECTOR: {
    label: 'TOURNAMENT_ADMIN (Director)',
    codeStandard: 'TOURNAMENT_ADMIN',
    badgeClass: 'border-indigo-400/50 bg-indigo-500/15 text-indigo-300',
    capabilities:
      'Control total del evento. Crea estructura (Suiza, Doble Elim), asigna premios, delega roles y modifica cualquier marcador.',
  },
  REFEREE: {
    label: 'REFEREE / POOL_CAPTAIN (Árbitro)',
    codeStandard: 'REFEREE / POOL_CAPTAIN',
    badgeClass: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300',
    capabilities:
      'Poderes delegados en su Pool/Estación: ve, edita y reporta marcadores de CUALQUIER partida asignada y resuelve disputas (Timer 3m).',
  },
  PAY_EDITOR: {
    label: 'PAY_EDITOR / TREASURER (Tesorería)',
    codeStandard: 'PAY_EDITOR / TREASURER',
    badgeClass: 'border-amber-400/50 bg-amber-500/15 text-amber-300',
    capabilities:
      'Gestión exclusiva del cobro de inscripciones (Venue Fees), validación QR y liberación de pozo de premios (Payouts).',
  },
  STREAMER: {
    label: 'STREAMER / CASTER (Solo Lectura WS)',
    codeStandard: 'STREAMER / CASTER',
    badgeClass: 'border-purple-400/50 bg-purple-500/15 text-purple-300',
    capabilities:
      'Acceso de SOLO LECTURA a datos en tiempo real por WebSockets, estado de mesas y personajes sin riesgo de alterar marcadores.',
  },
  PLAYER: {
    label: 'PARTICIPANT / ENTRANT (Competidor)',
    codeStandard: 'PARTICIPANT / ENTRANT',
    badgeClass: 'border-cyan-400/50 bg-cyan-500/15 text-cyan-300',
    capabilities:
      'Alcance restringido (EventParticipant): solo puede hacer Check-in, elegir personajes y reportar/adjuntar foto ÚNICAMENTE para sus propias partidas.',
  },
  SPECTATOR: {
    label: 'SPECTATOR (Público / Pick-ems)',
    codeStandard: 'SPECTATOR',
    badgeClass: 'border-slate-700 bg-slate-800/80 text-slate-300',
    capabilities:
      'Acceso de solo lectura al Canvas 3D/2D de llaves, participación en quinielas/predicciones (Pick-ems) y votaciones en vivo.',
  },
};

export const PublicLandingAndStartHub: React.FC<PublicLandingAndStartHubProps> = ({
  currentUser,
  tournamentSummaries,
  activeTournamentSlug,
  getEffectiveRoleForTournament,
  onSelectTournamentAndNavigate,
  onOpenAuthModal,
  onQuickSwitchAccount,
  onOpenCreateTournament,
  onOpenUsersAdminModal,
  onSelfEnrollInTournament,
  onLogout,
}) => {
  const safeSummaries = Array.isArray(tournamentSummaries) ? tournamentSummaries : [];

  const totalPrizePool = safeSummaries.reduce(
    (acc, t) => acc + (t.event?.prizePool ?? t.prizePool ?? 0),
    0
  );
  const totalEntrants = safeSummaries.reduce(
    (acc, t) => acc + (t.entrantsCount ?? t.numberEntrants ?? t.entrants?.length ?? 0),
    0
  );
  const totalSets = safeSummaries.reduce(
    (acc, t) => acc + (t.setsCount ?? t.totalSetsCount ?? t.sets?.length ?? 0),
    0
  );

  const globalAccountRoleLabel =
    currentUser?.globalRole === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'USER';

  return (
    <div className="flex flex-col gap-6">
      {/* HERO SECTION: DIFERENCIADO ENTRE VISITANTE NO LOGEADO Y USUARIO LOGEADO (START.GG HUB) */}
      {!currentUser ? (
        <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-[#0B1120] via-[#0F172A] to-[#090D16] p-6 lg:p-8 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-sky-400">
                <Trophy className="w-4 h-4" />
                <span>Estándar RBAC Start.gg · Roles Globales (Cuenta) vs Roles Contextuales (Torneo / Estación)</span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight leading-tight">
                Un Rol Base (<span className="text-sky-400 font-mono">USER</span>) al Registrarte; Poderes Dinámicos en Cada Torneo
              </h1>

              <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
                Al registrarte obtienes el Rol Global{' '}
                <span className="text-white font-mono font-semibold">USER</span>. Tus permisos cambian dinámicamente según el contexto de cada evento: puedes ser{' '}
                <span className="text-cyan-300 font-mono font-semibold">PARTICIPANT</span> en un torneo (restringido a Check-in y auto-reporte de tus propias peleas),{' '}
                <span className="text-indigo-300 font-mono font-semibold">TOURNAMENT_ADMIN</span> en un torneo creado por ti, o{' '}
                <span className="text-emerald-300 font-mono font-semibold">REFEREE / POOL_CAPTAIN</span> delegado para arbitrar cualquier partida de tu estación.
              </p>

              {/* Botones Principales de Autenticación y Exploración */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenAuthModal('login')}
                  className="px-4 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-sky-500/10 transition-colors cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  Iniciar Sesión (Google / Email)
                </button>

                <button
                  type="button"
                  onClick={() => onOpenAuthModal('register')}
                  className="px-4 py-2.5 rounded-xl border border-sky-400/50 bg-sky-500/10 hover:bg-sky-500/20 text-sky-200 font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  1. Registro Base (Rol Global: USER)
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onSelectTournamentAndNavigate(activeTournamentSlug, 'brackets')
                  }
                  className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-slate-400" />
                  Modo SPECTATOR (Canvas 3D + Pick-ems)
                </button>
              </div>

              {/* Acceso Rápido Demo para Probar Roles Dinámicos por Torneo */}
              <div className="mt-2 pt-4 border-t border-slate-800/80">
                <div className="text-[11px] font-mono text-slate-400 mb-2">
                  DEMO 1-CLICK — PRUEBA EL CAMBIO DINÁMICO DE ROL CONTEXTUAL SEGÚN EL TORNEO:
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onQuickSwitchAccount('arslan.ash@twistedminds.gg')}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950/90 hover:border-emerald-400/60 text-xs text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Gamepad2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      <strong>ArslanAsh#PK</strong> (Global: <code className="text-sky-300">USER</code> → <code className="text-cyan-300">PARTICIPANT</code> en T8 · <code className="text-emerald-300">REFEREE</code> en SF6 · <code className="text-indigo-300">TOURNAMENT_ADMIN</code> en GGST)
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onQuickSwitchAccount('referee01@nikbrackets.pro')}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950/90 hover:border-amber-400/60 text-xs text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      <strong>Referee01#OFFICIAL</strong> (Global: <code className="text-sky-300">USER</code> → Delegado <code className="text-emerald-300">REFEREE / POOL_CAPTAIN</code>)
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onQuickSwitchAccount('broadcast@nikbrackets.pro')}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950/90 hover:border-purple-400/60 text-xs text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-purple-400" />
                    <span>
                      <strong>CasterLive#OBS</strong> (Global: <code className="text-sky-300">USER</code> → <code className="text-purple-300">STREAMER / CASTER</code> Solo Lectura WS)
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onQuickSwitchAccount('niklaussmauricio@gmail.com')}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950/90 hover:border-sky-400/60 text-xs text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Shield className="w-3.5 h-3.5 text-sky-400" />
                    <span>
                      <strong>Niklauss#KR1</strong> (Global: <code className="text-sky-300">SUPER_ADMIN</code>)
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Panel Derecho: Jerarquía Estándar (Roles Globales vs Roles Contextuales) */}
            <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-950/90 p-5 flex flex-col gap-3.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Jerarquía Estándar de Seguridad y Control de Acceso
                  </h2>
                  <p className="text-xs text-slate-400">
                    Diferenciación estricta entre Cuenta Global y Contexto del Torneo
                  </p>
                </div>
                <Lock className="w-4 h-4 text-sky-400 shrink-0" />
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg border border-sky-500/25 bg-sky-950/15">
                  <div className="font-mono font-semibold text-sky-300">
                    A. ROLES GLOBALES (Nivel Cuenta / Sistema)
                  </div>
                  <p className="text-slate-300 mt-0.5">
                    • <strong>SUPER_ADMIN:</strong> Monitoreo global, moderación, API DeepSeek y finanzas.<br />
                    • <strong>USER (Por defecto):</strong> Vincula Riot ID / SteamID, crea torneos o se inscribe.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg border border-indigo-500/25 bg-indigo-950/15">
                  <div className="font-mono font-semibold text-indigo-300">
                    B. ROLES CONTEXTUALES (Por Torneo / Pool / Estación)
                  </div>
                  <p className="text-slate-300 mt-0.5">
                    • <strong>TOURNAMENT_ADMIN:</strong> Crea estructura, delega roles y edita cualquier match.<br />
                    • <strong>REFEREE / POOL_CAPTAIN:</strong> Reporta cualquier partida de su zona + Timer 3m.<br />
                    • <strong>STREAMER / CASTER:</strong> Solo lectura WebSockets/OBS sin alterar scores.<br />
                    • <strong>PAY_EDITOR / TREASURER:</strong> Cobro de Venue Fees QR y liberación de Payouts.<br />
                    • <strong>PARTICIPANT / ENTRANT:</strong> Check-in y reporte <em>solo de sus propias partidas</em>.<br />
                    • <strong>SPECTATOR:</strong> Lectura 3D/2D y predicciones <em>Pick-ems</em> en vivo.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center">
                <div className="p-2 rounded-lg bg-slate-900/80">
                  <div className="text-base font-mono tabular-nums font-bold text-white">
                    {safeSummaries.length}
                  </div>
                  <div className="text-[11px] text-slate-400">Torneos Activos</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/80">
                  <div className="text-base font-mono tabular-nums font-bold text-sky-400">
                    {totalEntrants}
                  </div>
                  <div className="text-[11px] text-slate-400">Competidores</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/80">
                  <div className="text-base font-mono tabular-nums font-bold text-emerald-400">
                    ${totalPrizePool.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-400">Prize Pool Total</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* PANEL START.GG CUANDO EL USUARIO ESTÁ LOGEADO */
        <section className="rounded-2xl border border-slate-800 bg-gradient-to-br from-[#0B1120] via-[#0F172A] to-[#090D16] p-6 shadow-xl flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-sky-500/15 border border-sky-400/40 flex items-center justify-center text-lg font-bold text-sky-300 font-mono">
                {(currentUser.gamerTag || 'US').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-white">
                    Centro de Control Start.gg — {currentUser.gamerTag}
                  </h1>
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-mono font-semibold border ${
                      globalAccountRoleLabel === 'SUPER_ADMIN'
                        ? 'border-sky-400/50 bg-sky-500/15 text-sky-300'
                        : 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
                    }`}
                  >
                    Rol Global (Cuenta): {globalAccountRoleLabel}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-mono border border-slate-700 bg-slate-900 text-slate-300">
                    {currentUser.email}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border ${
                      currentUser.profileCompleted
                        ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                        : 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    {currentUser.profileCompleted
                      ? 'Perfil Progresivo Guardado (Inscripción en 1s)'
                      : 'Cuenta 1-Click (0.5s)'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Jugador: {currentUser.displayName} · ELO Global: {currentUser.eloRating} ·{' '}
                  <strong className="text-emerald-300">MAIN: {currentUser.mainCharacter || 'Reina'}</strong> ·{' '}
                  {currentUser.gameAccounts && currentUser.gameAccounts.length > 0
                    ? `IDs de Consola: ${currentUser.gameAccounts
                        .map((a) => `[${a.platform}: ${a.inGameId}]`)
                        .join(' ')}`
                    : 'Sin IDs de consola guardados aún (colócalos ahora en Administración de Usuario o al inscribirte)'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onOpenCreateTournament}
                className="px-3.5 py-2 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Opción B: Crear Torneo (Serás TOURNAMENT_ADMIN)
              </button>

              <button
                type="button"
                onClick={() => onOpenUsersAdminModal(activeTournamentSlug)}
                className="px-3.5 py-2 rounded-xl border border-amber-400/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Users className="w-4 h-4 text-amber-400" />
                Administración de Usuario (Mis Datos, IDs Consola & Roles)
              </button>

              <button
                type="button"
                onClick={() => onOpenAuthModal('profile')}
                className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
                Modal Rápido de Perfil
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="px-3 py-2 rounded-xl border border-rose-500/40 bg-rose-950/30 hover:bg-rose-900/50 text-rose-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Cerrar Sesión
              </button>
            </div>
          </div>

          {/* Diagrama Interactivo del Perfilado Progresivo (Progressive Profiling) + Roles Contextuales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-950/80 text-xs">
            <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/70 flex flex-col justify-between gap-2">
              <div>
                <div className="text-[11px] font-mono text-sky-400 font-semibold">
                  1. REGISTRO INICIAL (0.5s · 1-CLICK) + BIBLIOTECA DE IDs
                </div>
                <div className="font-bold text-white mt-0.5">
                  Rol Global: <code className="text-emerald-300">{globalAccountRoleLabel}</code> ·{' '}
                  <code className="text-sky-300">GameAccount</code>
                </div>
                <p className="text-slate-400 mt-1">
                  Guarda múltiples IDs por plataforma para el mismo juego (ej. <code>PS5: 349Q-tay4-YYH8</code> vs <code>PC_STEAM: 2jdr-i7LF-23HT</code>) y tu personaje <strong>MAIN</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenAuthModal('profile')}
                className="self-start px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium cursor-pointer"
              >
                Mis IDs por Consola (PS5 / PC) & MAIN →
              </button>
            </div>

            <div className="p-3 rounded-lg border border-cyan-500/30 bg-cyan-950/15 flex flex-col justify-between gap-2">
              <div>
                <div className="text-[11px] font-mono text-cyan-300 font-semibold">
                  2 & 3. INSCRIPCIÓN INTELIGENTE (EventEntrant en 1 Segundo)
                </div>
                <div className="font-bold text-white mt-0.5">
                  Rol Contextual: <code className="text-cyan-300">PARTICIPANT</code>
                </div>
                <p className="text-slate-300 mt-1">
                  En tu 1° torneo completas WhatsApp, consola y MAIN. ¡Para el 2° torneo tus datos ya quedan guardados y confirmas con 1 clic!
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSelfEnrollInTournament(activeTournamentSlug)}
                className="self-start px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 font-medium cursor-pointer"
              >
                Abrir Modal Inteligente de Inscripción →
              </button>
            </div>

            <div className="p-3 rounded-lg border border-indigo-500/30 bg-indigo-950/15 flex flex-col justify-between gap-2">
              <div>
                <div className="text-[11px] font-mono text-indigo-300 font-semibold">
                  OPCIÓN B · CREAR TORNEO & DELEGAR PODERES
                </div>
                <div className="font-bold text-white mt-0.5">
                  Adquiere Rol: <code className="text-indigo-300">TOURNAMENT_ADMIN</code>
                </div>
                <p className="text-slate-300 mt-1">
                  Control total del evento y delegación de rol <code className="text-emerald-300">REFEREE / POOL_CAPTAIN</code> a cualquier <code className="text-slate-200">USER</code> registrado.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={onOpenCreateTournament}
                  className="px-2.5 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 font-medium cursor-pointer"
                >
                  + Crear Torneo
                </button>
                <button
                  type="button"
                  onClick={() => onOpenUsersAdminModal(activeTournamentSlug)}
                  className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 font-medium cursor-pointer"
                >
                  Delegar REFEREE →
                </button>
              </div>
            </div>
          </div>

          {/* Tabla Resumen de Mi Rol Dinámico en Cada Torneo */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-sky-400" />
                Mis Roles Contextuales y Partidas Asignadas por Torneo ({safeSummaries.length} eventos)
              </h2>
              <span className="text-xs text-slate-400">
                El rol cambia automáticamente según hayas creado el torneo, seas árbitro delegado o compitas en el bracket
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {safeSummaries.map((item) => {
                const itemSlug = item.slug || item.tournamentSlug || item.event?.tournamentSlug || 'nexus-tekken8-masters';
                const itemName = item.event?.name || item.name || itemSlug;
                const itemGame = item.event?.gameName || item.gameName || 'eSports';
                const itemEntrants = item.entrants || [];
                const itemSets = item.sets || [];
                const itemSetsCount = item.setsCount ?? item.totalSetsCount ?? itemSets.length;
                const itemEntrantsCount = item.entrantsCount ?? item.numberEntrants ?? itemEntrants.length;

                const roleCtx = getEffectiveRoleForTournament(itemSlug, itemEntrants);
                const roleMeta = ROLE_DISPLAY_META[roleCtx.role] || ROLE_DISPLAY_META.SPECTATOR;
                const myEntrant = roleCtx.myEntrant;
                const mySets = myEntrant
                  ? itemSets.filter(
                      (s) =>
                        s.entrant1ID === myEntrant.entrantID ||
                        s.entrant2ID === myEntrant.entrantID
                    )
                  : [];
                const myActiveSet =
                  mySets.find((s) => s.status !== 'COMPLETED') || mySets[0] || null;

                return (
                  <div
                    key={itemSlug}
                    className={`rounded-xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                      itemSlug === activeTournamentSlug
                        ? 'border-sky-400/70 bg-slate-900/95'
                        : 'border-slate-800 bg-slate-950/85 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono uppercase text-sky-400">
                          {itemGame}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${roleMeta.badgeClass}`}
                        >
                          {roleMeta.label}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-white leading-snug">
                        {itemName}
                      </h3>

                      <p className="text-xs text-slate-400">
                        {roleCtx.reason}
                      </p>

                      {/* Si tiene partida propia en este torneo, mostrarla con botón directo de auto-reporte */}
                      {myEntrant && myActiveSet ? (
                        <div className="p-2.5 rounded-lg border border-sky-500/30 bg-sky-950/20 text-xs space-y-1">
                          <div className="flex items-center justify-between font-mono text-[11px] text-sky-300">
                            <span>TU MATCH: {myActiveSet.setID}</span>
                            <span>{myActiveSet.status}</span>
                          </div>
                          <div className="text-white font-medium">
                            {myActiveSet.roundLabel} · Estación {myActiveSet.other?.station || 'EST-01'}
                          </div>
                          <div className="text-[11px] text-slate-300">
                            Marcador actual: {myActiveSet.entrant1Score} - {myActiveSet.entrant2Score} (Bo{myActiveSet.bestOf})
                          </div>
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/50 text-xs text-slate-400">
                          {roleCtx.role === 'TOURNAMENT_DIRECTOR' || roleCtx.role === 'SUPER_ADMIN'
                            ? `Tienes control administrativo sobre los ${itemSetsCount} sets y ${itemEntrantsCount} inscritos.`
                            : roleCtx.role === 'REFEREE'
                            ? `Estás habilitado como Reporteador para validar cualquiera de los ${itemSetsCount} sets.`
                            : 'No estás inscrito como competidor en este bracket aún.'}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => onSelectTournamentAndNavigate(itemSlug, 'brackets')}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-sky-400" />
                        Ver Bracket
                      </button>

                      {myActiveSet && (
                        <button
                          type="button"
                          onClick={() =>
                            onSelectTournamentAndNavigate(
                              itemSlug,
                              'reporter',
                              myActiveSet.setID
                            )
                          }
                          className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Swords className="w-3.5 h-3.5" />
                          Reportar Mi Match ({myActiveSet.setID})
                        </button>
                      )}

                      {(roleCtx.role === 'TOURNAMENT_DIRECTOR' ||
                        roleCtx.role === 'SUPER_ADMIN' ||
                        roleCtx.role === 'REFEREE') && (
                        <button
                          type="button"
                          onClick={() =>
                            onSelectTournamentAndNavigate(
                              itemSlug,
                              'reporter',
                              item.featuredSet?.setID
                            )
                          }
                          className="px-3 py-1.5 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Arbitrar Sets
                        </button>
                      )}

                      {(roleCtx.role === 'TOURNAMENT_DIRECTOR' ||
                        roleCtx.role === 'SUPER_ADMIN') && (
                        <button
                          type="button"
                          onClick={() => onOpenUsersAdminModal(itemSlug)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 cursor-pointer"
                        >
                          Asignar Roles
                        </button>
                      )}

                      {!myEntrant && (
                        <button
                          type="button"
                          onClick={() => onSelfEnrollInTournament(itemSlug)}
                          className="px-2.5 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-xs text-cyan-200 flex items-center gap-1 cursor-pointer"
                        >
                          <UserPlus className="w-3 h-3" />
                          Inscribirme ({currentUser.gamerTag})
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* EXPLORADOR GENERAL DE TORNEOS DISPONIBLES (ACCESIBLE CON Y SIN LOGIN) */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-sky-400" />
              Directorio Público de Torneos eSports ({safeSummaries.length} Eventos Oficiales)
            </h2>
            <p className="text-xs text-slate-400">
              Selecciona cualquier torneo para ver su bracket en tiempo real ({totalSets} sets OBF sincronizados por WebSocket).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {safeSummaries.map((tItem) => {
            const tSlug = tItem.slug || tItem.tournamentSlug || tItem.event?.tournamentSlug || 'nexus-tekken8-masters';
            const tName = tItem.event?.name || tItem.name || tSlug;
            const tGameName = tItem.event?.gameName || tItem.gameName || 'eSports';
            const tFormat = tItem.event?.format || tItem.format || 'two_stage';
            const tPrizePool = tItem.event?.prizePool ?? tItem.prizePool ?? 0;
            const tEntrants = tItem.entrants || [];
            const tEntrantsCount = tItem.entrantsCount ?? tItem.numberEntrants ?? tEntrants.length;
            const tSetsCount = tItem.setsCount ?? tItem.totalSetsCount ?? tItem.sets?.length ?? 0;
            const tCompletedSetsCount = tItem.completedSetsCount ?? 0;
            const tTopEntrants = tItem.topEntrants || tEntrants.slice(0, 4);

            const isCurrent = tSlug === activeTournamentSlug;
            const roleCtx = getEffectiveRoleForTournament(tSlug, tEntrants);
            const roleMeta = ROLE_DISPLAY_META[roleCtx.role] || ROLE_DISPLAY_META.SPECTATOR;
            const progressPct =
              tSetsCount > 0
                ? Math.round((tCompletedSetsCount / tSetsCount) * 100)
                : 0;

            return (
              <div
                key={tSlug}
                className={`rounded-2xl border bg-slate-900/90 p-5 flex flex-col justify-between gap-4 transition-all ${
                  isCurrent
                    ? 'border-sky-400 ring-1 ring-sky-400/30 shadow-lg'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-3">
                  {/* Cabecera del Torneo */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-mono uppercase tracking-wider text-sky-400 font-semibold">
                        {tGameName}
                      </span>
                      <h3 className="text-base font-bold text-white mt-0.5 leading-snug">
                        {tName}
                      </h3>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border shrink-0 ${roleMeta.badgeClass}`}
                    >
                      {currentUser ? roleMeta.label : 'Modo Espectador'}
                    </span>
                  </div>

                  {/* Metadatos del Evento */}
                  <div className="grid grid-cols-3 gap-2 text-xs bg-slate-950/90 border border-slate-800/90 rounded-xl p-3">
                    <div>
                      <div className="text-[11px] text-slate-400">Formato</div>
                      <div className="font-semibold text-slate-200 truncate">
                        {FORMAT_LABELS[tFormat] || tFormat}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">Inscritos / Sets</div>
                      <div className="font-mono tabular-nums font-semibold text-white">
                        {tEntrantsCount} jug. · {tSetsCount} sets
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400">Prize Pool</div>
                      <div className="font-mono tabular-nums font-bold text-emerald-400">
                        ${tPrizePool.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Barra de Progreso del Torneo */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>
                        Avance del Bracket: {tCompletedSetsCount}/{tSetsCount} completados
                      </span>
                      <span className="text-sky-400 font-semibold">{progressPct}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                      <div
                        style={{ width: `${progressPct}%` }}
                        className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-300"
                      />
                    </div>
                  </div>

                  {/* Match Destacado en Vivo */}
                  {tItem.featuredSet && (
                    <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/70 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span>
                          MATCH DESTACADO · {tItem.featuredSet.setID} ({tItem.featuredSet.station})
                        </span>
                        <span className="text-amber-300">{tItem.featuredSet.status}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-semibold text-white">
                        <span className="truncate">{tItem.featuredSet.p1Tag}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 font-mono text-sky-400">
                          {tItem.featuredSet.score1} : {tItem.featuredSet.score2}
                        </span>
                        <span className="truncate text-right">{tItem.featuredSet.p2Tag}</span>
                      </div>
                    </div>
                  )}

                  {/* Top Seeds del Torneo */}
                  {tTopEntrants.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[11px] font-mono text-slate-400">
                        TOP SEEDS INSCRITOS:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {tTopEntrants.slice(0, 4).map((e) => (
                          <span
                            key={e.entrantID}
                            className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[11px] text-slate-300 font-mono"
                          >
                            #{e.initialSeed} {e.entrantTag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Acciones del Torneo */}
                <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectTournamentAndNavigate(tSlug, 'brackets')}
                    className="flex-1 px-3 py-2 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {currentUser ? 'Ver Bracket' : 'Ver sin Login'}
                  </button>

                  {!roleCtx.myEntrant && (
                    <button
                      type="button"
                      onClick={() => onSelfEnrollInTournament(tSlug)}
                      className="px-3 py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-xs font-semibold text-emerald-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Inscribirme
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectTournamentAndNavigate(tSlug, 'participants')}
                    className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 hover:bg-slate-800 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    {tEntrantsCount}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
