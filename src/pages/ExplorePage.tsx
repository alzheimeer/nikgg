/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Directorio de Torneos (Ruta `/explore`) para nikgg (nikBrackets Pro)
 * Búsqueda, filtrado por juego (Tekken 8, Street Fighter 6, Guilty Gear, General) y estado (En Vivo, Inscripciones Abiertas, Finalizados),
 * tarjetas interactivas de torneo con progreso de matches, bolsa de premios y redirección directa a `/t/:tournamentSlug`.
 */

import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Award,
  Boxes,
  Calendar,
  CheckCircle2,
  Filter,
  Flame,
  Gamepad2,
  Play,
  Plus,
  Radio,
  Search,
  Sparkles,
  Swords,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { TournamentSummaryCardData } from '../components/PublicLandingAndStartHub';
import { AuthenticatedUser } from '../components/AuthAndUsersModal';
import { ESPORTS_GAMES_CATALOG } from '../i18n/translations';

interface ExplorePageProps {
  currentUser: AuthenticatedUser | null;
  tournamentSummaries: TournamentSummaryCardData[];
  onOpenCreateTournament: () => void;
  onOpenAuthModal: (mode: 'login' | 'register') => void;
  onSelfEnrollInTournament?: (slug: string) => Promise<void>;
}

type GameFilterKey = 'ALL' | 'tekken8' | 'sf6' | 'ggst' | 'smash_ultimate' | 'dbfz' | 'general';
type StatusFilterKey = 'ALL' | 'LIVE' | 'OPEN' | 'COMPLETED';

// Portadas visuales y estilos temáticos por juego
const GAME_VISUAL_THEMES: Record<
  string,
  {
    bgGradient: string;
    borderGlow: string;
    badgeColor: string;
    fallbackCover: string;
    accentHex: string;
  }
> = {
  tekken8: {
    bgGradient: 'from-amber-950/40 via-red-950/20 to-slate-950',
    borderGlow: 'hover:border-amber-500/50',
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    fallbackCover: 'linear-gradient(135deg, #78350f 0%, #450a0a 100%)',
    accentHex: '#F59E0B',
  },
  sf6: {
    bgGradient: 'from-cyan-950/40 via-blue-950/20 to-slate-950',
    borderGlow: 'hover:border-cyan-500/50',
    badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    fallbackCover: 'linear-gradient(135deg, #0e7490 0%, #1e1b4b 100%)',
    accentHex: '#06B6D4',
  },
  ggst: {
    bgGradient: 'from-rose-950/40 via-orange-950/20 to-slate-950',
    borderGlow: 'hover:border-rose-500/50',
    badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    fallbackCover: 'linear-gradient(135deg, #9f1239 0%, #7c2d12 100%)',
    accentHex: '#F43F5E',
  },
  smash_ultimate: {
    bgGradient: 'from-red-950/40 via-yellow-950/20 to-slate-950',
    borderGlow: 'hover:border-red-500/50',
    badgeColor: 'bg-red-500/10 text-red-400 border-red-500/30',
    fallbackCover: 'linear-gradient(135deg, #991b1b 0%, #854d0e 100%)',
    accentHex: '#EF4444',
  },
  general: {
    bgGradient: 'from-slate-900/40 via-indigo-950/20 to-slate-950',
    borderGlow: 'hover:border-sky-500/50',
    badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    fallbackCover: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    accentHex: '#38BDF8',
  },
};

export const ExplorePage: React.FC<ExplorePageProps> = ({
  currentUser,
  tournamentSummaries,
  onOpenCreateTournament,
  onOpenAuthModal,
  onSelfEnrollInTournament,
}) => {
  const navigate = useNavigate();

  // Estados de filtros
  const [selectedGame, setSelectedGame] = useState<GameFilterKey>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilterKey>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [enrollingSlug, setEnrollingSlug] = useState<string | null>(null);

  // Determina el estado del torneo
  const getTournamentStatus = (t: TournamentSummaryCardData): 'LIVE' | 'OPEN' | 'COMPLETED' => {
    const sets = t.setsCount || t.totalSetsCount || 0;
    const completed = t.completedSetsCount || 0;
    const inProgress = t.inProgressSetsCount || 0;
    const ready = t.readySetsCount || 0;

    if (completed > 0 && completed >= sets && sets > 0) {
      return 'COMPLETED';
    }
    if (inProgress > 0 || (completed > 0 && completed < sets)) {
      return 'LIVE';
    }
    return 'OPEN';
  };

  // Cálculo de estadísticas globales
  const stats = useMemo(() => {
    const totalTournaments = tournamentSummaries.length;
    let totalEntrants = 0;
    let totalPrize = 0;
    let liveCount = 0;

    for (const t of tournamentSummaries) {
      totalEntrants += t.entrantsCount || t.numberEntrants || 0;
      totalPrize += t.prizePool || t.event?.prizePool || 0;
      if (getTournamentStatus(t) === 'LIVE') liveCount++;
    }

    return { totalTournaments, totalEntrants, totalPrize, liveCount };
  }, [tournamentSummaries]);

  // Filtrado de torneos
  const filteredTournaments = useMemo(() => {
    return tournamentSummaries.filter((t) => {
      const gameSlug = (t.gameSlug || t.event?.gameSlug || '').toLowerCase();
      const name = (t.name || t.event?.name || '').toLowerCase();
      const status = getTournamentStatus(t);

      // Filtro por Juego
      if (selectedGame !== 'ALL') {
        if (selectedGame === 'general') {
          if (['tekken8', 'sf6', 'ggst', 'smash_ultimate'].includes(gameSlug)) return false;
        } else if (gameSlug !== selectedGame) {
          return false;
        }
      }

      // Filtro por Estado
      if (selectedStatus !== 'ALL') {
        if (status !== selectedStatus) return false;
      }

      // Filtro por Texto de Búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = name.includes(q);
        const matchesGame = (t.gameName || t.event?.gameName || '').toLowerCase().includes(q);
        const matchesEntrant = (t.entrantTags || []).some((tag) => tag.toLowerCase().includes(q));
        const matchesTop = (t.topEntrants || []).some((ent) => ent.entrantTag.toLowerCase().includes(q));
        if (!matchesName && !matchesGame && !matchesEntrant && !matchesTop) return false;
      }

      return true;
    });
  }, [tournamentSummaries, selectedGame, selectedStatus, searchQuery]);

  const handleEnrollClick = async (slug: string) => {
    if (!currentUser) {
      onOpenAuthModal('login');
      return;
    }
    if (onSelfEnrollInTournament) {
      setEnrollingSlug(slug);
      try {
        await onSelfEnrollInTournament(slug);
      } finally {
        setEnrollingSlug(null);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 pb-20">
      {/* HEADER & HERO DEL EXPLORADOR */}
      <div className="relative border-b border-slate-800/80 bg-gradient-to-b from-slate-950 via-slate-900/60 to-[#070A12] pt-8 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950/60 border border-sky-800/50 text-sky-400 text-xs font-mono mb-2">
                <Swords className="w-3.5 h-3.5" />
                <span>Directorio Global de Competiciones OBF</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Explorar Torneos de eSports
              </h1>
              <p className="text-sm sm:text-base text-slate-400 mt-1 max-w-2xl">
                Encuentra competiciones en vivo, inscríbete en llaves abiertas o inspecciona brackets 3D con aceleración DAG O(1).
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenCreateTournament}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 font-bold text-sm shadow-lg shadow-sky-500/20 transition-all shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Crear Nuevo Torneo</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 font-mono text-xs">
            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80">
              <span className="text-slate-400 block text-[11px]">Torneos Registrados</span>
              <span className="text-white font-bold text-base">{stats.totalTournaments}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80">
              <span className="text-slate-400 block text-[11px]">Partidas en Vivo</span>
              <span className="text-rose-400 font-bold text-base flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                {stats.liveCount} Torneos
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80">
              <span className="text-slate-400 block text-[11px]">Competidores Totales</span>
              <span className="text-cyan-400 font-bold text-base">{stats.totalEntrants}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80">
              <span className="text-slate-400 block text-[11px]">Prize Pool Global</span>
              <span className="text-amber-400 font-bold text-base">
                ${stats.totalPrize.toLocaleString()} USD
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* =========================================================================
            BARRA DE FILTROS SUPERIOR
           ========================================================================= */}
        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-4 sm:p-5 backdrop-blur-md space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Input de Búsqueda de Torneo */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre de torneo, juego o tag de jugador..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-700/80 bg-slate-950/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Selector de Estado */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
              <span className="text-xs font-medium text-slate-400 mr-1 hidden sm:inline">Estado:</span>
              <button
                type="button"
                onClick={() => setSelectedStatus('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedStatus === 'ALL'
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatus('LIVE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                  selectedStatus === 'LIVE'
                    ? 'bg-rose-500 text-white font-bold shadow-lg shadow-rose-500/30'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                🔴 En Vivo
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatus('OPEN')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1 transition-colors ${
                  selectedStatus === 'OPEN'
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                📝 Inscripciones Abiertas
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatus('COMPLETED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1 transition-colors ${
                  selectedStatus === 'COMPLETED'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                🏆 Finalizados
              </button>
            </div>
          </div>

          {/* Categorías por Juego */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-400 font-medium mr-1 shrink-0 flex items-center gap-1">
              <Gamepad2 className="w-3.5 h-3.5" /> Juego:
            </span>

            <button
              type="button"
              onClick={() => setSelectedGame('ALL')}
              className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedGame === 'ALL'
                  ? 'bg-white text-slate-950 font-bold'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Todos los Juegos
            </button>

            <button
              type="button"
              onClick={() => setSelectedGame('tekken8')}
              className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                selectedGame === 'tekken8'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>👊 Tekken 8</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedGame('sf6')}
              className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                selectedGame === 'sf6'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>🔥 Street Fighter 6</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedGame('ggst')}
              className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                selectedGame === 'ggst'
                  ? 'bg-rose-500 text-white font-bold'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>⚡ Guilty Gear Strive</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedGame('smash_ultimate')}
              className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                selectedGame === 'smash_ultimate'
                  ? 'bg-red-500 text-white font-bold'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span>⭐ Super Smash Bros.</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedGame('general')}
              className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedGame === 'general'
                  ? 'bg-indigo-500 text-white font-bold'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Otros Juegos
            </button>

            {(selectedGame !== 'ALL' || selectedStatus !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedGame('ALL');
                  setSelectedStatus('ALL');
                  setSearchQuery('');
                }}
                className="ml-auto text-xs text-sky-400 hover:text-sky-300 underline font-medium shrink-0"
              >
                Limpiar Filtros
              </button>
            )}
          </div>
        </div>

        {/* =========================================================================
            GRID DE TARJETAS DE TORNEO (TOURNAMENT CARDS)
           ========================================================================= */}
        {filteredTournaments.length === 0 ? (
          <div className="py-20 text-center rounded-2xl border border-slate-800/80 bg-slate-900/30 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-800/60 flex items-center justify-center text-slate-500">
              <Filter className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">No se encontraron torneos</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              No hay competiciones que coincidan con los filtros seleccionados. Intenta ampliar los criterios de búsqueda o crea un nuevo torneo.
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedGame('ALL');
                  setSelectedStatus('ALL');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
              >
                Restablecer Filtros
              </button>
              <button
                type="button"
                onClick={onOpenCreateTournament}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold"
              >
                + Crear Torneo
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTournaments.map((t) => {
              const slug = t.tournamentSlug || t.slug || 'tournament';
              const name = t.name || t.event?.name || 'Torneo Sin Nombre';
              const gameName = t.gameName || t.event?.gameName || 'eSports';
              const gameSlug = (t.gameSlug || t.event?.gameSlug || 'general').toLowerCase();
              const prize = t.prizePool || t.event?.prizePool || 0;
              const entrantsCount = t.entrantsCount || t.numberEntrants || (t.entrants ? t.entrants.length : 0);
              const setsCount = t.setsCount || t.totalSetsCount || (t.sets ? t.sets.length : 0);
              const completedCount = t.completedSetsCount || 0;
              const progressPct = setsCount > 0 ? Math.round((completedCount / setsCount) * 100) : 0;
              const status = getTournamentStatus(t);

              const theme = GAME_VISUAL_THEMES[gameSlug] || GAME_VISUAL_THEMES.general;

              return (
                <div
                  key={slug}
                  className={`group relative rounded-2xl border border-slate-800/90 bg-gradient-to-b ${theme.bgGradient} p-5 flex flex-col justify-between transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl hover:shadow-sky-950/40 ${theme.borderGlow}`}
                >
                  <div className="space-y-4">
                    {/* Header de la Tarjeta con Badges de Estado y Juego */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {status === 'LIVE' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                            EN VIVO
                          </span>
                        )}
                        {status === 'OPEN' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                            ABIERTO
                          </span>
                        )}
                        {status === 'COMPLETED' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40">
                            FINALIZADO
                          </span>
                        )}

                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${theme.badgeColor}`}>
                          {gameName}
                        </span>
                      </div>

                      <span className="text-[11px] font-mono text-slate-400">
                        {t.event?.format || 'OBF v1.0'}
                      </span>
                    </div>

                    {/* Portada / Banner Estético del Torneo */}
                    <div
                      className="h-28 rounded-xl overflow-hidden relative p-3 flex flex-col justify-between border border-slate-800/80 group-hover:border-slate-700/80 transition-colors"
                      style={{ background: theme.fallbackCover }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[10px] font-mono text-white/90">
                          {t.event?.date || '2026-10-22'}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[11px] font-mono font-bold text-amber-300">
                          ${prize.toLocaleString()} USD
                        </span>
                      </div>

                      <div className="text-white">
                        <span className="text-[10px] uppercase tracking-wider text-slate-300 block font-mono">
                          {t.event?.organizationSlug || 'nikBrackets Pro'}
                        </span>
                        <div className="text-base font-extrabold truncate text-white drop-shadow-md">
                          {name}
                        </div>
                      </div>
                    </div>

                    {/* Métricas del Torneo */}
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-cyan-400" />
                          Jugadores:
                        </span>
                        <span className="font-bold text-white">{entrantsCount}</span>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Trophy className="w-3.5 h-3.5 text-amber-400" />
                          Premio:
                        </span>
                        <span className="font-bold text-amber-300">${prize.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Barra de Progreso de Partidos */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span>Progreso de Matches</span>
                        <span className="text-sky-400 font-semibold">
                          {completedCount}/{setsCount} ({progressPct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Vista previa de Competidores Top */}
                    {t.topEntrants && t.topEntrants.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                          Seeds Destacados
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {t.topEntrants.slice(0, 4).map((ent) => (
                            <span
                              key={ent.entrantID}
                              className="px-2 py-0.5 rounded bg-slate-900/90 border border-slate-800 text-[10px] font-mono text-slate-300"
                            >
                              #{ent.initialSeed} {ent.entrantTag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Acciones de la Tarjeta */}
                  <div className="pt-5 mt-4 border-t border-slate-800/80 flex items-center gap-2">
                    <Link
                      to={`/t/${slug}`}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-sky-500/20 transition-all"
                    >
                      <Boxes className="w-4 h-4 text-slate-950" />
                      <span>Entrar al Torneo</span>
                    </Link>

                    {status === 'OPEN' && (
                      <button
                        type="button"
                        onClick={() => handleEnrollClick(slug)}
                        disabled={enrollingSlug === slug}
                        className="py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white transition-colors"
                        title="Inscribirse en este torneo"
                      >
                        {enrollingSlug === slug ? '...' : 'Inscribirme'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExplorePage;
