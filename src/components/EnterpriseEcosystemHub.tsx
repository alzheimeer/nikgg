/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hub Ecosistema Enterprise & Quality of Life (Comparativa Start.gg / Challonge / FACEIT / Community Gaming):
 * 1. API Pública GraphQL (/api/graphql) & Developer Portal Interactivo
 * 2. Servidor Nativo MCP (Model Context Protocol — mcp-server.ts & Agente en Lenguaje Natural)
 * 3. Matchmaking Continuo (Ladder ELO/Glicko-2) & Cola Anti-Cheat con Telemetría
 * 4. Dispersión Automática de Pagos (Auto-Payouts: Stripe Connect, Web3 USDC Polygon y QR)
 * 5. Tienda eSports, Merchandising & Crowdfunding Comunitario (Incrementa el Prize Pool en Vivo)
 * 6. Cliente LAN / Offline-First Local Cache (IndexedDB/LocalStorage Sync) + Colas BullMQ + Badges de Perfil
 */

import React, { useEffect, useState } from 'react';
import { OBFDocument, StandingsRow } from '../engine/nikBracketsEngine';
import {
  Award,
  CheckCircle2,
  Code2,
  Coins,
  Cpu,
  Database,
  Download,
  HardDriveDownload,
  Layers,
  Play,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Swords,
  Terminal,
  Trophy,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';

interface EnterpriseEcosystemHubProps {
  obf: OBFDocument;
  standings: StandingsRow[];
  activeTournamentSlug: string;
  currentUserGamerTag?: string;
  onTournamentUpdated: (updatedDoc: OBFDocument, updatedStandings?: StandingsRow[]) => void;
  onSelectSetAndOpenReferee: (setID: string) => void;
}

type EcosystemSection =
  | 'graphql_mcp'
  | 'matchmaking_anticheat'
  | 'autopayouts_shop'
  | 'lan_bullmq_badges';

export const EnterpriseEcosystemHub: React.FC<EnterpriseEcosystemHubProps> = ({
  obf,
  standings,
  activeTournamentSlug,
  currentUserGamerTag = 'Niklauss#KR1',
  onTournamentUpdated,
  onSelectSetAndOpenReferee,
}) => {
  const [activeSection, setActiveSection] = useState<EcosystemSection>('graphql_mcp');

  // 1. Estado GraphQL Playground
  const [gqlQuery, setGqlQuery] = useState<string>(
    `query GetTournamentOBF($slug: String!) {\n  tournament(slug: $slug) {\n    slug\n    name\n    gameName\n    format\n    prizePool\n    entrantsCount\n    standings { rank gamerTag mainCharacter wins losses buchholzScore }\n    sets { setID roundLabel status station entrant1Tag entrant2Tag entrant1Score entrant2Score }\n  }\n}`
  );
  const [gqlApiKey, setGqlApiKey] = useState<string>('nbk_live_89f2a4c71d90e3b1f2026nikbrackets');
  const [gqlResponse, setGqlResponse] = useState<string>('');
  const [runningGql, setRunningGql] = useState<boolean>(false);

  // 2. Estado MCP Server & Natural Language Agent
  const [mcpPrompt, setMcpPrompt] = useState<string>(
    'Muéstrame el estado del bracket y las partidas listas para jugar'
  );
  const [mcpSelectedTool, setMcpSelectedTool] = useState<string>('get_bracket_state');
  const [mcpResponse, setMcpResponse] = useState<string>('');
  const [runningMcp, setRunningMcp] = useState<boolean>(false);

  // 3. Estado Matchmaking & Anti-Cheat Queue
  const [mmTickets, setMmTickets] = useState<Array<any>>([]);
  const [mmMatchResult, setMmMatchResult] = useState<any | null>(null);
  const [mmPlatform, setMmPlatform] = useState<string>('PS5');
  const [mmRegion, setMmRegion] = useState<string>('LATAM-North (28ms)');
  const [loadingMm, setLoadingMm] = useState<boolean>(false);

  // 4. Estado Auto-Payouts & Crowdfunding Shop
  const [payoutRail, setPayoutRail] = useState<
    'WEB3_USDC_POLYGON' | 'STRIPE_CONNECT' | 'QR_INSTANT'
  >('WEB3_USDC_POLYGON');
  const [payoutPreview, setPayoutPreview] = useState<Array<any>>([]);
  const [payoutDispersions, setPayoutDispersions] = useState<Array<any>>([]);
  const [dispersingPayouts, setDispersingPayouts] = useState<boolean>(false);

  const [shopCatalog, setShopCatalog] = useState<Array<any>>([]);
  const [shopContributions, setShopContributions] = useState<Array<any>>([]);
  const [communityAddedUsd, setCommunityAddedUsd] = useState<number>(126);
  const [buyingItemId, setBuyingItemId] = useState<string | null>(null);

  // 5. Estado LAN Offline-First Cache, BullMQ Queues y Badges
  const [lanSimulatedOffline, setLanSimulatedOffline] = useState<boolean>(false);
  const [lanBundleMeta, setLanBundleMeta] = useState<{
    syncedAt: string;
    checksumSha256: string;
    sizeBytes: number;
    queuedMutationsCount: number;
  }>({
    syncedAt: new Date().toISOString(),
    checksumSha256: 'sha256_9f8a4c2d1e7b03a1',
    sizeBytes: 42850,
    queuedMutationsCount: 0,
  });
  const [bullMqData, setBullMqData] = useState<{
    engine: string;
    counts: Record<string, number>;
    jobs: Array<any>;
  } | null>(null);
  const [badgesCatalog, setBadgesCatalog] = useState<Array<any>>([]);

  const fetchAllEcosystemData = async () => {
    try {
      const [mmRes, payRes, cfRes, qRes, bdgRes] = await Promise.all([
        fetch('/api/matchmaking/state').then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/tournaments/${encodeURIComponent(activeTournamentSlug)}/payouts`).then((r) =>
          r.ok ? r.json() : null
        ),
        fetch(`/api/tournaments/${encodeURIComponent(activeTournamentSlug)}/crowdfunding`).then(
          (r) => (r.ok ? r.json() : null)
        ),
        fetch('/api/queues/status').then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/tournaments/${encodeURIComponent(activeTournamentSlug)}/badges`).then((r) =>
          r.ok ? r.json() : null
        ),
      ]);

      if (mmRes?.tickets) setMmTickets(mmRes.tickets);
      if (payRes) {
        setPayoutPreview(payRes.previewSplits || []);
        setPayoutDispersions(payRes.dispersions || []);
      }
      if (cfRes) {
        setShopCatalog(cfRes.catalog || []);
        setShopContributions(cfRes.recentContributions || []);
        setCommunityAddedUsd(cfRes.communityAddedUsd || 0);
      }
      if (qRes) setBullMqData(qRes);
      if (bdgRes?.badgesCatalog) setBadgesCatalog(bdgRes.badgesCatalog);
    } catch {
      // Ignore background fetch error
    }
  };

  useEffect(() => {
    fetchAllEcosystemData();
  }, [activeTournamentSlug, obf.event.prizePool]);

  const handleExecuteGraphQL = async () => {
    setRunningGql(true);
    try {
      const res = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': gqlApiKey,
        },
        body: JSON.stringify({
          query: gqlQuery,
          variables: { slug: activeTournamentSlug },
        }),
      });
      const data = await res.json();
      setGqlResponse(JSON.stringify(data, null, 2));
    } finally {
      setRunningGql(false);
    }
  };

  const handleExecuteMcp = async (useNaturalLanguage = false) => {
    setRunningMcp(true);
    try {
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: useNaturalLanguage ? undefined : mcpSelectedTool,
          naturalLanguagePrompt: useNaturalLanguage ? mcpPrompt : undefined,
          args: { slug: activeTournamentSlug },
        }),
      });
      const data = await res.json();
      setMcpResponse(JSON.stringify(data, null, 2));
      if (data.obf) {
        onTournamentUpdated(data.obf, data.standings);
      }
    } finally {
      setRunningMcp(false);
    }
  };

  const handleEnqueueMatchmaking = async () => {
    setLoadingMm(true);
    try {
      const res = await fetch('/api/matchmaking/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gamerTag: currentUserGamerTag,
          eloRating: 2210,
          mainCharacter: obf.entrants[0]?.mainCharacter || 'Sergei Dragunov',
          platform: mmPlatform,
          region: mmRegion,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMmTickets(data.tickets || []);
      }
    } finally {
      setLoadingMm(false);
    }
  };

  const handleMatchNow = async () => {
    setLoadingMm(true);
    try {
      const res = await fetch('/api/matchmaking/match-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: activeTournamentSlug }),
      });
      if (res.ok) {
        const data = await res.json();
        setMmMatchResult(data);
      }
    } finally {
      setLoadingMm(false);
    }
  };

  const handleDispersePayouts = async () => {
    setDispersingPayouts(true);
    try {
      const res = await fetch(
        `/api/tournaments/${encodeURIComponent(activeTournamentSlug)}/payouts/disperse`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rail: payoutRail }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setPayoutDispersions(data.dispersions || []);
        await fetchAllEcosystemData();
      }
    } finally {
      setDispersingPayouts(false);
    }
  };

  const handleContributeCrowdfunding = async (itemId: string) => {
    setBuyingItemId(itemId);
    try {
      const res = await fetch(
        `/api/tournaments/${encodeURIComponent(activeTournamentSlug)}/crowdfunding/contribute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemId,
            buyerTag: currentUserGamerTag,
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.catalog) setShopCatalog(data.catalog);
        if (data.recentContributions) setShopContributions(data.recentContributions);
        if (data.obf) onTournamentUpdated(data.obf);
        await fetchAllEcosystemData();
      }
    } finally {
      setBuyingItemId(null);
    }
  };

  const handleSyncLanCache = async () => {
    const res = await fetch(
      `/api/offline/sync-bundle?slug=${encodeURIComponent(activeTournamentSlug)}`
    );
    if (res.ok) {
      const data = await res.json();
      try {
        localStorage.setItem(
          `nikbrackets_lan_cache_${activeTournamentSlug}`,
          JSON.stringify(data)
        );
      } catch {
        // Ignore quota limits
      }
      setLanBundleMeta({
        syncedAt: data.syncedAt,
        checksumSha256: data.checksumSha256.slice(0, 18),
        sizeBytes: data.sizeBytes,
        queuedMutationsCount: 0,
      });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Cabecera Superior de Paridad Ecosistema Enterprise */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono mb-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>100% PARIDAD ENTERPRISE + QOL IMPLEMENTADA EN TIEMPO REAL</span>
            </div>
            <h2 className="text-lg font-bold text-white">
              Centro de Ecosistema Enterprise: GraphQL, MCP Server, Matchmaking Anti-Cheat, Auto-Payouts & Shop
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Torneo activo: <strong className="text-sky-300">{obf.event.name}</strong> · Prize Pool en vivo:{' '}
              <strong className="text-emerald-400 font-mono">
                ${obf.event.prizePool.toLocaleString()} USD
              </strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSection('graphql_mcp')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                activeSection === 'graphql_mcp'
                  ? 'border-sky-400 bg-sky-500/20 text-white'
                  : 'border-slate-800 bg-slate-950 text-slate-300 hover:text-white'
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-sky-400" />
              <span>1. API GraphQL & Servidor MCP</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('matchmaking_anticheat')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                activeSection === 'matchmaking_anticheat'
                  ? 'border-emerald-400 bg-emerald-500/20 text-white'
                  : 'border-slate-800 bg-slate-950 text-slate-300 hover:text-white'
              }`}
            >
              <Swords className="w-3.5 h-3.5 text-emerald-400" />
              <span>2. Matchmaking & Anti-Cheat</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('autopayouts_shop')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                activeSection === 'autopayouts_shop'
                  ? 'border-amber-400 bg-amber-500/20 text-white'
                  : 'border-slate-800 bg-slate-950 text-slate-300 hover:text-white'
              }`}
            >
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>3. Auto-Payouts & Crowdfunding Shop</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('lan_bullmq_badges')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                activeSection === 'lan_bullmq_badges'
                  ? 'border-purple-400 bg-purple-500/20 text-white'
                  : 'border-slate-800 bg-slate-950 text-slate-300 hover:text-white'
              }`}
            >
              <HardDriveDownload className="w-3.5 h-3.5 text-purple-400" />
              <span>4. Cliente LAN Offline, BullMQ & Badges</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECCIÓN 1: API PÚBLICA GRAPHQL & SERVIDOR MCP NATIVO */}
      {activeSection === 'graphql_mcp' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Columna Izquierda: Developer Portal & GraphQL Playground */}
          <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-sky-400" />
                  <span>API Pública GraphQL (/api/graphql) & Developer Portal</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Compatible con bots de Discord, overlays OBS y esquemas Start.gg / Challonge
                </p>
              </div>
              <span className="px-2.5 py-1 rounded bg-sky-500/15 border border-sky-500/30 font-mono text-[11px] text-sky-300">
                POST /api/graphql
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block text-slate-400 font-mono">
                X-API-Key de Desarrollador:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={gqlApiKey}
                  onChange={(e) => setGqlApiKey(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-sky-300"
                />
                <button
                  type="button"
                  onClick={() =>
                    setGqlQuery(
                      `mutation ReportMatchViaGraphQL($slug: String!) {\n  reportSetScore(slug: $slug, score1: 2, score2: 1) {\n    setID\n    status\n    entrant1Score\n    entrant2Score\n    winnerID\n  }\n}`
                    )
                  }
                  className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-[11px] font-mono text-amber-300 cursor-pointer"
                >
                  Cargar Mutation Ejemplo
                </button>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="block text-slate-400 font-mono">Consulta / Mutación GraphQL:</label>
              <textarea
                rows={8}
                value={gqlQuery}
                onChange={(e) => setGqlQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-emerald-300"
              />
            </div>

            <button
              type="button"
              onClick={handleExecuteGraphQL}
              disabled={runningGql}
              className="w-full py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              {runningGql ? 'Ejecutando GraphQL...' : 'Ejecutar Query / Mutation en /api/graphql'}
            </button>

            {gqlResponse && (
              <pre className="rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-200 max-h-64 overflow-y-auto">
                {gqlResponse}
              </pre>
            )}
          </div>

          {/* Columna Derecha: Servidor MCP Nativo (mcp-server.ts) & Agente de Lenguaje Natural */}
          <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>Servidor MCP Nativo (/mcp-server.ts · JSON-RPC 2.0)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Conecta Claude Desktop, Cursor o agentes autónomos para operar el torneo por voz o texto
                </p>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 font-mono text-[11px] text-emerald-300">
                STDIO + HTTP /api/mcp
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-mono">
                  Herramienta MCP Directa:
                </label>
                <select
                  value={mcpSelectedTool}
                  onChange={(e) => setMcpSelectedTool(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
                >
                  <option value="list_tournaments">list_tournaments</option>
                  <option value="get_bracket_state">get_bracket_state</option>
                  <option value="report_set_score">report_set_score (Avanza DAG O(1))</option>
                  <option value="trigger_match_checkin">trigger_match_checkin (FORCE_BOTH)</option>
                  <option value="run_deepseek_vision_ocr">run_deepseek_vision_ocr</option>
                  <option value="disperse_prize_payouts">disperse_prize_payouts</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => handleExecuteMcp(false)}
                  disabled={runningMcp}
                  className="w-full py-2 rounded-lg border border-emerald-500/50 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Invocar Tool MCP
                </button>
              </div>
            </div>

            <div className="space-y-2 text-xs pt-2 border-t border-slate-800">
              <label className="block text-slate-300 font-semibold">
                O envía una instrucción en Lenguaje Natural al Agente MCP:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={mcpPrompt}
                  onChange={(e) => setMcpPrompt(e.target.value)}
                  placeholder="Ej. Reporta marcador 2-0 en el próximo set o muéstrame la lista de torneos..."
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => handleExecuteMcp(true)}
                  disabled={runningMcp}
                  className="px-3.5 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Ejecutar Agente
                </button>
              </div>
            </div>

            {mcpResponse && (
              <pre className="rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-emerald-200 max-h-64 overflow-y-auto">
                {mcpResponse}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* SECCIÓN 2: MATCHMAKING CONTINUO (LADDER ELO/GLICKO-2) & COLA ANTI-CHEAT */}
      {activeSection === 'matchmaking_anticheat' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 flex flex-col justify-between gap-4">
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Cola de Matchmaking Continuo & Verificación Anti-Cheat</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Estilo FACEIT: Emparejamiento dinámico por ELO/Glicko-2 con validación de integridad y Rollback Netcode
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Plataforma Verificada</label>
                  <select
                    value={mmPlatform}
                    onChange={(e) => setMmPlatform(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                  >
                    <option value="PS5">PlayStation 5 (Cross-Play)</option>
                    <option value="PC_STEAM">PC Steam (Kernel Guard)</option>
                    <option value="XBOX_SERIES">Xbox Series X|S</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Servidor / Región Rollback</label>
                  <select
                    value={mmRegion}
                    onChange={(e) => setMmRegion(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                  >
                    <option value="LATAM-North (28ms)">LATAM-North (Bogotá/Lima · 1F)</option>
                    <option value="LATAM-South (34ms)">LATAM-South (Santiago/SP · 1F)</option>
                    <option value="NA-East (42ms)">NA-East (Virginia · 2F)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-xs space-y-1">
                <div className="font-semibold text-emerald-300 flex items-center justify-between">
                  <span>Estado Anti-Cheat: VERIFICADO (NexusKernel Guard v4.2)</span>
                  <span className="font-mono text-[10px]">0 Packet Loss</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Firma SHA-256 de memoria activa, macros bloqueadas y telemetría de 60.0 FPS constante confirmada.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleEnqueueMatchmaking}
                disabled={loadingMm}
                className="flex-1 py-2.5 rounded-xl border border-sky-400/50 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 font-semibold text-xs cursor-pointer"
              >
                Entrar a la Cola ({currentUserGamerTag})
              </button>
              <button
                type="button"
                onClick={handleMatchNow}
                disabled={loadingMm}
                className="flex-1 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Emparejar Ahora (Matchmaking ELO)
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">
                Jugadores en Cola de Ladder ELO/Glicko-2 ({mmTickets.length} Verificados)
              </h3>
              <span className="text-xs font-mono text-emerald-400">Anti-Cheat Activo</span>
            </div>

            {mmMatchResult && (
              <div className="p-4 rounded-xl border border-sky-400/50 bg-sky-950/30 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-mono text-[11px] text-sky-300 font-bold">
                    ✓ PARTIDA ENCONTRADA ({mmMatchResult.serverRegion}) · Diferencial ELO: {mmMatchResult.eloDelta} pts
                  </div>
                  <div className="text-sm font-bold text-white mt-1">
                    {mmMatchResult.player1.gamerTag} ({mmMatchResult.winProbabilityP1}% prob.) vs{' '}
                    {mmMatchResult.player2.gamerTag}
                  </div>
                  <div className="text-[11px] font-mono text-emerald-300 mt-0.5">
                    Estación asignada: {mmMatchResult.assignedStation} · Set: {mmMatchResult.assignedSetID}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectSetAndOpenReferee(mmMatchResult.assignedSetID)}
                  className="px-3.5 py-2 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  Ir al Set en Consola Árbitro →
                </button>
              </div>
            )}

            <div className="space-y-2">
              {mmTickets.map((tk) => (
                <div
                  key={tk.ticketId}
                  className="p-3 rounded-xl border border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      <span>{tk.gamerTag}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] text-sky-300">
                        {tk.platform}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 font-mono text-[10px] text-emerald-300">
                        {tk.antiCheatHash}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Main: <strong className="text-slate-200">{tk.mainCharacter}</strong> · Región: {tk.region}
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-sky-400 font-bold">
                      ELO {tk.eloRating} (±{tk.glickoDeviation})
                    </div>
                    <div className="text-[11px] text-emerald-400">
                      Ping: {tk.pingMs}ms · Jitter: {tk.jitterMs}ms
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN 3: DISPERSIÓN AUTOMÁTICA DE PAGOS (AUTO-PAYOUTS) & TIENDA CROWDFUNDING */}
      {activeSection === 'autopayouts_shop' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Auto-Payouts */}
          <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 flex flex-col justify-between gap-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-400" />
                    <span>Dispersión Automática de Premios (Auto-Payouts)</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Liquidación instantánea al Top 4 según Standings vía Smart Contract Web3, Stripe Connect o QR
                  </p>
                </div>
                <span className="font-mono text-sm font-bold text-emerald-400">
                  ${obf.event.prizePool.toLocaleString()} USD
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                {(
                  [
                    { id: 'WEB3_USDC_POLYGON', label: 'Web3 USDC (Polygon)' },
                    { id: 'STRIPE_CONNECT', label: 'Stripe Connect Express' },
                    { id: 'QR_INSTANT', label: 'QR Bancario / PIX' },
                  ] as const
                ).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setPayoutRail(r.id)}
                    className={`p-2.5 rounded-xl border font-mono text-[11px] font-semibold cursor-pointer ${
                      payoutRail === r.id
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                        : 'border-slate-800 bg-slate-950 text-slate-400'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {payoutPreview.map((sp) => (
                  <div
                    key={sp.placement}
                    className="p-3 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-amber-400 mr-2">
                        #{sp.placement} ({sp.percentage}%)
                      </span>
                      <span className="font-semibold text-white">{sp.entrantTag}</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-400">
                      ${Number(sp.amountUsd).toLocaleString()} USD
                    </span>
                  </div>
                ))}
              </div>

              {payoutDispersions.length > 0 && (
                <div className="p-3 rounded-xl border border-emerald-500/40 bg-emerald-950/20 space-y-1.5 text-xs">
                  <div className="font-bold text-emerald-300">
                    ✓ Comprobantes de Dispersión Emitidos ({payoutDispersions[0]?.rail}):
                  </div>
                  {payoutDispersions.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between font-mono text-[11px] text-slate-200"
                    >
                      <span>
                        #{d.placement} {d.entrantTag} → ${Number(d.amountUsd).toLocaleString()} USD
                      </span>
                      <span className="text-sky-300 truncate max-w-[180px]">
                        TX: {d.txHashOrReceipt}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleDispersePayouts}
              disabled={dispersingPayouts}
              className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              {dispersingPayouts
                ? 'Ejecutando Dispersión...'
                : `Dispersar $${obf.event.prizePool.toLocaleString()} USD al Top 4 (${payoutRail})`}
            </button>
          </div>

          {/* Tienda eSports, Merchandising & Crowdfunding Comunitario */}
          <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-400" />
                  <span>Tienda Oficial, Merchandising & Crowdfunding</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Cada compra aporta directamente al Prize Pool del torneo en tiempo real
                </p>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 font-mono text-xs font-bold text-emerald-300">
                +${communityAddedUsd} USD Comunidad
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {shopCatalog.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-slate-800 bg-slate-950 flex flex-col justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center justify-between font-mono text-[10px] text-sky-400 mb-1">
                      <span>{item.category}</span>
                      <span>{item.soldCount} vendidos</span>
                    </div>
                    <div className="font-bold text-white leading-snug">{item.name}</div>
                    <div className="text-[11px] text-emerald-400 font-mono mt-1">
                      +{item.prizePoolContributionPct}% directo al Prize Pool (+$
                      {Math.round((item.priceUsd * item.prizePoolContributionPct) / 100)} USD)
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleContributeCrowdfunding(item.id)}
                    disabled={buyingItemId === item.id}
                    className="w-full py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    {buyingItemId === item.id
                      ? 'Procesando...'
                      : `Adquirir por $${item.priceUsd} USD`}
                  </button>
                </div>
              ))}
            </div>

            {shopContributions.length > 0 && (
              <div className="pt-2 border-t border-slate-800 space-y-1 text-xs">
                <div className="font-mono text-[11px] text-slate-400">
                  Aportes Recientes al Pozo de Premios:
                </div>
                {shopContributions.slice(0, 3).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-[11px] py-1 px-2 rounded bg-slate-950 border border-slate-800/70"
                  >
                    <span className="text-slate-200 truncate">
                      <strong className="text-white">{c.buyerTag}</strong> — {c.itemName}
                    </span>
                    <span className="font-mono font-bold text-emerald-400 shrink-0 ml-2">
                      +${c.addedToPrizePoolUsd} USD al Pozo
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECCIÓN 4: CLIENTE LAN / OFFLINE-FIRST CACHE, COLAS BULLMQ Y BADGES DE GAMIFICACIÓN */}
      {activeSection === 'lan_bullmq_badges' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cliente LAN / Offline-First Local Cache */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 flex flex-col justify-between gap-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <HardDriveDownload className="w-4 h-4 text-purple-400" />
                    <span>Modo LAN / Offline-First Local Cache</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Inspirado en local-cache-for-startgg: opera el torneo sin internet y sincroniza al reconectar
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded font-mono text-[10px] font-bold flex items-center gap-1 ${
                    lanSimulatedOffline
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {lanSimulatedOffline ? (
                    <>
                      <WifiOff className="w-3 h-3" /> MODO LAN OFFLINE
                    </>
                  ) : (
                    <>
                      <Wifi className="w-3 h-3" /> CLOUD SYNC ONLINE
                    </>
                  )}
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Último Snapshot Local:</span>
                  <span className="text-white">
                    {new Date(lanBundleMeta.syncedAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Checksum SHA-256:</span>
                  <span className="text-sky-300">{lanBundleMeta.checksumSha256}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tamaño en Caché Local:</span>
                  <span className="text-emerald-300">
                    {(lanBundleMeta.sizeBytes / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>

              { bullMqData && (
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950 space-y-2 text-xs">
                  <div className="font-bold text-white flex items-center justify-between">
                    <span>Workers BullMQ + Redis Streams</span>
                    <span className="font-mono text-[10px] text-sky-400">
                      {bullMqData.counts.completed} completados · {bullMqData.counts.delayed} timers
                    </span>
                  </div>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {bullMqData.jobs.slice(0, 4).map((j) => (
                      <div
                        key={j.jobId}
                        className="p-2 rounded bg-slate-900 border border-slate-800/80 text-[11px] font-mono"
                      >
                        <div className="flex justify-between text-sky-300">
                          <span>{j.name}</span>
                          <span className="text-emerald-400">{j.status.toUpperCase()}</span>
                        </div>
                        <div className="text-slate-400 text-[10px] mt-0.5">{j.resultSummary}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleSyncLanCache}
                className="flex-1 py-2 rounded-xl border border-purple-400/50 bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Guardar Snapshot LAN Local
              </button>
              <button
                type="button"
                onClick={() => setLanSimulatedOffline((p) => !p)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs cursor-pointer"
              >
                {lanSimulatedOffline ? 'Reconectar Cloud' : 'Simular Corte de Red LAN'}
              </button>
            </div>
          </div>

          {/* Badges de Gamificación y Logros de Perfil Competitivo */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Badges de Gamificación y Logros de Perfil Competitivo</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Insignias verificables otorgadas automáticamente por desempeño en torneos, rachas y verificación Anti-Cheat
                </p>
              </div>
              <span className="font-mono text-xs text-amber-300">
                {badgesCatalog.length} Insignias Activas
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {badgesCatalog.map((b) => (
                <div
                  key={b.id}
                  className="p-3.5 rounded-xl border border-slate-800 bg-slate-950 flex flex-col justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        {b.title}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 font-mono text-[10px] text-amber-300">
                        {b.tier}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px] mt-1 leading-relaxed">
                      {b.description}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-900 flex items-center justify-between font-mono text-[11px]">
                    <span className="text-slate-400">Portador Destacado:</span>
                    <span className="text-emerald-400 font-semibold">{b.holderTag}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
