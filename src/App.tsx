/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * nikBrackets Pro — Aplicación Principal Full-Stack con Motor DAG O(1), WebSockets en Tiempo Real,
 * Caché Distribuida Redis, Landing Page Pública (Modo Espectador), Hub Estilo Start.gg con Roles
 * Dinámicos por Torneo (Admin Creador, Reporteador Asignado, Participante solo en su Match),
 * Firebase Google Auth + PostgreSQL Cloud SQL.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  INITIAL_24_ENTRANTS_TEKKEN,
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
import { BracketDagVisualizer } from './components/BracketDagVisualizer';
import {
  ParticipantsManagementView,
  RefereeStationConsole,
} from './components/ParticipantsAndRefereeView';
import { AnalyticsAndBenchmarkView } from './components/AnalyticsAndBenchmarkView';
import {
  AdminAndSecurityView,
  AdminSummaryState,
  CloudBackupSummaryItem,
  EphemeralTokenItem,
  ThirdPartyApiKeyItem,
} from './components/AdminAndSecurityView';
import {
  exportStandingsToCsv,
  exportTournamentPdfReport,
} from './utils/exportReports';
import {
  AuthDialogModal,
  ProgressiveTournamentEnrollmentModal,
  UsersRolesAndTreasuryPanel,
  type AuditLogItem,
  type AuthenticatedUser,
  type ProgressiveEnrollmentSubmitPayload,
  type TournamentPaymentItem,
  type TournamentRoleAssignment,
} from './components/AuthAndUsersModal';
import {
  PublicLandingAndStartHub,
  type TournamentSummaryCardData,
} from './components/PublicLandingAndStartHub';
import { auth, firebaseSignOut, onAuthStateChanged } from './lib/firebase';
import {
  Bell,
  Compass,
  Eye,
  FileSpreadsheet,
  FileText,
  Globe,
  LogIn,
  LogOut,
  Play,
  Plus,
  Search,
  Shield,
  Sliders,
  Sparkles,
  Swords,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

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

export default function App() {
  const localEngineRef = useRef<OptimizedNikBracketEngine>(
    new OptimizedNikBracketEngine(INITIAL_OBF)
  );

  // Navegación principal: inicia en 'landing' (Landing Page Pública / Start.gg Hub)
  const [activeTab, setActiveTab] = useState<
    'landing' | 'brackets' | 'participants' | 'reporter' | 'analytics' | 'admin'
  >('landing');
  const [activeRole, setActiveRole] = useState<UserRole>('SPECTATOR');
  const [locale, setLocale] = useState<SupportedLocale>('es');
  const t = TRANSLATIONS[locale];

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
  const [searchQuery, setSearchQuery] = useState<string>('');
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
    writeBehindQueue: [] as Array<{
      jobId: string;
      tournamentSlug: string;
      setID: string;
      score1: number;
      score2: number;
      winnerID: string | null;
      latencyMs: number;
      syncedAt: string;
    }>,
  });

  // Notificaciones Push & Suscripciones Personalizadas
  const [notifications, setNotifications] = useState<PushNotificationItem[]>([]);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState<boolean>(false);
  const [browserPushEnabled, setBrowserPushEnabled] = useState<boolean>(false);
  const [pushSubscriptions, setPushSubscriptions] = useState({
    upsetAlerts: true,
    matchReady: true,
    disputeAlerts: true,
    cloudBackups: true,
  });

  // Personalización de la Interfaz del Cliente
  const [showThemeDrawer, setShowThemeDrawer] = useState<boolean>(false);
  const [accentColor, setAccentColor] = useState<string>('#38BDF8'); // Sky 400
  const [compactDensity, setCompactDensity] = useState<boolean>(false);
  const [highContrastMode, setHighContrastMode] = useState<boolean>(false);

  // Modal de Creación de Torneo
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTourneyName, setNewTourneyName] = useState<string>('Copa Mundial OBF 2026');
  const [newTourneyGameSlug, setNewTourneyGameSlug] = useState<string>('tekken8');
  const [newTourneyFormat, setNewTourneyFormat] = useState<TournamentFormat>('two_stage');
  const [newTourneyEntrants, setNewTourneyEntrants] = useState<number>(8);
  const [newTourneyPrize, setNewTourneyPrize] = useState<number>(25000);

  // Estado IA DeepSeek (Narrativa Caster & Auditoría)
  const [casterNarrative, setCasterNarrative] = useState<string>('');
  const [loadingNarrative, setLoadingNarrative] = useState<boolean>(false);
  const [aiAuditReport, setAiAuditReport] = useState<string>('');
  const [aiAuditLoading, setAiAuditLoading] = useState<boolean>(false);

  // Estado Admin, 2FA, Tokens y Cloud Backups
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

  // Estado de Autenticación (Firebase Google Auth / Email + PostgreSQL RBAC) en memoria
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

  // Disparo de notificación Push nativa del navegador cuando está habilitada
  const triggerBrowserPush = useCallback(
    (notif: PushNotificationItem) => {
      if (!browserPushEnabled || typeof Notification === 'undefined') return;
      if (notif.type === 'UPSET_ALERT' && !pushSubscriptions.upsetAlerts) return;
      if (notif.type === 'MATCH_READY' && !pushSubscriptions.matchReady) return;
      if (notif.type === 'DISPUTE' && !pushSubscriptions.disputeAlerts) return;
      if (notif.type === 'CLOUD_BACKUP' && !pushSubscriptions.cloudBackups) return;

      if (Notification.permission === 'granted') {
        try {
          new Notification(notif.title, {
            body: notif.message,
          });
        } catch {
          // Ignore in restricted iframe contexts
        }
      }
    },
    [browserPushEnabled, pushSubscriptions]
  );

  // Carga inicial desde el backend /api/bootstrap
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
      // Fallback local engine active
    }
  }, []);

  // Cargar usuarios, roles, pagos QR y bitácora desde PostgreSQL usando el token en memoria
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
        // Non-blocking fallback
      }
    },
    [authToken, activeTournamentSlug]
  );

  useEffect(() => {
    fetchBootstrap();
  }, [fetchBootstrap]);

  // Escuchar sesión de Firebase Auth (Google Sign-In)
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
            setCurrentUser(data.user);
            setAuthToken(idToken);
            await fetchUsersAndRbacData(idToken, activeTournamentSlug);
            await fetchBootstrap(activeTournamentSlug);
          }
        } catch {
          // Ignore and allow manual login
        }
      }
    });
    return () => unsubscribe();
  }, [activeTournamentSlug, fetchUsersAndRbacData, fetchBootstrap]);

  /**
   * Calcula dinámicamente el rol del usuario en cualquier torneo específico (Start.gg RBAC):
   * - Sin sesión iniciada -> SPECTATOR (solo lectura)
   * - Rol asignado explícitamente en `tournament_roles` para ese torneo -> TOURNAMENT_DIRECTOR, REFEREE, STREAMER, PAY_EDITOR, PLAYER
   * - Creador del torneo (`tournamentCreators[slug] === currentUser.uid`) -> TOURNAMENT_DIRECTOR
   * - Inscrito en el bracket (`entrants` contiene `currentUser.gamerTag`) -> PLAYER (solo reporta su propio match)
   * - En otro caso -> SPECTATOR
   */
  const getEffectiveRoleForTournament = useCallback(
    (
      slug: string,
      customEntrants?: OBFEntrant[]
    ): {
      role: UserRole;
      reason: string;
      assignedStation?: string | null;
      myEntrant?: OBFEntrant | null;
    } => {
      const entrantsPool =
        customEntrants && customEntrants.length > 0
          ? customEntrants
          : slug === activeTournamentSlug
          ? obf.entrants
          : tournamentSummaries.find(
              (s) => (s.slug || s.tournamentSlug || s.event?.tournamentSlug) === slug
            )?.entrants || [];

      if (!currentUser) {
        return {
          role: 'SPECTATOR',
          reason: 'Visitante sin sesión iniciada — Modo Espectador (Solo Lectura).',
          myEntrant: null,
        };
      }

      const normalizeTag = (val: string) => val.trim().toLowerCase();
      const myEntrant =
        entrantsPool.find(
          (e) =>
            normalizeTag(e.entrantTag) === normalizeTag(currentUser.gamerTag) ||
            normalizeTag(e.entrantTag).split('#')[0] ===
              normalizeTag(currentUser.gamerTag).split('#')[0]
        ) || null;

      // 1. Verificar asignación explícita en este torneo (allTournamentRoles o tournamentRoles)
      const explicitAssignment =
        (slug === activeTournamentSlug
          ? tournamentRoles.find((r) => r.userUid === currentUser.uid)
          : undefined) ||
        allTournamentRoles.find(
          (r) => r.tournamentSlug === slug && r.userUid === currentUser.uid
        );

      if (explicitAssignment) {
        const assignedRole = explicitAssignment.role as UserRole;
        const reasonMap: Record<UserRole, string> = {
          SUPER_ADMIN: 'SUPER_ADMIN (Rol Global): Control total de la plataforma y de todos los eventos.',
          USER: 'USER (Rol Global Base): Puede personalizar perfil, vincular Riot ID / SteamID, crear torneos o inscribirse.',
          TOURNAMENT_DIRECTOR:
            'TOURNAMENT_ADMIN (Director): Control total del evento. Crea estructura, delega roles a otros usuarios y modifica cualquier marcador.',
          REFEREE: `REFEREE / POOL_CAPTAIN (${
            explicitAssignment.assignedStation || 'Todas las estaciones'
          }): Poderes delegados para ver, editar y reportar marcadores de CUALQUIER partida asignada y resolver disputas (Timer 3m).`,
          PAY_EDITOR:
            'PAY_EDITOR / TREASURER (Tesorería): Gestión exclusiva del cobro de inscripciones (Venue Fees), validación QR y liberación de Payouts.',
          STREAMER:
            'STREAMER / CASTER (Producción / OBS): Acceso de SOLO LECTURA a datos en tiempo real por WebSockets sin riesgo de alterar marcadores.',
          PLAYER: myEntrant
            ? `PARTICIPANT / ENTRANT (EventParticipant — ${myEntrant.entrantTag} · Seed #${myEntrant.initialSeed}): Alcance restringido; solo puede hacer Check-in y reportar ÚNICAMENTE sus propias partidas.`
            : 'PARTICIPANT / ENTRANT: Alcance restringido a sus propias partidas.',
          SPECTATOR:
            'SPECTATOR (Público General): Acceso de solo lectura al Canvas 3D/2D y participación en quinielas (Pick-ems).',
        };
        return {
          role: assignedRole,
          reason: reasonMap[assignedRole] || 'Rol contextual asignado en este torneo.',
          assignedStation: explicitAssignment.assignedStation,
          myEntrant,
        };
      }

      // 2. Verificar si el usuario tiene rol global SUPER_ADMIN y no tiene rol más específico
      if (currentUser.globalRole === 'SUPER_ADMIN') {
        return {
          role: 'SUPER_ADMIN',
          reason:
            'SUPER_ADMIN (Rol Global): Control total del software, moderación global y supervisión de todos los torneos.',
          myEntrant,
        };
      }

      // 3. Verificar si el usuario creó este torneo (Adquiere Rol Contextual: TOURNAMENT_ADMIN)
      if (tournamentCreators[slug] && tournamentCreators[slug] === currentUser.uid) {
        return {
          role: 'TOURNAMENT_DIRECTOR',
          reason:
            'TOURNAMENT_ADMIN (Creador del Torneo): Control total del evento, delegación de REFEREE / POOL_CAPTAIN y edición de cualquier marcador.',
          myEntrant,
        };
      }

      // 4. Verificar si el usuario está inscrito como participante en el bracket (EventParticipant -> PARTICIPANT)
      if (myEntrant) {
        return {
          role: 'PLAYER',
          reason: `PARTICIPANT / ENTRANT (${myEntrant.entrantTag} · Seed #${myEntrant.initialSeed}): Alcance restringido a Check-in y auto-reporte exclusivo de tu propia partida.`,
          myEntrant,
        };
      }

      return {
        role: 'SPECTATOR',
        reason:
          'Rol Global USER (No inscrito en este evento) → Contexto actual: SPECTATOR (Solo lectura + Pick-ems; puedes inscribirte con 1 clic para adquirir rol PARTICIPANT).',
        myEntrant: null,
      };
    },
    [
      currentUser,
      activeTournamentSlug,
      obf.entrants,
      tournamentSummaries,
      tournamentRoles,
      allTournamentRoles,
      tournamentCreators,
    ]
  );

  // Contexto de rol activo para el torneo actualmente seleccionado
  const activeTournamentRoleContext = useMemo(
    () => getEffectiveRoleForTournament(activeTournamentSlug, obf.entrants),
    [getEffectiveRoleForTournament, activeTournamentSlug, obf.entrants]
  );

  // Sincronizar automáticamente activeRole cuando cambia el usuario o el torneo seleccionado
  useEffect(() => {
    setActiveRole(activeTournamentRoleContext.role);
  }, [activeTournamentRoleContext.role]);

  // Conexión WebSocket en Tiempo Real en el mismo puerto 3000 (/ws)
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

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
              setNotifications((prev) => {
                if (prev.some((n) => n.id === notif.id)) return prev;
                return [notif, ...prev].slice(0, 35);
              });
              triggerBrowserPush(notif);
            } else if (msg.type === 'presence:updated') {
              if (msg.payload?.connectedCount) {
                setConnectedClientsCount(msg.payload.connectedCount);
              }
            }
          } catch {
            // Ignore malformed message
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
  }, [activeRole, triggerBrowserPush]);

  // Cerrar sesión de forma inmediata y limpia (Firebase + Estado en Memoria)
  const handleLogout = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch {
      // Ignore if not signed in via Firebase popup
    }
    setCurrentUser(null);
    setAuthToken('');
    setActiveRole('SPECTATOR');
    setShowAuthModal(false);
    setReportErrorBanner('');
    setActiveTab('landing');
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'presence:role', role: 'SPECTATOR' }));
    }
  }, []);

  // Cambio rápido de cuenta Demo desde la Landing Page o Header
  const handleQuickSwitchAccount = useCallback(
    async (email: string) => {
      try {
        const res = await fetch('/api/auth/login-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password:
              email === 'niklaussmauricio@gmail.com'
                ? 'NikBrackets2026!'
                : 'Pro Tour 2026',
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
          setAuthToken(data.token);
          await fetchUsersAndRbacData(data.token, activeTournamentSlug);
          await fetchBootstrap(activeTournamentSlug);
        }
      } catch {
        // Ignore
      }
    },
    [activeTournamentSlug, fetchUsersAndRbacData, fetchBootstrap]
  );

  // Abrir modal de autenticación en el modo deseado ('login' | 'register' | 'profile')
  const handleOpenAuthModal = useCallback((mode: 'login' | 'register' | 'profile') => {
    setAuthModalInitialMode(mode);
    setShowAuthModal(true);
  }, []);

  // Sincronizar cambio manual de vista de rol por WebSocket (para pruebas o inspectores)
  const handleRoleChange = (newRole: UserRole) => {
    if (!currentUser && newRole !== 'SPECTATOR') {
      handleOpenAuthModal('login');
      return;
    }
    setActiveRole(newRole);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'presence:role', role: newRole }));
    }
  };

  // Acciones conectadas al Backend REST + Broadcast WebSocket
  const handleSelectTournament = async (slug: string, targetSetID?: string) => {
    setReportErrorBanner('');
    const res = await fetch(`/api/tournaments/${slug}/select`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setActiveTournamentSlug(slug);
      setObf(data.obf);
      setStandings(data.standings);
      if (targetSetID && data.obf.sets.some((s: OBFSet) => s.setID === targetSetID)) {
        setSelectedSetID(targetSetID);
      } else {
        setSelectedSetID(data.obf.sets[0]?.setID || '');
      }
      if (authToken) {
        await fetchUsersAndRbacData(authToken, slug);
      }
      await fetchBootstrap(slug);
    }
  };

  const handleSelectTournamentAndNavigate = async (
    slug: string,
    targetTab: 'brackets' | 'participants' | 'reporter' | 'analytics' | 'admin',
    targetSetID?: string
  ) => {
    await handleSelectTournament(slug, targetSetID);
    setActiveTab(targetTab);
  };

  const handleFormatChange = async (format: TournamentFormat) => {
    const res = await fetch(`/api/tournaments/${activeTournamentSlug}/format`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format }),
    });
    if (res.ok) {
      const data = await res.json();
      setObf(data.obf);
      setStandings(data.standings);
      setSelectedSetID(data.obf.sets[0]?.setID || '');
      await fetchBootstrap(activeTournamentSlug);
    }
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !authToken) {
      setShowCreateModal(false);
      handleOpenAuthModal('login');
      return;
    }
    const gameMeta =
      ESPORTS_GAMES_CATALOG.find((g) => g.slug === newTourneyGameSlug) || ESPORTS_GAMES_CATALOG[0];
    const res = await fetch('/api/tournaments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        name: newTourneyName,
        gameName: gameMeta.name,
        gameSlug: gameMeta.slug,
        format: newTourneyFormat,
        entrantCount: newTourneyEntrants,
        prizePool: newTourneyPrize,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setShowCreateModal(false);
      await fetchBootstrap(data.slug);
      await fetchUsersAndRbacData(authToken, data.slug);
      setActiveTab('brackets');
    }
  };

  // Verifica si el usuario actual puede reportar un set específico en el torneo activo
  const myEntrantInActiveTournament = activeTournamentRoleContext.myEntrant;

  const canReportSpecificSet = useCallback(
    (set: OBFSet | undefined): boolean => {
      if (!set || !currentUser) return false;
      if (
        activeRole === 'SUPER_ADMIN' ||
        activeRole === 'TOURNAMENT_DIRECTOR' ||
        activeRole === 'REFEREE'
      ) {
        return true;
      }
      if (activeRole === 'PLAYER' && myEntrantInActiveTournament) {
        return (
          set.entrant1ID === myEntrantInActiveTournament.entrantID ||
          set.entrant2ID === myEntrantInActiveTournament.entrantID
        );
      }
      return false;
    },
    [currentUser, activeRole, myEntrantInActiveTournament]
  );

  const handleReportScore = async (params: {
    setID: string;
    score1: number;
    score2: number;
    games: SetGameSelection[];
    proofImageUrl?: string;
    aiVerifiedConfidence?: number;
    disputeReason?: string;
  }) => {
    setReportErrorBanner('');
    if (!currentUser) {
      handleOpenAuthModal('login');
      return;
    }
    const targetSet = obf.sets.find((s) => s.setID === params.setID);
    if (!canReportSpecificSet(targetSet)) {
      setReportErrorBanner(
        activeRole === 'PLAYER'
          ? `Permiso denegado: Como Participante (${currentUser.gamerTag}) solo puedes enviar resultados de tu propia partida.`
          : 'Permiso denegado: Tu rol en este torneo es de solo lectura.'
      );
      return;
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const res = await fetch(`/api/tournaments/${activeTournamentSlug}/sets/${params.setID}/report`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...params,
        actorRole: activeRole,
        actorGamerTag: currentUser.gamerTag,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setObf(data.obf);
      setStandings(data.standings);
      await fetchBootstrap(activeTournamentSlug);
    } else {
      const errData = await res.json().catch(() => ({}));
      setReportErrorBanner(errData.error || 'No tienes permiso para reportar este set.');
    }
  };

  const handleCascadeReset = async (setID: string) => {
    const res = await fetch(`/api/tournaments/${activeTournamentSlug}/sets/${setID}/reset`, {
      method: 'POST',
    });
    if (res.ok) {
      const data = await res.json();
      setObf(data.obf);
      setStandings(data.standings);
      await fetchBootstrap(activeTournamentSlug);
    }
  };

  const handleSimulateNextMatch = async () => {
    const res = await fetch(`/api/tournaments/${activeTournamentSlug}/simulate-next`, {
      method: 'POST',
    });
    if (res.ok) {
      const data = await res.json();
      setObf(data.obf);
      setStandings(data.standings);
      if (data.simulatedSetID) setSelectedSetID(data.simulatedSetID);
      await fetchBootstrap(activeTournamentSlug);
    }
  };

  const handleAddEntrant = async (entrant: Partial<OBFEntrant>) => {
    const res = await fetch(`/api/tournaments/${activeTournamentSlug}/entrants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entrant),
    });
    if (res.ok) {
      const data = await res.json();
      setObf(data.obf);
      setStandings(data.standings);
      await fetchBootstrap(activeTournamentSlug);
    }
  };

  const handleSelfEnrollInTournament = async (slug: string) => {
    if (!currentUser || !authToken) {
      handleOpenAuthModal('register');
      return;
    }
    setEnrollModalTargetSlug(slug);
  };

  const handleConfirmProgressiveEnrollment = async (
    payload: ProgressiveEnrollmentSubmitPayload
  ) => {
    if (!currentUser || !authToken) {
      handleOpenAuthModal('register');
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
    if (payload.tournamentSlug === activeTournamentSlug) {
      if (data.obf) setObf(data.obf);
      if (data.standings) setStandings(data.standings);
    }
    await fetchBootstrap(payload.tournamentSlug);
    await fetchUsersAndRbacData(authToken, payload.tournamentSlug);
  };

  const handleToggleCheckIn = async (entrantID: string) => {
    const res = await fetch(
      `/api/tournaments/${activeTournamentSlug}/entrants/${entrantID}/checkin`,
      { method: 'PATCH' }
    );
    if (res.ok) {
      const data = await res.json();
      setObf(data.obf);
    }
  };

  const handleRemoveEntrant = async (entrantID: string) => {
    const res = await fetch(
      `/api/tournaments/${activeTournamentSlug}/entrants/${entrantID}`,
      { method: 'DELETE' }
    );
    if (res.ok) {
      const data = await res.json();
      setObf(data.obf);
      setStandings(data.standings);
      await fetchBootstrap(activeTournamentSlug);
    }
  };

  const handleReseedByElo = async () => {
    const res = await fetch(`/api/tournaments/${activeTournamentSlug}/reseed`, {
      method: 'POST',
    });
    if (res.ok) {
      const data = await res.json();
      setObf(data.obf);
      setStandings(data.standings);
    }
  };

  // Funciones DeepSeek IA
  const handleRequestCasterNarrative = async (setID: string) => {
    setLoadingNarrative(true);
    try {
      const res = await fetch('/api/ai/caster-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: activeTournamentSlug, setId: setID }),
      });
      if (res.ok) {
        const data = await res.json();
        setCasterNarrative(data.narrative);
      }
    } finally {
      setLoadingNarrative(false);
    }
  };

  const handleVerifyVisionAi = async (setID: string, proofImageUrl: string) => {
    const res = await fetch('/api/ai/verify-vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: activeTournamentSlug, setId: setID, proofImageUrl }),
    });
    return res.json();
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

  const selectedSet = useMemo(
    () => obf.sets.find((s) => s.setID === selectedSetID) || obf.sets[0],
    [obf.sets, selectedSetID]
  );

  const canReportSelectedSet = useMemo(
    () => canReportSpecificSet(selectedSet),
    [canReportSpecificSet, selectedSet]
  );

  const canReportAnyScores =
    Boolean(currentUser) &&
    (activeRole === 'SUPER_ADMIN' ||
      activeRole === 'TOURNAMENT_DIRECTOR' ||
      activeRole === 'REFEREE');

  const completedCount = useMemo(
    () => obf.sets.filter((s) => s.status === 'COMPLETED').length,
    [obf.sets]
  );

  return (
    <div
      className={`min-h-screen flex flex-col ${
        highContrastMode ? 'bg-black text-white' : 'bg-[#090D16] text-slate-100'
      }`}
    >
      {/* TOP BAR DE NAVEGACIÓN Y GESTIÓN DE SESIÓN / ROLES */}
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-3.5 border-b border-slate-800 bg-slate-950/95 sticky top-0 z-30">
        {/* Zona 1: Brand Wordmark */}
        <div className="flex items-center gap-3">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('landing');
            }}
            className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 flex items-center gap-2"
          >
            <span>nikBrackets Pro</span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
              Start.gg OBF
            </span>
          </a>
        </div>

        {/* Zona 2: Enlaces de Navegación */}
        <nav className="hidden xl:flex items-center gap-5 text-xs font-medium text-slate-300">
          <button
            type="button"
            onClick={() => setActiveTab('landing')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-1 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'landing' ? 'text-white border-b-2 border-sky-400 font-semibold' : ''
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-sky-400" />
            {currentUser ? 'Hub Start.gg (Mis Torneos)' : 'Inicio & Torneos'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('brackets')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-1 cursor-pointer ${
              activeTab === 'brackets' ? 'text-white border-b-2 border-sky-400 font-semibold' : ''
            }`}
          >
            {t.navBrackets}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('participants')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-1 cursor-pointer ${
              activeTab === 'participants' ? 'text-white border-b-2 border-sky-400 font-semibold' : ''
            }`}
          >
            {t.navParticipants}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reporter')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-1 cursor-pointer ${
              activeTab === 'reporter' ? 'text-white border-b-2 border-sky-400 font-semibold' : ''
            }`}
          >
            {t.navReporter}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-1 cursor-pointer ${
              activeTab === 'analytics' ? 'text-white border-b-2 border-sky-400 font-semibold' : ''
            }`}
          >
            {t.navAnalytics}
          </button>
          {currentUser && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 pb-1 flex items-center gap-1 cursor-pointer ${
                activeTab === 'admin' ? 'text-amber-300 border-b-2 border-amber-400 font-semibold' : 'text-amber-300/90'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Admin Usuarios & Roles
            </button>
          )}
        </nav>

        {/* Zona 3: Botones Explícitos de Login, Registro, Admin Usuario, Crear Torneo y Cerrar Sesión */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!currentUser ? (
            <>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-[11px] font-mono text-slate-400">
                <Eye className="w-3.5 h-3.5 text-sky-400" />
                Modo Espectador
              </span>

              <button
                type="button"
                onClick={() => handleOpenAuthModal('login')}
                className="px-3.5 py-2 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                Iniciar Sesión
              </button>

              <button
                type="button"
                onClick={() => handleOpenAuthModal('register')}
                className="px-3.5 py-2 rounded-lg border border-sky-400/50 bg-sky-500/10 hover:bg-sky-500/20 text-sky-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Registrarse
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className="px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                title="Administración de Usuario: colocar o actualizar mis datos, IDs por consola (PS5/PC) y personaje MAIN"
              >
                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Administración de Usuario</span>
                {!currentUser.profileCompleted && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-mono text-[9px]">
                    Completar Datos
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                style={{ backgroundColor: accentColor }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-950 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.createTournament}
              </button>

              <button
                type="button"
                onClick={() => handleOpenAuthModal('profile')}
                className="px-3 py-2 rounded-lg border border-sky-500/40 bg-slate-900 hover:bg-slate-800 text-xs text-sky-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                title="Ver o editar mi perfil competitivo"
              >
                <Shield className="w-3.5 h-3.5 text-sky-400" />
                <span className="font-semibold">{currentUser.gamerTag}</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-2 rounded-lg border border-rose-500/40 bg-rose-950/40 hover:bg-rose-900/60 text-rose-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                title="Cerrar sesión activa y volver a modo espectador"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                Cerrar Sesión
              </button>
            </>
          )}
        </div>
      </header>

      {/* Navegación Móvil / Tablet Compacta */}
      <div className="flex xl:hidden items-center gap-1 overflow-x-auto px-4 py-2 border-b border-slate-800 bg-slate-950">
        {(
          [
            ['landing', currentUser ? 'Hub Start.gg' : 'Explorar Torneos'],
            ['brackets', t.navBrackets],
            ['participants', t.navParticipants],
            ['reporter', t.navReporter],
            ['analytics', t.navAnalytics],
            ...(currentUser ? ([['admin', 'Admin Usuarios']] as const) : []),
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 ${
              activeTab === key ? 'bg-slate-800 text-white' : 'text-slate-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* BARRA CONTEXTUAL DEL WORKSPACE (Selector de Torneo, Rol Efectivo en este Torneo, Formato OBF y Herramientas) */}
      <section className="border-b border-slate-800/80 bg-slate-900/60 px-6 py-3">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Selector de Torneo y Rol Efectivo Dinámico */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={activeTournamentSlug}
              onChange={(e) => handleSelectTournament(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white"
            >
              {tournamentList.map((ev) => (
                <option key={ev.tournamentSlug} value={ev.tournamentSlug}>
                  {ev.name} ({ev.gameName})
                </option>
              ))}
            </select>

            {/* Indicador Dual: Rol Global (Cuenta) + Rol Contextual (Torneo Seleccionado) */}
            {currentUser && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-xs font-mono">
                <span className="text-slate-400">Rol Global:</span>
                <strong
                  className={
                    currentUser.globalRole === 'SUPER_ADMIN'
                      ? 'text-sky-300'
                      : 'text-emerald-300'
                  }
                >
                  {currentUser.globalRole === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'USER'}
                </strong>
              </div>
            )}

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-xs">
              <span className="text-slate-400">Rol Contextual:</span>
              <strong
                className={
                  activeRole === 'TOURNAMENT_DIRECTOR' || activeRole === 'SUPER_ADMIN'
                    ? 'text-sky-300 font-mono'
                    : activeRole === 'REFEREE'
                    ? 'text-emerald-300 font-mono'
                    : activeRole === 'STREAMER'
                    ? 'text-purple-300 font-mono'
                    : activeRole === 'PAY_EDITOR'
                    ? 'text-amber-300 font-mono'
                    : activeRole === 'PLAYER'
                    ? 'text-cyan-300 font-mono'
                    : 'text-slate-300 font-mono'
                }
              >
                {RBAC_PERMISSIONS_MATRIX[activeRole]?.codeStandard || activeRole}
              </strong>
              {activeRole === 'PLAYER' && myEntrantInActiveTournament && (
                <span className="font-mono text-[11px] text-amber-300">
                  (Solo sus matches: {myEntrantInActiveTournament.entrantTag})
                </span>
              )}
              {activeRole === 'STREAMER' && (
                <span className="font-mono text-[11px] text-purple-300">
                  (Solo lectura WS/OBS)
                </span>
              )}
              {!currentUser && (
                <span className="font-mono text-[11px] text-slate-400">
                  (Solo lectura + Pick-ems)
                </span>
              )}
            </div>

            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
              <span>
                {obf.entrants.length} {t.entrantsCount}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {completedCount}/{obf.sets.length} {t.completedSets}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {wsConnected ? t.wsStatusConnected : t.wsStatusOffline} ({connectedClientsCount} online)
              </span>
            </div>
          </div>

          {/* Controles de Formato, Idioma, Alertas Push y Personalización */}
          <div className="flex flex-wrap items-center gap-2">
            {(activeRole === 'SUPER_ADMIN' || activeRole === 'TOURNAMENT_DIRECTOR') && (
              <select
                value={obf.event.format}
                onChange={(e) => handleFormatChange(e.target.value as TournamentFormat)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-mono text-sky-300"
                title="Cambiar Formato OBF v1.0"
              >
                <option value="two_stage">Formato: Two-Stage (Suizo + Doble Elim)</option>
                <option value="double_elimination">Formato: Doble Eliminación</option>
                <option value="single_elimination">Formato: Eliminación Simple (2^k)</option>
                <option value="swiss">Formato: Sistema Suizo</option>
                <option value="round_robin">Formato: Round Robin (Berger)</option>
                <option value="free_for_all">Formato: Free-For-All (Lobbies)</option>
                <option value="leaderboard">Formato: Leaderboard / Time Trial</option>
              </select>
            )}

            {/* Selector Multilingüe (ES / EN / PT / JA) */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as SupportedLocale)}
                className="bg-transparent text-xs font-mono text-white focus:outline-none"
                aria-label="Seleccionar idioma"
              >
                <option value="es" className="bg-slate-950">ES</option>
                <option value="en" className="bg-slate-950">EN</option>
                <option value="pt" className="bg-slate-950">PT</option>
                <option value="ja" className="bg-slate-950">JA</option>
              </select>
            </div>

            {/* Botón Centro de Alertas Push */}
            <button
              type="button"
              onClick={() => setShowNotificationsDrawer((prev) => !prev)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-xs text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-sky-400" />
              <span>{t.pushNotifications}</span>
              <span className="font-mono tabular-nums text-sky-400">({notifications.length})</span>
            </button>

            {/* Botón Personalizador de Interfaz */}
            <button
              type="button"
              onClick={() => setShowThemeDrawer((prev) => !prev)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-xs text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span>{t.themeCustomizer}</span>
            </button>
          </div>
        </div>
      </section>

      {/* CONTENIDO PRINCIPAL DEL WORKSPACE (1440px Baseline) */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6 flex flex-col gap-6">
        {/* Alerta de permisos si intenta reportar un match ajeno */}
        {reportErrorBanner && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-xs text-rose-200 flex items-center justify-between gap-3">
            <span>{reportErrorBanner}</span>
            <button
              type="button"
              onClick={() => setReportErrorBanner('')}
              className="text-rose-300 hover:text-white font-semibold"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* VISTA 0: LANDING PAGE PÚBLICA (SIN LOGIN) Y CENTRO START.GG DE ROLES POR TORNEO (CON LOGIN) */}
        {activeTab === 'landing' && (
          <PublicLandingAndStartHub
            currentUser={currentUser}
            tournamentSummaries={tournamentSummaries}
            activeTournamentSlug={activeTournamentSlug}
            allTournamentRoles={allTournamentRoles}
            tournamentCreators={tournamentCreators}
            getEffectiveRoleForTournament={getEffectiveRoleForTournament}
            onSelectTournamentAndNavigate={handleSelectTournamentAndNavigate}
            onOpenAuthModal={handleOpenAuthModal}
            onQuickSwitchAccount={handleQuickSwitchAccount}
            onOpenCreateTournament={() => {
              if (!currentUser) {
                handleOpenAuthModal('login');
              } else {
                setShowCreateModal(true);
              }
            }}
            onOpenUsersAdminModal={async (slug) => {
              if (slug && slug !== activeTournamentSlug) {
                await handleSelectTournament(slug);
              }
              setActiveTab('admin');
            }}
            onSelfEnrollInTournament={handleSelfEnrollInTournament}
            onLogout={handleLogout}
          />
        )}

        {/* Barra de Acciones Rápidas y Búsqueda Global (cuando se explora un torneo específico) */}
        {activeTab !== 'landing' && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
              <button
                type="button"
                onClick={() => setActiveTab('landing')}
                className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-sky-300 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" />
                {currentUser ? '← Volver a Mis Torneos (Start.gg)' : '← Volver a Landing de Torneos'}
              </button>

              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/90 pl-10 pr-4 py-2 text-xs text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Si es Participante en este torneo y tiene partida, botón directo para ir a su match */}
              {activeRole === 'PLAYER' && myEntrantInActiveTournament && (
                <button
                  type="button"
                  onClick={() => {
                    const mySet =
                      obf.sets.find(
                        (s) =>
                          (s.entrant1ID === myEntrantInActiveTournament.entrantID ||
                            s.entrant2ID === myEntrantInActiveTournament.entrantID) &&
                          s.status !== 'COMPLETED'
                      ) ||
                      obf.sets.find(
                        (s) =>
                          s.entrant1ID === myEntrantInActiveTournament.entrantID ||
                          s.entrant2ID === myEntrantInActiveTournament.entrantID
                      );
                    if (mySet) {
                      setSelectedSetID(mySet.setID);
                      setActiveTab('reporter');
                    }
                  }}
                  className="px-3.5 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Swords className="w-3.5 h-3.5" />
                  Ir a Mi Partida ({myEntrantInActiveTournament.entrantTag})
                </button>
              )}

              {canReportAnyScores && (
                <button
                  type="button"
                  onClick={handleSimulateNextMatch}
                  className="px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-medium text-emerald-300 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  {t.simulateRound} (WS Live)
                </button>
              )}

              <button
                type="button"
                onClick={() => exportStandingsToCsv(obf, standings)}
                className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                {t.exportCsv}
              </button>

              <button
                type="button"
                onClick={() => exportTournamentPdfReport(obf, standings)}
                className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                {t.exportPdf}
              </button>

              {currentUser && (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  className="px-3 py-2 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs text-amber-300 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                  Usuarios, Roles & Pagos QR ({usersList.length})
                </button>
              )}
            </div>
          </div>
        )}

        {/* VISTA 1: BRACKETS EN VIVO (DAG O(1) + PANEL LATERAL CONTEXTUAL SEGÚN ROL) */}
        {activeTab === 'brackets' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8">
              <BracketDagVisualizer
                obf={obf}
                selectedSetID={selectedSetID}
                onSelectSet={(id) => setSelectedSetID(id)}
                canReportScores={canReportAnyScores}
                canReportSet={canReportSpecificSet}
                myEntrantID={myEntrantInActiveTournament?.entrantID || null}
                onQuickScoreReport={(set, s1, s2) =>
                  handleReportScore({
                    setID: set.setID,
                    score1: s1,
                    score2: s2,
                    games: set.games,
                  })
                }
                accentColor={accentColor}
                compactDensity={compactDensity}
                searchQuery={searchQuery}
                casterNarrative={casterNarrative}
                onRequestCasterNarrative={handleRequestCasterNarrative}
                loadingNarrative={loadingNarrative}
              />
            </div>

            {/* Columna derecha contextual: Consola de Reporte de Estación + Clasificación Top Buchholz */}
            <div className="lg:col-span-4 flex flex-col gap-5">
              {selectedSet && (
                <RefereeStationConsole
                  obf={obf}
                  selectedSet={selectedSet}
                  onSelectSet={(id) => setSelectedSetID(id)}
                  canReportScores={canReportSelectedSet}
                  activeRole={activeRole}
                  isAuthenticated={Boolean(currentUser)}
                  myEntrantID={myEntrantInActiveTournament?.entrantID || null}
                  myGamerTag={currentUser?.gamerTag || null}
                  assignedStation={activeTournamentRoleContext.assignedStation}
                  onOpenLogin={() => handleOpenAuthModal('login')}
                  onConfirmScore={handleReportScore}
                  onCascadeReset={handleCascadeReset}
                  onVerifyVisionAi={handleVerifyVisionAi}
                />
              )}

              {/* Resumen de Clasificación Buchholz y ELO en Vivo */}
              <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-4">
                <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-800">
                  <h3 className="text-sm font-semibold text-white">
                    Top Clasificación (Buchholz & ELO)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('analytics')}
                    className="text-xs text-sky-400 hover:underline"
                  >
                    Ver Analítica Completa
                  </button>
                </div>

                <div className="space-y-2">
                  {standings.slice(0, 6).map((row) => (
                    <div
                      key={row.entrant.entrantID}
                      className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60 last:border-none"
                    >
                      <div className="min-w-0">
                        <span className="font-mono tabular-nums text-slate-400 mr-2">
                          #{row.rank}
                        </span>
                        <span className="font-semibold text-white">
                          {row.entrant.entrantTag}
                        </span>
                        <span className="text-[11px] text-slate-400 ml-1.5">
                          · {row.entrant.mainCharacter}
                        </span>
                      </div>
                      <div className="font-mono tabular-nums text-right shrink-0">
                        <span className="text-white font-semibold">
                          {row.wins}-{row.losses}
                        </span>
                        <span className="text-slate-400 ml-2">
                          BH {row.buchholzScore}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VISTA 2: GESTIÓN DE PARTICIPANTES Y SEEDING (ORGANIZADOR / CHECK-IN PROPIO DE PARTICIPANT) */}
        {activeTab === 'participants' && (
          <ParticipantsManagementView
            obf={obf}
            standings={standings}
            activeRole={activeRole}
            myEntrantID={myEntrantInActiveTournament?.entrantID || null}
            onAddEntrant={handleAddEntrant}
            onToggleCheckIn={handleToggleCheckIn}
            onRemoveEntrant={handleRemoveEntrant}
            onReseedByElo={handleReseedByElo}
          />
        )}

        {/* VISTA 3: CONSOLA EXCLUSIVA DE ÁRBITRO / REPORTADOR / AUTO-REPORTE DE JUGADOR */}
        {activeTab === 'reporter' && selectedSet && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6">
              <RefereeStationConsole
                obf={obf}
                selectedSet={selectedSet}
                onSelectSet={(id) => setSelectedSetID(id)}
                canReportScores={canReportSelectedSet}
                activeRole={activeRole}
                isAuthenticated={Boolean(currentUser)}
                myEntrantID={myEntrantInActiveTournament?.entrantID || null}
                myGamerTag={currentUser?.gamerTag || null}
                assignedStation={activeTournamentRoleContext.assignedStation}
                onOpenLogin={() => handleOpenAuthModal('login')}
                onConfirmScore={handleReportScore}
                onCascadeReset={handleCascadeReset}
                onVerifyVisionAi={handleVerifyVisionAi}
              />
            </div>

            <div className="lg:col-span-6 border border-slate-800 bg-slate-900/80 rounded-xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-base font-semibold text-white">
                  Cola de Partidas Activas por Estación Física
                </h3>
                <span className="text-xs font-mono tabular-nums text-slate-400">
                  {obf.sets.filter((s) => s.status === 'READY').length} listas para jugar
                </span>
              </div>

              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {obf.sets.map((s) => {
                  const p1 = obf.entrants.find((e) => e.entrantID === s.entrant1ID);
                  const p2 = obf.entrants.find((e) => e.entrantID === s.entrant2ID);
                  const isMine = Boolean(
                    myEntrantInActiveTournament &&
                      (s.entrant1ID === myEntrantInActiveTournament.entrantID ||
                        s.entrant2ID === myEntrantInActiveTournament.entrantID)
                  );
                  return (
                    <div
                      key={s.setID}
                      onClick={() => setSelectedSetID(s.setID)}
                      className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-center justify-between ${
                        s.setID === selectedSetID
                          ? 'border-sky-400 bg-slate-900'
                          : isMine
                          ? 'border-emerald-500/40 bg-emerald-950/15 hover:border-emerald-400'
                          : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
                          <span>
                            {s.setID} · {s.roundLabel} · {s.other.station || 'EST-01'}
                          </span>
                          {isMine && (
                            <span className="text-emerald-400 font-semibold">
                              ★ TU PARTIDA
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-semibold text-white mt-0.5">
                          {p1?.entrantTag || 'TBD'} vs {p2?.entrantTag || 'TBD'}
                        </div>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <div className="text-sm font-bold text-sky-400">
                          {s.entrant1Score} - {s.entrant2Score}
                        </div>
                        <div className="text-[11px] text-slate-400">{s.status}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* VISTA 4: ANALÍTICA EN TIEMPO REAL, BENCHMARK DAG O(1) Y REDIS CACHE */}
        {activeTab === 'analytics' && (
          <AnalyticsAndBenchmarkView
            obf={obf}
            standings={standings}
            redis={redisTelemetry}
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
          />
        )}

        {/* VISTA 5: USUARIOS, ROLES RBAC, PAGOS QR, AUDITORÍA, DEEPSEEK API KEY, 2FA, TOKENS & CLOUD BACKUPS */}
        {activeTab === 'admin' && (
          <div className="flex flex-col gap-6">
            <UsersRolesAndTreasuryPanel
              currentUser={currentUser}
              activeRole={activeRole}
              activeTournamentSlug={activeTournamentSlug}
              activeTournamentName={obf.event.name}
              usersList={usersList}
              tournamentRoles={tournamentRoles}
              tournamentPayments={tournamentPayments}
              auditLogs={auditLogs}
              onOpenAuthModal={() => handleOpenAuthModal('profile')}
              onSaveUserProfileFromAdmin={async (payload) => {
                if (!authToken) return;
                const res = await fetch('/api/auth/profile', {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                  },
                  body: JSON.stringify(payload),
                });
                const data = await res.json();
                if (!res.ok) {
                  throw new Error(data.error || 'No se pudieron actualizar los datos del usuario.');
                }
                if (
                  data.user &&
                  currentUser &&
                  (!payload.targetUid || payload.targetUid === currentUser.uid)
                ) {
                  setCurrentUser(data.user);
                }
                await fetchUsersAndRbacData(authToken, activeTournamentSlug);
                await fetchBootstrap(activeTournamentSlug);
              }}
              onUpsertGameAccountFromAdmin={async (payload) => {
                if (!authToken) return;
                const res = await fetch('/api/auth/game-accounts', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                  },
                  body: JSON.stringify(payload),
                });
                const data = await res.json();
                if (!res.ok) {
                  throw new Error(data.error || 'No se pudo guardar el ID de consola.');
                }
                if (
                  data.gameAccounts &&
                  currentUser &&
                  (!payload.targetUid || payload.targetUid === currentUser.uid)
                ) {
                  setCurrentUser({
                    ...currentUser,
                    gameAccounts: data.gameAccounts,
                  });
                }
                await fetchUsersAndRbacData(authToken, activeTournamentSlug);
              }}
              onDeleteGameAccountFromAdmin={async (accountId, targetUid) => {
                if (!authToken) return;
                const query = targetUid ? `?targetUid=${encodeURIComponent(targetUid)}` : '';
                const res = await fetch(`/api/auth/game-accounts/${accountId}${query}`, {
                  method: 'DELETE',
                  headers: {
                    Authorization: `Bearer ${authToken}`,
                  },
                });
                const data = await res.json();
                if (
                  res.ok &&
                  data.gameAccounts &&
                  currentUser &&
                  (!targetUid || targetUid === currentUser.uid)
                ) {
                  setCurrentUser({
                    ...currentUser,
                    gameAccounts: data.gameAccounts,
                  });
                }
                await fetchUsersAndRbacData(authToken, activeTournamentSlug);
              }}
              onChangeUserGlobalRole={async (targetUid, newRole, accountStatus) => {
                if (!authToken) return;
                const res = await fetch(`/api/users/${encodeURIComponent(targetUid)}/role`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                  },
                  body: JSON.stringify({ globalRole: newRole, accountStatus }),
                });
                if (res.ok) {
                  if (currentUser && currentUser.uid === targetUid) {
                    setCurrentUser({
                      ...currentUser,
                      globalRole: newRole,
                      accountStatus: accountStatus || currentUser.accountStatus,
                    });
                  }
                  await fetchUsersAndRbacData(authToken, activeTournamentSlug);
                  await fetchBootstrap(activeTournamentSlug);
                }
              }}
              onAssignTournamentStaff={async (params) => {
                if (!authToken) return;
                const res = await fetch(
                  `/api/tournaments/${encodeURIComponent(activeTournamentSlug)}/roles`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${authToken}`,
                    },
                    body: JSON.stringify(params),
                  }
                );
                if (res.ok) {
                  await fetchUsersAndRbacData(authToken, activeTournamentSlug);
                  await fetchBootstrap(activeTournamentSlug);
                }
              }}
              onRemoveTournamentStaff={async (id) => {
                if (!authToken) return;
                const res = await fetch(
                  `/api/tournaments/${encodeURIComponent(activeTournamentSlug)}/roles/${id}`,
                  {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${authToken}` },
                  }
                );
                if (res.ok) {
                  await fetchUsersAndRbacData(authToken, activeTournamentSlug);
                  await fetchBootstrap(activeTournamentSlug);
                }
              }}
              onOpenSmartEnrollmentModal={() => setEnrollModalTargetSlug(activeTournamentSlug)}
              onSelfRegisterInTournament={async (params) => {
                if (!authToken) {
                  handleOpenAuthModal('register');
                  return;
                }
                const res = await fetch(
                  `/api/tournaments/${encodeURIComponent(activeTournamentSlug)}/self-register`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${authToken}`,
                    },
                    body: JSON.stringify(params),
                  }
                );
                const data = await res.json();
                if (!res.ok) {
                  throw new Error(data.error || 'No se pudo completar la inscripción.');
                }
                if (data.user) setCurrentUser(data.user);
                if (data.obf) setObf(data.obf);
                if (data.standings) setStandings(data.standings);
                await fetchUsersAndRbacData(authToken, activeTournamentSlug);
                await fetchBootstrap(activeTournamentSlug);
              }}
              onCreateTreasuryPayment={async (params) => {
                if (!authToken) return;
                const res = await fetch(
                  `/api/tournaments/${encodeURIComponent(activeTournamentSlug)}/payments`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${authToken}`,
                    },
                    body: JSON.stringify(params),
                  }
                );
                if (res.ok) {
                  await fetchUsersAndRbacData(authToken, activeTournamentSlug);
                }
              }}
              onUpdatePaymentStatus={async (paymentId, status) => {
                if (!authToken) return;
                const res = await fetch(
                  `/api/tournaments/${encodeURIComponent(activeTournamentSlug)}/payments/${paymentId}`,
                  {
                    method: 'PATCH',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${authToken}`,
                    },
                    body: JSON.stringify({ status }),
                  }
                );
                if (res.ok) {
                  await fetchUsersAndRbacData(authToken, activeTournamentSlug);
                }
              }}
            />

            <AdminAndSecurityView
              activeRole={activeRole}
              adminSummary={adminSummary}
              ephemeralTokens={ephemeralTokens}
              thirdPartyApiKeys={thirdPartyApiKeys}
              cloudBackups={cloudBackups}
              activeTournamentSlug={activeTournamentSlug}
              onSaveAdminConfig={async (cfg) => {
                const res = await fetch('/api/admin/config', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(cfg),
                });
                if (res.ok) {
                  await fetchBootstrap(activeTournamentSlug);
                }
              }}
              onVerify2FA={async (code) => {
                const res = await fetch('/api/auth/2fa/verify', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ code }),
                });
                const data = await res.json();
                await fetchBootstrap(activeTournamentSlug);
                return data;
              }}
              onRotate2FASecret={async () => {
                const res = await fetch('/api/auth/2fa/rotate-secret', { method: 'POST' });
                const data = await res.json();
                await fetchBootstrap(activeTournamentSlug);
                return data;
              }}
              onCreateEphemeralToken={async (name, role, scope) => {
                await fetch('/api/tokens/ephemeral', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name, role, scope }),
                });
                await fetchBootstrap(activeTournamentSlug);
              }}
              onRevokeEphemeralToken={async (token) => {
                await fetch(`/api/tokens/ephemeral/${encodeURIComponent(token)}`, {
                  method: 'DELETE',
                });
                await fetchBootstrap(activeTournamentSlug);
              }}
              onCreateThirdPartyKey={async (name) => {
                await fetch('/api/admin/api-keys', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name }),
                });
                await fetchBootstrap(activeTournamentSlug);
              }}
              onDeleteThirdPartyKey={async (id) => {
                await fetch(`/api/admin/api-keys/${encodeURIComponent(id)}`, {
                  method: 'DELETE',
                });
                await fetchBootstrap(activeTournamentSlug);
              }}
              onCreateCloudBackup={async (label) => {
                await fetch('/api/cloud/backup', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ label }),
                });
                await fetchBootstrap(activeTournamentSlug);
              }}
              onRestoreCloudBackup={async (backupId) => {
                const res = await fetch(`/api/cloud/restore/${encodeURIComponent(backupId)}`, {
                  method: 'POST',
                });
                if (res.ok) {
                  await fetchBootstrap(activeTournamentSlug);
                }
              }}
            />
          </div>
        )}
      </main>

      {/* PANEL LATERAL DE NOTIFICACIONES PUSH PERSONALIZADAS */}
      {showNotificationsDrawer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex justify-end">
          <div className="w-full max-w-md bg-slate-950 border-l border-slate-800 h-full p-5 flex flex-col justify-between">
            <div className="flex flex-col gap-4 overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-base font-semibold text-white">
                  Centro de Notificaciones Push en Tiempo Real
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNotificationsDrawer(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Configuración de Suscripciones Push Personalizadas */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">
                    Notificaciones Web Push del Navegador
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (typeof Notification !== 'undefined') {
                        const perm = await Notification.requestPermission();
                        setBrowserPushEnabled(perm === 'granted');
                      } else {
                        setBrowserPushEnabled((p) => !p);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md font-medium ${
                      browserPushEnabled
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {browserPushEnabled ? 'Activas' : 'Activar Push'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-slate-300">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pushSubscriptions.upsetAlerts}
                      onChange={(e) =>
                        setPushSubscriptions((s) => ({ ...s, upsetAlerts: e.target.checked }))
                      }
                    />
                    Alertas de Upset
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pushSubscriptions.matchReady}
                      onChange={(e) =>
                        setPushSubscriptions((s) => ({ ...s, matchReady: e.target.checked }))
                      }
                    />
                    Llamados a Estación
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pushSubscriptions.disputeAlerts}
                      onChange={(e) =>
                        setPushSubscriptions((s) => ({ ...s, disputeAlerts: e.target.checked }))
                      }
                    />
                    Disputas Arbitrales
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pushSubscriptions.cloudBackups}
                      onChange={(e) =>
                        setPushSubscriptions((s) => ({ ...s, cloudBackups: e.target.checked }))
                      }
                    />
                    Snapshots Cloud
                  </label>
                </div>
              </div>

              {/* Historial de Eventos Push recibidos por WebSockets */}
              <div className="space-y-2.5 overflow-y-auto pr-1 flex-1">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
                      <span
                        className={
                          n.priority === 'critical'
                            ? 'text-rose-400 font-semibold'
                            : n.priority === 'high'
                            ? 'text-amber-400 font-semibold'
                            : 'text-sky-400'
                        }
                      >
                        {n.type}
                      </span>
                      <span>{new Date(n.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="font-semibold text-white">{n.title}</div>
                    <p className="text-slate-300 leading-relaxed">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PANEL LATERAL DE PERSONALIZACIÓN DE LA INTERFAZ DEL CLIENTE */}
      {showThemeDrawer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex justify-end">
          <div className="w-full max-w-sm bg-slate-950 border-l border-slate-800 h-full p-5 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-base font-semibold text-white">
                  Personalización de Interfaz del Cliente
                </h3>
                <button
                  type="button"
                  onClick={() => setShowThemeDrawer(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Color de Acento del Torneo (10% Accent Budget)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { name: 'Sky Cyan', hex: '#38BDF8' },
                    { name: 'Emerald', hex: '#10B981' },
                    { name: 'Amber Gold', hex: '#F59E0B' },
                    { name: 'Crimson', hex: '#F43F5E' },
                  ].map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setAccentColor(c.hex)}
                      className={`p-2 rounded-lg border text-xs font-medium flex flex-col items-center gap-1.5 ${
                        accentColor === c.hex ? 'border-white bg-slate-900' : 'border-slate-800 bg-slate-950'
                      }`}
                    >
                      <span
                        style={{ backgroundColor: c.hex }}
                        className="w-5 h-5 rounded-full block"
                      />
                      <span className="text-[11px] text-slate-300">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-800 text-xs">
                <label className="flex items-center justify-between text-slate-200 cursor-pointer">
                  <span>Densidad Compacta de Nodos DAG</span>
                  <input
                    type="checkbox"
                    checked={compactDensity}
                    onChange={(e) => setCompactDensity(e.target.checked)}
                  />
                </label>

                <label className="flex items-center justify-between text-slate-200 cursor-pointer">
                  <span>Modo Alto Contraste (WCAG AAA)</span>
                  <input
                    type="checkbox"
                    checked={highContrastMode}
                    onChange={(e) => setHighContrastMode(e.target.checked)}
                  />
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowThemeDrawer(false)}
              className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white"
            >
              Listo
            </button>
          </div>
        </div>
      )}

      {/* MODAL PARA CREAR UN NUEVO TORNEO OBF v1.0 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateTournament}
            className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-white">
                  Crear Nuevo Torneo en Motor DAG O(1)
                </h3>
                <p className="text-xs text-sky-400">
                  Al crearlo, serás asignado automáticamente como Admin (TOURNAMENT_DIRECTOR) de este torneo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Nombre Oficial del Torneo</label>
                <input
                  type="text"
                  required
                  value={newTourneyName}
                  onChange={(e) => setNewTourneyName(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">Título eSports Oficial</label>
                  <select
                    value={newTourneyGameSlug}
                    onChange={(e) => setNewTourneyGameSlug(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  >
                    {ESPORTS_GAMES_CATALOG.map((g) => (
                      <option key={g.slug} value={g.slug}>
                        {g.name} ({g.genre})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Formato OBF v1.0</label>
                  <select
                    value={newTourneyFormat}
                    onChange={(e) => setNewTourneyFormat(e.target.value as TournamentFormat)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  >
                    <option value="two_stage">Two-Stage (Suizo + Doble Elim)</option>
                    <option value="double_elimination">Doble Eliminación</option>
                    <option value="single_elimination">Eliminación Simple (2^k)</option>
                    <option value="swiss">Sistema Suizo</option>
                    <option value="round_robin">Round Robin (Berger)</option>
                    <option value="free_for_all">Free-For-All</option>
                    <option value="leaderboard">Leaderboard / Time Trial</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Cantidad de Participantes</label>
                  <select
                    value={newTourneyEntrants}
                    onChange={(e) => setNewTourneyEntrants(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono tabular-nums text-white"
                  >
                    <option value={4}>4 Competidores</option>
                    <option value={8}>8 Competidores</option>
                    <option value={12}>12 Competidores (Con BYEs automáticos)</option>
                    <option value={16}>16 Competidores</option>
                    <option value={24}>24 Competidores (Two-Stage 3D Z-Space)</option>
                    <option value={32}>32 Competidores</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Prize Pool (USD)</label>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={newTourneyPrize}
                    onChange={(e) => setNewTourneyPrize(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono tabular-nums text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-xs text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{ backgroundColor: accentColor }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-950"
              >
                Generar Torneo y Sincronizar WS
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DE AUTENTICACIÓN OFICIAL (GOOGLE OAUTH + 1-CLICK + PERFIL COMPETITIVO) */}
      <AuthDialogModal
        isOpen={showAuthModal}
        initialMode={authModalInitialMode}
        onClose={() => setShowAuthModal(false)}
        onNavigateToUserAdmin={() => setActiveTab('admin')}
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

      {/* MODAL INTELIGENTE DE INSCRIPCIÓN A TORNEO (PERFILADO PROGRESIVO + ID POR CONSOLA + MAIN) */}
      {(() => {
        const targetMeta =
          tournamentList.find((ev) => ev.tournamentSlug === enrollModalTargetSlug) ||
          obf.event;
        return (
          <ProgressiveTournamentEnrollmentModal
            isOpen={Boolean(enrollModalTargetSlug)}
            onClose={() => setEnrollModalTargetSlug(null)}
            currentUser={currentUser}
            tournamentSlug={enrollModalTargetSlug || activeTournamentSlug}
            tournamentName={targetMeta.name}
            gameName={targetMeta.gameName}
            gameSlug={targetMeta.gameSlug}
            onSubmitEnrollment={handleConfirmProgressiveEnrollment}
          />
        );
      })()}

      {/* Footer Limpio */}
      <footer className="border-t border-slate-800/80 px-6 py-4 text-xs text-slate-500">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <span>
            nikBrackets Pro — Basado en el estándar Open Bracket Format (OBF v1.0) & Start.gg Multi-Tournament RBAC
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('landing')}
              className="hover:text-slate-300"
            >
              Directorio de Torneos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className="hover:text-slate-300"
            >
              Benchmark O(1) DAG
            </button>
            {currentUser && (
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className="hover:text-slate-300 flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                Admin Usuarios & DeepSeek API
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
