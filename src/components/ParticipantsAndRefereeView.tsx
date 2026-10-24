/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Gestión de Participantes (TOURNAMENT_ADMIN), Consola de Reporte de Estación Móvil (REFEREE / POOL_CAPTAIN / DeepSeek-VL),
 * Auto-Reporte Restringido de Competidor (PARTICIPANT / ENTRANT) y Quinielas en Vivo (SPECTATOR Pick-ems).
 */

import React, { useEffect, useState } from 'react';
import {
  OBFDocument,
  OBFEntrant,
  OBFSet,
  RBAC_PERMISSIONS_MATRIX,
  SetGameSelection,
  StandingsRow,
  UserRole,
} from '../engine/nikBracketsEngine';
import {
  ESPORTS_GAMES_CATALOG,
  resolveCatalogCharacter,
} from '../i18n/translations';
import {
  AlertTriangle,
  Camera,
  Check,
  Clock,
  Plus,
  RotateCcw,
  Shuffle,
  Trash2,
  Trophy,
  Tv,
  UserCheck,
} from 'lucide-react';

interface ParticipantsViewProps {
  obf: OBFDocument;
  standings: StandingsRow[];
  activeRole: UserRole;
  myEntrantID?: string | null;
  onAddEntrant: (entrant: Partial<OBFEntrant>) => Promise<void>;
  onToggleCheckIn: (entrantID: string) => Promise<void>;
  onRemoveEntrant: (entrantID: string) => Promise<void>;
  onReseedByElo: () => Promise<void>;
}

export const ParticipantsManagementView: React.FC<ParticipantsViewProps> = ({
  obf,
  standings,
  activeRole,
  myEntrantID = null,
  onAddEntrant,
  onToggleCheckIn,
  onRemoveEntrant,
  onReseedByElo,
}) => {
  const gameCatalog =
    ESPORTS_GAMES_CATALOG.find((g) => g.slug === obf.event.gameSlug) || ESPORTS_GAMES_CATALOG[0];

  const [tag, setTag] = useState<string>('');
  const [elo, setElo] = useState<number>(2010);
  const [mainChar, setMainChar] = useState<string>(gameCatalog.characters[0]);
  const [country, setCountry] = useState<string>('CO');
  const [team, setTeam] = useState<string>('Nexus Gaming');

  useEffect(() => {
    setMainChar(gameCatalog.characters[0]);
  }, [gameCatalog]);

  const canEdit = RBAC_PERMISSIONS_MATRIX[activeRole]?.canEditBracketsAndSeeds;
  const canCheckInAny =
    activeRole === 'SUPER_ADMIN' ||
    activeRole === 'TOURNAMENT_DIRECTOR' ||
    activeRole === 'REFEREE';

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tag.trim()) return;
    await onAddEntrant({
      entrantTag: tag.trim(),
      eloRating: elo,
      mainCharacter: mainChar,
      country,
      teamName: team,
    });
    setTag('');
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Formulario de Inscripción de Participante + Seeding Inteligente */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleAdd}
          className="lg:col-span-5 border border-slate-800 bg-slate-900/80 rounded-xl p-5 flex flex-col justify-between gap-4"
        >
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Inscribir Competidor al Árbol DAG
                </h2>
                <p className="text-[11px] text-slate-400">
                  {canEdit
                    ? 'Rol TOURNAMENT_ADMIN: Edición de llaves y seeding habilitada.'
                    : `Rol Contextual ${RBAC_PERMISSIONS_MATRIX[activeRole]?.codeStandard || activeRole}: Solo lectura de estructura.`}
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {obf.entrants.length} inscritos
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Gamertag Oficial</label>
                <input
                  type="text"
                  required
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  disabled={!canEdit}
                  placeholder="Ej. ShadowFighter#CO"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Rating ELO Inicial</label>
                <input
                  type="number"
                  min={800}
                  max={3200}
                  value={elo}
                  onChange={(e) => setElo(Number(e.target.value))}
                  disabled={!canEdit}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono tabular-nums text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">País (ISO-2)</label>
                <input
                  type="text"
                  maxLength={2}
                  value={country}
                  onChange={(e) => setCountry(e.target.value.toUpperCase())}
                  disabled={!canEdit}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Personaje Principal ({gameCatalog.characters.length} A-Z)
                </label>
                <select
                  value={mainChar}
                  onChange={(e) => setMainChar(e.target.value)}
                  disabled={!canEdit}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-50"
                >
                  {gameCatalog.characters.map((c, idx) => (
                    <option key={c} value={c}>
                      {idx + 1}. {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Equipo / Clan</label>
                <input
                  type="text"
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                  disabled={!canEdit}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onReseedByElo}
              disabled={!canEdit}
              className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 disabled:opacity-50 text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Shuffle className="w-3.5 h-3.5 text-sky-400" />
              Re-Balancear Seeds por ELO (2^k)
            </button>
            <button
              type="submit"
              disabled={!canEdit}
              className="px-4 py-2 rounded-lg bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-slate-950 font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Agregar y Regenerar DAG
            </button>
          </div>
        </form>

        {/* Lista de Participantes y Estado de Check-In (PARTICIPANT solo puede hacer Check-In de su propio registro) */}
        <div className="lg:col-span-7 border border-slate-800 bg-slate-900/80 rounded-xl p-5 overflow-x-auto">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-white">
                Padrón de Jugadores (EventParticipant), Seeding y Check-In
              </h2>
              <p className="text-[11px] text-slate-400">
                {activeRole === 'PLAYER'
                  ? 'Alcance PARTICIPANT: Solo puedes realizar Check-in en tu propio registro.'
                  : canCheckInAny
                  ? 'Alcance Staff (TOURNAMENT_ADMIN / REFEREE): Puedes validar el Check-in de cualquier jugador.'
                  : 'Vista de consulta en tiempo real.'}
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              Check-In: {obf.entrants.filter((e) => e.checkedIn).length}/{obf.entrants.length}
            </span>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400">
                <th className="py-2 pr-2">Seed</th>
                <th className="py-2 px-2">Gamertag</th>
                <th className="py-2 px-2">Main / Equipo</th>
                <th className="py-2 px-2 text-right">ELO</th>
                <th className="py-2 px-2 text-right">Récord</th>
                <th className="py-2 pl-2 text-right">Check-In / Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {obf.entrants.map((entrant) => {
                const st = standings.find((r) => r.entrant.entrantID === entrant.entrantID);
                const isMyEntrantRow = Boolean(myEntrantID && entrant.entrantID === myEntrantID);
                const canToggleThisCheckIn =
                  canCheckInAny || (activeRole === 'PLAYER' && isMyEntrantRow);

                return (
                  <tr
                    key={entrant.entrantID}
                    className={`hover:bg-slate-800/40 ${
                      isMyEntrantRow ? 'bg-sky-950/20' : ''
                    }`}
                  >
                    <td className="py-2.5 pr-2 font-mono tabular-nums font-bold text-sky-400">
                      #{entrant.initialSeed}
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="font-semibold text-white flex flex-wrap items-center gap-1.5">
                        <span>{entrant.entrantTag}</span>
                        {entrant.platform && entrant.inGameId && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] font-mono text-sky-300">
                            {entrant.platform}: {entrant.inGameId}
                          </span>
                        )}
                        {isMyEntrantRow && (
                          <span className="px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-400/40 text-[10px] font-mono text-sky-300">
                            TÚ
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        ID: {entrant.entrantID} · País: {entrant.country || 'CO'}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-slate-300">
                      <span className="font-semibold text-emerald-300">
                        MAIN: {entrant.mainCharacter || 'N/A'}
                      </span>
                      {entrant.secondaryCharacter && (
                        <span className="text-xs text-sky-300 ml-1">
                          / SEC: {entrant.secondaryCharacter}
                        </span>
                      )}{' '}
                      · <span className="text-slate-400">{entrant.teamName || 'Free'}</span>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums text-slate-200">
                      {entrant.eloRating}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono tabular-nums">
                      {st ? `${st.wins}V - ${st.losses}D` : '0V - 0D'}
                    </td>
                    <td className="py-2.5 pl-2 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={!canToggleThisCheckIn}
                          onClick={() => onToggleCheckIn(entrant.entrantID)}
                          title={
                            canToggleThisCheckIn
                              ? 'Alternar estado de Check-In'
                              : 'Solo puedes hacer Check-In en tu propio registro'
                          }
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1 disabled:opacity-45 ${
                            entrant.checkedIn
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          <UserCheck className="w-3 h-3" />
                          {entrant.checkedIn ? 'Check-In OK' : 'Pendiente'}
                        </button>
                        {canEdit && obf.entrants.length > 4 && (
                          <button
                            type="button"
                            onClick={() => onRemoveEntrant(entrant.entrantID)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-400"
                            title="Retirar jugador"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface RefereeStationConsoleProps {
  obf: OBFDocument;
  selectedSet: OBFSet;
  onSelectSet: (setID: string) => void;
  canReportScores: boolean;
  activeRole?: UserRole;
  assignedStation?: string | null;
  isAuthenticated?: boolean;
  myEntrantID?: string | null;
  myGamerTag?: string | null;
  onOpenLogin?: () => void;
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
  onVerifyVisionAi: (setID: string, proofUrl: string) => Promise<{
    detectedScore1: number;
    detectedScore2: number;
    confidence: number;
    analysisSummary: string;
  }>;
}

export const RefereeStationConsole: React.FC<RefereeStationConsoleProps> = ({
  obf,
  selectedSet,
  onSelectSet,
  canReportScores,
  activeRole = 'SPECTATOR',
  assignedStation = null,
  isAuthenticated = false,
  myEntrantID = null,
  myGamerTag = null,
  onOpenLogin,
  onConfirmScore,
  onCascadeReset,
  onVerifyVisionAi,
}) => {
  const gameCatalog =
    ESPORTS_GAMES_CATALOG.find((g) => g.slug === obf.event.gameSlug) || ESPORTS_GAMES_CATALOG[0];

  const p1 = obf.entrants.find((e) => e.entrantID === selectedSet.entrant1ID);
  const p2 = obf.entrants.find((e) => e.entrantID === selectedSet.entrant2ID);

  const isMySelectedSet = Boolean(
    myEntrantID &&
      (selectedSet.entrant1ID === myEntrantID || selectedSet.entrant2ID === myEntrantID)
  );

  const mySetsInTournament = obf.sets.filter(
    (s) =>
      myEntrantID &&
      (s.entrant1ID === myEntrantID || s.entrant2ID === myEntrantID)
  );
  const myNextPendingSet =
    mySetsInTournament.find((s) => s.status !== 'COMPLETED') || mySetsInTournament[0];

  const canCascadeReset =
    activeRole === 'SUPER_ADMIN' ||
    activeRole === 'TOURNAMENT_DIRECTOR' ||
    activeRole === 'REFEREE';

  const [score1, setScore1] = useState<number>(selectedSet.entrant1Score);
  const [score2, setScore2] = useState<number>(selectedSet.entrant2Score);
  const [char1, setChar1] = useState<string>(
    resolveCatalogCharacter(
      selectedSet.games?.[0]?.character1Slug || p1?.mainCharacter,
      gameCatalog.characters
    )
  );
  const [char2, setChar2] = useState<string>(
    resolveCatalogCharacter(
      selectedSet.games?.[0]?.character2Slug || p2?.mainCharacter || gameCatalog.characters[1],
      gameCatalog.characters
    )
  );
  const [stage, setStage] = useState<string>(gameCatalog.legalStages[0]);
  const [proofUrl, setProofUrl] = useState<string>(
    selectedSet.other.proofImageUrl || 'victory_capture_1080p.png'
  );
  const [disputeReason, setDisputeReason] = useState<string>(selectedSet.other.disputeReason || '');
  const [aiConfidence, setAiConfidence] = useState<number | undefined>(
    selectedSet.other.aiVerifiedConfidence
  );
  const [aiAnalysisText, setAiAnalysisText] = useState<string>('');
  const [verifyingAi, setVerifyingAi] = useState<boolean>(false);

  // Timer Reglamentario de 3 Minutos (180s) para Check-in / Disputa de Partida (REFEREE / POOL_CAPTAIN)
  const [disputeTimerSeconds, setDisputeTimerSeconds] = useState<number>(180);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  // Quinielas / Predicciones en Vivo (Pick-ems para SPECTATOR y Comunidad)
  const [pickemVotes, setPickemVotes] = useState<
    Record<string, { p1Votes: number; p2Votes: number; myPick?: 1 | 2 }>
  >({});

  useEffect(() => {
    setScore1(selectedSet.entrant1Score);
    setScore2(selectedSet.entrant2Score);
    setChar1(
      resolveCatalogCharacter(
        selectedSet.games?.[0]?.character1Slug || p1?.mainCharacter,
        gameCatalog.characters
      )
    );
    setChar2(
      resolveCatalogCharacter(
        selectedSet.games?.[0]?.character2Slug || p2?.mainCharacter || gameCatalog.characters[1],
        gameCatalog.characters
      )
    );
    setStage(gameCatalog.legalStages[0]);
    setDisputeReason(selectedSet.other.disputeReason || '');
    setAiConfidence(selectedSet.other.aiVerifiedConfidence);
    setDisputeTimerSeconds(180);
    setTimerRunning(selectedSet.status === 'IN_PROGRESS' || selectedSet.status === 'DISPUTED');
  }, [selectedSet, p1, p2, gameCatalog]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setDisputeTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const currentPickem = pickemVotes[selectedSet.setID] || {
    p1Votes: Math.max(12, (p1?.eloRating || 2000) - 1880),
    p2Votes: Math.max(10, (p2?.eloRating || 1980) - 1880),
    myPick: undefined,
  };
  const totalPickemVotes = Math.max(1, currentPickem.p1Votes + currentPickem.p2Votes);
  const p1PickPct = Math.round((currentPickem.p1Votes / totalPickemVotes) * 100);
  const p2PickPct = 100 - p1PickPct;

  const handleVotePickem = (slot: 1 | 2) => {
    setPickemVotes((prev) => {
      const existing = prev[selectedSet.setID] || currentPickem;
      if (existing.myPick === slot) return prev;
      return {
        ...prev,
        [selectedSet.setID]: {
          p1Votes: existing.p1Votes + (slot === 1 ? 1 : existing.myPick === 1 ? -1 : 0),
          p2Votes: existing.p2Votes + (slot === 2 ? 1 : existing.myPick === 2 ? -1 : 0),
          myPick: slot,
        },
      };
    });
  };

  const maxWins = Math.ceil(selectedSet.bestOf / 2);

  const handleSubmit = async (withDispute = false) => {
    await onConfirmScore({
      setID: selectedSet.setID,
      score1,
      score2,
      games: [
        {
          gameNumber: 1,
          character1Slug: char1,
          character2Slug: char2,
          stageSlug: stage,
          winnerEntrantID: score1 >= score2 ? p1?.entrantID : p2?.entrantID,
        },
      ],
      proofImageUrl: proofUrl,
      aiVerifiedConfidence: aiConfidence,
      disputeReason: withDispute ? disputeReason || 'Revisión arbitral solicitada en estación' : '',
    });
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <div className="text-xs font-mono text-sky-400">
            {selectedSet.setID} · {selectedSet.other.station || 'EST-01'} · Bo{selectedSet.bestOf}
          </div>
          <h3 className="text-sm font-semibold text-white mt-0.5">
            {selectedSet.roundLabel}
          </h3>
        </div>

        <select
          value={selectedSet.setID}
          onChange={(e) => onSelectSet(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-mono text-white"
        >
          {obf.sets.map((s) => {
            const isMine =
              myEntrantID && (s.entrant1ID === myEntrantID || s.entrant2ID === myEntrantID);
            return (
              <option key={s.setID} value={s.setID}>
                {s.setID} ({s.status}){isMine ? ' ★ TU PARTIDA' : ''}
              </option>
            );
          })}
        </select>
      </div>

      {/* BANNER DE PERMISOS SEGÚN ROL CONTEXTUAL DEL ESTÁNDAR */}
      {!isAuthenticated || activeRole === 'SPECTATOR' ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="text-slate-300">
            <span className="font-semibold text-white">Rol Contextual SPECTATOR (Solo Lectura):</span> Acceso libre al Canvas 3D y llaves. Participa abajo en las quinielas en vivo (<em>Pick-ems</em>).
          </div>
          {!isAuthenticated && onOpenLogin && (
            <button
              type="button"
              onClick={onOpenLogin}
              className="px-3 py-1.5 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer"
            >
              Iniciar Sesión
            </button>
          )}
        </div>
      ) : activeRole === 'STREAMER' ? (
        <div className="rounded-lg border border-purple-500/35 bg-purple-950/20 p-3 flex items-center justify-between gap-2 text-xs text-purple-200">
          <div className="flex items-center gap-2">
            <Tv className="w-4 h-4 text-purple-400 shrink-0" />
            <span>
              <strong className="text-white">Rol Contextual STREAMER / CASTER:</strong> Acceso WebSocket de <strong>solo lectura</strong>. Puedes ver el estado de las mesas y selecciones de personajes sin riesgo de alterar marcadores accidentalmente.
            </span>
          </div>
          <span className="font-mono text-[10px] text-purple-300 shrink-0">OBS SAFE MODE</span>
        </div>
      ) : activeRole === 'PAY_EDITOR' ? (
        <div className="rounded-lg border border-amber-500/35 bg-amber-950/20 p-3 text-xs text-amber-200">
          <strong className="text-white">Rol Contextual PAY_EDITOR / TREASURER:</strong> Gestión exclusiva de cobro de inscripciones QR y liberación de premios. Marcadores de partidas en solo lectura.
        </div>
      ) : activeRole === 'PLAYER' && !isMySelectedSet ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="text-amber-200">
            <span className="font-semibold text-white">Rol Contextual PARTICIPANT / ENTRANT ({myGamerTag}):</span> Alcance restringido a tus propias peleas. No puedes reportar marcadores de otros jugadores.
          </div>
          {myNextPendingSet && (
            <button
              type="button"
              onClick={() => onSelectSet(myNextPendingSet.setID)}
              className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer"
            >
              Ir a mi pelea ({myNextPendingSet.setID})
            </button>
          )}
        </div>
      ) : activeRole === 'PLAYER' && isMySelectedSet ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-300 flex items-center justify-between">
          <span>
            <strong className="text-white">EventParticipant Activo ({selectedSet.setID}):</strong> Puedes elegir personajes, adjuntar foto de victoria y reportar el resultado de tu partida.
          </span>
          <span className="font-mono text-[11px] text-emerald-400">MI PARTIDA</span>
        </div>
      ) : activeRole === 'REFEREE' ? (
        <div className="rounded-lg border border-emerald-500/35 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200 flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong className="text-white">Rol Contextual REFEREE / POOL_CAPTAIN:</strong> Poderes delegados en{' '}
            <span className="font-mono text-emerald-300">{assignedStation || 'Todas las Estaciones'}</span> para editar marcadores de cualquier partida y resolver disputas.
          </span>
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className={disputeTimerSeconds === 0 ? 'text-rose-400 font-bold' : 'text-amber-300'}>
              Timer 3m: {formatTimer(disputeTimerSeconds)}
            </span>
            <button
              type="button"
              onClick={() => setTimerRunning((r) => !r)}
              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              {timerRunning ? 'Pausar' : 'Iniciar 3m'}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-sky-500/30 bg-sky-950/20 px-3 py-2 text-xs text-sky-300 flex items-center justify-between">
          <span>
            <strong className="text-white">Rol Contextual TOURNAMENT_ADMIN (Director):</strong> Control total del evento, delegación de árbitros y modificación de cualquier marcador.
          </span>
          <span className="font-mono text-[11px] text-sky-400">CONTROL TOTAL</span>
        </div>
      )}

      {/* Controles Táctiles de Marcador + IDs de Consola y MAIN para Casters/Árbitros */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono text-slate-400">
              {p1 ? `Seed #${p1.initialSeed} · ELO ${p1.eloRating}` : 'Ranura 1'}
            </div>
            <div className="text-sm font-bold text-white truncate mt-0.5">
              {p1 ? p1.entrantTag : 'Esperando rival'}
            </div>
            {p1 && (
              <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] font-mono">
                <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-sky-300">
                  {p1.platform || 'PS5'}: {p1.inGameId || '349Q-tay4-YYH8'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                  MAIN: {p1.mainCharacter || char1}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-3">
            <div className="flex gap-1">
              {Array.from({ length: maxWins + 1 }, (_, val) => (
                <button
                  key={val}
                  type="button"
                  disabled={!canReportScores || !p1 || !p2}
                  onClick={() => setScore1(val)}
                  className={`w-8 h-9 rounded-lg font-mono tabular-nums text-xs font-bold transition-colors ${
                    score1 === val
                      ? 'bg-sky-400 text-slate-950'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  } disabled:opacity-40`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono text-slate-400">
              {p2 ? `Seed #${p2.initialSeed} · ELO ${p2.eloRating}` : 'Ranura 2'}
            </div>
            <div className="text-sm font-bold text-white truncate mt-0.5">
              {p2 ? p2.entrantTag : 'Esperando rival'}
            </div>
            {p2 && (
              <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] font-mono">
                <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-sky-300">
                  {p2.platform || 'PC_STEAM'}: {p2.inGameId || '2jdr-i7LF-23HT'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                  MAIN: {p2.mainCharacter || char2}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-3">
            <div className="flex gap-1">
              {Array.from({ length: maxWins + 1 }, (_, val) => (
                <button
                  key={val}
                  type="button"
                  disabled={!canReportScores || !p1 || !p2}
                  onClick={() => setScore2(val)}
                  className={`w-8 h-9 rounded-lg font-mono tabular-nums text-xs font-bold transition-colors ${
                    score2 === val
                      ? 'bg-rose-400 text-slate-950'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  } disabled:opacity-40`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Selección de Personajes (Roster Completo 44 Personajes A-Z en Tekken) y Escenario Legal */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        <div>
          <label className="block text-slate-400 mb-1">
            Personaje P1 ({gameCatalog.characters.length} A-Z)
          </label>
          <select
            value={char1}
            disabled={!canReportScores}
            onChange={(e) => setChar1(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-2 text-white disabled:opacity-50"
          >
            {gameCatalog.characters.map((c, idx) => (
              <option key={c} value={c}>
                {idx + 1}. {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-400 mb-1">
            Personaje P2 ({gameCatalog.characters.length} A-Z)
          </label>
          <select
            value={char2}
            disabled={!canReportScores}
            onChange={(e) => setChar2(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-2 text-white disabled:opacity-50"
          >
            {gameCatalog.characters.map((c, idx) => (
              <option key={c} value={c}>
                {idx + 1}. {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-400 mb-1">Escenario Legal</label>
          <select
            value={stage}
            disabled={!canReportScores}
            onChange={(e) => setStage(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-2 text-emerald-300 disabled:opacity-50"
          >
            {gameCatalog.legalStages.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Foto de Victoria / Verificación Multimodal con DeepSeek-VL */}
      <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 font-medium">
            Adjuntar Foto de Victoria / Verificación por Visión (DeepSeek-VL)
          </span>
          {aiConfidence !== undefined && (
            <span className="font-mono tabular-nums text-emerald-400">
              Confianza IA: {(aiConfidence * 100).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={proofUrl}
            disabled={!canReportScores}
            onChange={(e) => setProofUrl(e.target.value)}
            placeholder="URL o captura de victoria adjunta..."
            className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-mono text-white disabled:opacity-50"
          />
          <button
            type="button"
            disabled={!canReportScores || verifyingAi || !p1 || !p2}
            onClick={async () => {
              setVerifyingAi(true);
              try {
                const res = await onVerifyVisionAi(selectedSet.setID, proofUrl);
                setScore1(res.detectedScore1);
                setScore2(res.detectedScore2);
                setAiConfidence(res.confidence);
                setAiAnalysisText(res.analysisSummary);
              } finally {
                setVerifyingAi(false);
              }
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-medium text-sky-300 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Camera className="w-3.5 h-3.5" />
            {verifyingAi ? 'Analizando...' : 'Validar Captura'}
          </button>
        </div>
        {aiAnalysisText && (
          <p className="text-[11px] text-slate-300 leading-relaxed pt-1">
            {aiAnalysisText}
          </p>
        )}
      </div>

      {/* Quinielas / Predicciones en Vivo (Pick-ems para SPECTATOR y Público General) */}
      {p1 && p2 && (
        <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/90 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              Quiniela en Vivo (Spectator Pick-ems & Votación)
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {totalPickemVotes} votos en tiempo real
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleVotePickem(1)}
              className={`px-3 py-1.5 rounded-lg border text-left flex items-center justify-between transition-colors cursor-pointer ${
                currentPickem.myPick === 1
                  ? 'border-sky-400 bg-sky-500/15 text-white font-semibold'
                  : 'border-slate-800 bg-slate-900 hover:border-slate-700 text-slate-300'
              }`}
            >
              <span className="truncate">{p1.entrantTag}</span>
              <span className="font-mono text-sky-400 ml-2">{p1PickPct}%</span>
            </button>

            <button
              type="button"
              onClick={() => handleVotePickem(2)}
              className={`px-3 py-1.5 rounded-lg border text-left flex items-center justify-between transition-colors cursor-pointer ${
                currentPickem.myPick === 2
                  ? 'border-rose-400 bg-rose-500/15 text-white font-semibold'
                  : 'border-slate-800 bg-slate-900 hover:border-slate-700 text-slate-300'
              }`}
            >
              <span className="truncate">{p2.entrantTag}</span>
              <span className="font-mono text-rose-400 ml-2">{p2PickPct}%</span>
            </button>
          </div>
        </div>
      )}

      {/* Botones de Acción Arbitral / Reporte */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canCascadeReset}
            onClick={() => onCascadeReset(selectedSet.setID)}
            title="Solo REFEREE / POOL_CAPTAIN y TOURNAMENT_ADMIN pueden revertir sets en cascada"
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-xs text-slate-300 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
            Revertir Cascada
          </button>

          <button
            type="button"
            disabled={!canReportScores || !p1 || !p2}
            onClick={() => handleSubmit(true)}
            className="px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-950/30 hover:bg-amber-900/40 disabled:opacity-40 text-xs text-amber-300 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Solicitar Árbitro / Disputa
          </button>
        </div>

        <button
          type="button"
          disabled={!canReportScores || !p1 || !p2}
          onClick={() => handleSubmit(false)}
          className="px-4 py-2 rounded-lg bg-sky-400 hover:bg-sky-300 disabled:opacity-40 text-slate-950 font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Check className="w-4 h-4" />
          Confirmar Resultado O(1)
        </button>
      </div>
    </div>
  );
};
