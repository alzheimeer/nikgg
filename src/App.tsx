/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * nikgg (nikBrackets Pro) — Aplicación Modular de Rutas con React Router v7
 * Rutas:
 *   - `/`                   : Landing Page de Conversión (LandingPage.tsx)
 *   - `/explore`            : Directorio y Filtrado de Torneos (ExplorePage.tsx)
 *   - `/t/:tournamentSlug`  : Hub de Torneo Activo con WebGL 3D perezoso (TournamentHubPage.tsx)
 *
 * Motor DAG O(1), WebSockets en tiempo real, Caché Redis, RBAC multi-rol,
 * Integración con auth.niklauss.uk (VITE_AUTH_URL) y PostgreSQL Cloud SQL.
 */

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  INITIAL_24_ENTRANTS_TEKKEN,
  DoubleDqRule,
  LosersBracketDqPenalty,
  OBFDocument,
  OBFEntrant,
  OBFEventMetadata,
  OBFSet,
  OptimizedNikBracketEngine,
  RBAC_PERMISSIONS_MATRIX,
  SetGameSelection,
  StandingsRow,
  TournamentFormat,
  UserRole,
  applyInitial24Simulation,
  generateSetsByFormat,
} from './engine/nikBracketsEngine';
import {
  ESPORTS_GAMES_CATALOG,
  SupportedLocale,
  TRANSLATIONS,
} from './i18n/translations';
import {
  AdminSummaryState,
  CloudBackupSummaryItem,
  EphemeralTokenItem,
  ThirdPartyApiKeyItem,
} from './components/AdminAndSecurityView';
import {
  AuthDialogModal,
  ProgressiveTournamentEnrollmentModal,
  type AuditLogItem,
  type AuthenticatedUser,
  type ProgressiveEnrollmentSubmitPayload,
  type TournamentPaymentItem,
  type TournamentRoleAssignment,
} from './components/AuthAndUsersModal';
import { TournamentSummaryCardData } from './components/PublicLandingAndStartHub';
import {
  CreateTournamentModal,
  type CreateTournamentSubmitPayload,
} from './components/CreateTournamentModal';
import { LandingPage } from './pages/LandingPage';
import { ExplorePage } from './pages/ExplorePage';
import { auth, firebaseSignOut, onAuthStateChanged } from './lib/firebase';
import {
  Bell,
  Boxes,
  ExternalLink,
  Eye,
  Flame,
  Globe,
  Layers,
  LogIn,
  LogOut,
  Moon,
  Plus,
  Radio,
  Search,
  Shield,
  Sliders,
  Sparkles,
  Sun,
  Swords,
  UserCheck,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';

// Carga perezosa (Lazy Loading) del Hub del Torneo Activo para mantener la Landing Page < 100ms
const TournamentHubPage = React.lazy(() => import('./pages/TournamentHubPage'));

interface PushNotificationItem {
  id: string;
  type: 'MATCH_READY' | 'SCORE_REPORTED' | 'UPSET_ALERT' | 'DISPUTE' | 'CLOUD_BACKUP' | 'AI_INSIGHT';
  title: string;
  message: string;
  tournamentSlug: string;
  setID?: string;
  timestamp: string;
  priority: 'normal' | 'high' | 'critical';
}

const INITIAL_OBF: OBFDocument = (() => {
  const baseDoc: OBFDocument = {
    version: '1.0',
    standard: 'Open Bracket Format (OBF)',
    event: {
      id: 'evt-nexus-tekken8-masters',
      organizationSlug: 'nikbrackets-pro',
      tournamentSlug: 'nexus-tekken8-masters',
      eventSlug: 'nexus-tekken8-masters-main',
      name: 'Nexus Grid Major 2026 — Tekken 8 World Tour (24 Pro Showcase)',
      date: '2026-10-22',
      gameName: 'Tekken 8',
      gameSlug: 'tekken8',
      format: 'two_stage',
      numberEntrants: 24,
      guaranteedMinMatches: 3,
      venueFee: 25,
      entryFee: 25,
      prizePool: 50000,
    },
    entrants: INITIAL_24_ENTRANTS_TEKKEN,
    sets: generateSetsByFormat('two_stage', INITIAL_24_ENTRANTS_TEKKEN),
  };
  const eng = new OptimizedNikBracketEngine(baseDoc);
  applyInitial24Simulation(eng);
  return eng.getDocument();
})();

// Componente Fallback mientras se descarga el bundle del torneo
function PageLoadingFallback() {
  return (
    <div className="min-h-screen bg-[#070A12] flex flex-col items-center justify-center p-6 space-y-4">
      <div className="relative">
        <div className="w-14 h-14 rounded-full border-4 border-sky-500/20 border-t-sky-400 animate-spin" />
        <Boxes className="w-6 h-6 text-sky-400 absolute inset-0 m-auto animate-pulse" />
      </div>
      <p className="text-xs font-mono text-slate-400">
        Cargando Módulo de Competición nikgg...
      </p>
    </div>
  );
}

/**
 * Componente de Navegación Global y Header Compartido
 */
interface GlobalNavbarProps {
  currentUser: AuthenticatedUser | null;
  activeTournamentSlug: string;
  wsConnected: boolean;
  connectedClientsCount: number;
  unreadNotificationsCount: number;
  onOpenAuthModal: (mode: 'login' | 'register' | 'profile') => void;
  onOpenCreateTournament: () => void;
  onOpenNotifications: () => void;
  onOpenThemeDrawer: () => void;
  onLogout: () => Promise<void>;
  accentColor: string;
}

function GlobalNavbar({
  currentUser,
  activeTournamentSlug,
  wsConnected,
  connectedClientsCount,
  unreadNotificationsCount,
  onOpenAuthModal,
  onOpenCreateTournament,
  onOpenNotifications,
  onOpenThemeDrawer,
  onLogout,
  accentColor,
}: GlobalNavbarProps) {
  const location = useLocation();
  const authUrl = import.meta.env.VITE_AUTH_URL || 'https://auth.niklauss.uk';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo y Enlaces de Navegación Principales */}
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="flex items-center gap-2.5 font-black text-xl tracking-tight text-white group"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center text-slate-950 shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
                <Swords className="w-5 h-5 text-slate-950 stroke-[2.5]" />
              </div>
              <div className="flex flex-col">
                <span className="leading-none text-lg">nikgg</span>
                <span className="text-[10px] font-mono tracking-widest uppercase text-sky-400 font-semibold">
                  nikBrackets Pro
                </span>
              </div>
            </Link>

            {/* Links de Rutas */}
            <nav className="hidden md:flex items-center gap-1 text-xs font-semibold">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`
                }
              >
                Inicio
              </NavLink>

              <NavLink
                to="/explore"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                    isActive
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`
                }
              >
                <Search className="w-3.5 h-3.5 text-sky-400" />
                <span>Explorar Torneos</span>
              </NavLink>

              <NavLink
                to={`/t/${activeTournamentSlug}`}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                    isActive && !location.search.includes('tab=circuits')
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30 font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`
                }
              >
                <Boxes className="w-3.5 h-3.5 text-cyan-400" />
                <span>Torneo Activo</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  LIVE
                </span>
              </NavLink>

              <NavLink
                to={`/t/${activeTournamentSlug}?tab=circuits`}
                className={() =>
                  `px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                    location.pathname.startsWith('/t/') && location.search.includes('tab=circuits')
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/40 font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`
                }
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Circuitos 6M & Masivos 3000+</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                  PRO
                </span>
              </NavLink>
            </nav>
          </div>

          {/* Zona Derecha: Indicadores, Notificaciones, Auth y CTA */}
          <div className="flex items-center gap-2.5">
            {/* Indicador WebSocket en Vivo */}
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] font-mono">
              <span
                className={`w-2 h-2 rounded-full ${
                  wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className="text-slate-400">
                {wsConnected ? `${connectedClientsCount} online` : 'Offline'}
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-sky-400 font-semibold">&lt;2ms</span>
            </div>

            {/* Botón de Notificaciones */}
            <button
              type="button"
              onClick={onOpenNotifications}
              className="relative p-2 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
              title="Notificaciones push del torneo"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white font-mono text-[9px] flex items-center justify-center font-bold">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* Botón de Personalización / Tema */}
            <button
              type="button"
              onClick={onOpenThemeDrawer}
              className="p-2 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
              title="Ajustar densidad y colores"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {/* Crear Torneo Botón */}
            <button
              type="button"
              onClick={onOpenCreateTournament}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-sky-500/40 hover:border-sky-400 bg-sky-950/30 text-sky-300 hover:text-white text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Crear Torneo</span>
            </button>

            {/* Auth Buttons */}
            {!currentUser ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenAuthModal('login')}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Iniciar Sesión</span>
                </button>

                <a
                  href={authUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir portal SSO auth.niklauss.uk"
                  className="hidden xl:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-sky-300 text-xs transition-colors"
                >
                  <span>SSO</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenAuthModal('profile')}
                  className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-white flex items-center gap-2 transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-semibold truncate max-w-[120px]">
                    {currentUser.gamerTag || currentUser.displayName || 'Mi Perfil'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onLogout}
                  className="p-1.5 rounded-xl border border-rose-900/50 bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 transition-colors"
                  title="Cerrar Sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Barra de Navegación Móvil */}
        <div className="md:hidden flex items-center gap-2 py-2 border-t border-slate-800/60 overflow-x-auto text-xs font-semibold">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `px-3 py-1 rounded-lg ${isActive ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400'}`
            }
          >
            Inicio
          </NavLink>
          <NavLink
            to="/explore"
            className={({ isActive }) =>
              `px-3 py-1 rounded-lg ${isActive ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400'}`
            }
          >
            Explorar
          </NavLink>
          <NavLink
            to={`/t/${activeTournamentSlug}`}
            className={({ isActive }) =>
              `px-3 py-1 rounded-lg ${isActive && !location.search.includes('tab=circuits') ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400'}`
            }
          >
            Torneo Activo
          </NavLink>
          <NavLink
            to={`/t/${activeTournamentSlug}?tab=circuits`}
            className={() =>
              `px-3 py-1 rounded-lg whitespace-nowrap ${
                location.pathname.startsWith('/t/') && location.search.includes('tab=circuits')
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-amber-400/90'
              }`
            }
          >
            Circuitos 6M
          </NavLink>
        </div>
      </div>
    </header>
  );
}

export default function App() {
  const localEngineRef = useRef<OptimizedNikBracketEngine>(
    new OptimizedNikBracketEngine(INITIAL_OBF)
  );

  const [activeRole, setActiveRole] = useState<UserRole>('SPECTATOR');
  const [activeTournamentSlug, setActiveTournamentSlug] = useState<string>('nexus-tekken8-masters');
  const [tournamentList, setTournamentList] = useState<OBFEventMetadata[]>([INITIAL_OBF.event]);
  const [tournamentSummaries, setTournamentSummaries] = useState<TournamentSummaryCardData[]>(() => [
    {
      slug: INITIAL_OBF.event.tournamentSlug,
      tournamentSlug: INITIAL_OBF.event.tournamentSlug,
      event: INITIAL_OBF.event,
      entrantsCount: INITIAL_OBF.entrants.length,
      setsCount: INITIAL_OBF.sets.length,
      completedSetsCount: INITIAL_OBF.sets.filter((s) => s.status === 'COMPLETED').length,
      readySetsCount: INITIAL_OBF.sets.filter((s) => s.status === 'READY').length,
      inProgressSetsCount: INITIAL_OBF.sets.filter((s) => s.status === 'IN_PROGRESS').length,
      topEntrants: INITIAL_OBF.entrants.slice(0, 6),
      entrants: INITIAL_OBF.entrants,
      sets: INITIAL_OBF.sets,
    },
  ]);
  const [allTournamentRoles, setAllTournamentRoles] = useState<TournamentRoleAssignment[]>([]);
  const [tournamentCreators, setTournamentCreators] = useState<Record<string, string>>({});

  const [obf, setObf] = useState<OBFDocument>(INITIAL_OBF);
  const [standings, setStandings] = useState<StandingsRow[]>(() =>
    localEngineRef.current.getStandings()
  );
  const [selectedSetID, setSelectedSetID] = useState<string>('SW-R1-1');
  const [reportErrorBanner, setReportErrorBanner] = useState<string>('');

  // Telemetría WebSocket y Redis
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [connectedClientsCount, setConnectedClientsCount] = useState<number>(1);
  const [redisTelemetry, setRedisTelemetry] = useState({
    connected: true,
    mode: 'REDIS_IN_MEMORY_JSON_REPLICA',
    hits: 142,
    misses: 14,
    hitRatePct: 91.0,
    activeKeys: 4,
    activeTags: ['tournament:nexus-tekken8-masters'],
    lastLatencyMs: 0.38,
    writeBehindQueue: [] as any[],
  });

  // Notificaciones Push
  const [notifications, setNotifications] = useState<PushNotificationItem[]>([]);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState<boolean>(false);

  // Personalización de la Interfaz
  const [showThemeDrawer, setShowThemeDrawer] = useState<boolean>(false);
  const [accentColor, setAccentColor] = useState<string>('#38BDF8');
  const [compactDensity, setCompactDensity] = useState<boolean>(false);
  const [highContrastMode, setHighContrastMode] = useState<boolean>(false);

  // Modal Integral de Creación de Torneo / Macro Evento / Circuito
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);

  // IA DeepSeek
  const [aiAuditReport, setAiAuditReport] = useState<string>('');
  const [aiAuditLoading, setAiAuditLoading] = useState<boolean>(false);

  // Admin & Seguridad
  const [adminSummary, setAdminSummary] = useState<AdminSummaryState>({
    hasDeepSeekKey: false,
    deepseekKeyMasked: '',
    deepseekModel: 'deepseek-chat',
    deepseekEndpoint: 'https://api.deepseek.com/v1/chat/completions',
    redisTtlSeconds: 300,
    cloudProvider: 'Google Cloud Storage',
    cloudBucketUri: 'gs://nikbrackets-cloud-vault-2026/obf-snapshots',
    autoBackupEnabled: true,
    twoFactorRequiredForAdmin: false,
    twoFactorVerified: true,
    currentTotpPreview: '482910',
  });
  const [ephemeralTokens, setEphemeralTokens] = useState<EphemeralTokenItem[]>([]);
  const [thirdPartyApiKeys, setThirdPartyApiKeys] = useState<ThirdPartyApiKeyItem[]>([]);
  const [cloudBackups, setCloudBackups] = useState<CloudBackupSummaryItem[]>([]);

  // Autenticación
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [authToken, setAuthToken] = useState<string>('');
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authModalInitialMode, setAuthModalInitialMode] = useState<'login' | 'register' | 'profile'>('login');
  const [enrollModalTargetSlug, setEnrollModalTargetSlug] = useState<string | null>(null);
  const [usersList, setUsersList] = useState<AuthenticatedUser[]>([]);
  const [tournamentRoles, setTournamentRoles] = useState<TournamentRoleAssignment[]>([]);
  const [tournamentPayments, setTournamentPayments] = useState<TournamentPaymentItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  const wsRef = useRef<WebSocket | null>(null);

  // Carga inicial de datos /api/bootstrap
  const fetchBootstrap = useCallback(async (slug?: string) => {
    try {
      const url = slug ? `/api/bootstrap?slug=${encodeURIComponent(slug)}` : '/api/bootstrap';
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (data.obf) {
        setObf(data.obf);
        setSelectedSetID((prev) =>
          data.obf.sets.some((s: OBFSet) => s.setID === prev)
            ? prev
            : data.obf.sets[0]?.setID || ''
        );
      }
      if (data.standings) setStandings(data.standings);
      if (data.activeTournamentSlug) setActiveTournamentSlug(data.activeTournamentSlug);
      if (data.tournamentList) setTournamentList(data.tournamentList);
      if (data.tournamentSummaries) setTournamentSummaries(data.tournamentSummaries);
      if (data.allTournamentRoles) setAllTournamentRoles(data.allTournamentRoles);
      if (data.tournamentCreators) setTournamentCreators(data.tournamentCreators);
      if (data.redis) setRedisTelemetry(data.redis);
      if (data.notifications) setNotifications(data.notifications);
      if (data.adminSummary) setAdminSummary(data.adminSummary);
      if (data.ephemeralTokens) setEphemeralTokens(data.ephemeralTokens);
      if (data.thirdPartyApiKeys) setThirdPartyApiKeys(data.thirdPartyApiKeys);
      if (data.cloudBackups) setCloudBackups(data.cloudBackups);
      if (data.connectedClientsCount) setConnectedClientsCount(data.connectedClientsCount);
    } catch {
      // Local engine fallback
    }
  }, []);

  const fetchUsersAndRbacData = useCallback(
    async (tokenToUse?: string, slugToUse?: string) => {
      const effectiveToken = tokenToUse || authToken;
      if (!effectiveToken) return;
      try {
        const targetSlug = slugToUse || activeTournamentSlug;
        const res = await fetch(`/api/users?slug=${encodeURIComponent(targetSlug)}`, {
          headers: { Authorization: `Bearer ${effectiveToken}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.users) setUsersList(data.users);
        if (data.tournamentRoles) setTournamentRoles(data.tournamentRoles);
        if (data.tournamentPayments) setTournamentPayments(data.tournamentPayments);
        if (data.auditLogs) setAuditLogs(data.auditLogs);
      } catch {
        // Fallback
      }
    },
    [authToken, activeTournamentSlug]
  );

  useEffect(() => {
    fetchBootstrap();
  }, [fetchBootstrap]);

  // Listener de Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          const res = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.user) {
              setCurrentUser(data.user);
            }
            setAuthToken(idToken);
            await fetchUsersAndRbacData(idToken, activeTournamentSlug);
            await fetchBootstrap(activeTournamentSlug);
          }
        } catch {
          // Ignore
        }
      }
    });
    return () => unsubscribe();
  }, [activeTournamentSlug, fetchBootstrap, fetchUsersAndRbacData]);

  // WebSocket Connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let socket: WebSocket | null = null;
    let reconnectTimer: any = null;

    const connect = () => {
      try {
        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          setWsConnected(true);
          socket?.send(JSON.stringify({ type: 'presence:role', role: activeRole }));
        };

        socket.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.redis) setRedisTelemetry(msg.redis);

            if (msg.type === 'init' || msg.type === 'tournament:updated' || msg.type === 'match:updated') {
              const p = msg.payload;
              if (p.obf) setObf(p.obf);
              if (p.standings) setStandings(p.standings);
              if (p.activeTournamentSlug) setActiveTournamentSlug(p.activeTournamentSlug);
              if (p.tournamentList) setTournamentList(p.tournamentList);
            } else if (msg.type === 'notification:push') {
              const notif = msg.payload as PushNotificationItem;
              setNotifications((prev) => [notif, ...prev].slice(0, 30));
            } else if (msg.type === 'presence:updated') {
              if (msg.payload?.connectedCount) {
                setConnectedClientsCount(msg.payload.connectedCount);
              }
            }
          } catch {
            // Ignore
          }
        };

        socket.onclose = () => {
          setWsConnected(false);
          reconnectTimer = setTimeout(connect, 3000);
        };
      } catch {
        setWsConnected(false);
      }
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [activeRole]);

  // Handlers de Sesión y Modales
  const handleLogout = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch {
      // Ignore
    }
    setCurrentUser(null);
    setAuthToken('');
    setActiveRole('SPECTATOR');
    setShowAuthModal(false);
    setReportErrorBanner('');
  }, []);

  const handleOpenAuthModal = useCallback((mode: 'login' | 'register' | 'profile') => {
    setAuthModalInitialMode(mode);
    setShowAuthModal(true);
  }, []);

  const handleRoleChange = (newRole: UserRole) => {
    setActiveRole(newRole);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'presence:role', role: newRole }));
    }
  };

  // Handlers de Selección de Torneo
  const handleSelectTournament = async (slug: string, targetSetID?: string) => {
    setReportErrorBanner('');
    const res = await fetch(`/api/tournaments/${encodeURIComponent(slug)}/select`, {
      method: 'POST',
    });
    if (res.ok) {
      const data = await res.json();
      setActiveTournamentSlug(slug);
      if (data.obf) setObf(data.obf);
      if (data.standings) setStandings(data.standings);
      if (targetSetID) {
        setSelectedSetID(targetSetID);
      } else if (data.obf?.sets?.[0]) {
        setSelectedSetID(data.obf.sets[0].id || data.obf.sets[0].setID);
      }
      if (authToken) {
        await fetchUsersAndRbacData(authToken, slug);
      }
      await fetchBootstrap(slug);
    }
  };

  // Creación Integral de Torneo / Macro Evento / Circuito 6M
  const handleCreateTournament = async (payload: CreateTournamentSubmitPayload) => {
    if (!currentUser || !authToken) {
      setShowCreateModal(false);
      handleOpenAuthModal('login');
      return;
    }
    setIsSubmittingCreate(true);
    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          ...payload,
          creatorUid: currentUser.uid,
          creatorEmail: currentUser.email,
          creatorDisplayName: currentUser.displayName || currentUser.gamerTag,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowCreateModal(false);
        await fetchBootstrap(data.slug);
        await fetchUsersAndRbacData(authToken, data.slug);
        window.location.href = `/t/${data.slug}`;
      }
    } finally {
      setIsSubmittingCreate(false);
    }
  };


  // Auto-Inscripción Progresiva
  const handleSelfEnroll = async (slug: string) => {
    if (!currentUser || !authToken) {
      handleOpenAuthModal('login');
      return;
    }
    setEnrollModalTargetSlug(slug);
  };

  const handleConfirmEnrollment = async (payload: ProgressiveEnrollmentSubmitPayload) => {
    if (!currentUser || !authToken) {
      handleOpenAuthModal('login');
      return;
    }
    const res = await fetch(
      `/api/tournaments/${encodeURIComponent(payload.tournamentSlug)}/self-register`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'No se pudo completar la inscripción.');
    }
    if (data.user) {
      setCurrentUser(data.user);
    }
    await fetchBootstrap(payload.tournamentSlug);
    await fetchUsersAndRbacData(authToken, payload.tournamentSlug);
    setEnrollModalTargetSlug(null);
  };

  // Handlers del Torneo Activo (Matches, Check-in, DQ, Simulación)
  const handleUpdateScore = async (score1: number, score2: number, isDq?: boolean) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const res = await fetch(
      `/api/tournaments/${encodeURIComponent(activeTournamentSlug)}/sets/${encodeURIComponent(selectedSetID)}/report`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          setID: selectedSetID,
          score1,
          score2,
          isDq,
          actorRole: activeRole,
          actorGamerTag: currentUser?.gamerTag || 'Niklauss#KR1',
        }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.obf) setObf(data.obf);
      if (data.standings) setStandings(data.standings);
    }
  };

  const handleConfirmScore = async (params: {
    setID: string;
    score1: number;
    score2: number;
    games: SetGameSelection[];
    proofImageUrl?: string;
    aiVerifiedConfidence?: number;
    disputeReason?: string;
  }) => {
    setReportErrorBanner('');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const res = await fetch(
      `/api/tournaments/${encodeURIComponent(activeTournamentSlug)}/sets/${encodeURIComponent(params.setID)}/report`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...params,
          actorRole: activeRole,
          actorGamerTag: currentUser?.gamerTag || 'Niklauss#KR1',
        }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.obf) setObf(data.obf);
      if (data.standings) setStandings(data.standings);
      await fetchBootstrap(activeTournamentSlug);
    } else {
      const errData = await res.json().catch(() => ({}));
      setReportErrorBanner(errData.error || 'No se pudo reportar el marcador.');
    }
  };

  const handleCascadeReset = async (setID: string) => {
    const res = await fetch(
      `/api/tournaments/${encodeURIComponent(activeTournamentSlug)}/sets/${encodeURIComponent(setID)}/reset`,
      { method: 'POST' }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.obf) setObf(data.obf);
      if (data.standings) setStandings(data.standings);
      await fetchBootstrap(activeTournamentSlug);
    }
  };

  const handleMatchCheckIn = async (setID: string, slot: 1 | 2 | 'BOTH' = 'BOTH') => {
    const res = await fetch(
      `/api/tournaments/${encodeURIComponent(activeTournamentSlug)}/sets/${encodeURIComponent(setID)}/checkin`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ slot }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.obf) setObf(data.obf);
      if (data.standings) setStandings(data.standings);
    }
  };

  const handleAdminCheckInAction = async (setID: string, action: any) => {
    const res = await fetch(
      `/api/tournaments/${encodeURIComponent(activeTournamentSlug)}/sets/${encodeURIComponent(setID)}/checkin-admin`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ action }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.obf) setObf(data.obf);
      if (data.standings) setStandings(data.standings);
    }
  };

  const handleAddEntrant = async (entrant: Partial<OBFEntrant>) => {
    const res = await fetch(`/api/tournaments/${encodeURIComponent(activeTournamentSlug)}/entrants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entrant),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.obf) setObf(data.obf);
      if (data.standings) setStandings(data.standings);
      await fetchBootstrap(activeTournamentSlug);
    }
  };

  const handleToggleCheckIn = async (entrantID: string) => {
    const res = await fetch(
      `/api/tournaments/${encodeURIComponent(activeTournamentSlug)}/entrants/${encodeURIComponent(entrantID)}/checkin`,
      { method: 'PATCH' }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.obf) setObf(data.obf);
    }
  };

  const handleRemoveEntrant = async (entrantID: string) => {
    const res = await fetch(
      `/api/tournaments/${encodeURIComponent(activeTournamentSlug)}/entrants/${encodeURIComponent(entrantID)}`,
      { method: 'DELETE' }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.obf) setObf(data.obf);
      if (data.standings) setStandings(data.standings);
      await fetchBootstrap(activeTournamentSlug);
    }
  };

  const handleReseedByElo = async () => {
    const res = await fetch(`/api/tournaments/${encodeURIComponent(activeTournamentSlug)}/reseed`, {
      method: 'POST',
    });
    if (res.ok) {
      const data = await res.json();
      if (data.obf) setObf(data.obf);
      if (data.standings) setStandings(data.standings);
    }
  };

  const handleQuickSimulateAll = async () => {
    const res = await fetch(
      `/api/tournaments/${encodeURIComponent(activeTournamentSlug)}/simulate-next`,
      { method: 'POST' }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.obf) setObf(data.obf);
      if (data.standings) setStandings(data.standings);
    }
  };

  const handleRunAiAudit = async () => {
    setAiAuditLoading(true);
    try {
      const res = await fetch('/api/ai/bracket-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: activeTournamentSlug }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiAuditReport(data.report);
      }
    } finally {
      setAiAuditLoading(false);
    }
  };

  const featuredTournament = tournamentSummaries[0];

  return (
    <BrowserRouter>
      <div
        className={`min-h-screen flex flex-col ${
          highContrastMode ? 'bg-black text-white' : 'bg-[#070A12] text-slate-100'
        }`}
      >
        {/* BARRA DE NAVEGACIÓN SUPERIOR GLOBAL */}
        <GlobalNavbar
          currentUser={currentUser}
          activeTournamentSlug={activeTournamentSlug}
          wsConnected={wsConnected}
          connectedClientsCount={connectedClientsCount}
          unreadNotificationsCount={notifications.length}
          onOpenAuthModal={handleOpenAuthModal}
          onOpenCreateTournament={() => setShowCreateModal(true)}
          onOpenNotifications={() => setShowNotificationsDrawer(true)}
          onOpenThemeDrawer={() => setShowThemeDrawer(true)}
          onLogout={handleLogout}
          accentColor={accentColor}
        />

        {/* =========================================================================
            SISTEMA DE RUTAS CON REACT ROUTER (3 RUTAS PRINCIPALES)
           ========================================================================= */}
        <main className="flex-1">
          <Routes>
            {/* RUTA A: LANDING PAGE DE CONVERSIÓN (/) */}
            <Route
              path="/"
              element={
                <LandingPage
                  currentUser={currentUser}
                  featuredTournament={featuredTournament}
                  activeTournamentSlug={activeTournamentSlug}
                  connectedClientsCount={connectedClientsCount}
                  wsConnected={wsConnected}
                  onOpenAuthModal={(mode) => handleOpenAuthModal(mode)}
                  onOpenCreateTournament={() => setShowCreateModal(true)}
                />
              }
            />

            {/* RUTA B: DIRECTORIO DE TORNEOS (/explore) */}
            <Route
              path="/explore"
              element={
                <ExplorePage
                  currentUser={currentUser}
                  tournamentSummaries={tournamentSummaries}
                  onOpenCreateTournament={() => setShowCreateModal(true)}
                  onOpenAuthModal={(mode) => handleOpenAuthModal(mode)}
                  onSelfEnrollInTournament={handleSelfEnroll}
                />
              }
            />

            {/* RUTA C: HUB DEL TORNEO ACTIVO (/t/:tournamentSlug) CON LAZY LOADING */}
            <Route
              path="/t/:tournamentSlug"
              element={
                <Suspense fallback={<PageLoadingFallback />}>
                  <TournamentHubPage
                    obf={obf}
                    standings={standings}
                    selectedSetID={selectedSetID}
                    onSelectSet={(id) => setSelectedSetID(id)}
                    activeRole={activeRole}
                    onChangeRole={handleRoleChange}
                    currentUser={currentUser}
                    authToken={authToken}
                    onConfirmScore={handleConfirmScore}
                    onCascadeReset={handleCascadeReset}
                    onMatchCheckIn={handleMatchCheckIn}
                    onAdminCheckInAction={handleAdminCheckInAction}
                    onAddEntrant={handleAddEntrant}
                    onToggleCheckIn={handleToggleCheckIn}
                    onRemoveEntrant={handleRemoveEntrant}
                    onReseedByElo={handleReseedByElo}
                    onQuickSimulateAll={handleQuickSimulateAll}
                    redisTelemetry={redisTelemetry}
                    onFlushRedis={async () => {
                      const res = await fetch('/api/redis/flush', { method: 'POST' });
                      if (res.ok) {
                        const data = await res.json();
                        setRedisTelemetry(data.redis);
                      }
                    }}
                    onRunAiAudit={handleRunAiAudit}
                    aiAuditReport={aiAuditReport}
                    aiAuditLoading={aiAuditLoading}
                    adminSummary={adminSummary}
                    ephemeralTokens={ephemeralTokens}
                    thirdPartyApiKeys={thirdPartyApiKeys}
                    cloudBackups={cloudBackups}
                    onSaveAdminConfig={async (cfg) => {
                      setAdminSummary((prev) => ({ ...prev, ...cfg }));
                    }}
                    onVerify2FA={async () => ({ verified: true })}
                    onRotate2FASecret={async () => ({
                      totpSecret: 'ABC',
                      currentTotpPreview: '123456',
                    })}
                    onCreateEphemeralToken={async () => {}}
                    onRevokeEphemeralToken={async () => {}}
                    onCreateThirdPartyKey={async () => {}}
                    onRevokeThirdPartyApiKey={async () => {}}
                    onTriggerCloudBackup={async () => {}}
                    usersList={usersList}
                    tournamentRoles={tournamentRoles}
                    tournamentPayments={tournamentPayments}
                    auditLogs={auditLogs}
                    onSaveUserProfileFromAdmin={async (payload) => {
                      if (!authToken) return;
                      await fetch('/api/auth/profile', {
                        method: 'PATCH',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${authToken}`,
                        },
                        body: JSON.stringify(payload),
                      });
                      await fetchUsersAndRbacData(authToken, activeTournamentSlug);
                    }}
                    onUpsertGameAccountFromAdmin={async (payload) => {
                      if (!authToken) return;
                      await fetch('/api/auth/game-accounts', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${authToken}`,
                        },
                        body: JSON.stringify(payload),
                      });
                      await fetchUsersAndRbacData(authToken, activeTournamentSlug);
                    }}
                    onDeleteGameAccountFromAdmin={async (accId, targetUid) => {
                      if (!authToken) return;
                      const q = targetUid ? `?targetUid=${encodeURIComponent(targetUid)}` : '';
                      await fetch(`/api/auth/game-accounts/${accId}${q}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${authToken}` },
                      });
                      await fetchUsersAndRbacData(authToken, activeTournamentSlug);
                    }}
                    onChangeUserGlobalRole={async (targetUid, newRole, accountStatus) => {
                      if (!authToken) return;
                      await fetch('/api/admin/users/role', {
                        method: 'PATCH',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${authToken}`,
                        },
                        body: JSON.stringify({ targetUid, newRole, accountStatus }),
                      });
                      await fetchUsersAndRbacData(authToken, activeTournamentSlug);
                    }}
                    onAssignTournamentStaff={async (params) => {
                      if (!authToken) return;
                      await fetch(`/api/tournaments/${activeTournamentSlug}/roles`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${authToken}`,
                        },
                        body: JSON.stringify(params),
                      });
                      await fetchUsersAndRbacData(authToken, activeTournamentSlug);
                    }}
                    onRemoveTournamentStaff={async (roleId) => {
                      if (!authToken) return;
                      await fetch(`/api/tournaments/${activeTournamentSlug}/roles/${roleId}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${authToken}` },
                      });
                      await fetchUsersAndRbacData(authToken, activeTournamentSlug);
                    }}
                    onUpdatePaymentStatus={async (paymentId, status) => {
                      if (!authToken) return;
                      await fetch(`/api/tournaments/${activeTournamentSlug}/payments/${paymentId}`, {
                        method: 'PATCH',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${authToken}`,
                        },
                        body: JSON.stringify({ status }),
                      });
                      await fetchUsersAndRbacData(authToken, activeTournamentSlug);
                    }}
                    onCreateTreasuryPayment={async (params) => {
                      if (!authToken) return;
                      await fetch(`/api/tournaments/${activeTournamentSlug}/payments`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${authToken}`,
                        },
                        body: JSON.stringify(params),
                      });
                      await fetchUsersAndRbacData(authToken, activeTournamentSlug);
                    }}
                    onSelfRegisterInTournament={async (params) => {
                      await handleConfirmEnrollment({
                        tournamentSlug: activeTournamentSlug,
                        ...params,
                      });
                    }}
                    onOpenAuthModal={handleOpenAuthModal}
                    onSwitchTournament={handleSelectTournament}
                    reportErrorBanner={reportErrorBanner}
                    onDismissErrorBanner={() => setReportErrorBanner('')}
                    tournamentList={tournamentList}
                    wsConnected={wsConnected}
                    connectedClientsCount={connectedClientsCount}
                    accentColor={accentColor}
                    compactDensity={compactDensity}
                  />
                </Suspense>
              }
            />

            {/* FALLBACK: CUALQUIER OTRA RUTA REDIRIGE A LA LANDING PAGE */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* =========================================================================
            MODALES GLOBALES Y DRAWERS
           ========================================================================= */}

        {/* MODAL INTEGRAL DE CREACIÓN DE TORNEO / MACRO EVENTO / CIRCUITO */}
        <CreateTournamentModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateTournament}
          existingTournaments={tournamentList}
          isSubmitting={isSubmittingCreate}
        />

        {/* MODAL DE AUTENTICACIÓN OFICIAL */}
        <AuthDialogModal
          isOpen={showAuthModal}
          initialMode={authModalInitialMode}
          onClose={() => setShowAuthModal(false)}
          onNavigateToUserAdmin={() => {
            setShowAuthModal(false);
            window.location.href = `/t/${activeTournamentSlug}`;
          }}
          currentUser={currentUser}
          authToken={authToken}
          onAuthenticated={async (user, token) => {
            setCurrentUser(user);
            setAuthToken(token);
            await fetchUsersAndRbacData(token, activeTournamentSlug);
            await fetchBootstrap(activeTournamentSlug);
          }}
          onLogout={handleLogout}
          onUpdateProfile={async (profileData) => {
            if (!authToken) return;
            const res = await fetch('/api/auth/profile', {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify(profileData),
            });
            if (res.ok) {
              const data = await res.json();
              setCurrentUser(data.user);
              await fetchUsersAndRbacData(authToken, activeTournamentSlug);
              await fetchBootstrap(activeTournamentSlug);
            }
          }}
        />

        {/* MODAL DE INSCRIPCIÓN PROGRESIVA A TORNEO */}
        {enrollModalTargetSlug && (
          <ProgressiveTournamentEnrollmentModal
            isOpen={Boolean(enrollModalTargetSlug)}
            onClose={() => setEnrollModalTargetSlug(null)}
            currentUser={currentUser}
            tournamentSlug={enrollModalTargetSlug}
            tournamentName={
              tournamentList.find((ev) => ev.tournamentSlug === enrollModalTargetSlug)?.name ||
              obf.event.name
            }
            gameName={obf.event.gameName}
            gameSlug={obf.event.gameSlug}
            onSubmitEnrollment={handleConfirmEnrollment}
          />
        )}

        {/* DRAWER DE NOTIFICACIONES */}
        {showNotificationsDrawer && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
            <div className="w-full max-w-sm bg-slate-950 border-l border-slate-800 p-5 space-y-4 overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-sky-400" />
                  <h3 className="font-bold text-white text-sm">Notificaciones Push</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNotificationsDrawer(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {notifications.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500">
                  No hay notificaciones recientes.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sky-400">{n.title}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {n.timestamp ? new Date(n.timestamp).toLocaleTimeString() : 'Ahora'}
                        </span>
                      </div>
                      <p className="text-slate-300 text-[11px] leading-relaxed">{n.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* DRAWER DE TEMAS Y DENSIDAD */}
        {showThemeDrawer && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
            <div className="w-full max-w-sm bg-slate-950 border-l border-slate-800 p-5 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-sky-400" />
                  <h3 className="font-bold text-white text-sm">Personalización UI</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowThemeDrawer(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-300">Modo Alto Contraste (WCAG AAA)</span>
                  <input
                    type="checkbox"
                    checked={highContrastMode}
                    onChange={(e) => setHighContrastMode(e.target.checked)}
                    className="h-4 w-4 accent-sky-400 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-300">Densidad Compacta de Nodos</span>
                  <input
                    type="checkbox"
                    checked={compactDensity}
                    onChange={(e) => setCompactDensity(e.target.checked)}
                    className="h-4 w-4 accent-sky-400 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </BrowserRouter>
  );
}
