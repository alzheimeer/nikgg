/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Landing Page de Conversión (Ruta `/`) para nikgg (nikBrackets Pro)
 * Hero de alto impacto, Feature Grid interactivo, Métricas, Prueba Social y CTAs directos.
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Boxes,
  Cpu,
  Eye,
  Flame,
  Globe,
  Layers,
  LogIn,
  Play,
  Radio,
  Shield,
  Sparkles,
  Swords,
  Timer,
  Trophy,
  Users,
  Video,
  Zap,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { TournamentSummaryCardData } from '../components/PublicLandingAndStartHub';
import { AuthenticatedUser } from '../components/AuthAndUsersModal';

interface LandingPageProps {
  currentUser: AuthenticatedUser | null;
  featuredTournament?: TournamentSummaryCardData;
  activeTournamentSlug: string;
  connectedClientsCount: number;
  wsConnected: boolean;
  onOpenAuthModal: (mode: 'login' | 'register') => void;
  onOpenCreateTournament: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  currentUser,
  featuredTournament,
  activeTournamentSlug,
  connectedClientsCount,
  wsConnected,
  onOpenAuthModal,
  onOpenCreateTournament,
}) => {
  const navigate = useNavigate();
  const authUrl = import.meta.env.VITE_AUTH_URL || 'https://auth.niklauss.uk';

  const defaultTourneySlug = featuredTournament?.tournamentSlug || activeTournamentSlug || 'nexus-tekken8-masters';

  return (
    <div className="relative min-h-screen bg-[#070A12] text-slate-100 overflow-x-hidden selection:bg-sky-500/30 selection:text-sky-200">
      {/* Luces de fondo y patrones cibernéticos */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-gradient-to-b from-sky-500/15 via-indigo-600/10 to-transparent blur-3xl opacity-70" />
        <div className="absolute top-[35%] right-[-10%] w-[500px] h-[500px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-[65%] left-[-10%] w-[550px] h-[550px] bg-violet-600/10 blur-[130px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b08_1px,transparent_1px),linear-gradient(to_bottom,#1e293b08_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20 space-y-24">
        {/* =========================================================================
            1. HERO SECTION
           ========================================================================= */}
        <section className="pt-10 sm:pt-16 pb-8 text-center space-y-8">
          {/* Badge superior animado */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-sky-500/30 bg-sky-950/40 backdrop-blur-md text-xs font-medium text-sky-300 shadow-lg shadow-sky-950/50">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
            </span>
            <span>nikBrackets Pro v2 · Motor DAG O(1) + WebGL 3D Espacial</span>
            <span className="text-slate-500">|</span>
            <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
              <Zap className="w-3 h-3" /> &lt;2ms Sync
            </span>
          </div>

          {/* Título Principal de Impacto */}
          <div className="max-w-4xl mx-auto space-y-4">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.08]">
              La Plataforma de eSports de{' '}
              <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">
                Nueva Generación
              </span>{' '}
              con Brackets 3D e IA
            </h1>
            <p className="max-w-2xl mx-auto text-base sm:text-xl text-slate-300 leading-relaxed font-normal">
              Organiza y compite en torneos masivos con aceleración DAG O(1), validación de resultados
              por OCR (DeepSeek-VL) y sincronización WebSockets en tiempo real.
            </p>
          </div>

          {/* Botones de Acción Principales (CTAs) */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <Link
              to="/explore"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 text-slate-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-lg shadow-sky-500/25 hover:shadow-sky-400/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Swords className="w-5 h-5 text-slate-950" />
              <span>Explorar Torneos</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            {currentUser ? (
              <Link
                to={`/t/${defaultTourneySlug}`}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-slate-700 bg-slate-900/90 hover:bg-slate-800 text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2 backdrop-blur-md transition-all hover:border-slate-600"
              >
                <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                <span>Entrar a Mi Torneo Activo</span>
              </Link>
            ) : (
              <div className="flex w-full sm:w-auto items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenAuthModal('login')}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-slate-700/80 bg-slate-900/90 hover:bg-slate-800 hover:border-sky-500/40 text-slate-100 font-semibold text-sm sm:text-base flex items-center justify-center gap-2 backdrop-blur-md transition-all"
                >
                  <LogIn className="w-4 h-4 text-sky-400" />
                  <span>Iniciar Sesión / Registro</span>
                </button>

                <a
                  href={authUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir Portal Externo de Autenticación SSO"
                  className="hidden md:inline-flex p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-sky-300 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}

            <button
              type="button"
              onClick={onOpenCreateTournament}
              className="w-full sm:w-auto px-5 py-3.5 rounded-xl border border-dashed border-slate-700 hover:border-sky-500/50 bg-slate-950/60 text-slate-300 hover:text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <span>+ Crear Torneo OBF</span>
            </button>
          </div>

          {/* Badges de soporte y capacidades */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-900/80 border border-slate-800/80">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" /> Motor DAG O(1)
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-900/80 border border-slate-800/80">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" /> WebGL 3D Espacial (Three.js)
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-900/80 border border-slate-800/80">
              <CheckCircle2 className="w-3.5 h-3.5 text-violet-400" /> Arbitraje con DeepSeek-VL
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-900/80 border border-slate-800/80">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Estándar OBF v1.0
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-900/80 border border-slate-800/80">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" /> Google Meet Integrado
            </span>
          </div>

          {/* =========================================================================
              TEASER / SHOWCASE DEL TORNEO ACTIVO
             ========================================================================= */}
          {featuredTournament && (
            <div className="pt-6 max-w-4xl mx-auto">
              <div className="relative rounded-2xl border border-sky-500/30 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-5 sm:p-6 backdrop-blur-xl shadow-2xl shadow-sky-950/30 text-left overflow-hidden group">
                <div className="absolute top-0 right-0 w-80 h-32 bg-sky-500/10 blur-2xl pointer-events-none" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        EN VIVO
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-950/60 text-sky-400 border border-sky-800/40">
                        {featuredTournament.event?.gameName || 'Tekken 8'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800/80 text-slate-300">
                        Formato: {featuredTournament.event?.format || 'Two-Stage'}
                      </span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-white group-hover:text-sky-300 transition-colors">
                      {featuredTournament.event?.name || 'Nexus Grid Major 2026 — Tekken 8 World Tour'}
                    </h3>
                  </div>

                  <Link
                    to={`/t/${defaultTourneySlug}`}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md transition-all shrink-0"
                  >
                    <Boxes className="w-4 h-4 text-slate-950" />
                    <span>Entrar al Bracket 3D</span>
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
                    <span className="text-slate-400 block text-[11px]">Bolsa de Premios</span>
                    <span className="text-amber-400 font-bold text-sm">
                      ${(featuredTournament.event?.prizePool || 50000).toLocaleString()} USD
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
                    <span className="text-slate-400 block text-[11px]">Competidores</span>
                    <span className="text-cyan-400 font-bold text-sm">
                      {featuredTournament.entrantsCount || 24} Jugadores Pro
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
                    <span className="text-slate-400 block text-[11px]">Partidos Jugados</span>
                    <span className="text-emerald-400 font-bold text-sm">
                      {featuredTournament.completedSetsCount || 0} / {featuredTournament.setsCount || 44}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
                    <span className="text-slate-400 block text-[11px]">Visualización</span>
                    <span className="text-violet-400 font-bold text-sm flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> WebGL Z-Space
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* =========================================================================
            2. FEATURE GRID (CARACTERÍSTICAS CLAVE)
           ========================================================================= */}
        <section className="space-y-10">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-xs uppercase font-mono tracking-widest text-sky-400 font-bold">
              Infraestructura y Tecnología
            </h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-white">
              Arquitectura Diseñada para la Competición de Élite
            </p>
            <p className="text-sm sm:text-base text-slate-400">
              Despídete de los brackets estáticos lentos. nikgg proporciona velocidad instantánea, visualización 3D y arbitraje inteligente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1: Brackets 3D en Tiempo Real */}
            <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 space-y-4 hover:border-sky-500/40 hover:bg-slate-900/80 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
                <Boxes className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-sky-300 transition-colors">
                Brackets 3D en Tiempo Real
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Renders espaciales fluidos en WebGL con capacidad para <strong>3,000+ participantes</strong> en memoria O(1) con <code>InstancedMesh</code>, conectores cúbicos de Bézier y presets de cámara orbital interactiva.
              </p>
              <div className="pt-2 text-xs font-mono text-sky-400 flex items-center gap-1.5">
                <span>Three.js + Z-Space</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Feature 2: Arbitraje Asistido por IA */}
            <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 space-y-4 hover:border-cyan-500/40 hover:bg-slate-900/80 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                Arbitraje Asistido por IA
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Validación automática de capturas de victoria mediante OCR multimodal (DeepSeek-VL). Detección instantánea de marcadores, nombres de personajes y mitigación de disputas sin intervención manual.
              </p>
              <div className="pt-2 text-xs font-mono text-cyan-400 flex items-center gap-1.5">
                <span>OCR Multimodal DeepSeek-VL</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Feature 3: Gestión Progresiva de Roles */}
            <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 space-y-4 hover:border-indigo-500/40 hover:bg-slate-900/80 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                Gestión Progresiva de Roles
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Matriz de permisos granulares por torneo. Los <strong>Jugadores</strong> reportan exclusivamente sus combates, los <strong>Árbitros</strong> controlan estaciones asignadas y los <strong>Casters</strong> disfrutan de métricas en directo.
              </p>
              <div className="pt-2 text-xs font-mono text-indigo-400 flex items-center gap-1.5">
                <span>RBAC Dinámico por Torneo</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Feature 4: Motor DAG O(1) */}
            <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 space-y-4 hover:border-violet-500/40 hover:bg-slate-900/80 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400 group-hover:scale-110 transition-transform">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-violet-300 transition-colors">
                Aceleración Algorítmica DAG O(1)
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Propagación de ganadores y perdedores en tiempo constante. Sin reconstruir todo el árbol de llaves, actualizando exclusivamente los nodos hijos dependientes en microsegundos.
              </p>
              <div className="pt-2 text-xs font-mono text-violet-400 flex items-center gap-1.5">
                <span>OptimizedNikBracketEngine</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Feature 5: Redis Caché & Offline LAN */}
            <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 space-y-4 hover:border-amber-500/40 hover:bg-slate-900/80 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                Caché Redis & Offline-First LAN
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Patrón Read-Aside con colas Write-Behind para persistencia asíncrona. Si el internet del recinto falla, el servidor local continúa operando sin pérdida de datos.
              </p>
              <div className="pt-2 text-xs font-mono text-amber-400 flex items-center gap-1.5">
                <span>Resistencia ante Caídas de Red</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Feature 6: Google Meet & Video Arbitraje */}
            <div className="relative rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 space-y-4 hover:border-rose-500/40 hover:bg-slate-900/80 transition-all duration-300 group">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
                <Video className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-rose-300 transition-colors">
                Salas Google Meet Integradas
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Generación con 1-click de videollamadas de Google Meet vinculadas a la mesa de torneo. Permite verificación facial de jugadores y arbitraje remoto en tiempo real.
              </p>
              <div className="pt-2 text-xs font-mono text-rose-400 flex items-center gap-1.5">
                <span>Video Arbitraje WebRTC</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            3. SECCIÓN DE MÉTRICAS Y PRUEBA SOCIAL
           ========================================================================= */}
        <section className="relative rounded-3xl border border-slate-800/90 bg-gradient-to-r from-slate-950 via-slate-900/70 to-slate-950 p-8 sm:p-12 overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-radial from-sky-500/5 via-transparent to-transparent pointer-events-none" />

          <div className="text-center space-y-2 mb-10">
            <h2 className="text-xs uppercase font-mono tracking-widest text-cyan-400 font-bold">
              Rendimiento Comprobado
            </h2>
            <p className="text-2xl sm:text-3xl font-extrabold text-white">
              Métricas Diseñadas para Torneos Masivos y Circuitos Oficiales
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 text-center">
            {/* Métrica 1 */}
            <div className="space-y-1.5 p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
              <div className="text-3xl sm:text-5xl font-black font-mono tracking-tight text-white bg-gradient-to-r from-white via-slate-200 to-sky-300 bg-clip-text text-transparent">
                +3,000
              </div>
              <div className="text-xs sm:text-sm font-semibold text-sky-400">Jugadores Simultáneos</div>
              <div className="text-[11px] text-slate-400">Capacidad en Pools Masivos OBF</div>
            </div>

            {/* Métrica 2 */}
            <div className="space-y-1.5 p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
              <div className="text-3xl sm:text-5xl font-black font-mono tracking-tight text-emerald-400">
                &lt; 2ms
              </div>
              <div className="text-xs sm:text-sm font-semibold text-emerald-400">Sincronización WebSockets</div>
              <div className="text-[11px] text-slate-400">Latencia end-to-end de marcadores</div>
            </div>

            {/* Métrica 3 */}
            <div className="space-y-1.5 p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
              <div className="text-3xl sm:text-5xl font-black font-mono tracking-tight text-cyan-300">
                OBF v1.0
              </div>
              <div className="text-xs sm:text-sm font-semibold text-cyan-400">Compatibilidad Estándar</div>
              <div className="text-[11px] text-slate-400">Open Bracket Format universal</div>
            </div>

            {/* Métrica 4 */}
            <div className="space-y-1.5 p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
              <div className="text-3xl sm:text-5xl font-black font-mono tracking-tight text-violet-400">
                99.8%
              </div>
              <div className="text-xs sm:text-sm font-semibold text-violet-400">Precisión OCR con IA</div>
              <div className="text-[11px] text-slate-400">Validación DeepSeek-VL sin fricción</div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            4. BANNER FINAL CTA
           ========================================================================= */}
        <section className="text-center py-12 px-6 rounded-3xl border border-sky-500/20 bg-gradient-to-b from-sky-950/20 via-slate-900/60 to-slate-950/80 space-y-6">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white">
            ¿Listo para Experimentar los Torneos en 3D?
          </h2>
          <p className="max-w-xl mx-auto text-sm sm:text-base text-slate-300">
            Explora las competiciones activas, inscríbete como competidor o gestiona tu propio evento con el estándar OBF.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/explore"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition-all"
            >
              <Swords className="w-5 h-5 text-slate-950" />
              <span>Explorar Directorio de Torneos</span>
            </Link>

            <Link
              to={`/t/${defaultTourneySlug}`}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm sm:text-base flex items-center justify-center gap-2 transition-all"
            >
              <Boxes className="w-4 h-4 text-sky-400" />
              <span>Ver Showcase 3D en Vivo</span>
            </Link>
          </div>
        </section>
      </div>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-300">nikgg</span>
            <span>·</span>
            <span>nikBrackets Pro Esports Engine</span>
            <span>·</span>
            <span>Protocolo OBF v1.0</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/explore" className="hover:text-slate-300 transition-colors">
              Explorar
            </Link>
            <Link to={`/t/${defaultTourneySlug}`} className="hover:text-slate-300 transition-colors">
              Bracket 3D
            </Link>
            <a
              href={authUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-300 transition-colors"
            >
              Auth Portal
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
