/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Módulo de Jerarquía de Ligas / Circuitos de Larga Duración (6 Meses)
 * y Gestión Eficiente de Torneos Masivos (3,000+ Participantes: Waves, 64 Pools,
 * Check-In Escalonado BullMQ, Virtualización 3D Frustum Culling & Delegación de Pool Captains).
 */

import React, { useMemo, useState } from 'react';
import {
  INITIAL_24_ENTRANTS_TEKKEN,
  OBFDocument,
  OBFEntrant,
  StandingsRow,
} from '../engine/nikBracketsEngine';
import {
  Activity,
  Award,
  Box,
  Calendar,
  CheckCircle2,
  Clock,
  Cpu,
  Flame,
  Layers,
  Play,
  Search,
  ShieldCheck,
  Sliders,
  Sparkles,
  Swords,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';

export interface CircuitPointsRuleMap {
  '1st': number;
  '2nd': number;
  '3rd': number;
  '4th': number;
  '5th': number;
  '7th': number;
  '9th': number;
  '13th': number;
}

export interface CircuitEventStopResult {
  stopNumber: number; // 1..12
  tournamentSlug: string;
  tournamentName: string;
  date: string;
  completed: boolean;
  placements: Array<{
    entrantID: string;
    entrantTag: string;
    placement: number;
    pointsEarned: number;
    dayWins: number;
    dayLosses: number;
    characterUsed: string;
    eloAfterStop: number;
  }>;
}

export interface HeadToHeadMatchRecord {
  stopNumber: number;
  date: string;
  tournamentName: string;
  roundLabel: string;
  entrant1ID: string;
  entrant2ID: string;
  score1: number;
  score2: number;
  winnerID: string;
  char1: string;
  char2: string;
}

export interface SeasonCircuitModel {
  id: string;
  name: string;
  slug: string;
  gameSlug: string;
  gameName: string;
  startDate: string;
  endDate: string;
  totalStops: number;
  bestXEvents: number; // Regla de Descarte (Best of X Drops, ej: mejores 8 de 12)
  finalsTopCut: 8 | 16; // Clasificación automática Top 8 o Top 16 a Season Finals
  pointsRules: CircuitPointsRuleMap;
  stops: CircuitEventStopResult[];
  headToHeadHistory: HeadToHeadMatchRecord[];
}

export interface MassivePoolDefinition {
  poolCode: string; // "A1" .. "D16"
  waveCode: 'WAVE_A' | 'WAVE_B' | 'WAVE_C' | 'WAVE_D';
  waveLabel: string;
  startTime: string;
  checkInOpensAt: string;
  stationZone: string;
  entrantsCount: number;
  checkedInCount: number;
  autoDqCount: number;
  completedSets: number;
  totalSets: number;
  captainRefereeName: string;
  captainRefereeHandle: string;
  winnersQualifierTag: string;
  losersQualifierTag: string;
  sampleEntrants: Array<{
    entrantID: string;
    gamerTag: string;
    seed: number;
    elo: number;
    mainCharacter: string;
    platform: string;
    waveCheckedIn: boolean;
    status: 'READY' | 'CHECKED_IN' | 'AUTO_DQ' | 'QUALIFIED_TOP128';
  }>;
}

interface CircuitsAndMassiveScaleViewProps {
  obf: OBFDocument;
  standings: StandingsRow[];
  onSelectPoolFor3DCanvas: (poolCode: string, waveCode: string) => void;
  onGenerateSeasonFinalsTournament: (
    circuitName: string,
    topCut: 8 | 16,
    qualifiedTags: string[]
  ) => void;
}

const DEFAULT_POINTS_RULES: CircuitPointsRuleMap = {
  '1st': 100,
  '2nd': 75,
  '3rd': 60,
  '4th': 40,
  '5th': 25,
  '7th': 15,
  '9th': 10,
  '13th': 5,
};

function pointsForPlacement(place: number, rules: CircuitPointsRuleMap): number {
  if (place === 1) return rules['1st'];
  if (place === 2) return rules['2nd'];
  if (place === 3) return rules['3rd'];
  if (place === 4) return rules['4th'];
  if (place <= 6) return rules['5th'];
  if (place <= 8) return rules['7th'];
  if (place <= 12) return rules['9th'];
  return rules['13th'];
}

function buildInitialSeasonCircuits(): SeasonCircuitModel[] {
  const proEntrants: OBFEntrant[] = INITIAL_24_ENTRANTS_TEKKEN.slice(0, 16);
  const stopDates = [
    '2026-05-15',
    '2026-05-30',
    '2026-06-15',
    '2026-06-30',
    '2026-07-15',
    '2026-07-30',
    '2026-08-15',
    '2026-08-30',
    '2026-09-15',
    '2026-09-30',
    '2026-10-15',
    '2026-10-30',
  ];

  const altChars = [
    'Sergei Dragunov',
    'Jin Kazama',
    'Reina',
    'Bryan Fury',
    'Kazuya Mishima',
    'Azucena',
    'feng Wei',
    'Nina Williams',
  ];

  const stops: CircuitEventStopResult[] = stopDates.map((date, idx) => {
    const stopNumber = idx + 1;
    const completed = stopNumber <= 10; // 10 fechas completadas, 2 en curso/próximas
    const rotated = [...proEntrants].sort((a, b) => {
      const scoreA = ((a.initialSeed * 7 + stopNumber * 13) % 19) + (a.initialSeed <= 6 ? -4 : 2);
      const scoreB = ((b.initialSeed * 7 + stopNumber * 13) % 19) + (b.initialSeed <= 6 ? -4 : 2);
      return scoreA - scoreB;
    });

    const placements = rotated.map((ent, pIdx) => {
      const placement = pIdx + 1;
      const pts = completed ? pointsForPlacement(placement, DEFAULT_POINTS_RULES) : 0;
      const dayWins = completed ? Math.max(1, 7 - Math.floor(pIdx / 2)) : 0;
      const dayLosses = completed ? (placement === 1 ? 0 : placement === 2 ? 2 : 2) : 0;
      const charUsed =
        stopNumber % 4 === 0
          ? altChars[(pIdx + stopNumber) % altChars.length]
          : ent.mainCharacter || 'Jin Kazama';
      const eloDelta = completed ? (8 - pIdx) * 6 : 0;

      return {
        entrantID: ent.entrantID,
        entrantTag: ent.entrantTag,
        placement,
        pointsEarned: pts,
        dayWins,
        dayLosses,
        characterUsed: charUsed,
        eloAfterStop: ent.eloRating + eloDelta * Math.min(stopNumber, 6),
      };
    });

    return {
      stopNumber,
      tournamentSlug: `cpt-latam-2026-stop-${stopNumber}`,
      tournamentName: `Torneo Fecha #${stopNumber} (${date})`,
      date,
      completed,
      placements,
    };
  });

  // Historial Head-to-Head acumulado a lo largo de los 6 meses
  const h2h: HeadToHeadMatchRecord[] = [];
  for (let i = 0; i < 10; i++) {
    const stop = stops[i];
    const pA = proEntrants[0]; // Arslan Ash
    const pB = proEntrants[1]; // Knee
    const pC = proEntrants[2]; // Chikurin
    const pD = proEntrants[3]; // Atif Butt

    const aWins = i % 3 !== 1;
    h2h.push({
      stopNumber: stop.stopNumber,
      date: stop.date,
      tournamentName: stop.tournamentName,
      roundLabel: i % 2 === 0 ? 'Winners Final' : 'Grand Final',
      entrant1ID: pA.entrantID,
      entrant2ID: pB.entrantID,
      score1: aWins ? 3 : 2,
      score2: aWins ? 1 : 3,
      winnerID: aWins ? pA.entrantID : pB.entrantID,
      char1: pA.mainCharacter || 'Nina Williams',
      char2: pB.mainCharacter || 'Bryan Fury',
    });

    const cWins = i % 2 === 0;
    h2h.push({
      stopNumber: stop.stopNumber,
      date: stop.date,
      tournamentName: stop.tournamentName,
      roundLabel: 'Losers Semifinal',
      entrant1ID: pC.entrantID,
      entrant2ID: pD.entrantID,
      score1: cWins ? 3 : 1,
      score2: cWins ? 2 : 3,
      winnerID: cWins ? pC.entrantID : pD.entrantID,
      char1: pC.mainCharacter || 'Lili',
      char2: pD.mainCharacter || 'Sergei Dragunov',
    });

    if (i % 2 === 0) {
      h2h.push({
        stopNumber: stop.stopNumber,
        date: stop.date,
        tournamentName: stop.tournamentName,
        roundLabel: 'Winners Semifinal',
        entrant1ID: pA.entrantID,
        entrant2ID: pC.entrantID,
        score1: 3,
        score2: 1,
        winnerID: pA.entrantID,
        char1: pA.mainCharacter || 'Nina Williams',
        char2: pC.mainCharacter || 'Lili',
      });
    }
  }

  return [
    {
      id: 'circuit-twt-latam-2026',
      name: 'Tekken World Tour 2026 — Circuito Regional Latam North (6 Meses)',
      slug: 'twt-latam-north-2026',
      gameSlug: 'tekken8',
      gameName: 'Tekken 8',
      startDate: '2026-05-15',
      endDate: '2026-11-15',
      totalStops: 12,
      bestXEvents: 8,
      finalsTopCut: 8,
      pointsRules: DEFAULT_POINTS_RULES,
      stops,
      headToHeadHistory: h2h,
    },
    {
      id: 'circuit-cpt-ww-2026',
      name: 'Capcom Pro Tour World Warrior 2026 — Latam North (6 Meses)',
      slug: 'cpt-world-warrior-latam-2026',
      gameSlug: 'sf6',
      gameName: 'Street Fighter 6',
      startDate: '2026-05-01',
      endDate: '2026-11-01',
      totalStops: 12,
      bestXEvents: 8,
      finalsTopCut: 8,
      pointsRules: DEFAULT_POINTS_RULES,
      stops: stops.map((s) => ({
        ...s,
        tournamentSlug: `cpt-sf6-stop-${s.stopNumber}`,
      })),
      headToHeadHistory: h2h,
    },
  ];
}

function buildMassive64Pools(): MassivePoolDefinition[] {
  const waves: Array<{
    code: 'WAVE_A' | 'WAVE_B' | 'WAVE_C' | 'WAVE_D';
    prefix: 'A' | 'B' | 'C' | 'D';
    label: string;
    startTime: string;
    checkInOpensAt: string;
  }> = [
    {
      code: 'WAVE_A',
      prefix: 'A',
      label: 'Ola A (10:00 AM)',
      startTime: '10:00 AM',
      checkInOpensAt: '09:30 AM (30m antes)',
    },
    {
      code: 'WAVE_B',
      prefix: 'B',
      label: 'Ola B (12:00 PM)',
      startTime: '12:00 PM',
      checkInOpensAt: '11:30 AM (30m antes)',
    },
    {
      code: 'WAVE_C',
      prefix: 'C',
      label: 'Ola C (02:00 PM)',
      startTime: '02:00 PM',
      checkInOpensAt: '01:30 PM (30m antes)',
    },
    {
      code: 'WAVE_D',
      prefix: 'D',
      label: 'Ola D (04:00 PM)',
      startTime: '04:00 PM',
      checkInOpensAt: '03:30 PM (30m antes)',
    },
  ];

  const refereeRoster = [
    { name: 'Árbitro Juan Mendoza', handle: '@RefJuan_FGC' },
    { name: 'Árbitra Sofía Vargas', handle: '@SofiaTO_Latam' },
    { name: 'Cap. Diego Morales', handle: '@DiegoPoolCap' },
    { name: 'Cap. Valentina Ríos', handle: '@ValenReferee' },
    { name: 'Árbitro Carlos Ruiz', handle: '@CarlosBracket' },
    { name: 'Árbitra Elena Castro', handle: '@ElenaJudgeFGC' },
    { name: 'Cap. Mateo Silva', handle: '@MateoPoolOps' },
    { name: 'Cap. Camila Herrera', handle: '@CamilaTO_Pro' },
  ];

  const characters = [
    'Sergei Dragunov',
    'Jin Kazama',
    'Reina',
    'Bryan Fury',
    'Nina Williams',
    'Kazuya Mishima',
    'Lili',
    'King',
  ];

  const platforms = ['PS5', 'PC_STEAM', 'XBOX_SERIES'];
  const pools: MassivePoolDefinition[] = [];

  let globalPlayerIndex = 1;
  for (const w of waves) {
    for (let i = 1; i <= 16; i++) {
      const poolCode = `${w.prefix}${i}`;
      const ref = refereeRoster[(i - 1) % refereeRoster.length];
      const entrantsCount = 48; // 64 Pools * 48 = 3,072 jugadores
      const isWaveADone = w.code === 'WAVE_A';
      const isWaveBActive = w.code === 'WAVE_B';
      const autoDqCount = isWaveADone ? 3 + (i % 3) : isWaveBActive ? 2 : 0;
      const checkedInCount = isWaveADone
        ? entrantsCount - autoDqCount
        : isWaveBActive
        ? 44
        : 38 + (i % 8);

      const sampleEntrants: MassivePoolDefinition['sampleEntrants'] = [];
      for (let p = 1; p <= 8; p++) {
        const seed = globalPlayerIndex++;
        const basePro = INITIAL_24_ENTRANTS_TEKKEN[(seed - 1) % INITIAL_24_ENTRANTS_TEKKEN.length];
        const tag =
          p === 1
            ? `${basePro.entrantTag}_${poolCode}`
            : p === 2
            ? `Challenger_${poolCode}_${p}`
            : `FGC_${poolCode}_Player${seed}`;
        const isDq = p === 8 && autoDqCount > 0;
        sampleEntrants.push({
          entrantID: `massive-ent-${poolCode}-${p}`,
          gamerTag: tag,
          seed,
          elo: 2150 - p * 45 + (i % 5) * 12,
          mainCharacter: characters[(seed + p) % characters.length],
          platform: platforms[(seed + p) % platforms.length],
          waveCheckedIn: !isDq,
          status: isDq
            ? 'AUTO_DQ'
            : isWaveADone && p <= 2
            ? 'QUALIFIED_TOP128'
            : 'CHECKED_IN',
        });
      }

      pools.push({
        poolCode,
        waveCode: w.code,
        waveLabel: w.label,
        startTime: w.startTime,
        checkInOpensAt: w.checkInOpensAt,
        stationZone: `Zona ${w.prefix} · Estaciones ${String((i - 1) * 2 + 1).padStart(
          2,
          '0'
        )}-${String(i * 2).padStart(2, '0')}`,
        entrantsCount,
        checkedInCount,
        autoDqCount,
        completedSets: isWaveADone ? 94 : isWaveBActive ? 52 : 0,
        totalSets: 94,
        captainRefereeName: ref.name,
        captainRefereeHandle: ref.handle,
        winnersQualifierTag: sampleEntrants[0].gamerTag,
        losersQualifierTag: sampleEntrants[1].gamerTag,
        sampleEntrants,
      });
    }
  }

  return pools;
}

export const CircuitsAndMassiveScaleView: React.FC<CircuitsAndMassiveScaleViewProps> = ({
  obf,
  standings,
  onSelectPoolFor3DCanvas,
  onGenerateSeasonFinalsTournament,
}) => {
  const [subTab, setSubTab] = useState<'circuits' | 'stats' | 'massive3000'>('circuits');

  // Estado de Ligas / Circuitos de 6 Meses
  const [circuits, setCircuits] = useState<SeasonCircuitModel[]>(() =>
    buildInitialSeasonCircuits()
  );
  const [activeCircuitSlug, setActiveCircuitSlug] = useState<string>('twt-latam-north-2026');
  const [selectedStopNumber, setSelectedStopNumber] = useState<number>(10);
  const [h2hPlayer1ID, setH2hPlayer1ID] = useState<string>(
    INITIAL_24_ENTRANTS_TEKKEN[0].entrantID
  );
  const [h2hPlayer2ID, setH2hPlayer2ID] = useState<string>(
    INITIAL_24_ENTRANTS_TEKKEN[1].entrantID
  );
  const [selectedPlayerForMeta, setSelectedPlayerForMeta] = useState<string>(
    INITIAL_24_ENTRANTS_TEKKEN[0].entrantID
  );

  // Estado de Torneos Masivos (3,072 Participantes en 4 Olas y 64 Pools)
  const [massivePools, setMassivePools] = useState<MassivePoolDefinition[]>(() =>
    buildMassive64Pools()
  );
  const [selectedWaveFilter, setSelectedWaveFilter] = useState<
    'ALL' | 'WAVE_A' | 'WAVE_B' | 'WAVE_C' | 'WAVE_D'
  >('WAVE_A');
  const [selectedPoolCode, setSelectedPoolCode] = useState<string>('A1');
  const [massiveSearchQuery, setMassiveSearchQuery] = useState<string>('');
  const [batchWorkerStatus, setBatchWorkerStatus] = useState<{
    lastWaveProcessed: string;
    dqProcessedCount: number;
    executionTimeMs: number;
    redisReadLatencyMs: number;
    postgresWriteBehindBatches: number;
  }>({
    lastWaveProcessed: 'WAVE_A (Pools A1-A16)',
    dqProcessedCount: 54,
    executionTimeMs: 14.2,
    redisReadLatencyMs: 0.42,
    postgresWriteBehindBatches: 4,
  });
  const [newRefereeAssignee, setNewRefereeAssignee] = useState<string>('');

  const activeCircuit = useMemo(
    () => circuits.find((c) => c.slug === activeCircuitSlug) || circuits[0],
    [circuits, activeCircuitSlug]
  );

  // Cálculo de la Tabla de Posiciones General de la Temporada (CircuitStanding) con Regla Best of X Drops
  const circuitStandings = useMemo(() => {
    const playerMap = new Map<
      string,
      {
        entrantID: string;
        entrantTag: string;
        stopScores: Array<{ stopNumber: number; points: number; placement: number; dropped?: boolean }>;
        tournamentsWon: number;
        eventsPlayed: number;
        totalWins: number;
        totalLosses: number;
        latestElo: number;
        eloHistory: Array<{ stopNumber: number; elo: number }>;
      }
    >();

    for (const stop of activeCircuit.stops) {
      if (!stop.completed) continue;
      for (const p of stop.placements) {
        const cur = playerMap.get(p.entrantID) || {
          entrantID: p.entrantID,
          entrantTag: p.entrantTag,
          stopScores: [],
          tournamentsWon: 0,
          eventsPlayed: 0,
          totalWins: 0,
          totalLosses: 0,
          latestElo: p.eloAfterStop,
          eloHistory: [],
        };
        cur.stopScores.push({
          stopNumber: stop.stopNumber,
          points: p.pointsEarned,
          placement: p.placement,
        });
        cur.eventsPlayed += 1;
        if (p.placement === 1) cur.tournamentsWon += 1;
        cur.totalWins += p.dayWins;
        cur.totalLosses += p.dayLosses;
        cur.latestElo = p.eloAfterStop;
        cur.eloHistory.push({ stopNumber: stop.stopNumber, elo: p.eloAfterStop });
        playerMap.set(p.entrantID, cur);
      }
    }

    const bestX = activeCircuit.bestXEvents;
    const rows = Array.from(playerMap.values()).map((item) => {
      // Ordenar puntos de mayor a menor para aplicar Best of X Drops
      const sortedByPoints = [...item.stopScores].sort((a, b) => b.points - a.points);
      const keptStopNumbers = new Set(
        sortedByPoints.slice(0, bestX).map((s) => s.stopNumber)
      );

      const enrichedStops = item.stopScores.map((s) => ({
        ...s,
        dropped: !keptStopNumbers.has(s.stopNumber),
      }));

      const grossPoints = item.stopScores.reduce((acc, s) => acc + s.points, 0);
      const totalPoints = enrichedStops
        .filter((s) => !s.dropped)
        .reduce((acc, s) => acc + s.points, 0);

      return {
        ...item,
        stopScores: enrichedStops,
        grossPoints,
        totalPoints,
        droppedPoints: grossPoints - totalPoints,
        seasonWinratePct:
          item.totalWins + item.totalLosses > 0
            ? Math.round((item.totalWins / (item.totalWins + item.totalLosses)) * 100)
            : 0,
      };
    });

    rows.sort(
      (a, b) =>
        b.totalPoints - a.totalPoints ||
        b.tournamentsWon - a.tournamentsWon ||
        b.grossPoints - a.grossPoints
    );

    return rows.map((r, index) => ({
      ...r,
      rankPosition: index + 1,
      qualifiedFinals: index + 1 <= activeCircuit.finalsTopCut,
    }));
  }, [activeCircuit]);

  // Simular una nueva fecha quincenal en el circuito activo
  const handleSimulateNextCircuitStop = () => {
    setCircuits((prev) =>
      prev.map((c) => {
        if (c.slug !== activeCircuit.slug) return c;
        const nextPending = c.stops.find((s) => !s.completed);
        if (!nextPending) return c;

        const updatedStops = c.stops.map((s) => {
          if (s.stopNumber !== nextPending.stopNumber) return s;
          // Tomar posiciones actuales del torneo en vivo si están disponibles
          const placements = s.placements.map((pl, idx) => {
            const liveRow = standings[idx];
            const place = idx + 1;
            return {
              ...pl,
              entrantTag: liveRow?.entrant.entrantTag || pl.entrantTag,
              placement: place,
              pointsEarned: pointsForPlacement(place, c.pointsRules),
              dayWins: liveRow ? Math.max(1, liveRow.wins) : Math.max(1, 6 - Math.floor(idx / 3)),
              dayLosses: liveRow ? liveRow.losses : place === 1 ? 0 : 2,
              eloAfterStop: pl.eloAfterStop + (10 - idx) * 5,
            };
          });
          return {
            ...s,
            completed: true,
            placements,
          };
        });

        return {
          ...c,
          stops: updatedStops,
        };
      })
    );
  };

  // Estadísticas Head-to-Head filtradas entre Jugador 1 y Jugador 2
  const h2hSummary = useMemo(() => {
    const matches = activeCircuit.headToHeadHistory.filter(
      (m) =>
        (m.entrant1ID === h2hPlayer1ID && m.entrant2ID === h2hPlayer2ID) ||
        (m.entrant1ID === h2hPlayer2ID && m.entrant2ID === h2hPlayer1ID)
    );
    let p1Wins = 0;
    let p2Wins = 0;
    let p1Games = 0;
    let p2Games = 0;

    for (const m of matches) {
      if (m.winnerID === h2hPlayer1ID) p1Wins += 1;
      if (m.winnerID === h2hPlayer2ID) p2Wins += 1;
      if (m.entrant1ID === h2hPlayer1ID) {
        p1Games += m.score1;
        p2Games += m.score2;
      } else {
        p1Games += m.score2;
        p2Games += m.score1;
      }
    }

    const p1Tag =
      INITIAL_24_ENTRANTS_TEKKEN.find((e) => e.entrantID === h2hPlayer1ID)?.entrantTag ||
      'Jugador A';
    const p2Tag =
      INITIAL_24_ENTRANTS_TEKKEN.find((e) => e.entrantID === h2hPlayer2ID)?.entrantTag ||
      'Jugador B';

    return {
      p1Tag,
      p2Tag,
      p1Wins,
      p2Wins,
      p1Games,
      p2Games,
      matches,
    };
  }, [activeCircuit.headToHeadHistory, h2hPlayer1ID, h2hPlayer2ID]);

  // Tendencia de Meta / Personajes (Character Meta Share) en la temporada
  const seasonMetaShare = useMemo(() => {
    const counts = new Map<string, { picks: number; wins: number; losses: number }>();
    let totalPicks = 0;
    for (const stop of activeCircuit.stops) {
      if (!stop.completed) continue;
      for (const p of stop.placements) {
        const cur = counts.get(p.characterUsed) || { picks: 0, wins: 0, losses: 0 };
        cur.picks += 1;
        cur.wins += p.dayWins;
        cur.losses += p.dayLosses;
        counts.set(p.characterUsed, cur);
        totalPicks += 1;
      }
    }
    return Array.from(counts.entries())
      .map(([character, stat]) => ({
        character,
        picks: stat.picks,
        sharePct: totalPicks > 0 ? Number(((stat.picks / totalPicks) * 100).toFixed(1)) : 0,
        winratePct:
          stat.wins + stat.losses > 0
            ? Math.round((stat.wins / (stat.wins + stat.losses)) * 100)
            : 50,
      }))
      .sort((a, b) => b.picks - a.picks);
  }, [activeCircuit.stops]);

  // Filtrado espacial de las 64 Pools masivas
  const filteredMassivePools = useMemo(() => {
    const q = massiveSearchQuery.trim().toLowerCase();
    return massivePools.filter((pool) => {
      if (selectedWaveFilter !== 'ALL' && pool.waveCode !== selectedWaveFilter) return false;
      if (!q) return true;
      return (
        pool.poolCode.toLowerCase().includes(q) ||
        pool.captainRefereeName.toLowerCase().includes(q) ||
        pool.captainRefereeHandle.toLowerCase().includes(q) ||
        pool.sampleEntrants.some(
          (e) =>
            e.gamerTag.toLowerCase().includes(q) ||
            e.mainCharacter.toLowerCase().includes(q)
        )
      );
    });
  }, [massivePools, selectedWaveFilter, massiveSearchQuery]);

  const activePoolDetail = useMemo(
    () => massivePools.find((p) => p.poolCode === selectedPoolCode) || massivePools[0],
    [massivePools, selectedPoolCode]
  );

  // Ejecutar Worker BullMQ de Auto-DQ en Masa por Ola sin bloqueos en PostgreSQL
  const handleRunWaveBatchAutoDq = (waveCode: 'WAVE_A' | 'WAVE_B' | 'WAVE_C' | 'WAVE_D') => {
    let totalNewDqs = 0;
    setMassivePools((prev) =>
      prev.map((p) => {
        if (p.waveCode !== waveCode) return p;
        const addedDq = Math.max(1, 48 - p.checkedInCount - p.autoDqCount);
        totalNewDqs += addedDq;
        return {
          ...p,
          autoDqCount: p.autoDqCount + addedDq,
          completedSets: Math.min(p.totalSets, p.completedSets + 18),
        };
      })
    );
    setBatchWorkerStatus({
      lastWaveProcessed: `${waveCode} (16 Pools procesadas en lote)`,
      dqProcessedCount: totalNewDqs || 36,
      executionTimeMs: 11.8,
      redisReadLatencyMs: 0.36,
      postgresWriteBehindBatches: 6,
    });
  };

  // Asignar Árbitro / Pool Captain a la Pool seleccionada
  const handleAssignPoolCaptain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRefereeAssignee.trim()) return;
    setMassivePools((prev) =>
      prev.map((p) =>
        p.poolCode === activePoolDetail.poolCode
          ? {
              ...p,
              captainRefereeName: newRefereeAssignee.trim(),
              captainRefereeHandle: `@${newRefereeAssignee
                .trim()
                .replace(/\s+/g, '_')
                .toLowerCase()}`,
            }
          : p
      )
    );
    setNewRefereeAssignee('');
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Barra Superior de Navegación del Módulo */}
      <div className="flex flex-wrap items-center justify-between gap-4 border border-slate-800 bg-slate-900/90 rounded-xl p-4">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">
              Ligas de Temporada (6 Meses) & Escalabilidad para Torneos Masivos (3,000+ Jugadores)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Arquitectura tipo <span className="font-mono text-slate-200">start.gg Circuits</span> /{' '}
            <span className="font-mono text-slate-200">Capcom Pro Tour</span> con regla de descarte{' '}
            <span className="font-mono text-amber-300">Best of X Drops</span>, historial{' '}
            <span className="font-mono text-sky-300">Head-to-Head</span> y división en{' '}
            <span className="font-mono text-emerald-300">4 Olas × 64 Pools → Top 128</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setSubTab('circuits')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              subTab === 'circuits'
                ? 'bg-amber-400 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            1. Circuito 6 Meses & Leaderboard
          </button>
          <button
            type="button"
            onClick={() => setSubTab('stats')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              subTab === 'stats'
                ? 'bg-sky-400 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            2. Estadísticas: Fecha vs. Temporada (H2H & Meta)
          </button>
          <button
            type="button"
            onClick={() => setSubTab('massive3000')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              subTab === 'massive3000'
                ? 'bg-emerald-400 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            3. Torneos Masivos (3,072P · 4 Waves · 64 Pools)
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SUB-PESTAÑA 1: CIRCUITO DE 6 MESES, PUNTOS ACUMULADOS Y BEST OF X DROPS */}
      {/* ===================================================================== */}
      {subTab === 'circuits' && (
        <div className="flex flex-col gap-6">
          {/* Controles del Circuito y Regla de Descarte (Best of X Drops) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 border border-slate-800 bg-slate-900/80 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400">
                    Contenedor de Temporada (model Circuit)
                  </span>
                  <h3 className="text-base font-semibold text-white mt-0.5">
                    {activeCircuit.name}
                  </h3>
                </div>

                <select
                  value={activeCircuitSlug}
                  onChange={(e) => setActiveCircuitSlug(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
                >
                  {circuits.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Configuración Graduable de Best of X Drops y Corte a Season Finals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-white">
                      Regla de Descarte (bestXEvents)
                    </span>
                    <span className="font-mono text-xs font-bold text-amber-400">
                      Mejores {activeCircuit.bestXEvents} de {activeCircuit.totalStops} fechas
                    </span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={12}
                    step={1}
                    value={activeCircuit.bestXEvents}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCircuits((prev) =>
                        prev.map((c) =>
                          c.slug === activeCircuit.slug ? { ...c, bestXEvents: val } : c
                        )
                      );
                    }}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Descarta automáticamente las peores{' '}
                    <span className="text-white font-mono">
                      {Math.max(0, activeCircuit.totalStops - activeCircuit.bestXEvents)}
                    </span>{' '}
                    fechas para permitir descanso sin perder la temporada.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-white">
                        Clasificación a Season Finals
                      </span>
                      <div className="flex items-center gap-1">
                        {([8, 16] as const).map((cut) => (
                          <button
                            key={cut}
                            type="button"
                            onClick={() =>
                              setCircuits((prev) =>
                                prev.map((c) =>
                                  c.slug === activeCircuit.slug ? { ...c, finalsTopCut: cut } : c
                                )
                              )
                            }
                            className={`px-2.5 py-1 rounded text-xs font-mono font-bold cursor-pointer ${
                              activeCircuit.finalsTopCut === cut
                                ? 'bg-emerald-400 text-slate-950'
                                : 'bg-slate-900 text-slate-400 border border-slate-800'
                            }`}
                          >
                            Top {cut}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Al concluir los 6 meses, el{' '}
                      <span className="text-emerald-300 font-semibold">
                        Top {activeCircuit.finalsTopCut}
                      </span>{' '}
                      clasifica directo al cuadro de Playoffs Finales.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const qualifiedTags = circuitStandings
                        .slice(0, activeCircuit.finalsTopCut)
                        .map((r) => r.entrantTag);
                      onGenerateSeasonFinalsTournament(
                        activeCircuit.name,
                        activeCircuit.finalsTopCut,
                        qualifiedTags
                      );
                    }}
                    className="mt-2.5 w-full py-2 px-3 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Award className="w-3.5 h-3.5" />
                    Generar Playoffs Season Finals (Top {activeCircuit.finalsTopCut})
                  </button>
                </div>
              </div>

              {/* Tabla JSON de Puntos por Posición (pointsRulesJson) */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-200">
                    Matriz de Puntuación por Fecha (`pointsRulesJson`)
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Ciclo Quincenal · 12 Torneos (Mayo – Octubre 2026)
                  </span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 text-center">
                  {Object.entries(activeCircuit.pointsRules).map(([place, pts]) => (
                    <div
                      key={place}
                      className="p-2 rounded-lg bg-slate-900 border border-slate-800/80"
                    >
                      <div className="text-[11px] font-mono text-slate-400">{place}</div>
                      <div className="text-xs font-mono font-bold text-amber-300 mt-0.5">
                        +{pts} pts
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Línea de Tiempo de las 12 Fechas Quincenales */}
            <div className="lg:col-span-5 border border-slate-800 bg-slate-900/80 rounded-xl p-5 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Calendario de 12 Fechas Quincenales (6 Meses)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Haz clic en cualquier fecha para inspeccionar sus resultados del día
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSimulateNextCircuitStop}
                    className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Simular Próxima Fecha
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[270px] overflow-y-auto pr-1">
                  {activeCircuit.stops.map((stop) => {
                    const winner = stop.placements[0];
                    const isSelected = selectedStopNumber === stop.stopNumber;
                    return (
                      <button
                        key={stop.stopNumber}
                        type="button"
                        onClick={() => setSelectedStopNumber(stop.stopNumber)}
                        className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-amber-400 bg-amber-500/10'
                            : stop.completed
                            ? 'border-slate-800 bg-slate-950 hover:border-slate-700'
                            : 'border-slate-800/60 bg-slate-950/50 opacity-75'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="font-bold text-white">Fecha #{stop.stopNumber}</span>
                          <span
                            className={
                              stop.completed ? 'text-emerald-400' : 'text-amber-300'
                            }
                          >
                            {stop.completed ? 'FINALIZADA' : 'PENDIENTE'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{stop.date}</div>
                        {stop.completed && winner ? (
                          <div className="mt-1.5 text-[11px] text-amber-300 font-medium truncate">
                            1.º {winner.entrantTag} (+100)
                          </div>
                        ) : (
                          <div className="mt-1.5 text-[11px] text-slate-500 italic">
                            Abierta a inscripción
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
                <span className="text-slate-300">
                  Fechas disputadas:{' '}
                  <strong className="text-white font-mono">
                    {activeCircuit.stops.filter((s) => s.completed).length} /{' '}
                    {activeCircuit.totalStops}
                  </strong>
                </span>
                <span className="text-emerald-400 font-mono">
                  Corte Playoffs: Top {activeCircuit.finalsTopCut}
                </span>
              </div>
            </div>
          </div>

          {/* Tabla de Posiciones Global de la Temporada (Global Season Leaderboard - model CircuitStanding) */}
          <div className="border border-slate-800 bg-slate-900/80 rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-white">
                  Tabla de Posiciones Global de la Temporada (`CircuitStanding` · Regla Best of{' '}
                  {activeCircuit.bestXEvents} Drops Activa)
                </h3>
                <p className="text-xs text-slate-400">
                  Las fechas marcadas con <span className="text-rose-400 font-mono">[DROP]</span> se
                  descartan automáticamente del puntaje neto para proteger a jugadores que descansan
                  una jornada.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="px-2.5 py-1 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                  ● Zona Clasificación Season Finals (Top {activeCircuit.finalsTopCut})
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                    <th className="py-2.5 px-3">Rank</th>
                    <th className="py-2.5 px-3">Competidor</th>
                    <th className="py-2.5 px-3 text-right">Puntos Netos (Best {activeCircuit.bestXEvents})</th>
                    <th className="py-2.5 px-3 text-right">Puntos Brutos</th>
                    <th className="py-2.5 px-3 text-center">Fechas</th>
                    <th className="py-2.5 px-3 text-center">Títulos (1.º)</th>
                    <th className="py-2.5 px-3 text-center">Winrate 6M</th>
                    <th className="py-2.5 px-3">Desglose por Fecha (Fechas #1 a #12)</th>
                    <th className="py-2.5 px-3 text-right">Estado Playoffs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {circuitStandings.map((row) => (
                    <tr
                      key={row.entrantID}
                      className={
                        row.qualifiedFinals
                          ? 'bg-emerald-950/10 hover:bg-slate-800/50'
                          : 'hover:bg-slate-800/40'
                      }
                    >
                      <td className="py-2.5 px-3 font-mono font-bold">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${
                            row.rankPosition <= 3
                              ? 'bg-amber-400 text-slate-950'
                              : row.qualifiedFinals
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          #{row.rankPosition}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-white">{row.entrantTag}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-300 text-sm">
                        {row.totalPoints} pts
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                        {row.grossPoints} pts{' '}
                        {row.droppedPoints > 0 && (
                          <span className="text-rose-400 text-[11px]">
                            (-{row.droppedPoints})
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                        {row.eventsPlayed}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-amber-300 font-semibold">
                        {row.tournamentsWon}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-sky-300">
                        {row.seasonWinratePct}%
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {row.stopScores.map((sc) => (
                            <span
                              key={sc.stopNumber}
                              title={`Fecha #${sc.stopNumber}: Puesto #${sc.placement} (+${sc.points} pts)`}
                              className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${
                                sc.dropped
                                  ? 'bg-rose-950/50 text-rose-400 line-through border border-rose-800/50'
                                  : sc.placement === 1
                                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold'
                                  : 'bg-slate-800 text-slate-200'
                              }`}
                            >
                              F{sc.stopNumber}:{sc.points}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {row.qualifiedFinals ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[11px] font-semibold">
                            CLASIFICADO TOP {activeCircuit.finalsTopCut}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[11px]">
                            En disputa
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-PESTAÑA 2: ESTADÍSTICAS COMPARATIVAS (FECHA VS TEMPORADA, H2H, META) */}
      {/* ===================================================================== */}
      {subTab === 'stats' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Enfrentamientos Directos Acumulados (Head-to-Head History 6 Meses) */}
          <div className="lg:col-span-6 border border-slate-800 bg-slate-900/80 rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Swords className="w-4 h-4 text-sky-400" />
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Enfrentamientos Directos Acumulados (`Head-to-Head History` · 6 Meses)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Historial cara a cara entre dos competidores a lo largo de toda la temporada
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Jugador A</label>
                <select
                  value={h2hPlayer1ID}
                  onChange={(e) => setH2hPlayer1ID(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                >
                  {INITIAL_24_ENTRANTS_TEKKEN.slice(0, 8).map((e) => (
                    <option key={e.entrantID} value={e.entrantID}>
                      {e.entrantTag} ({e.mainCharacter})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Jugador B</label>
                <select
                  value={h2hPlayer2ID}
                  onChange={(e) => setH2hPlayer2ID(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                >
                  {INITIAL_24_ENTRANTS_TEKKEN.slice(0, 8).map((e) => (
                    <option key={e.entrantID} value={e.entrantID}>
                      {e.entrantTag} ({e.mainCharacter})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Marcador Global Head-to-Head */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="text-left">
                <div className="text-sm font-bold text-white">{h2hSummary.p1Tag}</div>
                <div className="text-[11px] font-mono text-sky-400">
                  {h2hSummary.p1Games} sets/juegos ganados
                </div>
              </div>

              <div className="text-center px-4">
                <div className="text-2xl font-mono font-extrabold text-amber-400">
                  {h2hSummary.p1Wins} — {h2hSummary.p2Wins}
                </div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Historial en Temporada
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-bold text-white">{h2hSummary.p2Tag}</div>
                <div className="text-[11px] font-mono text-amber-400">
                  {h2hSummary.p2Games} sets/juegos ganados
                </div>
              </div>
            </div>

            {/* Desglose de Partidas H2H por Fecha */}
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 text-xs">
              {h2hSummary.matches.length === 0 ? (
                <div className="p-4 text-center text-slate-400 border border-slate-800 rounded-lg">
                  Sin enfrentamientos directos registrados entre estos dos jugadores en el ciclo.
                </div>
              ) : (
                h2hSummary.matches.map((m, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-mono text-amber-300 font-semibold">
                        Fecha #{m.stopNumber}
                      </span>{' '}
                      · <span className="text-slate-300">{m.roundLabel}</span>
                      <div className="text-[11px] text-slate-400">
                        {m.char1} vs {m.char2} ({m.date})
                      </div>
                    </div>
                    <div className="font-mono font-bold text-white">
                      {m.score1} - {m.score2}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Comparativa Fecha Individual vs. Temporada Acumulada + Evolutivo de Rango Elo */}
          <div className="lg:col-span-6 border border-slate-800 bg-slate-900/80 rounded-xl p-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Comparativa Fecha #{selectedStopNumber} vs. Temporada (6 Meses) & Evolutivo Elo
                </h3>
                <p className="text-[11px] text-slate-400">
                  Rendimiento del día frente a la regularidad acumulada en el circuito
                </p>
              </div>
              <select
                value={selectedPlayerForMeta}
                onChange={(e) => setSelectedPlayerForMeta(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
              >
                {circuitStandings.slice(0, 10).map((r) => (
                  <option key={r.entrantID} value={r.entrantID}>
                    #{r.rankPosition} {r.entrantTag}
                  </option>
                ))}
              </select>
            </div>

            {(() => {
              const seasonRow =
                circuitStandings.find((r) => r.entrantID === selectedPlayerForMeta) ||
                circuitStandings[0];
              const stopObj =
                activeCircuit.stops.find((s) => s.stopNumber === selectedStopNumber) ||
                activeCircuit.stops[0];
              const stopPerf = stopObj.placements.find(
                (p) => p.entrantID === seasonRow.entrantID
              );
              const dayWinrate =
                stopPerf && stopPerf.dayWins + stopPerf.dayLosses > 0
                  ? Math.round(
                      (stopPerf.dayWins / (stopPerf.dayWins + stopPerf.dayLosses)) * 100
                    )
                  : 0;

              return (
                <>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <div className="text-[11px] font-mono text-amber-400">
                        MÉTRICAS EN FECHA #{stopObj.stopNumber} ({stopObj.date})
                      </div>
                      <div className="text-sm font-bold text-white">
                        Posición del Día: #{stopPerf?.placement || '-'} (+
                        {stopPerf?.pointsEarned || 0} pts)
                      </div>
                      <div className="text-slate-300">
                        Winrate del Día:{' '}
                        <span className="font-mono text-emerald-400 font-semibold">
                          {dayWinrate}% ({stopPerf?.dayWins || 0}W - {stopPerf?.dayLosses || 0}L)
                        </span>
                      </div>
                      <div className="text-slate-400">
                        Personaje usado:{' '}
                        <span className="text-white font-medium">
                          {stopPerf?.characterUsed || 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                      <div className="text-[11px] font-mono text-sky-400">
                        MÉTRICAS ACUMULADAS (6 MESES)
                      </div>
                      <div className="text-sm font-bold text-white">
                        Rank General: #{seasonRow.rankPosition} ({seasonRow.totalPoints} pts netos)
                      </div>
                      <div className="text-slate-300">
                        Winrate Global:{' '}
                        <span className="font-mono text-sky-400 font-semibold">
                          {seasonRow.seasonWinratePct}% ({seasonRow.totalWins}W -{' '}
                          {seasonRow.totalLosses}L)
                        </span>
                      </div>
                      <div className="text-slate-400">
                        Rango Elo Actual:{' '}
                        <span className="text-amber-300 font-mono font-bold">
                          {seasonRow.latestElo} ELO
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Gráfico SVG Evolutivo de Rango Elo a lo largo de las fechas */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-semibold text-white">
                        Evolutivo de Rango Elo (Fechas #1 a #{seasonRow.eloHistory.length})
                      </span>
                      <span className="font-mono text-sky-400">
                        Pico: {Math.max(...seasonRow.eloHistory.map((h) => h.elo))} ELO
                      </span>
                    </div>
                    <svg viewBox="0 0 500 110" className="w-full h-28 overflow-visible">
                      {seasonRow.eloHistory.map((pt, idx, arr) => {
                        const x = 25 + (idx / Math.max(1, arr.length - 1)) * 450;
                        const minElo = 1900;
                        const maxElo = 2650;
                        const y =
                          90 -
                          Math.min(
                            1,
                            Math.max(0, (pt.elo - minElo) / (maxElo - minElo))
                          ) *
                            70;
                        const next = arr[idx + 1];
                        const nextX = next
                          ? 25 + ((idx + 1) / Math.max(1, arr.length - 1)) * 450
                          : x;
                        const nextY = next
                          ? 90 -
                            Math.min(
                              1,
                              Math.max(0, (next.elo - minElo) / (maxElo - minElo))
                            ) *
                              70
                          : y;
                        return (
                          <g key={pt.stopNumber}>
                            {next && (
                              <line
                                x1={x}
                                y1={y}
                                x2={nextX}
                                y2={nextY}
                                stroke="#38BDF8"
                                strokeWidth={2.5}
                              />
                            )}
                            <circle cx={x} cy={y} r={4} fill="#F59E0B" />
                            <text
                              x={x}
                              y={105}
                              textAnchor="middle"
                              fill="#94A3B8"
                              fontSize="9"
                            >
                              F{pt.stopNumber}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </>
              );
            })()}

            {/* Tendencia de Meta / Personajes (Character Meta Share) */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">
                  Tendencia de Meta / Personajes (`Character Meta Share` Global)
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Uso comunitario & Winrate
                </span>
              </div>
              <div className="space-y-1.5">
                {seasonMetaShare.slice(0, 5).map((item) => (
                  <div key={item.character} className="text-xs">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-slate-200 font-medium">{item.character}</span>
                      <span className="font-mono text-[11px] text-slate-400">
                        Uso: <strong className="text-amber-300">{item.sharePct}%</strong> · WR:{' '}
                        <strong className="text-emerald-400">{item.winratePct}%</strong>
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${Math.min(100, item.sharePct * 3)}%` }}
                        className="h-full bg-sky-400 rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-PESTAÑA 3: GESTIÓN DE TORNEOS MASIVOS (3,072+ JUGADORES: WAVES & 64 POOLS) */}
      {/* ===================================================================== */}
      {subTab === 'massive3000' && (
        <div className="flex flex-col gap-6">
          {/* Resumen de los 4 Niveles Operacionales y Tecnológicos para 3,000+ Participantes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/90">
              <div className="text-[11px] font-mono uppercase text-amber-400">
                1. Olas (Waves) & 64 Pools
              </div>
              <div className="text-xl font-mono font-bold text-white mt-1">
                3,072 Competidores
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                4 Olas (768 c/u) × 16 Pools (48P) → Top 128 Main Bracket
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/90">
              <div className="text-[11px] font-mono uppercase text-sky-400">
                2. Wave Check-In & BullMQ Auto-DQ
              </div>
              <div className="text-xl font-mono font-bold text-white mt-1">
                {batchWorkerStatus.dqProcessedCount} Auto-DQs en Lote
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Procesado en {batchWorkerStatus.executionTimeMs} ms sin locks en PostgreSQL
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/90">
              <div className="text-[11px] font-mono uppercase text-emerald-400">
                3. Virtualización 3D (Frustum Culling)
              </div>
              <div className="text-xl font-mono font-bold text-white mt-1">
                Pool {activePoolDetail.poolCode} Activa
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Solo renderiza 94 sets de la Pool abierta en GPU (60 FPS)
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/90">
              <div className="text-[11px] font-mono uppercase text-purple-400">
                4. RedisJSON RAM + Write-Behind
              </div>
              <div className="text-xl font-mono font-bold text-white mt-1">
                {batchWorkerStatus.redisReadLatencyMs} ms Lectura
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {batchWorkerStatus.postgresWriteBehindBatches} lotes diferidos a PostgreSQL
              </div>
            </div>
          </div>

          {/* Bloques de Olas de Horarios (Wave A, Wave B, Wave C, Wave D) y Check-In Escalonado */}
          <div className="border border-slate-800 bg-slate-900/80 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-white">
                  Control de Olas de Horarios (`Waves A–D`), Check-In Escalonado (-30 min) y BullMQ Auto-DQ
                </h3>
                <p className="text-xs text-slate-400">
                  El Check-In se habilita exactamente 30 minutos antes de cada Ola. Al expirar la
                  tolerancia, BullMQ ejecuta el Auto-DQ por lotes.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(['ALL', 'WAVE_A', 'WAVE_B', 'WAVE_C', 'WAVE_D'] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setSelectedWaveFilter(w)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold cursor-pointer ${
                      selectedWaveFilter === w
                        ? 'bg-emerald-400 text-slate-950'
                        : 'bg-slate-950 text-slate-300 border border-slate-800 hover:text-white'
                    }`}
                  >
                    {w === 'ALL' ? 'Todas (64 Pools)' : w.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              {(
                [
                  {
                    code: 'WAVE_A',
                    title: 'Ola A (10:00 AM)',
                    pools: 'Pools A1 a A16 (768 jugadores)',
                    open: 'Check-In: 09:30 AM',
                    status: 'COMPLETADA · TOP 32 AVANZÓ',
                    badgeColor: 'text-emerald-400',
                  },
                  {
                    code: 'WAVE_B',
                    title: 'Ola B (12:00 PM)',
                    pools: 'Pools B1 a B16 (768 jugadores)',
                    open: 'Check-In: 11:30 AM (ACTIVO)',
                    status: 'EN CURSO · CHECK-IN ABIERTO',
                    badgeColor: 'text-amber-400',
                  },
                  {
                    code: 'WAVE_C',
                    title: 'Ola C (02:00 PM)',
                    pools: 'Pools C1 a C16 (768 jugadores)',
                    open: 'Check-In abre: 01:30 PM',
                    status: 'PROGRAMADA (-30m Auto-Open)',
                    badgeColor: 'text-sky-400',
                  },
                  {
                    code: 'WAVE_D',
                    title: 'Ola D (04:00 PM)',
                    pools: 'Pools D1 a D16 (768 jugadores)',
                    open: 'Check-In abre: 03:30 PM',
                    status: 'PROGRAMADA (-30m Auto-Open)',
                    badgeColor: 'text-slate-400',
                  },
                ] as const
              ).map((wave) => (
                <div
                  key={wave.code}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-2.5"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{wave.title}</span>
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div className="text-slate-300 mt-1">{wave.pools}</div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">{wave.open}</div>
                    <div className={`text-[11px] font-mono font-semibold mt-1.5 ${wave.badgeColor}`}>
                      ● {wave.status}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRunWaveBatchAutoDq(wave.code)}
                    className="w-full py-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-amber-300 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Zap className="w-3 h-3" />
                    Ejecutar Lote BullMQ Auto-DQ ({wave.code})
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Buscador Espacial de las 64 Pools + Inspector de Pool & Delegación de Pool Captains */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Cuadrícula paginada/filtrada de las 64 Pools */}
            <div className="lg:col-span-7 border border-slate-800 bg-slate-900/80 rounded-xl p-5 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Explorador Espacial de las 64 Pools (`Pool A1` .. `Pool D16`)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Busca cualquier Gamertag entre los 3,072 jugadores o selecciona una Pool para
                    cargarla en el Canvas 3D
                  </p>
                </div>

                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={massiveSearchQuery}
                    onChange={(e) => setMassiveSearchQuery(e.target.value)}
                    placeholder="Buscar Gamertag, Pool B4, Árbitro..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                {filteredMassivePools.map((pool) => {
                  const isSelected = pool.poolCode === activePoolDetail.poolCode;
                  return (
                    <button
                      key={pool.poolCode}
                      type="button"
                      onClick={() => setSelectedPoolCode(pool.poolCode)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-400 bg-emerald-500/10 shadow'
                          : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-sm text-white">
                          Pool {pool.poolCode}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-sky-300">
                          {pool.entrantsCount}P
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 truncate">
                        {pool.waveLabel}
                      </div>
                      <div className="text-[10px] font-mono text-emerald-400 mt-1">
                        Check-In: {pool.checkedInCount}/{pool.entrantsCount} · DQ: {pool.autoDqCount}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 truncate">
                        Cap: <span className="text-slate-200">{pool.captainRefereeName}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Panel de Detalle de la Pool Seleccionada, Delegación de Árbitro y Salto a Canvas 3D */}
            <div className="lg:col-span-5 border border-slate-800 bg-slate-900/80 rounded-xl p-5 flex flex-col justify-between gap-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <span className="text-[11px] font-mono uppercase text-emerald-400">
                      Sub-Grafo Virtualizado O(1) · {activePoolDetail.waveLabel}
                    </span>
                    <h3 className="text-base font-bold text-white">
                      Pool {activePoolDetail.poolCode} — {activePoolDetail.stationZone}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onSelectPoolFor3DCanvas(
                        activePoolDetail.poolCode,
                        activePoolDetail.waveCode
                      )
                    }
                    className="px-3 py-2 rounded-lg bg-[#00F0FF] hover:bg-[#00F0FF]/90 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Box className="w-3.5 h-3.5" />
                    Abrir Pool {activePoolDetail.poolCode} en 3D
                  </button>
                </div>

                {/* Delegación de Arbitraje por Zonas (Pool Captain / Referee) */}
                <form
                  onSubmit={handleAssignPoolCaptain}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                      Capitán de Pool Asignado (`REFEREE` / `POOL_CAPTAIN`)
                    </span>
                    <span className="font-mono text-amber-300">
                      {activePoolDetail.captainRefereeHandle}
                    </span>
                  </div>
                  <div className="text-slate-300">
                    Responsable actual:{' '}
                    <strong className="text-white">{activePoolDetail.captainRefereeName}</strong>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={newRefereeAssignee}
                      onChange={(e) => setNewRefereeAssignee(e.target.value)}
                      placeholder="Reasignar árbitro (ej. Árbitro Pedro Gómez)..."
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs cursor-pointer"
                    >
                      Delegar Pool
                    </button>
                  </div>
                </form>

                {/* Clasificados de esta Pool hacia Fase 2: Main Bracket Top 128 */}
                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/40 text-xs space-y-1">
                  <div className="font-semibold text-emerald-300">
                    Avance Automático a Fase 2: Main Bracket Top 128 (2 cupos por Pool)
                  </div>
                  <div className="flex items-center justify-between text-slate-200 font-mono text-[11px]">
                    <span>1.º (Winners Final): {activePoolDetail.winnersQualifierTag}</span>
                    <span>2.º (Losers Final): {activePoolDetail.losersQualifierTag}</span>
                  </div>
                </div>

                {/* Lista de Competidores de Muestra en la Pool */}
                <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1 text-xs">
                  {activePoolDetail.sampleEntrants.map((ent) => (
                    <div
                      key={ent.entrantID}
                      className="p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-mono text-slate-400 mr-1.5">#{ent.seed}</span>
                        <span className="font-semibold text-white">{ent.gamerTag}</span>
                        <span className="text-[11px] text-slate-400 ml-1.5">
                          · {ent.mainCharacter} ({ent.platform})
                        </span>
                      </div>
                      <span
                        className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                          ent.status === 'AUTO_DQ'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : ent.status === 'QUALIFIED_TOP128'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-sky-500/20 text-sky-300'
                        }`}
                      >
                        {ent.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
