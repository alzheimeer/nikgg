/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Wizard Integral Multi-Nivel para Creación de Torneos (Estándar OBF v1.0)
 * Jerarquía de 3 Niveles:
 *   - NIVEL 1: CIRCUITO / TEMPORADA 6 MESES (Global Leaderboard, Descarte Best of X, Top Finals)
 *   - NIVEL 2: MACRO EVENTO MULTI-TORNEO / PARADA (Contenedor con sub-torneos por país o juegos)
 *   - NIVEL 3: TORNEO / CATEGORÍA INDIVIDUAL (Cuadro DAG O(1) dedicado o sub-torneo hijo)
 */

import React, { useState } from 'react';
import {
  DoubleDqRule,
  LosersBracketDqPenalty,
  OBFEventMetadata,
  SubTournamentItem,
  TournamentFormat,
  TournamentHierarchyLevel,
} from '../engine/nikBracketsEngine';
import { ESPORTS_GAMES_CATALOG } from '../i18n/translations';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Compass,
  CreditCard,
  Flag,
  Flame,
  Gamepad2,
  Globe,
  Layers,
  MapPin,
  Plus,
  QrCode,
  Radio,
  Shield,
  Sliders,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  Users,
  Video,
  X,
  Zap,
} from 'lucide-react';

export interface CreateTournamentSubmitPayload {
  name: string;
  gameName: string;
  gameSlug: string;
  format: TournamentFormat;
  entrantCount: number;
  prizePool: number;
  hierarchyLevel: TournamentHierarchyLevel;
  parentCircuitSlug?: string | null;
  parentMacroEventSlug?: string | null;
  venueCity?: string;
  country?: string;
  meetUrl?: string;
  streamUrl?: string;
  entryFee?: number;
  paymentInstructions?: string;
  subTournamentsList?: Array<{
    name: string;
    country?: string;
    city?: string;
    gameSlug?: string;
    gameName?: string;
    format?: TournamentFormat;
    entrantCount?: number;
    prizePool?: number;
  }>;
  enableMatchCheckIn: boolean;
  matchCheckInTimeoutMinutes: number;
  enableAutoDq: boolean;
  doubleDqRule: DoubleDqRule;
  losersBracketDqPenalty: LosersBracketDqPenalty;
}

interface CreateTournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateTournamentSubmitPayload) => Promise<void>;
  existingTournaments: OBFEventMetadata[];
  isSubmitting?: boolean;
}

const PRESET_LATAM_COUNTRIES = [
  { code: 'PE', name: 'Perú', city: 'Lima', flag: '🇵🇪' },
  { code: 'CO', name: 'Colombia', city: 'Bogotá', flag: '🇨🇴' },
  { code: 'MX', name: 'México', city: 'CDMX', flag: '🇲🇽' },
  { code: 'CL', name: 'Chile', city: 'Santiago', flag: '🇨🇱' },
  { code: 'AR', name: 'Argentina', city: 'Buenos Aires', flag: '🇦🇷' },
  { code: 'BR', name: 'Brasil', city: 'São Paulo', flag: '🇧🇷' },
];

export const CreateTournamentModal: React.FC<CreateTournamentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  existingTournaments,
  isSubmitting = false,
}) => {
  // Wizard Step: 1 = Nivel Jerárquico, 2 = Datos & Formato, 3 = Sub-Torneos / Paradas, 4 = Check-in & DQ, 5 = Tesorería & Lobbies
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Nivel Jerárquico
  const [hierarchyLevel, setHierarchyLevel] = useState<TournamentHierarchyLevel>('MACRO_EVENT');
  const [parentCircuitSlug, setParentCircuitSlug] = useState<string>('');
  const [parentMacroEventSlug, setParentMacroEventSlug] = useState<string>('');

  // Datos Generales
  const [name, setName] = useState<string>('Tekken World Tour 2026 — Master Series Latam');
  const [gameSlug, setGameSlug] = useState<string>('tekken8');
  const [format, setFormat] = useState<TournamentFormat>('two_stage');
  const [entrantCount, setEntrantCount] = useState<number>(32);
  const [prizePool, setPrizePool] = useState<number>(50000);
  const [venueCity, setVenueCity] = useState<string>('Lima');
  const [country, setCountry] = useState<string>('PE');

  // Sub-torneos / Paradas por país o categorías (Nivel 1 o 2)
  const [subTournaments, setSubTournaments] = useState<
    Array<{
      id: string;
      name: string;
      country: string;
      city: string;
      gameSlug: string;
      gameName: string;
      format: TournamentFormat;
      entrantCount: number;
      prizePool: number;
    }>
  >([
    {
      id: 'sub-pe',
      name: 'TWT Parada Perú Qualifier (Lima Masters)',
      country: 'PE',
      city: 'Lima',
      gameSlug: 'tekken8',
      gameName: 'Tekken 8',
      format: 'two_stage',
      entrantCount: 32,
      prizePool: 10000,
    },
    {
      id: 'sub-co',
      name: 'TWT Parada Colombia Qualifier (Bogotá Major)',
      country: 'CO',
      city: 'Bogotá',
      gameSlug: 'tekken8',
      gameName: 'Tekken 8',
      format: 'double_elimination',
      entrantCount: 32,
      prizePool: 10000,
    },
    {
      id: 'sub-mx',
      name: 'TWT Parada México Open (CDMX Battle)',
      country: 'MX',
      city: 'CDMX',
      gameSlug: 'tekken8',
      gameName: 'Tekken 8',
      format: 'two_stage',
      entrantCount: 32,
      prizePool: 10000,
    },
    {
      id: 'sub-cl',
      name: 'TWT Parada Chile Master (Santiago Climax)',
      country: 'CL',
      city: 'Santiago',
      gameSlug: 'tekken8',
      gameName: 'Tekken 8',
      format: 'double_elimination',
      entrantCount: 32,
      prizePool: 10000,
    },
  ]);

  // Formulario temporal para añadir sub-torneo manual
  const [newSubName, setNewSubName] = useState<string>('');
  const [newSubCountry, setNewSubCountry] = useState<string>('PE');
  const [newSubCity, setNewSubCity] = useState<string>('Lima');
  const [newSubGameSlug, setNewSubGameSlug] = useState<string>('tekken8');
  const [newSubFormat, setNewSubFormat] = useState<TournamentFormat>('two_stage');
  const [newSubEntrants, setNewSubEntrants] = useState<number>(32);
  const [newSubPrize, setNewSubPrize] = useState<number>(5000);

  // Check-In y Reglas DQ
  const [enableMatchCheckIn, setEnableMatchCheckIn] = useState<boolean>(true);
  const [matchCheckInTimeoutMinutes, setMatchCheckInTimeoutMinutes] = useState<number>(5);
  const [enableAutoDq, setEnableAutoDq] = useState<boolean>(true);
  const [doubleDqRule, setDoubleDqRule] = useState<DoubleDqRule>('AUTO_BYE_NEXT_ROUND');
  const [losersBracketDqPenalty, setLosersBracketDqPenalty] =
    useState<LosersBracketDqPenalty>('DROP_TO_LOSERS');

  // Tesorería & Lobbies
  const [isPaidEntry, setIsPaidEntry] = useState<boolean>(true);
  const [entryFee, setEntryFee] = useState<number>(25);
  const [paymentInstructions, setPaymentInstructions] = useState<string>(
    'Nequi / Daviplata / Yape / MercadoPago / Binance Pay USDT al +51 987 654 321'
  );
  const [meetUrl, setMeetUrl] = useState<string>('https://meet.google.com/nexus-twt-arena');
  const [streamUrl, setStreamUrl] = useState<string>('https://twitch.tv/tekken');

  if (!isOpen) return null;

  // Filtrar posibles circuitos y macro eventos existentes para vinculación
  const existingCircuits = existingTournaments.filter(
    (t) => t.hierarchyLevel === 'CIRCUIT' || t.format === 'leaderboard'
  );
  const existingMacroEvents = existingTournaments.filter(
    (t) => t.hierarchyLevel === 'MACRO_EVENT' || (t.subTournaments && t.subTournaments.length > 0)
  );

  // Preset 1: Paradas por Países Latam
  const applyPresetLatamCountries = () => {
    const parentGame = ESPORTS_GAMES_CATALOG.find((g) => g.slug === gameSlug)?.name || 'Tekken 8';
    const stops = PRESET_LATAM_COUNTRIES.map((c) => ({
      id: `sub-${c.code.toLowerCase()}`,
      name: `${name} — Parada ${c.name} (${c.city} Qualifier)`,
      country: c.code,
      city: c.city,
      gameSlug,
      gameName: parentGame,
      format,
      entrantCount: 32,
      prizePool: Math.floor(prizePool / PRESET_LATAM_COUNTRIES.length) || 5000,
    }));
    setSubTournaments(stops);
  };

  // Preset 2: Multi-Game FGC Triad
  const applyPresetMultiGame = () => {
    setSubTournaments([
      {
        id: 'sub-t8',
        name: `${name} — Tekken 8 Premier (Master)`,
        country: country || 'PE',
        city: venueCity || 'Lima',
        gameSlug: 'tekken8',
        gameName: 'Tekken 8',
        format: 'two_stage',
        entrantCount: 32,
        prizePool: Math.floor(prizePool * 0.45) || 20000,
      },
      {
        id: 'sub-sf6',
        name: `${name} — Street Fighter 6 Open (Capcom Pro)`,
        country: country || 'PE',
        city: venueCity || 'Lima',
        gameSlug: 'sf6',
        gameName: 'Street Fighter 6',
        format: 'double_elimination',
        entrantCount: 32,
        prizePool: Math.floor(prizePool * 0.35) || 15000,
      },
      {
        id: 'sub-ggst',
        name: `${name} — Guilty Gear -Strive- Invitational`,
        country: country || 'PE',
        city: venueCity || 'Lima',
        gameSlug: 'ggst',
        gameName: 'Guilty Gear -Strive-',
        format: 'single_elimination',
        entrantCount: 16,
        prizePool: Math.floor(prizePool * 0.2) || 8000,
      },
    ]);
  };

  // Preset 3: Categorías Pro vs Amateur
  const applyPresetProAm = () => {
    const parentGame = ESPORTS_GAMES_CATALOG.find((g) => g.slug === gameSlug)?.name || 'Tekken 8';
    setSubTournaments([
      {
        id: 'sub-pro',
        name: `${name} — División Premier (Pro Showcase)`,
        country: country || 'PE',
        city: venueCity || 'Lima',
        gameSlug,
        gameName: parentGame,
        format: 'two_stage',
        entrantCount: 24,
        prizePool: Math.floor(prizePool * 0.8) || 40000,
      },
      {
        id: 'sub-challenger',
        name: `${name} — División Open Challenger (Amateur)`,
        country: country || 'PE',
        city: venueCity || 'Lima',
        gameSlug,
        gameName: parentGame,
        format: 'double_elimination',
        entrantCount: 32,
        prizePool: Math.floor(prizePool * 0.2) || 10000,
      },
    ]);
  };

  const handleAddCustomSubTournament = () => {
    if (!newSubName.trim()) return;
    const gName = ESPORTS_GAMES_CATALOG.find((g) => g.slug === newSubGameSlug)?.name || 'Tekken 8';
    const newEntry = {
      id: `sub_${Date.now().toString(36)}`,
      name: newSubName.trim(),
      country: newSubCountry,
      city: newSubCity.trim() || 'Online',
      gameSlug: newSubGameSlug,
      gameName: gName,
      format: newSubFormat,
      entrantCount: newSubEntrants,
      prizePool: newSubPrize,
    };
    setSubTournaments((prev) => [...prev, newEntry]);
    setNewSubName('');
  };

  const handleRemoveSubTournament = (id: string) => {
    setSubTournaments((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const gameMeta =
      ESPORTS_GAMES_CATALOG.find((g) => g.slug === gameSlug) || ESPORTS_GAMES_CATALOG[0];

    await onSubmit({
      name: name.trim(),
      gameName: gameMeta.name,
      gameSlug: gameMeta.slug,
      format,
      entrantCount,
      prizePool,
      hierarchyLevel,
      parentCircuitSlug: parentCircuitSlug || null,
      parentMacroEventSlug: parentMacroEventSlug || null,
      venueCity: venueCity.trim(),
      country: country.trim(),
      meetUrl: meetUrl.trim(),
      streamUrl: streamUrl.trim(),
      entryFee: isPaidEntry ? entryFee : 0,
      paymentInstructions: isPaidEntry ? paymentInstructions : '',
      subTournamentsList:
        hierarchyLevel !== 'TOURNAMENT'
          ? subTournaments.map((s) => ({
              name: s.name,
              country: s.country,
              city: s.city,
              gameSlug: s.gameSlug,
              gameName: s.gameName,
              format: s.format,
              entrantCount: s.entrantCount,
              prizePool: s.prizePool,
            }))
          : [],
      enableMatchCheckIn,
      matchCheckInTimeoutMinutes,
      enableAutoDq,
      doubleDqRule,
      losersBracketDqPenalty,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl shadow-sky-950/40 overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-900/90 to-sky-950/30 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center text-slate-950 shadow-lg shadow-sky-500/20">
              <Swords className="w-6 h-6 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 font-bold border border-sky-500/30">
                  OBF v1.0 Multi-Level Architecture
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Paso {currentStep} de 5
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight mt-0.5">
                Crear Torneo, Macro Evento o Circuito Mundial
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Navigation Bar */}
        <div className="grid grid-cols-5 text-xs font-semibold border-b border-slate-800/80 bg-slate-900/40">
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className={`py-3 px-2 sm:px-4 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              currentStep === 1
                ? 'border-sky-400 text-sky-400 bg-sky-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">1. Jerarquía</span>
            <span className="sm:hidden">1</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentStep(2)}
            className={`py-3 px-2 sm:px-4 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              currentStep === 2
                ? 'border-sky-400 text-sky-400 bg-sky-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">2. Formato OBF</span>
            <span className="sm:hidden">2</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentStep(3)}
            className={`py-3 px-2 sm:px-4 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              currentStep === 3
                ? 'border-amber-400 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">3. Sub-Torneos</span>
            <span className="sm:hidden">3</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentStep(4)}
            className={`py-3 px-2 sm:px-4 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              currentStep === 4
                ? 'border-emerald-400 text-emerald-400 bg-emerald-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">4. Check-In & DQ</span>
            <span className="sm:hidden">4</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentStep(5)}
            className={`py-3 px-2 sm:px-4 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
              currentStep === 5
                ? 'border-indigo-400 text-indigo-400 bg-indigo-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">5. Tesorería</span>
            <span className="sm:hidden">5</span>
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmitForm} className="p-5 sm:p-6 space-y-6 max-h-[68vh] overflow-y-auto">
          {/* =========================================================================
              PASO 1: SELECCIÓN DE NIVEL JERÁRQUICO
             ========================================================================= */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-sky-400" />
                  <span>Selecciona el Nivel Jerárquico de la Competición</span>
                </h3>
                <p className="text-xs text-slate-400">
                  nikBrackets Pro soporta desde torneos rápidos de fin de semana hasta circuitos mundiales (tipo Tekken World Tour o Capcom Pro Tour) con paradas por país o categorías de juego.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Nivel 1: Circuito 6M */}
                <div
                  onClick={() => setHierarchyLevel('CIRCUIT')}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    hierarchyLevel === 'CIRCUIT'
                      ? 'border-sky-400 bg-sky-500/10 shadow-lg shadow-sky-500/10'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                        <Flame className="w-4 h-4" />
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-400/10 text-sky-400 font-bold border border-sky-400/30">
                        NIVEL 1
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Circuito Mundial / Temporada 6M</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Agrupa 8 a 12 paradas quincenales. Incluye Season Leaderboard, descarte Best-of-X y clasificación al Season Finals Top 8 / Top 16.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] font-mono text-sky-300">
                    Ej: Latam FGC Pro Circuit 2026
                  </div>
                </div>

                {/* Nivel 2: Macro Evento Multi-Torneo / Paradas por País */}
                <div
                  onClick={() => setHierarchyLevel('MACRO_EVENT')}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    hierarchyLevel === 'MACRO_EVENT'
                      ? 'border-amber-400 bg-amber-500/10 shadow-lg shadow-amber-500/10'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                        <Globe className="w-4 h-4" />
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 font-bold border border-amber-400/30">
                        NIVEL 2 (RECOMENDADO)
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Macro Evento con Sub-Torneos</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Contenedor paraguas que agrupa sub-torneos por país (Perú, Colombia, México, Chile) o múltiples juegos (Tekken 8, SF6, Valorant) en un solo Hub.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] font-mono text-amber-300">
                    Ej: Tekken World Tour - Paradas Latam
                  </div>
                </div>

                {/* Nivel 3: Torneo Individual */}
                <div
                  onClick={() => setHierarchyLevel('TOURNAMENT')}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    hierarchyLevel === 'TOURNAMENT'
                      ? 'border-indigo-400 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                        <Swords className="w-4 h-4" />
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-400/10 text-indigo-400 font-bold border border-indigo-400/30">
                        NIVEL 3
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Torneo / Categoría Individual</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Competición directa individual con bracket DAG O(1) dedicado (o asignado como sub-torneo dentro de un Macro Evento ya creado).
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] font-mono text-indigo-300">
                    Ej: TWT Parada Perú Qualifier
                  </div>
                </div>
              </div>

              {/* Vinculación opcional a un Circuito o Macro Evento Padre si es Nivel 2 o 3 */}
              {hierarchyLevel !== 'CIRCUIT' && existingCircuits.length > 0 && (
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2 text-xs">
                  <label className="block text-slate-300 font-semibold flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-sky-400" />
                    <span>¿Vincular a un Circuito de Temporada existente? (Opcional)</span>
                  </label>
                  <select
                    value={parentCircuitSlug}
                    onChange={(e) => setParentCircuitSlug(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white text-xs"
                  >
                    <option value="">Ninguno (Independiente / No suma puntos a Circuito)</option>
                    {existingCircuits.map((c) => (
                      <option key={c.tournamentSlug} value={c.tournamentSlug}>
                        {c.name} ({c.gameName})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {hierarchyLevel === 'TOURNAMENT' && existingMacroEvents.length > 0 && (
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-2 text-xs">
                  <label className="block text-slate-300 font-semibold flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-amber-400" />
                    <span>¿Vincular como Sub-Torneo a un Macro Evento existente? (Opcional)</span>
                  </label>
                  <select
                    value={parentMacroEventSlug}
                    onChange={(e) => setParentMacroEventSlug(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white text-xs"
                  >
                    <option value="">Ninguno (Torneo Independiente Principal)</option>
                    {existingMacroEvents.map((m) => (
                      <option key={m.tournamentSlug} value={m.tournamentSlug}>
                        {m.name} ({m.gameName})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              PASO 2: DATOS GENERALES, JUEGO Y FORMATO OBF
             ========================================================================= */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-150 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nombre Oficial del Torneo / Evento / Circuito
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Tekken World Tour 2026 — Master Series Latam"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Título eSports Oficial</label>
                  <select
                    value={gameSlug}
                    onChange={(e) => setGameSlug(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white"
                  >
                    {ESPORTS_GAMES_CATALOG.map((g) => (
                      <option key={g.slug} value={g.slug}>
                        {g.name} ({g.genre})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Formato Competitivo OBF v1.0</label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as TournamentFormat)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white"
                  >
                    <option value="two_stage">Two-Stage (Suizo + Doble Eliminación + 2nd Chance)</option>
                    <option value="double_elimination">Doble Eliminación (Winners + Losers + GF Reset)</option>
                    <option value="single_elimination">Eliminación Directa (Single Elimination + 3er Puesto)</option>
                    <option value="swiss">Sistema Suizo Puro (Sin Revanchas + Buchholz)</option>
                    <option value="round_robin">Round Robin (Todos vs Todos · Berger)</option>
                    <option value="compass_draw">Compass Draw (8 Puntos Cardinales · 3 Partidos Garantizados)</option>
                    <option value="free_for_all">Free-For-All (Lobbies de 4 · Top 2 Avanza)</option>
                    <option value="leaderboard">Leaderboard / Time Trial Continuo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Cupo de Participantes</label>
                  <select
                    value={entrantCount}
                    onChange={(e) => setEntrantCount(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 font-mono text-white"
                  >
                    <option value={4}>4 Competidores (Top 4 Directo)</option>
                    <option value={8}>8 Competidores (Clásico Pro)</option>
                    <option value={12}>12 Competidores (Guilty Gear Showcase)</option>
                    <option value={16}>16 Competidores (Capcom Pro Standard)</option>
                    <option value={24}>24 Competidores (Two-Stage 3D Showcase)</option>
                    <option value={32}>32 Competidores (Major Bracket)</option>
                    <option value={48}>48 Competidores (Mega Showcase)</option>
                    <option value={64}>64 Competidores (Regional Qualifier)</option>
                    <option value={128}>128 Competidores (Grand National)</option>
                    <option value={256}>256 Competidores (Super Major)</option>
                    <option value={3072}>3,072 Competidores (Arquitectura Masiva: 128 Pools & Waves A-H)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Bolsa de Premios (USD Prize Pool)</label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={prizePool}
                    onChange={(e) => setPrizePool(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">País Sede</label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white"
                  >
                    <option value="PE">🇵🇪 Perú</option>
                    <option value="CO">🇨🇴 Colombia</option>
                    <option value="MX">🇲🇽 México</option>
                    <option value="CL">🇨🇱 Chile</option>
                    <option value="AR">🇦🇷 Argentina</option>
                    <option value="BR">🇧🇷 Brasil</option>
                    <option value="US">🇺🇸 Estados Unidos</option>
                    <option value="JP">🇯🇵 Japón</option>
                    <option value="ONLINE">🌐 Online / Global Rollback</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Ciudad / Venue</label>
                  <input
                    type="text"
                    value={venueCity}
                    onChange={(e) => setVenueCity(e.target.value)}
                    placeholder="Ej: Lima / Arena Movistar"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              PASO 3: SUB-TORNEOS / PARADAS POR PAÍS O CATEGORÍAS (MACRO EVENTOS)
             ========================================================================= */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-150 text-xs">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                  <Globe className="w-4 h-4" />
                  <span>Sub-Torneos Contenidos dentro de este Evento</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Configura las paradas por país (ej. Tekken World Tour Perú, Colombia, México, Chile) o las divisiones/juegos que pertenecerán a este Macro Evento. El backend creará los cuadros automáticamente y los vinculará entre sí.
                </p>
              </div>

              {/* Botones de Presets Rápidos */}
              <div className="space-y-1.5">
                <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  Cargar Plantilla con 1 Clic (Presets Oficiales):
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={applyPresetLatamCountries}
                    className="px-3 py-1.5 rounded-xl border border-sky-500/40 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>🇵🇪🇨🇴🇲🇽🇨🇱 6 Paradas por Países Latam</span>
                  </button>

                  <button
                    type="button"
                    onClick={applyPresetMultiGame}
                    className="px-3 py-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Gamepad2 className="w-3.5 h-3.5" />
                    <span>Multi-Game FGC (Tekken 8 + SF6 + GGST)</span>
                  </button>

                  <button
                    type="button"
                    onClick={applyPresetProAm}
                    className="px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    <span>División Premier Pro + Open Challenger</span>
                  </button>
                </div>
              </div>

              {/* Lista de Sub-Torneos Actuales */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-slate-300 font-semibold">
                  <span>Sub-Torneos Configurados ({subTournaments.length}):</span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Total Cupos: {subTournaments.reduce((acc, s) => acc + s.entrantCount, 0)}
                  </span>
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {subTournaments.map((sub, idx) => (
                    <div
                      key={sub.id}
                      className="p-3 rounded-xl border border-slate-800 bg-slate-900/80 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-mono font-bold text-sky-400 text-xs">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate text-xs">{sub.name}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2 font-mono">
                            <span>📍 {sub.city} ({sub.country})</span>
                            <span>•</span>
                            <span className="text-amber-400">{sub.gameName}</span>
                            <span>•</span>
                            <span className="text-sky-400">{sub.format}</span>
                            <span>•</span>
                            <span>{sub.entrantCount} Jugadores</span>
                            <span>•</span>
                            <span className="text-emerald-400">${sub.prizePool.toLocaleString()} USD</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveSubTournament(sub.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                        title="Eliminar este sub-torneo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {subTournaments.length === 0 && (
                    <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                      No hay sub-torneos definidos. Usa los botones de plantilla arriba o añade uno manualmente.
                    </div>
                  )}
                </div>
              </div>

              {/* Añadir Nuevo Sub-Torneo Manual */}
              <div className="p-3.5 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-2.5">
                <div className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-sky-400" />
                  <span>Añadir Sub-Torneo o Parada Específica</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={newSubName}
                      onChange={(e) => setNewSubName(e.target.value)}
                      placeholder="Nombre del Sub-Torneo (ej. TWT Parada Brasil Masters)"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-white text-xs"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={newSubCity}
                      onChange={(e) => setNewSubCity(e.target.value)}
                      placeholder="Ciudad (ej. São Paulo)"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-white text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <select
                      value={newSubGameSlug}
                      onChange={(e) => setNewSubGameSlug(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-white text-xs"
                    >
                      {ESPORTS_GAMES_CATALOG.map((g) => (
                        <option key={g.slug} value={g.slug}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <select
                      value={newSubFormat}
                      onChange={(e) => setNewSubFormat(e.target.value as TournamentFormat)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-white text-xs"
                    >
                      <option value="two_stage">Two-Stage</option>
                      <option value="double_elimination">Doble Elim</option>
                      <option value="single_elimination">Single Elim</option>
                      <option value="swiss">Suizo</option>
                      <option value="round_robin">Round Robin</option>
                      <option value="compass_draw">Compass Draw</option>
                    </select>
                  </div>
                  <div>
                    <select
                      value={newSubEntrants}
                      onChange={(e) => setNewSubEntrants(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-white text-xs"
                    >
                      <option value={8}>8 Jugadores</option>
                      <option value={16}>16 Jugadores</option>
                      <option value={24}>24 Jugadores</option>
                      <option value={32}>32 Jugadores</option>
                      <option value={64}>64 Jugadores</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCustomSubTournament}
                    className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-colors"
                  >
                    + Añadir Parada
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              PASO 4: CHECK-IN POR PELEA, AUTO-DQ & POLÍTICAS
             ========================================================================= */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-in fade-in duration-150 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-900 cursor-pointer hover:border-slate-700 transition-colors">
                  <div>
                    <div className="font-bold text-white">Habilitar Check-In por Pelea</div>
                    <div className="text-[11px] text-slate-400">
                      Ambos jugadores deben confirmar presencia antes de jugar
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableMatchCheckIn}
                    onChange={(e) => setEnableMatchCheckIn(e.target.checked)}
                    className="h-4 w-4 accent-amber-400"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-900 cursor-pointer hover:border-slate-700 transition-colors">
                  <div>
                    <div className="font-bold text-white">Auto-DQ por Incomparecencia</div>
                    <div className="text-[11px] text-slate-400">
                      Descalifica en automático si vence el temporizador SLA
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableAutoDq}
                    onChange={(e) => setEnableAutoDq(e.target.checked)}
                    className="h-4 w-4 accent-amber-400"
                  />
                </label>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Tiempo Límite de Check-In</span>
                  <span className="font-mono font-bold text-amber-400 text-sm">
                    {matchCheckInTimeoutMinutes} minutos
                  </span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={30}
                  step={1}
                  value={matchCheckInTimeoutMinutes}
                  onChange={(e) => setMatchCheckInTimeoutMinutes(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>2m (Rápido)</span>
                  <span>5m (Estándar FGC)</span>
                  <span>15m (Torneo Abierto)</span>
                  <span>30m (Máximo)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Acción ante Descalificación Doble (Double DQ)
                  </label>
                  <select
                    value={doubleDqRule}
                    onChange={(e) => setDoubleDqRule(e.target.value as DoubleDqRule)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  >
                    <option value="AUTO_BYE_NEXT_ROUND">
                      AUTO_BYE_NEXT_ROUND (Pase directo BYE al rival siguiente)
                    </option>
                    <option value="RANDOM_COIN_FLIP">
                      RANDOM_COIN_FLIP (Sorteo aleatorio 2-0)
                    </option>
                    <option value="PAUSE_FOR_ADMIN">
                      PAUSE_FOR_ADMIN (Congelar set y alertar al Árbitro)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Penalidad en Losers Bracket
                  </label>
                  <select
                    value={losersBracketDqPenalty}
                    onChange={(e) => setLosersBracketDqPenalty(e.target.value as LosersBracketDqPenalty)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  >
                    <option value="DROP_TO_LOSERS">
                      DROP_TO_LOSERS (Cae a Losers normalmente si fue en Winners)
                    </option>
                    <option value="ELIMINATE_FROM_EVENT">
                      ELIMINATE_FROM_EVENT (Expulsión total de todo el evento)
                    </option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              PASO 5: TESORERÍA QR, CUOTA & SALAS VIRTUALES
             ========================================================================= */}
          {currentStep === 5 && (
            <div className="space-y-4 animate-in fade-in duration-150 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-900 cursor-pointer">
                  <div>
                    <div className="font-bold text-white">Inscripción Arancelada / De Pago</div>
                    <div className="text-[11px] text-slate-400">
                      Requiere comprobante QR antes de aprobar participación
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isPaidEntry}
                    onChange={(e) => setIsPaidEntry(e.target.checked)}
                    className="h-4 w-4 accent-sky-400"
                  />
                </label>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Costo de Entrada / Entry Fee (USD)
                  </label>
                  <input
                    type="number"
                    disabled={!isPaidEntry}
                    min={0}
                    step={5}
                    value={entryFee}
                    onChange={(e) => setEntryFee(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-white disabled:opacity-40"
                  />
                </div>
              </div>

              {isPaidEntry && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Instrucciones de Pago QR / Cuentas Bancarias
                  </label>
                  <textarea
                    rows={2}
                    value={paymentInstructions}
                    onChange={(e) => setPaymentInstructions(e.target.value)}
                    placeholder="Ej: Yape / Nequi / MercadoPago / Binance USDT al +51 987 654 321"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-white"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-rose-400" />
                    <span>Lobby Virtual (Google Meet / Discord)</span>
                  </label>
                  <input
                    type="url"
                    value={meetUrl}
                    onChange={(e) => setMeetUrl(e.target.value)}
                    placeholder="https://meet.google.com/xxx-yyyy-zzz"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Transmisión Oficial (Twitch / YouTube Stream)</span>
                  </label>
                  <input
                    type="url"
                    value={streamUrl}
                    onChange={(e) => setStreamUrl(e.target.value)}
                    placeholder="https://twitch.tv/canaldeltorneo"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-900 transition-colors"
            >
              Cancelar
            </button>

            <div className="flex items-center gap-2">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-900 flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Anterior</span>
                </button>
              )}

              {currentStep < 5 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((prev) => (prev + 1) as any)}
                  className="px-5 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-sky-500/20 transition-all"
                >
                  <span>Siguiente</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-400 via-indigo-400 to-emerald-400 hover:opacity-90 text-slate-950 text-xs font-black flex items-center gap-2 shadow-lg shadow-sky-500/25 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                      <span>Generando Estructura OBF...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 stroke-[2.5]" />
                      <span>
                        Generar {hierarchyLevel === 'CIRCUIT' ? 'Circuito' : hierarchyLevel === 'MACRO_EVENT' ? 'Macro Evento' : 'Torneo'} OBF
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
