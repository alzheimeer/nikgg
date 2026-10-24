/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dashboard de Analítica en Tiempo Real, Benchmark Algorítmico nikBrackets v1.0 vs v2.0 DAG O(1) y Telemetría Redis
 */

import React, { useEffect, useState } from 'react';
import {
  AlgorithmBenchmarkResult,
  OBFDocument,
  StandingsRow,
  runAlgorithmBenchmark,
} from '../engine/nikBracketsEngine';
import {
  exportObfJsonFile,
  exportStandingsToCsv,
  exportTournamentPdfReport,
} from '../utils/exportReports';
import { Cpu, Database, Download, FileSpreadsheet, FileText, RefreshCw, Sparkles } from 'lucide-react';

interface RedisTelemetry {
  connected: boolean;
  mode: string;
  hits: number;
  misses: number;
  hitRatePct: number;
  activeKeys: number;
  activeTags: string[];
  lastLatencyMs: number;
  writeBehindQueue: Array<{
    jobId: string;
    tournamentSlug: string;
    setID: string;
    score1: number;
    score2: number;
    winnerID: string | null;
    latencyMs: number;
    syncedAt: string;
  }>;
}

interface AnalyticsAndBenchmarkViewProps {
  obf: OBFDocument;
  standings: StandingsRow[];
  redis: RedisTelemetry;
  onFlushRedis: () => Promise<void>;
  onRunAiAudit: () => Promise<void>;
  aiAuditReport: string;
  aiAuditLoading: boolean;
}

export const AnalyticsAndBenchmarkView: React.FC<AnalyticsAndBenchmarkViewProps> = ({
  obf,
  standings,
  redis,
  onFlushRedis,
  onRunAiAudit,
  aiAuditReport,
  aiAuditLoading,
}) => {
  const [benchSize, setBenchSize] = useState<number>(128);
  const [benchmark, setBenchmark] = useState<AlgorithmBenchmarkResult>(() =>
    runAlgorithmBenchmark(128)
  );

  useEffect(() => {
    setBenchmark(runAlgorithmBenchmark(benchSize));
  }, [benchSize]);

  // Analítica de uso de personajes y victoria en vivo
  const characterStats = React.useMemo(() => {
    const counts = new Map<string, { picks: number; wins: number; avgElo: number }>();
    for (const row of standings) {
      const charName = row.entrant.mainCharacter || 'Sergei Dragunov';
      const current = counts.get(charName) || { picks: 0, wins: 0, avgElo: 0 };
      current.picks += 1;
      current.wins += row.wins;
      current.avgElo += row.entrant.eloRating;
      counts.set(charName, current);
    }
    return Array.from(counts.entries())
      .map(([name, stat]) => ({
        name,
        picks: stat.picks,
        wins: stat.wins,
        avgElo: Math.round(stat.avgElo / stat.picks),
      }))
      .sort((a, b) => b.wins - a.wins || b.picks - a.picks);
  }, [standings]);

  // Analítica de rendimiento por Estación Física
  const stationStats = React.useMemo(() => {
    const map = new Map<string, { total: number; completed: number; ready: number }>();
    for (const s of obf.sets) {
      const st = s.other.station || 'EST-01';
      const cur = map.get(st) || { total: 0, completed: 0, ready: 0 };
      cur.total += 1;
      if (s.status === 'COMPLETED') cur.completed += 1;
      if (s.status === 'READY') cur.ready += 1;
      map.set(st, cur);
    }
    return Array.from(map.entries());
  }, [obf.sets]);

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado y Acciones de Exportación PDF / CSV / OBF JSON */}
      <div className="flex flex-wrap items-center justify-between gap-4 border border-slate-800 bg-slate-900/80 rounded-xl p-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            01. Optimización Algorítmica de nikBrackets & Analítica en Tiempo Real
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Auditoría técnica de <span className="font-mono text-slate-300">alzheimeer/nikBrackets</span> (`packages/bracket-engine`) comparando búsqueda lineal vs Grafo DAG Indexado O(1).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportStandingsToCsv(obf, standings)}
            className="px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => exportTournamentPdfReport(obf, standings)}
            className="px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5 text-sky-400" />
            Exportar PDF Oficial
          </button>
          <button
            type="button"
            onClick={() => exportObfJsonFile(obf)}
            className="px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            Exportar OBF v1.0 (.json)
          </button>
        </div>
      </div>

      {/* Benchmark Comparativo en Vivo: nikBrackets v1.0 vs v2.0 DAG O(1) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 border border-slate-800 bg-slate-900/80 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-semibold text-white">
                  Benchmark en Vivo: Motor Original O(E × S) vs Nuevo DAG Indexado O(1)
                </h3>
              </div>

              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {[32, 64, 128, 256, 512].map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setBenchSize(sz)}
                    className={`px-2.5 py-1 text-xs font-mono tabular-nums rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      benchSize === sz
                        ? 'bg-sky-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {sz}P
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-xs text-slate-400">nikBrackets v1.0 (Lineal)</div>
                <div className="text-lg font-mono tabular-nums font-bold text-rose-400 mt-1">
                  {benchmark.legacyTimeMs} ms
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-500">
                  {benchmark.legacyOpsCount.toLocaleString()} iteraciones
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-xs text-slate-400">nikBrackets v2.0 (DAG O(1))</div>
                <div className="text-lg font-mono tabular-nums font-bold text-emerald-400 mt-1">
                  {benchmark.optimizedDagTimeMs} ms
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-500">
                  {benchmark.optimizedOpsCount.toLocaleString()} accesos Map
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-xs text-slate-400">Aceleración Real</div>
                <div className="text-lg font-mono tabular-nums font-bold text-sky-400 mt-1">
                  {benchmark.speedupFactor}× más rápido
                </div>
                <div className="text-[11px] text-slate-500">
                  {benchmark.setCount} sets evaluados
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-xs text-slate-400">Complejidad Standings</div>
                <div className="text-lg font-mono tabular-nums font-bold text-amber-400 mt-1">
                  O(V + E)
                </div>
                <div className="text-[11px] text-slate-500">
                  Antes: O(E × S) cuadrático
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="font-semibold text-white mb-1">
                Optimizaciones aplicadas sobre el código fuente de alzheimeer/nikBrackets:
              </div>
              {benchmark.improvements.map((imp, idx) => (
                <div key={idx} className="flex items-start gap-2 leading-relaxed">
                  <span className="font-mono text-sky-400 font-semibold">0{idx + 1}.</span>
                  <span>{imp}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Auditoría Inteligente con DeepSeek-R1 */}
          <div className="mt-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-white">
                Auditoría Táctica del Torneo (DeepSeek-R1 Operations Engine)
              </span>
              <button
                type="button"
                onClick={onRunAiAudit}
                disabled={aiAuditLoading}
                className="px-3 py-1.5 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {aiAuditLoading ? 'Analizando Grafo...' : 'Ejecutar Auditoría DeepSeek-R1'}
              </button>
            </div>
            {aiAuditReport && (
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 whitespace-pre-line leading-relaxed">
                {aiAuditReport}
              </div>
            )}
          </div>
        </div>

        {/* Telemetría Redis Read-Aside & Write-Behind Queue */}
        <div className="lg:col-span-5 border border-slate-800 bg-slate-900/80 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">
                  Caché Distribuida Redis (Read-Aside & Write-Behind)
                </h3>
              </div>
              <button
                type="button"
                onClick={onFlushRedis}
                className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-xs text-slate-300 flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3 h-3" />
                Purgar Caché
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-xs text-slate-400">Hit Ratio</div>
                <div className="text-lg font-mono tabular-nums font-bold text-emerald-400 mt-1">
                  {redis.hitRatePct}%
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-500">
                  {redis.hits} hits · {redis.misses} miss
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-xs text-slate-400">Latencia Lectura</div>
                <div className="text-lg font-mono tabular-nums font-bold text-sky-400 mt-1">
                  {redis.lastLatencyMs} ms
                </div>
                <div className="text-[11px] text-slate-500">
                  OBF JSON Tree
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-xs text-slate-400">Tags Activos</div>
                <div className="text-lg font-mono tabular-nums font-bold text-white mt-1">
                  {redis.activeKeys}
                </div>
                <div className="text-[11px] text-slate-500">
                  Invalidación O(1)
                </div>
              </div>
            </div>

            <div className="text-xs font-semibold text-slate-300 mb-2">
              Cola Asíncrona Write-Behind (BullMQ Score Persistence Log):
            </div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {redis.writeBehindQueue.length === 0 ? (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-500">
                  No hay escrituras pendientes en la cola Write-Behind. Reporta o simula un partido para observar el encolado en &lt; 1ms.
                </div>
              ) : (
                redis.writeBehindQueue.map((job) => (
                  <div
                    key={job.jobId}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono tabular-nums"
                  >
                    <span className="text-slate-300 truncate">
                      {job.setID} ({job.score1}-{job.score2})
                    </span>
                    <span className="text-emerald-400 shrink-0">
                      {job.latencyMs}ms · SYNCED
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Posiciones Buchholz + Rendimiento de Estaciones y Personajes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 border border-slate-800 bg-slate-900/80 rounded-xl p-5 overflow-x-auto">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-white">
              02. Clasificación General en Vivo (Buchholz Tie-Breaker & Variación ELO)
            </h3>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              Meta mínima: {obf.event.guaranteedMinMatches} sets garantizados
            </span>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 font-mono">
                <th className="py-2.5 pr-3">Pos</th>
                <th className="py-2.5 px-3">Competidor</th>
                <th className="py-2.5 px-3">Personaje / Club</th>
                <th className="py-2.5 px-3 text-right">ELO (Δ)</th>
                <th className="py-2.5 px-3 text-right">V-D</th>
                <th className="py-2.5 px-3 text-right">Dif. Juegos</th>
                <th className="py-2.5 pl-3 text-right">Buchholz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {standings.map((row) => (
                <tr key={row.entrant.entrantID} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 pr-3 font-mono tabular-nums font-bold text-slate-200">
                    #{row.rank}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-white">{row.entrant.entrantTag}</div>
                    <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                      Seed #{row.entrant.initialSeed} · {row.entrant.country || 'CO'} · {row.entrant.teamName || 'Free Agent'}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">
                    {row.entrant.mainCharacter || 'N/A'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    <span className="text-slate-200">{row.entrant.eloRating}</span>{' '}
                    <span
                      className={
                        row.eloDelta > 0
                          ? 'text-emerald-400'
                          : row.eloDelta < 0
                          ? 'text-rose-400'
                          : 'text-slate-500'
                      }
                    >
                      ({row.eloDelta >= 0 ? `+${row.eloDelta}` : row.eloDelta})
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-white">
                    {row.wins}-{row.losses}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                    {row.gameDifferential >= 0 ? `+${row.gameDifferential}` : row.gameDifferential}
                  </td>
                  <td className="py-2.5 pl-3 text-right font-mono tabular-nums font-bold text-sky-400">
                    {row.buchholzScore} pts
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Estadísticas de Meta de Personajes y Rendimiento de Estaciones */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="border border-slate-800 bg-slate-900/80 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white pb-2 mb-3 border-b border-slate-800">
              Rendimiento por Personaje / Selección
            </h3>
            <div className="space-y-2.5">
              {characterStats.map((c) => (
                <div key={c.name} className="flex items-center justify-between text-xs">
                  <div>
                    <div className="font-medium text-slate-200">{c.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                      {c.picks} jugadores · ELO Prom. {c.avgElo}
                    </div>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-sky-400">
                    {c.wins} victorias
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-slate-800 bg-slate-900/80 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white pb-2 mb-3 border-b border-slate-800">
              Carga Operativa por Estación
            </h3>
            <div className="space-y-2.5">
              {stationStats.map(([st, stat]) => {
                const pct = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0;
                return (
                  <div key={st} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono tabular-nums">
                      <span className="text-slate-200 font-semibold">{st}</span>
                      <span className="text-slate-400">
                        {stat.completed}/{stat.total} completados ({stat.ready} listos)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full bg-sky-400 transition-all duration-200"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
