/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Visualizador Interactivo del Grafo Acíclico Dirigido (DAG) OBF v2.0 + Grid de Estaciones + Overlay OBS
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  BracketPhase,
  OBFDocument,
  OBFEntrant,
  OBFSet,
} from '../engine/nikBracketsEngine';
import { BracketCanvasWebGL3D } from './BracketCanvasWebGL3D';
import { Box, Sparkles, Tv, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface BracketDagVisualizerProps {
  obf: OBFDocument;
  selectedSetID: string;
  onSelectSet: (setID: string) => void;
  canReportScores: boolean;
  canReportSet?: (set: OBFSet) => boolean;
  myEntrantID?: string | null;
  onQuickScoreReport: (set: OBFSet, score1: number, score2: number) => void;
  accentColor: string;
  compactDensity: boolean;
  searchQuery: string;
  casterNarrative: string;
  onRequestCasterNarrative: (setID: string) => void;
  loadingNarrative: boolean;
}

const PHASE_ORDER: BracketPhase[] = [
  'SWISS',
  'ROUND_ROBIN',
  'FFA_STAGE',
  'LEADERBOARD_STAGE',
  'WINNERS',
  'LOSERS',
  'SECOND_CHANCE',
  'THIRD_PLACE',
  'GRAND_FINAL',
  'GRAND_FINAL_RESET',
];

const PHASE_LABELS: Record<BracketPhase, string> = {
  SWISS: 'Fase Suiza Clasificatoria',
  ROUND_ROBIN: 'Fase Round Robin (Berger)',
  FFA_STAGE: 'Lobbies Free-For-All',
  LEADERBOARD_STAGE: 'Clasificación Time Trial',
  WINNERS: 'Winners Bracket',
  LOSERS: 'Losers Bracket',
  SECOND_CHANCE: 'Second Chance (Garantía 3 Sets)',
  THIRD_PLACE: 'Definición 3er Puesto',
  GRAND_FINAL: 'Grand Final',
  GRAND_FINAL_RESET: 'Grand Final Reset',
};

export const BracketDagVisualizer: React.FC<BracketDagVisualizerProps> = ({
  obf,
  selectedSetID,
  onSelectSet,
  canReportScores,
  canReportSet,
  myEntrantID,
  onQuickScoreReport,
  accentColor,
  compactDensity,
  searchQuery,
  casterNarrative,
  onRequestCasterNarrative,
  loadingNarrative,
}) => {
  const [visualMode, setVisualMode] = useState<'3d' | 'dag' | 'grid' | 'obs'>('3d');
  const [phaseFilter, setPhaseFilter] = useState<string>('ALL');
  const [zoom, setZoom] = useState<number>(1);
  const [showLoserEdges, setShowLoserEdges] = useState<boolean>(true);

  // Reiniciar el filtro de fase al cambiar de torneo o formato para mostrar todo el tablero nuevo
  useEffect(() => {
    setPhaseFilter('ALL');
  }, [obf.event.tournamentSlug, obf.event.format]);

  const entrantMap = useMemo(() => {
    const map = new Map<string, OBFEntrant>();
    for (const e of obf.entrants) {
      map.set(e.entrantID, e);
    }
    return map;
  }, [obf.entrants]);

  const activePhases = useMemo(() => {
    const present = new Set(obf.sets.map((s) => s.phase));
    return PHASE_ORDER.filter((p) => present.has(p));
  }, [obf.sets]);

  const filteredSets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return obf.sets.filter((s) => {
      if (phaseFilter !== 'ALL' && s.phase !== phaseFilter) return false;
      if (!q) return true;
      const p1 = s.entrant1ID ? entrantMap.get(s.entrant1ID)?.entrantTag.toLowerCase() || '' : '';
      const p2 = s.entrant2ID ? entrantMap.get(s.entrant2ID)?.entrantTag.toLowerCase() || '' : '';
      return (
        s.setID.toLowerCase().includes(q) ||
        s.roundLabel.toLowerCase().includes(q) ||
        (s.other.station || '').toLowerCase().includes(q) ||
        p1.includes(q) ||
        p2.includes(q)
      );
    });
  }, [obf.sets, phaseFilter, searchQuery, entrantMap]);

  // Cálculo de coordenadas en el lienzo DAG 2D a partir de position3D
  const dagLayout = useMemo(() => {
    const nodeWidth = 250;
    const nodeHeight = compactDensity ? 92 : 106;
    const nodes = new Map<
      string,
      { set: OBFSet; x: number; y: number; cx: number; cy: number }
    >();

    if (filteredSets.length === 0) {
      return { nodes, width: 1100, height: 540, nodeWidth, nodeHeight };
    }

    const xs = filteredSets.map((s) => s.other.position3D?.[0] ?? s.round * 4);
    const ys = filteredSets.map((s) => -(s.other.position3D?.[1] ?? 0));
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);

    const canvasWidth = Math.max(1360, Math.round(spanX * 74 + 480));
    const canvasHeight = Math.max(760, Math.round(spanY * 78 + 300));

    for (const set of filteredSets) {
      const rawX = set.other.position3D?.[0] ?? set.round * 4;
      const rawY = -(set.other.position3D?.[1] ?? 0);
      const normX = (rawX - minX) / spanX;
      const normY = (rawY - minY) / spanY;

      const x = Math.round(48 + normX * (canvasWidth - nodeWidth - 96));
      const y = Math.round(48 + normY * (canvasHeight - nodeHeight - 96));

      nodes.set(set.setID, {
        set,
        x,
        y,
        cx: x + nodeWidth / 2,
        cy: y + nodeHeight / 2,
      });
    }

    return { nodes, width: canvasWidth, height: canvasHeight, nodeWidth, nodeHeight };
  }, [filteredSets, compactDensity]);

  const selectedSet = useMemo(
    () => obf.sets.find((s) => s.setID === selectedSetID) || obf.sets[0],
    [obf.sets, selectedSetID]
  );

  const selectedP1 = selectedSet?.entrant1ID ? entrantMap.get(selectedSet.entrant1ID) : undefined;
  const selectedP2 = selectedSet?.entrant2ID ? entrantMap.get(selectedSet.entrant2ID) : undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de Herramientas del Visualizador (Controles segmentados interactivos) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border border-slate-800 bg-slate-900/90 p-3 rounded-xl">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => setVisualMode('3d')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              visualMode === '3d'
                ? 'bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            Canvas WebGL 3D (Z-Space)
          </button>
          <button
            type="button"
            onClick={() => setVisualMode('dag')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              visualMode === 'dag'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Grafo 2D DAG O(1)
          </button>
          <button
            type="button"
            onClick={() => setVisualMode('grid')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              visualMode === 'grid'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Fases & Estaciones
          </button>
          <button
            type="button"
            onClick={() => setVisualMode('obs')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              visualMode === 'obs'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            Overlay Broadcast OBS
          </button>
        </div>

        {/* Filtro interactivo por fase del torneo */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => setPhaseFilter('ALL')}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap shrink-0 ${
              phaseFilter === 'ALL' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-white'
            }`}
          >
            Todas ({obf.sets.length})
          </button>
          {activePhases.map((phase) => {
            const count = obf.sets.filter((s) => s.phase === phase).length;
            return (
              <button
                key={phase}
                type="button"
                onClick={() => setPhaseFilter(phase)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  phaseFilter === phase
                    ? 'bg-slate-800 text-white font-medium'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {phase.replace('_', ' ')} ({count})
              </button>
            );
          })}
        </div>

        {/* Controles de Zoom para el Grafo DAG */}
        {visualMode === 'dag' && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowLoserEdges((prev) => !prev)}
              className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                showLoserEdges
                  ? 'border-slate-700 bg-slate-800 text-slate-200'
                  : 'border-slate-800 bg-slate-950 text-slate-500'
              }`}
            >
              Rutas Losers: {showLoserEdges ? 'Visibles' : 'Ocultas'}
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.65, Number((z - 0.12).toFixed(2))))}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:text-white"
              title="Reducir Zoom"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono tabular-nums text-slate-400 px-1">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.35, Number((z + 0.12).toFixed(2))))}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:text-white"
              title="Aumentar Zoom"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:text-white"
              title="Restablecer Vista"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* MODO 0: CANVAS WEBGL 3D (Z-SPACE DEPTH) FIEL AL REPOSITORIO BASE */}
      {visualMode === '3d' && (
        <BracketCanvasWebGL3D
          obf={{
            ...obf,
            sets: phaseFilter === 'ALL' ? obf.sets : filteredSets,
          }}
          selectedSetID={selectedSetID}
          onSelectSet={onSelectSet}
        />
      )}

      {/* MODO 1: GRAFO DAG INTERACTIVO CON ARISTAS BÉZIER Y NODOS DE BAJA LATENCIA */}
      {visualMode === 'dag' && (
        <div className="relative w-full overflow-auto rounded-xl border border-slate-800 bg-[#090D16] shadow-inner max-h-[640px]">
          <div
            style={{
              width: `${Math.round(dagLayout.width * zoom)}px`,
              height: `${Math.round(dagLayout.height * zoom)}px`,
            }}
            className="relative origin-top-left transition-transform duration-150"
          >
            <div
              style={{
                width: `${dagLayout.width}px`,
                height: `${dagLayout.height}px`,
                transform: `scale(${zoom})`,
                transformOrigin: '0 0',
              }}
              className="relative"
            >
              {/* Capa SVG de Conectores Dirigidos del Grafo DAG */}
              <svg
                width={dagLayout.width}
                height={dagLayout.height}
                className="absolute inset-0 pointer-events-none"
              >
                {Array.from(dagLayout.nodes.values()).map(({ set, x, y }) => {
                  const edges: React.ReactNode[] = [];
                  const startX = x + dagLayout.nodeWidth;
                  const startY = y + dagLayout.nodeHeight / 2;

                  if (set.nextWinSetID && dagLayout.nodes.has(set.nextWinSetID)) {
                    const target = dagLayout.nodes.get(set.nextWinSetID)!;
                    const endX = target.x;
                    const endY =
                      set.nextWinSlot === 1
                        ? target.y + dagLayout.nodeHeight * 0.34
                        : set.nextWinSlot === 2
                        ? target.y + dagLayout.nodeHeight * 0.72
                        : target.cy;
                    const ctrlX1 = startX + (endX - startX) * 0.45;
                    const ctrlX2 = startX + (endX - startX) * 0.55;
                    const isCompleted = set.status === 'COMPLETED';

                    edges.push(
                      <path
                        key={`win-${set.setID}-${target.set.setID}`}
                        d={`M ${startX} ${startY} C ${ctrlX1} ${startY}, ${ctrlX2} ${endY}, ${endX} ${endY}`}
                        fill="none"
                        stroke={isCompleted ? accentColor : '#334155'}
                        strokeWidth={isCompleted ? 2.4 : 1.5}
                        strokeDasharray={isCompleted ? undefined : '5 4'}
                        opacity={isCompleted ? 0.95 : 0.65}
                      />
                    );
                  }

                  if (showLoserEdges && set.nextLoseSetID && dagLayout.nodes.has(set.nextLoseSetID)) {
                    const target = dagLayout.nodes.get(set.nextLoseSetID)!;
                    const endX = target.x;
                    const endY = target.cy;
                    const ctrlX1 = startX + (endX - startX) * 0.4;
                    const ctrlX2 = startX + (endX - startX) * 0.6;

                    edges.push(
                      <path
                        key={`lose-${set.setID}-${target.set.setID}`}
                        d={`M ${startX} ${startY + 12} C ${ctrlX1} ${startY + 35}, ${ctrlX2} ${endY - 20}, ${endX} ${endY}`}
                        fill="none"
                        stroke="#F43F5E"
                        strokeWidth={1.3}
                        strokeDasharray="3 5"
                        opacity={0.42}
                      />
                    );
                  }

                  return edges;
                })}
              </svg>

              {/* Nodos del Bracket */}
              {Array.from(dagLayout.nodes.values()).map(({ set, x, y }) => {
                const p1 = set.entrant1ID ? entrantMap.get(set.entrant1ID) : undefined;
                const p2 = set.entrant2ID ? entrantMap.get(set.entrant2ID) : undefined;
                const isSelected = set.setID === selectedSetID;
                const isP1Winner = set.status === 'COMPLETED' && set.winnerID === set.entrant1ID;
                const isP2Winner = set.status === 'COMPLETED' && set.winnerID === set.entrant2ID;
                const isMyMatch = Boolean(
                  myEntrantID && (set.entrant1ID === myEntrantID || set.entrant2ID === myEntrantID)
                );
                const canReportThisSet = canReportSet ? canReportSet(set) : canReportScores;

                return (
                  <div
                    key={set.setID}
                    style={{
                      left: `${x}px`,
                      top: `${y}px`,
                      width: `${dagLayout.nodeWidth}px`,
                      height: `${dagLayout.nodeHeight}px`,
                      borderColor: isSelected
                        ? accentColor
                        : isMyMatch
                        ? '#38BDF8'
                        : set.status === 'DISPUTED'
                        ? '#F43F5E'
                        : set.status === 'COMPLETED'
                        ? '#334155'
                        : '#1E293B',
                    }}
                    onClick={() => onSelectSet(set.setID)}
                    className={`absolute rounded-xl border bg-slate-900/95 px-3 py-2 cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 flex flex-col justify-between ${
                      isSelected
                        ? 'ring-1 ring-sky-400/50 shadow-lg'
                        : isMyMatch
                        ? 'ring-1 ring-sky-400/35'
                        : ''
                    }`}
                  >
                    {/* Metadatos Superiores sin Píldoras Estáticas */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums truncate">
                      <span className="truncate">
                        {set.setID} · {set.other.station || 'EST-01'} · Bo{set.bestOf}
                        {isMyMatch ? ' · TU PARTIDA' : ''}
                      </span>
                      <span
                        className={
                          set.status === 'COMPLETED'
                            ? 'text-emerald-400 font-semibold'
                            : set.status === 'DISPUTED'
                            ? 'text-rose-400 font-semibold'
                            : set.status === 'READY'
                            ? 'text-amber-300'
                            : 'text-slate-500'
                        }
                      >
                        {set.status}
                      </span>
                    </div>

                    {/* Jugador 1 */}
                    <div className="flex items-center justify-between gap-2 text-xs py-0.5 border-b border-slate-800/80">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono tabular-nums text-[11px] text-slate-500 shrink-0">
                          {p1 ? `#${p1.initialSeed}` : '—'}
                        </span>
                        <span
                          className={`truncate ${
                            isP1Winner ? 'font-bold text-white' : p1 ? 'text-slate-200' : 'text-slate-500 italic'
                          }`}
                        >
                          {p1 ? p1.entrantTag : 'Esperando rival'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {canReportThisSet && p1 && p2 && set.status !== 'ARCHIVED' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onQuickScoreReport(set, set.entrant1Score + 1, set.entrant2Score);
                            }}
                            className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                            title="Sumar +1 punto a Jugador 1"
                          >
                            +1
                          </button>
                        )}
                        <span
                          className={`font-mono tabular-nums text-xs font-bold w-4 text-right ${
                            isP1Winner ? 'text-sky-400' : 'text-slate-400'
                          }`}
                        >
                          {set.entrant1Score}
                        </span>
                      </div>
                    </div>

                    {/* Jugador 2 */}
                    <div className="flex items-center justify-between gap-2 text-xs pt-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono tabular-nums text-[11px] text-slate-500 shrink-0">
                          {p2 ? `#${p2.initialSeed}` : '—'}
                        </span>
                        <span
                          className={`truncate ${
                            isP2Winner ? 'font-bold text-white' : p2 ? 'text-slate-200' : 'text-slate-500 italic'
                          }`}
                        >
                          {p2 ? p2.entrantTag : 'Esperando rival'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {canReportThisSet && p1 && p2 && set.status !== 'ARCHIVED' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onQuickScoreReport(set, set.entrant1Score, set.entrant2Score + 1);
                            }}
                            className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                            title="Sumar +1 punto a Jugador 2"
                          >
                            +1
                          </button>
                        )}
                        <span
                          className={`font-mono tabular-nums text-xs font-bold w-4 text-right ${
                            isP2Winner ? 'text-sky-400' : 'text-slate-400'
                          }`}
                        >
                          {set.entrant2Score}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODO 2: VISTA DE FASES Y ESTACIONES (RESPONSIVA MÓVIL Y TABLET) */}
      {visualMode === 'grid' && (
        <div className="flex flex-col gap-5">
          {activePhases.map((phase) => {
            const phaseSets = filteredSets.filter((s) => s.phase === phase);
            if (phaseSets.length === 0) return null;

            return (
              <div key={phase} className="border border-slate-800 bg-slate-900/70 rounded-xl p-4">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                  <h3 className="text-sm font-semibold text-white">
                    {PHASE_LABELS[phase]}
                  </h3>
                  <span className="text-xs font-mono tabular-nums text-slate-400">
                    {phaseSets.filter((s) => s.status === 'COMPLETED').length} / {phaseSets.length} sets completados
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {phaseSets.map((set) => {
                    const p1 = set.entrant1ID ? entrantMap.get(set.entrant1ID) : undefined;
                    const p2 = set.entrant2ID ? entrantMap.get(set.entrant2ID) : undefined;
                    const isSelected = set.setID === selectedSetID;

                    return (
                      <div
                        key={set.setID}
                        onClick={() => onSelectSet(set.setID)}
                        style={{
                          borderColor: isSelected ? accentColor : undefined,
                        }}
                        className={`rounded-xl border p-3.5 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-slate-900 border-sky-400'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs text-slate-400 font-mono tabular-nums mb-2">
                          <span>
                            {set.setID} · {set.roundLabel}
                          </span>
                          <span>
                            {set.other.station || 'EST-01'} · Bo{set.bestOf}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-200 font-medium truncate">
                              {p1 ? `#${p1.initialSeed} ${p1.entrantTag}` : 'TBD'}
                            </span>
                            <span className="font-mono tabular-nums font-bold text-sky-400">
                              {set.entrant1Score}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-300 font-medium truncate">
                              {p2 ? `#${p2.initialSeed} ${p2.entrantTag}` : 'TBD'}
                            </span>
                            <span className="font-mono tabular-nums font-bold text-rose-400">
                              {set.entrant2Score}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                          <span>
                            Estado: <strong className="text-slate-200">{set.status}</strong>
                          </span>
                          {set.nextWinSetID && (
                            <span className="font-mono">
                              Avanza a {set.nextWinSetID} (Slot {set.nextWinSlot || 1})
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODO 3: OVERLAY BROADCAST 1920x1080 PARA OBS STUDIO Y STREAMERS */}
      {visualMode === 'obs' && selectedSet && (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-semibold text-white">
                Overlay Broadcast 1920×1080 — Sincronización WebSocket (&lt; 3ms)
              </h3>
              <p className="text-xs text-slate-400">
                Set seleccionado: {selectedSet.setID} · {selectedSet.roundLabel} · Estación {selectedSet.other.station || 'STAGE-MAIN'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRequestCasterNarrative(selectedSet.setID)}
              disabled={loadingNarrative}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {loadingNarrative ? 'Generando Brief DeepSeek-V3...' : 'Generar Narrativa Caster (DeepSeek-V3)'}
            </button>
          </div>

          {/* Barra Marcador OBS */}
          <div className="grid grid-cols-1 md:grid-cols-11 items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="md:col-span-4 flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-4 py-3">
              <div>
                <div className="text-base font-bold text-white">
                  {selectedP1?.entrantTag || 'Jugador 1 (TBD)'}
                </div>
                <div className="text-xs text-slate-400 font-mono tabular-nums">
                  Seed #{selectedP1?.initialSeed || 1} · {selectedP1?.mainCharacter || 'Main'} · ELO {selectedP1?.eloRating || 2000}
                </div>
              </div>
              <span className="text-3xl font-mono tabular-nums font-bold text-sky-400">
                {selectedSet.entrant1Score}
              </span>
            </div>

            <div className="md:col-span-3 flex flex-col items-center justify-center text-center py-2">
              <div className="text-xs font-mono uppercase tracking-wider text-amber-400 font-semibold">
                {selectedSet.roundLabel}
              </div>
              <div className="text-xs text-slate-400 font-mono tabular-nums mt-1">
                {obf.event.gameName} · Bo{selectedSet.bestOf} · {selectedSet.other.station || 'STAGE-MAIN'}
              </div>
            </div>

            <div className="md:col-span-4 flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-4 py-3">
              <span className="text-3xl font-mono tabular-nums font-bold text-rose-400">
                {selectedSet.entrant2Score}
              </span>
              <div className="text-right">
                <div className="text-base font-bold text-white">
                  {selectedP2?.entrantTag || 'Jugador 2 (TBD)'}
                </div>
                <div className="text-xs text-slate-400 font-mono tabular-nums">
                  Seed #{selectedP2?.initialSeed || 2} · {selectedP2?.mainCharacter || 'Main'} · ELO {selectedP2?.eloRating || 2000}
                </div>
              </div>
            </div>
          </div>

          {/* Teleprompter para Comentaristas impulsado por DeepSeek-V3 */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
            <div className="text-xs font-mono text-slate-400 mb-1">
              Teleprompter de Comentaristas (DeepSeek-V3 Storyline Engine)
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">
              {casterNarrative ||
                `Duelo activo en ${selectedSet.roundLabel}: ${selectedP1?.entrantTag || 'TBD'} vs ${selectedP2?.entrantTag || 'TBD'}. Presiona "Generar Narrativa Caster" para obtener análisis estadístico en tiempo real.`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
