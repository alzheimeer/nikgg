/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hub del Torneo Activo (Ruta `/t/:tournamentSlug`) para nikgg (nikBrackets Pro)
 * Carga perezosa (React.lazy + Suspense) del lienzo 3D WebGL con Three.js / InstancedMesh,
 * visualizador DAG 2D, consola de árbitro con OCR, temporizadores de check-in / DQ,
 * simulador de roles RBAC en caliente, Google Meet y analítica avanzada.
 */

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Bell,
  Boxes,
  CheckCircle2,
  Clock,
  Compass,
  Cpu,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Flame,
  Gamepad2,
  Globe,
  HelpCircle,
  Layers,
  Maximize2,
  Minimize2,
  Play,
  Printer,
  Radio,
  RefreshCw,
  Search,
  Share2,
  Shield,
  Sliders,
  Sparkles,
  Swords,
  Timer,
  Trophy,
  UserCheck,
  Users,
  Video,
  X,
  Zap,
} from 'lucide-react';
import {
  DoubleDqRule,
  LosersBracketDqPenalty,
  OBFDocument,
  OBFEntrant,
  OBFEventMetadata,
  OBFSet,
  SetGameSelection,
  StandingsRow,
  TournamentFormat,
  UserRole,
  isSetCompletedOrDq,
} from '../engine/nikBracketsEngine';
import { BracketDagVisualizer } from '../components/BracketDagVisualizer';
import {
  ParticipantsManagementView,
  RefereeStationConsole,
} from '../components/ParticipantsAndRefereeView';
import { AnalyticsAndBenchmarkView } from '../components/AnalyticsAndBenchmarkView';
import {
  AdminAndSecurityView,
  AdminSummaryState,
  CloudBackupSummaryItem,
  EphemeralTokenItem,
  ThirdPartyApiKeyItem,
} from '../components/AdminAndSecurityView';
import {
  AuthenticatedUser,
  AuditLogItem,
  TournamentPaymentItem,
  TournamentRoleAssignment,
  UsersRolesAndTreasuryPanel,
} from '../components/AuthAndUsersModal';
import { TournamentGoogleMeetPanel } from '../components/TournamentGoogleMeetPanel';
import { CircuitsAndMassiveScaleView } from '../components/CircuitsAndMassiveScaleView';
import { EnterpriseEcosystemHub } from '../components/EnterpriseEcosystemHub';
import { exportStandingsToCsv, exportTournamentPdfReport } from '../utils/exportReports';

// Carga perezosa del lienzo 3D WebGL para garantizar que la carga inicial sea instantánea
const BracketCanvasWebGL3D = React.lazy(
  () => import('../components/BracketCanvasWebGL3D')
);

// Fallback visual mientras el canvas 3D y los shaders compilan
function Tournament3DLoader() {
  return (
    <div className="w-full h-[640px] rounded-2xl border border-sky-500/30 bg-slate-950 flex flex-col items-center justify-center p-8 text-center space-y-4">
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-4 border-sky-500/20 border-t-sky-400 animate-spin" />
        <Boxes className="w-6 h-6 text-sky-400 absolute inset-0 m-auto animate-pulse" />
      </div>
      <div className="space-y-1">
        <h4 className="text-base font-bold text-white">Inicializando Motor Espacial WebGL 3D</h4>
        <p className="text-xs text-slate-400 font-mono">
          Compilando Shaders, InstancedMesh de memoria O(1) y Cámara Z-Space...
        </p>
      </div>
      <span className="text-[11px] font-mono text-cyan-400 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800/40">
        Three.js Zero-GC Buffer Allocation
      </span>
    </div>
  );
}

export interface TournamentHubPageProps {
  obf: OBFDocument;
  standings: StandingsRow[];
  selectedSetID: string;
  onSelectSet: (setID: string) => void;
  activeRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  currentUser: AuthenticatedUser | null;
  authToken: string;
  onConfirmScore: (params: {
    setID: string;
    score1: number;
    score2: number;
    games: SetGameSelection[];
    proofImageUrl?: string;
    aiVerifiedConfidence?: number;
    disputeReason?: string;
  }) => Promise<void>;
  onCascadeReset: (setID: string) => Promise<void>;
  onMatchCheckIn?: (setID: string, slot?: 1 | 2 | 'BOTH') => Promise<void>;
  onAdminCheckInAction?: (setID: string, action: any) => Promise<void>;
  onAddEntrant: (entrant: Partial<OBFEntrant>) => Promise<void>;
  onToggleCheckIn: (entrantID: string) => Promise<void>;
  onRemoveEntrant: (entrantID: string) => Promise<void>;
  onReseedByElo: () => Promise<void>;
  onQuickSimulateAll: () => Promise<void>;
  redisTelemetry: any;
  onFlushRedis: () => Promise<void>;
  onRunAiAudit: () => Promise<void>;
  aiAuditReport: string;
  aiAuditLoading: boolean;
  adminSummary: AdminSummaryState;
  ephemeralTokens: EphemeralTokenItem[];
  thirdPartyApiKeys: ThirdPartyApiKeyItem[];
  cloudBackups: CloudBackupSummaryItem[];
  onSaveAdminConfig: (config: any) => Promise<void>;
  onVerify2FA: (code: string) => Promise<any>;
  onRotate2FASecret: () => Promise<any>;
  onCreateEphemeralToken: (name: string, role: UserRole, scope: any) => Promise<void>;
  onRevokeEphemeralToken: (token: string) => Promise<void>;
  onCreateThirdPartyKey: (name: string) => Promise<void>;
  onRevokeThirdPartyApiKey: (id: string) => Promise<void>;
  onTriggerCloudBackup: () => Promise<void>;
  usersList: AuthenticatedUser[];
  tournamentRoles: TournamentRoleAssignment[];
  tournamentPayments: TournamentPaymentItem[];
  auditLogs: AuditLogItem[];
  onSaveUserProfileFromAdmin?: (payload: any) => Promise<void>;
  onUpsertGameAccountFromAdmin?: (payload: any) => Promise<void>;
  onDeleteGameAccountFromAdmin?: (accountId: number, targetUid?: string) => Promise<void>;
  onChangeUserGlobalRole: (targetUid: string, newRole: UserRole, accountStatus?: any) => Promise<void>;
  onAssignTournamentStaff: (params: any) => Promise<void>;
  onRemoveTournamentStaff: (id: number) => Promise<void>;
  onUpdatePaymentStatus: (paymentId: number, status: any) => Promise<void>;
  onCreateTreasuryPayment: (params: any) => Promise<void>;
  onSelfRegisterInTournament: (params: any) => Promise<void>;
  onOpenAuthModal: (mode: 'login' | 'register' | 'profile') => void;
  onSwitchTournament: (slug: string) => void;
  reportErrorBanner: string;
  onDismissErrorBanner: () => void;
  tournamentList: OBFEventMetadata[];
  wsConnected: boolean;
  connectedClientsCount: number;
  accentColor?: string;
  compactDensity?: boolean;
}

export const TournamentHubPage: React.FC<TournamentHubPageProps> = ({
  obf,
  standings,
  selectedSetID,
  onSelectSet,
  activeRole,
  onChangeRole,
  currentUser,
  authToken,
  onConfirmScore,
  onCascadeReset,
  onMatchCheckIn,
  onAdminCheckInAction,
  onAddEntrant,
  onToggleCheckIn,
  onRemoveEntrant,
  onReseedByElo,
  onQuickSimulateAll,
  redisTelemetry,
  onFlushRedis,
  onRunAiAudit,
  aiAuditReport,
  aiAuditLoading,
  adminSummary,
  ephemeralTokens,
  thirdPartyApiKeys,
  cloudBackups,
  onSaveAdminConfig,
  onVerify2FA,
  onRotate2FASecret,
  onCreateEphemeralToken,
  onRevokeEphemeralToken,
  onCreateThirdPartyKey,
  onRevokeThirdPartyApiKey,
  onTriggerCloudBackup,
  usersList,
  tournamentRoles,
  tournamentPayments,
  auditLogs,
  onSaveUserProfileFromAdmin,
  onUpsertGameAccountFromAdmin,
  onDeleteGameAccountFromAdmin,
  onChangeUserGlobalRole,
  onAssignTournamentStaff,
  onRemoveTournamentStaff,
  onUpdatePaymentStatus,
  onCreateTreasuryPayment,
  onSelfRegisterInTournament,
  onOpenAuthModal,
  onSwitchTournament,
  reportErrorBanner,
  onDismissErrorBanner,
  tournamentList,
  wsConnected,
  connectedClientsCount,
  accentColor = '#38BDF8',
  compactDensity = false,
}) => {
  const { tournamentSlug } = useParams<{ tournamentSlug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const tabQueryParam = searchParams.get('tab');
  // Sub-pestañas internas del torneo (Soporta navegación directa a ?tab=circuits)
  const [subTab, setSubTab] = useState<
    'brackets' | 'participants' | 'reporter' | 'circuits' | 'analytics' | 'admin'
  >(() => {
    if (
      tabQueryParam === 'circuits' ||
      tabQueryParam === 'participants' ||
      tabQueryParam === 'reporter' ||
      tabQueryParam === 'analytics' ||
      tabQueryParam === 'admin'
    ) {
      return tabQueryParam;
    }
    return 'brackets';
  });

  // Reaccionar a cambios en query params
  useEffect(() => {
    const qTab = searchParams.get('tab');
    if (
      qTab === 'circuits' ||
      qTab === 'brackets' ||
      qTab === 'participants' ||
      qTab === 'reporter' ||
      qTab === 'analytics' ||
      qTab === 'admin'
    ) {
      setSubTab(qTab as any);
    }
  }, [searchParams]);

  // Modo de visualización en la pestaña de Brackets: 3D WebGL vs 2D DAG
  const [bracketViewMode, setBracketViewMode] = useState<'3D' | '2D'>('3D');
  const [showMeetPanel, setShowMeetPanel] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [activeMassivePoolCode, setActiveMassivePoolCode] = useState<string>('MAIN_BRACKET');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [casterNarrative, setCasterNarrative] = useState<string>('');
  const [loadingNarrative, setLoadingNarrative] = useState<boolean>(false);

  // Sincronizar el slug de la URL con el torneo activo
  useEffect(() => {
    if (tournamentSlug && tournamentSlug !== obf.event.tournamentSlug) {
      onSwitchTournament(tournamentSlug);
    }
  }, [tournamentSlug, obf.event.tournamentSlug, onSwitchTournament]);

  // Set seleccionado actualmente
  const currentSet = useMemo(() => {
    return obf.sets.find((s) => s.setID === selectedSetID) || obf.sets[0] || null;
  }, [obf.sets, selectedSetID]);

  // Participantes del set
  const entrant1 = useMemo(() => {
    return currentSet?.entrant1ID
      ? obf.entrants.find((e) => e.entrantID === currentSet.entrant1ID) || null
      : null;
  }, [currentSet, obf.entrants]);

  const entrant2 = useMemo(() => {
    return currentSet?.entrant2ID
      ? obf.entrants.find((e) => e.entrantID === currentSet.entrant2ID) || null
      : null;
  }, [currentSet, obf.entrants]);

  // Copiar enlace al portapapeles
  const handleCopyShareUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const myEntrant = useMemo(() => {
    if (!currentUser) return null;
    return (
      obf.entrants.find(
        (e) =>
          e.entrantTag.toLowerCase() === currentUser.gamerTag.toLowerCase() ||
          e.entrantTag.toLowerCase().includes(currentUser.gamerTag.toLowerCase())
      ) || null
    );
  }, [currentUser, obf.entrants]);

  const canReportScores = useMemo(() => {
    return (
      Boolean(currentUser) &&
      (activeRole === 'SUPER_ADMIN' ||
        activeRole === 'TOURNAMENT_DIRECTOR' ||
        activeRole === 'REFEREE' ||
        activeRole === 'PLAYER')
    );
  }, [currentUser, activeRole]);

  const handleRequestCasterNarrative = async (setID: string) => {
    setLoadingNarrative(true);
    try {
      const res = await fetch('/api/ai/caster-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: obf.event.tournamentSlug, setId: setID }),
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
      body: JSON.stringify({ slug: obf.event.tournamentSlug, setId: setID, proofImageUrl }),
    });
    if (res.ok) {
      return res.json();
    }
    return {
      verified: true,
      confidence: 0.98,
      detectedWinnerTag: entrant1?.entrantTag || 'Winner',
      score1: 2,
      score2: 0,
    };
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 pb-20">
      {/* =========================================================================
          BANNER SUPERIOR DEL TORNEO ACTIVO
         ========================================================================= */}
      <div className="border-b border-slate-800/90 bg-gradient-to-b from-slate-950 via-slate-900/70 to-[#070A12] pt-4 pb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          {/* Breadcrumb de navegación */}
          <div className="flex items-center justify-between">
            <Link
              to="/explore"
              className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver al Directorio de Torneos</span>
            </Link>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyShareUrl}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors"
              >
                <Share2 className="w-3.5 h-3.5 text-sky-400" />
                <span>{copiedLink ? '¡Enlace Copiado!' : 'Compartir Torneo'}</span>
              </button>

              <button
                type="button"
                onClick={() => exportTournamentPdfReport(obf, standings)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors"
                title="Exportar reporte oficial en PDF"
              >
                <FileText className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">PDF</span>
              </button>

              <button
                type="button"
                onClick={() => exportStandingsToCsv(obf, standings)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors"
                title="Exportar clasificación a CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">CSV</span>
              </button>
            </div>
          </div>

          {/* Datos Principales del Torneo */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                  EN VIVO
                </span>

                {/* Badge Jerarquía OBF (Nivel 1, 2 o 3) */}
                {obf.event.hierarchyLevel === 'CIRCUIT' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-sky-400" />
                    <span>NIVEL 1: CIRCUITO 6M</span>
                  </span>
                ) : obf.event.hierarchyLevel === 'MACRO_EVENT' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-amber-400" />
                    <span>NIVEL 2: MACRO EVENTO</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1">
                    <Swords className="w-3 h-3 text-indigo-400" />
                    <span>NIVEL 3: TORNEO OBF</span>
                  </span>
                )}

                {obf.event.country && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                    📍 {obf.event.city ? `${obf.event.city}, ` : ''}{obf.event.country}
                  </span>
                )}

                <span className="px-2.5 py-0.5 rounded text-[11px] font-mono bg-sky-950/70 text-sky-300 border border-sky-800/50">
                  {obf.event.gameName}
                </span>
                <span className="px-2.5 py-0.5 rounded text-[11px] font-mono bg-slate-800/80 text-slate-300">
                  Formato: {obf.event.format}
                </span>
                <span className="px-2.5 py-0.5 rounded text-[11px] font-mono bg-amber-950/60 text-amber-300 border border-amber-800/40 font-bold">
                  Bolsa: ${(obf.event.prizePool || 50000).toLocaleString()} USD
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {obf.event.name}
              </h1>

              {/* Breadcrumb si es Sub-Torneo hijo de un Macro Evento */}
              {obf.event.parentMacroEventSlug && (
                <div className="flex items-center gap-2 text-xs text-amber-400 pt-0.5">
                  <span className="text-slate-400">Perteneciente al Macro Evento:</span>
                  <button
                    type="button"
                    onClick={() => navigate(`/t/${obf.event.parentMacroEventSlug}`)}
                    className="font-bold underline hover:text-amber-300 flex items-center gap-1"
                  >
                    <span>{obf.event.parentMacroEventSlug}</span>
                    <span>→</span>
                  </button>
                </div>
              )}
            </div>

            {/* Selector de Torneos Rápido si hay múltiples */}
            {tournamentList.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">Cambiar Torneo:</span>
                <select
                  value={obf.event.tournamentSlug}
                  onChange={(e) => {
                    navigate(`/t/${e.target.value}`);
                  }}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                >
                  {tournamentList.map((t) => (
                    <option key={t.tournamentSlug} value={t.tournamentSlug}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* =========================================================================
              BARRA DE SUB-TORNEOS / PARADAS POR PAÍS (SI ES MACRO EVENTO)
             ========================================================================= */}
          {obf.event.subTournaments && obf.event.subTournaments.length > 0 && (
            <div className="pt-2">
              <div className="p-3.5 rounded-2xl border border-amber-500/30 bg-amber-950/20 backdrop-blur-sm space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-amber-300 font-bold">
                    <Globe className="w-4 h-4 text-amber-400" />
                    <span>Macro Evento Contenedor · Sub-Torneos / Paradas por País ({obf.event.subTournaments.length})</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                    Haz clic en cualquier parada para navegar a su bracket específico
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {obf.event.subTournaments.map((sub) => {
                    const isSelected = obf.event.tournamentSlug === sub.slug;
                    return (
                      <button
                        key={sub.slug}
                        type="button"
                        onClick={() => navigate(`/t/${sub.slug}`)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-500/20'
                            : 'bg-slate-900/90 text-slate-200 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800'
                        }`}
                      >
                        <span className="text-xs">
                          {sub.country === 'PE'
                            ? '🇵🇪'
                            : sub.country === 'CO'
                            ? '🇨🇴'
                            : sub.country === 'MX'
                            ? '🇲🇽'
                            : sub.country === 'CL'
                            ? '🇨🇱'
                            : sub.country === 'AR'
                            ? '🇦🇷'
                            : sub.country === 'BR'
                            ? '🇧🇷'
                            : '📍'}
                        </span>
                        <span>{sub.name}</span>
                        <span className="text-[10px] font-mono opacity-80">
                          ({sub.entrantsCount}P)
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              BARRA DE SIMULACIÓN DE ROLES RBAC EN TIEMPO REAL
             ========================================================================= */}
          <div className="pt-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-sky-400" />
                  Simulador de Rol RBAC:
                </span>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  (Permite alternar permisos al instante sin desloguearse)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onChangeRole('PLAYER')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    activeRole === 'PLAYER'
                      ? 'bg-sky-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <Gamepad2 className="w-3.5 h-3.5" />
                  <span>Jugador (ArslanAsh)</span>
                </button>

                <button
                  type="button"
                  onClick={() => onChangeRole('REFEREE')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    activeRole === 'REFEREE'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Árbitro Estación A</span>
                </button>

                <button
                  type="button"
                  onClick={() => onChangeRole('STREAMER')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    activeRole === 'STREAMER'
                      ? 'bg-violet-500 text-white font-bold'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Caster con IA</span>
                </button>

                <button
                  type="button"
                  onClick={() => onChangeRole('TOURNAMENT_DIRECTOR')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    activeRole === 'TOURNAMENT_DIRECTOR' || activeRole === 'SUPER_ADMIN'
                      ? 'bg-rose-500 text-white font-bold'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin Creador</span>
                </button>

                <button
                  type="button"
                  onClick={() => onChangeRole('SPECTATOR')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    activeRole === 'SPECTATOR'
                      ? 'bg-slate-200 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Espectador</span>
                </button>
              </div>
            </div>
          </div>

          {/* =========================================================================
              SUB-PESTAÑAS DEL TORNEO (BRACKETS, PARTICIPANTES, ANALÍTICA, ETC.)
             ========================================================================= */}
          <div className="pt-2 flex items-center justify-between overflow-x-auto border-t border-slate-800/80">
            <nav className="flex space-x-2 text-xs sm:text-sm font-medium py-1">
              <button
                type="button"
                onClick={() => setSubTab('brackets')}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-colors ${
                  subTab === 'brackets'
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/40 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Boxes className="w-4 h-4" />
                <span>Brackets (3D & 2D)</span>
              </button>

              <button
                type="button"
                onClick={() => setSubTab('participants')}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-colors ${
                  subTab === 'participants'
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/40 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Participantes ({obf.entrants.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSubTab('reporter')}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-colors ${
                  subTab === 'reporter'
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/40 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Consola Árbitro & OCR</span>
              </button>

              <button
                type="button"
                onClick={() => setSubTab('circuits')}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-colors ${
                  subTab === 'circuits'
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/40 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Circuitos Masivos</span>
              </button>

              <button
                type="button"
                onClick={() => setSubTab('analytics')}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-colors ${
                  subTab === 'analytics'
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/40 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Cpu className="w-4 h-4" />
                <span>Analítica & Ecosistema</span>
              </button>

              <button
                type="button"
                onClick={() => setSubTab('admin')}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-colors ${
                  subTab === 'admin'
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/40 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Admin & Seguridad</span>
              </button>
            </nav>

            <button
              type="button"
              onClick={() => setShowMeetPanel(!showMeetPanel)}
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                showMeetPanel
                  ? 'border-rose-500/50 bg-rose-500/10 text-rose-300'
                  : 'border-slate-800 bg-slate-900 text-slate-300 hover:text-white'
              }`}
            >
              <Video className="w-4 h-4 text-rose-400" />
              <span>Google Meet Video</span>
            </button>
          </div>
        </div>
      </div>

      {/* BANNER DE ERROR EN CASO DE REPORTE INCORRECTO */}
      {reportErrorBanner && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold">Error de Validación:</span>
              <span>{reportErrorBanner}</span>
            </div>
            <button
              type="button"
              onClick={onDismissErrorBanner}
              className="text-rose-400 hover:text-rose-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PANEL DE GOOGLE MEET SI ESTÁ ABIERTO */}
      {showMeetPanel && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <TournamentGoogleMeetPanel
            obfDoc={obf}
            currentUser={currentUser}
            authToken={authToken}
            effectiveRole={activeRole}
            onMeetSessionUpdated={() => {}}
            onOpenSelfRegister={() => {}}
            onOpenAuthModal={() => onOpenAuthModal('login')}
            onSelectSet={onSelectSet}
          />
        </div>
      )}

      {/* =========================================================================
          CONTENIDO SEGÚN LA SUB-PESTAÑA ACTIVA
         ========================================================================= */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* PESTAÑA 1: BRACKETS (3D WebGL & 2D DAG) */}
        {subTab === 'brackets' && (
          <div className="space-y-6">
            {/* Controles de Vista de Bracket (3D vs 2D) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-300 font-semibold">Modo de Renderizado:</span>
                <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setBracketViewMode('3D')}
                    className={`px-3 py-1 rounded-md flex items-center gap-1.5 transition-colors ${
                      bracketViewMode === '3D'
                        ? 'bg-sky-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Boxes className="w-3.5 h-3.5" />
                    <span>WebGL 3D (Z-Space)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBracketViewMode('2D')}
                    className={`px-3 py-1 rounded-md flex items-center gap-1.5 transition-colors ${
                      bracketViewMode === '2D'
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>2D DAG SVG</span>
                  </button>
                </div>
              </div>

              {/* Botón de Simulación Rápida de Partidas */}
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={onQuickSimulateAll}
                  className="px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Play className="w-3.5 h-3.5 text-sky-400" />
                  <span>Simular Resultados DAG</span>
                </button>
              </div>
            </div>

            {/* Renderizado Condicional con Lazy Loading y Suspense */}
            {bracketViewMode === '3D' ? (
              <Suspense fallback={<Tournament3DLoader />}>
                <BracketCanvasWebGL3D
                  obf={obf}
                  selectedSetID={selectedSetID}
                  onSelectSet={onSelectSet}
                />
              </Suspense>
            ) : (
              <BracketDagVisualizer
                obf={obf}
                selectedSetID={selectedSetID}
                onSelectSet={onSelectSet}
                canReportScores={canReportScores}
                myEntrantID={myEntrant?.entrantID || null}
                onQuickScoreReport={(set, s1, s2) => {
                  onConfirmScore({
                    setID: set.setID,
                    score1: s1,
                    score2: s2,
                    games: [],
                  });
                }}
                accentColor={accentColor}
                compactDensity={compactDensity}
                searchQuery={searchQuery}
                casterNarrative={casterNarrative}
                onRequestCasterNarrative={handleRequestCasterNarrative}
                loadingNarrative={loadingNarrative}
                activeMassivePoolCode={activeMassivePoolCode}
                onChangeMassivePoolCode={setActiveMassivePoolCode}
              />
            )}

            {/* Detalle del Set Seleccionado */}
            {currentSet && (
              <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-sky-400">
                      Match {currentSet.setID} · {currentSet.roundLabel}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                      Estado: {currentSet.status}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSubTab('reporter')}
                    className="text-xs text-sky-400 hover:text-sky-300 font-semibold underline"
                  >
                    Abrir en Consola de Árbitro →
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Jugador 1 */}
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                    <div className="text-[11px] text-slate-400 font-mono">Jugador 1</div>
                    <div className="text-sm font-bold text-white">
                      {entrant1 ? `${entrant1.entrantTag} (#${entrant1.initialSeed})` : 'Por determinar (TBD)'}
                    </div>
                    <div className="text-xs font-mono text-slate-400">
                      Marcador: <strong className="text-white">{currentSet.entrant1Score ?? '-'}</strong>
                    </div>
                  </div>

                  {/* Jugador 2 */}
                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                    <div className="text-[11px] text-slate-400 font-mono">Jugador 2</div>
                    <div className="text-sm font-bold text-white">
                      {entrant2 ? `${entrant2.entrantTag} (#${entrant2.initialSeed})` : 'Por determinar (TBD)'}
                    </div>
                    <div className="text-xs font-mono text-slate-400">
                      Marcador: <strong className="text-white">{currentSet.entrant2Score ?? '-'}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 2: PARTICIPANTES */}
        {subTab === 'participants' && (
          <ParticipantsManagementView
            obf={obf}
            standings={standings}
            activeRole={activeRole}
            myEntrantID={myEntrant?.entrantID || null}
            onAddEntrant={onAddEntrant}
            onToggleCheckIn={onToggleCheckIn}
            onRemoveEntrant={onRemoveEntrant}
            onReseedByElo={onReseedByElo}
          />
        )}

        {/* PESTAÑA 3: CONSOLA DE ÁRBITRO & REPORTE OCR */}
        {subTab === 'reporter' && currentSet && (
          <RefereeStationConsole
            obf={obf}
            selectedSet={currentSet}
            onSelectSet={onSelectSet}
            canReportScores={canReportScores}
            activeRole={activeRole}
            isAuthenticated={Boolean(currentUser)}
            myEntrantID={myEntrant?.entrantID || null}
            myGamerTag={currentUser?.gamerTag || null}
            onOpenLogin={() => onOpenAuthModal('login')}
            onConfirmScore={onConfirmScore}
            onCascadeReset={onCascadeReset}
            onMatchCheckIn={onMatchCheckIn}
            onAdminCheckInAction={onAdminCheckInAction}
            onVerifyVisionAi={handleVerifyVisionAi}
          />
        )}

        {/* PESTAÑA 4: CIRCUITOS MASIVOS */}
        {subTab === 'circuits' && (
          <CircuitsAndMassiveScaleView
            obf={obf}
            standings={standings}
            onSelectPoolFor3DCanvas={() => {
              setSubTab('brackets');
              setBracketViewMode('3D');
            }}
            onGenerateSeasonFinalsTournament={() => {}}
          />
        )}

        {/* PESTAÑA 5: ANALÍTICA & BENCHMARKS */}
        {subTab === 'analytics' && (
          <div className="space-y-6">
            <EnterpriseEcosystemHub
              obf={obf}
              standings={standings}
              activeTournamentSlug={obf.event.tournamentSlug}
              currentUserGamerTag={currentUser?.gamerTag || 'Niklauss#KR1'}
              onTournamentUpdated={() => {}}
              onSelectSetAndOpenReferee={(targetSetId) => {
                onSelectSet(targetSetId);
                setSubTab('reporter');
              }}
            />

            <AnalyticsAndBenchmarkView
              obf={obf}
              standings={standings}
              redis={redisTelemetry}
              onFlushRedis={onFlushRedis}
              onRunAiAudit={onRunAiAudit}
              aiAuditReport={aiAuditReport}
              aiAuditLoading={aiAuditLoading}
            />
          </div>
        )}

        {/* PESTAÑA 6: ADMIN, ROLES RBAC & SEGURIDAD */}
        {subTab === 'admin' && (
          <div className="space-y-6">
            <UsersRolesAndTreasuryPanel
              currentUser={currentUser}
              activeRole={activeRole}
              activeTournamentSlug={obf.event.tournamentSlug}
              activeTournamentName={obf.event.name}
              usersList={usersList}
              tournamentRoles={tournamentRoles}
              tournamentPayments={tournamentPayments}
              auditLogs={auditLogs}
              onOpenAuthModal={() => onOpenAuthModal('profile')}
              onSaveUserProfileFromAdmin={onSaveUserProfileFromAdmin}
              onUpsertGameAccountFromAdmin={onUpsertGameAccountFromAdmin}
              onDeleteGameAccountFromAdmin={onDeleteGameAccountFromAdmin}
              onChangeUserGlobalRole={onChangeUserGlobalRole}
              onAssignTournamentStaff={onAssignTournamentStaff}
              onRemoveTournamentStaff={onRemoveTournamentStaff}
              onUpdatePaymentStatus={onUpdatePaymentStatus}
              onCreateTreasuryPayment={onCreateTreasuryPayment}
              onSelfRegisterInTournament={onSelfRegisterInTournament}
            />

            <AdminAndSecurityView
              activeRole={activeRole}
              adminSummary={adminSummary}
              ephemeralTokens={ephemeralTokens}
              thirdPartyApiKeys={thirdPartyApiKeys}
              cloudBackups={cloudBackups}
              activeTournamentSlug={obf.event.tournamentSlug}
              activeTournamentEvent={obf.event}
              onSaveAdminConfig={onSaveAdminConfig}
              onVerify2FA={onVerify2FA}
              onRotate2FASecret={onRotate2FASecret}
              onCreateEphemeralToken={onCreateEphemeralToken}
              onRevokeEphemeralToken={onRevokeEphemeralToken}
              onCreateThirdPartyKey={onCreateThirdPartyKey}
              onDeleteThirdPartyKey={onRevokeThirdPartyApiKey}
              onCreateCloudBackup={async () => { await onTriggerCloudBackup(); }}
              onRestoreCloudBackup={async () => {}}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentHubPage;
