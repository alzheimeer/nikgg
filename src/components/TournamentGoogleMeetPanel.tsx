import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  LayoutGrid,
  Lock,
  MessageSquare,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Swords,
  Trash2,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  getGoogleAccessToken,
  initWorkspaceAuth,
  signInWithGoogleForMeet,
} from '../lib/firebase';
import {
  createInitialBracketChatMessage,
  formatTournamentBracketText,
  type ChatBracketDisplayMode,
  type GoogleMeetAccessType,
  type OBFDocument,
  type OBFEntrant,
  type OBFSet,
  type TournamentChatMessage,
  type TournamentGoogleMeetSession,
  type UserRole,
} from '../engine/nikBracketsEngine';
import type { AuthenticatedUser } from './AuthAndUsersModal';

interface TournamentGoogleMeetPanelProps {
  obfDoc: OBFDocument;
  currentUser: AuthenticatedUser | null;
  authToken: string;
  effectiveRole: UserRole;
  activeTab?: string;
  onMeetSessionUpdated: (updatedDoc: OBFDocument) => void;
  onOpenSelfRegister: () => void;
  onOpenAuthModal: () => void;
  onSelectSet?: (setID: string) => void;
}

interface PendingConfirmAction {
  type: 'UPDATE_ACCESS_TYPE' | 'REPLACE_SPACE' | 'UNLINK_SPACE';
  title: string;
  description: string;
  targetAccessType?: GoogleMeetAccessType;
}

export const TournamentGoogleMeetPanel: React.FC<TournamentGoogleMeetPanelProps> = ({
  obfDoc,
  currentUser,
  authToken,
  effectiveRole,
  activeTab,
  onMeetSessionUpdated,
  onOpenSelfRegister,
  onOpenAuthModal,
  onSelectSet,
}) => {
  const [googleAccessToken, setLocalGoogleToken] = useState<string | null>(() =>
    getGoogleAccessToken()
  );
  const [needsGoogleAuth, setNeedsGoogleAuth] = useState<boolean>(!getGoogleAccessToken());
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(true);
  const [bracketViewMode, setBracketViewMode] = useState<ChatBracketDisplayMode>('BOTH');
  const [phaseFilter, setPhaseFilter] = useState<string>('ALL');
  const [chatInput, setChatInput] = useState<string>('');
  const [isSendingChat, setIsSendingChat] = useState<boolean>(false);
  const [copiedBracketText, setCopiedBracketText] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [desiredTopic, setDesiredTopic] = useState<string>(
    `Lobby Oficial — ${obfDoc.event.name}`
  );
  const [desiredAccessType, setDesiredAccessType] =
    useState<GoogleMeetAccessType>('OPEN');
  const [liveSpaceDetails, setLiveSpaceDetails] = useState<{
    name?: string;
    meetingUri?: string;
    meetingCode?: string;
    accessType?: string;
    activeConferenceRecord?: string | null;
  } | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmAction | null>(
    null
  );

  const meetSession = obfDoc.event.googleMeet || null;

  useEffect(() => {
    setDesiredTopic(`Lobby Oficial — ${obfDoc.event.name}`);
    setLiveSpaceDetails(null);
    setErrorMsg('');
    setStatusMsg('');
    setPhaseFilter('ALL');
  }, [obfDoc.event.tournamentSlug, obfDoc.event.name]);

  // Al cambiar de pestaña en el menú superior, colapsar paneles secundarios para que la vista seleccionada sea visible de inmediato
  useEffect(() => {
    if (activeTab && activeTab !== 'landing') {
      setIsChatOpen(false);
      setIsExpanded(false);
    }
  }, [activeTab]);

  useEffect(() => {
    const unsubscribe = initWorkspaceAuth(
      (_user, token) => {
        setLocalGoogleToken(token);
        setNeedsGoogleAuth(false);
      },
      () => {
        const current = getGoogleAccessToken();
        setLocalGoogleToken(current);
        setNeedsGoogleAuth(!current);
      }
    );
    return () => unsubscribe();
  }, []);

  // Mapa rápido O(1) de inscritos para renderizar el bracket 2D y Texto
  const entrantMap = useMemo(() => {
    const map = new Map<string, OBFEntrant>();
    for (const e of obfDoc.entrants) {
      map.set(e.entrantID, e);
    }
    return map;
  }, [obfDoc.entrants]);

  // Verifica si el usuario actual está inscrito específicamente en este torneo
  const matchedEntrant = useMemo(() => {
    if (!currentUser) return null;
    const normalizedGamerTag = (currentUser.gamerTag || '').trim().toLowerCase();
    const normalizedBaseTag = normalizedGamerTag.split('#')[0];
    const normalizedDisplay = (currentUser.displayName || '').trim().toLowerCase();
    const userGameIds = new Set(
      (currentUser.gameAccounts || []).map((acc) => (acc.inGameId || '').trim().toLowerCase())
    );

    return (
      obfDoc.entrants.find((e) => {
        const tag = (e.entrantTag || '').trim().toLowerCase();
        const tagBase = tag.split('#')[0];
        const eGameId = (e.inGameId || '').trim().toLowerCase();
        return (
          (normalizedGamerTag && tag === normalizedGamerTag) ||
          (normalizedBaseTag && tagBase === normalizedBaseTag) ||
          (normalizedDisplay && tag === normalizedDisplay) ||
          (eGameId && userGameIds.has(eGameId))
        );
      }) || null
    );
  }, [currentUser, obfDoc.entrants]);

  const isTournamentStaff =
    effectiveRole === 'SUPER_ADMIN' ||
    effectiveRole === 'TOURNAMENT_DIRECTOR' ||
    effectiveRole === 'REFEREE' ||
    effectiveRole === 'STREAMER';

  const canJoinTournamentMeet = Boolean(matchedEntrant) || isTournamentStaff;

  // Texto completo de todos los brackets ("quién contra quién le toca")
  const formattedBracketText = useMemo(
    () => formatTournamentBracketText(obfDoc),
    [obfDoc]
  );

  // Agrupación de rondas para el Mini-Bracket 2D dentro del chat
  const rounds2D = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        phase: string;
        round: number;
        roundLabel: string;
        sets: OBFSet[];
      }
    >();
    for (const s of obfDoc.sets) {
      if (phaseFilter !== 'ALL' && s.phase !== phaseFilter) continue;
      const key = `${s.phase}__${s.round}__${s.roundLabel}`;
      const existing = map.get(key);
      if (existing) {
        existing.sets.push(s);
      } else {
        map.set(key, {
          key,
          phase: s.phase,
          round: s.round,
          roundLabel: s.roundLabel,
          sets: [s],
        });
      }
    }
    return Array.from(map.values());
  }, [obfDoc.sets, phaseFilter]);

  const availablePhases = useMemo(() => {
    const phases = new Set<string>();
    for (const s of obfDoc.sets) {
      phases.add(s.phase);
    }
    return Array.from(phases);
  }, [obfDoc.sets]);

  // Mensajes del chat garantizando que apenas se cree/inicie siempre salga primero el mensaje con todos los brackets
  const chatMessages = useMemo<TournamentChatMessage[]>(() => {
    const existing = obfDoc.event.chatMessages || [];
    const hasBracketAnnouncement = existing.some(
      (m) => m.messageType === 'BRACKET_ANNOUNCEMENT'
    );
    if (existing.length > 0 && hasBracketAnnouncement) {
      return existing;
    }
    const autoInitial = createInitialBracketChatMessage(obfDoc);
    return [autoInitial, ...existing];
  }, [obfDoc]);

  const resolveSlotSummary = (
    entrantID: string | null,
    slotIndex: 1 | 2,
    set: OBFSet
  ): {
    tag: string;
    seed?: number;
    character?: string;
    platform?: string;
    isPending: boolean;
    isCurrentUser: boolean;
  } => {
    if (entrantID) {
      const ent = entrantMap.get(entrantID);
      if (ent) {
        return {
          tag: ent.entrantTag,
          seed: ent.initialSeed,
          character: ent.mainCharacter,
          platform: ent.platform,
          isPending: false,
          isCurrentUser: matchedEntrant?.entrantID === ent.entrantID,
        };
      }
      return {
        tag: entrantID,
        isPending: false,
        isCurrentUser: false,
      };
    }

    const incomingWin = obfDoc.sets.find(
      (s) => s.nextWinSetID === set.setID && (s.nextWinSlot === slotIndex || !s.nextWinSlot)
    );
    if (incomingWin) {
      return {
        tag: `Ganador [${incomingWin.setID}]`,
        isPending: true,
        isCurrentUser: false,
      };
    }
    const incomingLose = obfDoc.sets.find(
      (s) => s.nextLoseSetID === set.setID && (s.nextLoseSlot === slotIndex || !s.nextLoseSlot)
    );
    if (incomingLose) {
      return {
        tag: `Perdedor [${incomingLose.setID}]`,
        isPending: true,
        isCurrentUser: false,
      };
    }
    return {
      tag: 'Por definir (TBD)',
      isPending: true,
      isCurrentUser: false,
    };
  };

  const handleCopyBracketText = () => {
    navigator.clipboard?.writeText(formattedBracketText);
    setCopiedBracketText(true);
    setTimeout(() => setCopiedBracketText(false), 2500);
  };

  const handleSendChatMessage = async (
    e?: React.FormEvent,
    overrideType?: 'BRACKET_ANNOUNCEMENT' | 'USER_MESSAGE'
  ) => {
    if (e) e.preventDefault();
    const messageType = overrideType || 'USER_MESSAGE';
    if (messageType === 'USER_MESSAGE' && !chatInput.trim()) return;

    if (!currentUser || !authToken) {
      onOpenAuthModal();
      return;
    }

    setIsSendingChat(true);
    setErrorMsg('');
    try {
      const res = await fetch(
        `/api/tournaments/${obfDoc.event.tournamentSlug}/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            text:
              messageType === 'BRACKET_ANNOUNCEMENT'
                ? `📋 Brackets publicados por ${currentUser.displayName} (${currentUser.gamerTag}) — Quién contra quién le toca:`
                : chatInput.trim(),
            messageType,
            bracketDisplayMode: bracketViewMode,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al enviar mensaje al chat del torneo.');
      }
      if (messageType === 'USER_MESSAGE') {
        setChatInput('');
      } else {
        setStatusMsg(
          'Brackets de quién contra quién publicados en el chat en vivo para todos los participantes.'
        );
      }
      if (data.obf) {
        onMeetSessionUpdated(data.obf);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo enviar el mensaje al chat.');
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleGoogleMeetAuth = async () => {
    setErrorMsg('');
    setStatusMsg('');
    setIsLoading(true);
    try {
      const result = await signInWithGoogleForMeet();
      setLocalGoogleToken(result.accessToken);
      setNeedsGoogleAuth(false);
      setStatusMsg('Cuenta de Google Meet vinculada correctamente en memoria.');
    } catch (err: any) {
      setErrorMsg(
        err?.message || 'No se pudo autorizar Google Meet. Verifica la ventana emergente.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const persistMeetToTournament = async (
    nextMeet: TournamentGoogleMeetSession | null
  ) => {
    if (!authToken) {
      throw new Error(
        'Inicia sesión en la plataforma para guardar la sala de Google Meet en el torneo.'
      );
    }
    const res = await fetch(
      `/api/tournaments/${obfDoc.event.tournamentSlug}/google-meet`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ googleMeet: nextMeet }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        data.error || 'Error al vincular la sesión de Google Meet con el torneo.'
      );
    }
    if (data.obf) {
      onMeetSessionUpdated(data.obf);
    }
  };

  const executeCreateGoogleMeetSpace = async () => {
    setErrorMsg('');
    setStatusMsg('');
    const token = googleAccessToken || getGoogleAccessToken();
    if (!token) {
      setNeedsGoogleAuth(true);
      setErrorMsg('Autoriza tu cuenta con Google para crear una sala de Google Meet.');
      return;
    }
    if (!currentUser || !authToken) {
      onOpenAuthModal();
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('https://meet.googleapis.com/v2/spaces', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: {
            accessType: desiredAccessType,
          },
        }),
      });

      if (response.status === 401 || response.status === 403) {
        setNeedsGoogleAuth(true);
        throw new Error(
          'Tu sesión de Google Meet expiró o requiere permisos adicionales. Conéctate con Google nuevamente.'
        );
      }

      const spaceData = await response.json();
      if (!response.ok) {
        throw new Error(
          spaceData?.error?.message ||
            'No se pudo crear el espacio en Google Meet API v2.'
        );
      }

      const newSession: TournamentGoogleMeetSession = {
        spaceName: spaceData.name,
        meetingUri:
          spaceData.meetingUri ||
          `https://meet.google.com/${spaceData.meetingCode || ''}`,
        meetingCode: spaceData.meetingCode || spaceData.name?.replace('spaces/', ''),
        accessType:
          (spaceData.config?.accessType as GoogleMeetAccessType) || desiredAccessType,
        topic: desiredTopic.trim() || `Lobby Oficial — ${obfDoc.event.name}`,
        createdByEmail: currentUser.email,
        createdByName: currentUser.displayName,
        createdAt: new Date().toISOString(),
      };

      await persistMeetToTournament(newSession);
      setLiveSpaceDetails({
        name: spaceData.name,
        meetingUri: spaceData.meetingUri,
        meetingCode: spaceData.meetingCode,
        accessType: spaceData.config?.accessType || desiredAccessType,
        activeConferenceRecord: spaceData.activeConference?.conferenceRecord || null,
      });

      // Abrir automáticamente el chat con todos los brackets en Texto + 2D y copiar al portapapeles para pegar en Google Meet
      setIsChatOpen(true);
      navigator.clipboard?.writeText(
        formatTournamentBracketText({
          ...obfDoc,
          event: { ...obfDoc.event, googleMeet: newSession },
        })
      );
      setCopiedBracketText(true);
      setTimeout(() => setCopiedBracketText(false), 3000);

      setStatusMsg(
        `Sala Google Meet (${newSession.meetingCode}) creada. ¡Todos los brackets de quién contra quién ya están publicados en el chat (Texto y 2D) y copiados a tu portapapeles!`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al crear la sala de Google Meet.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInspectSpaceStatus = async () => {
    if (!meetSession?.spaceName) return;
    setErrorMsg('');
    setStatusMsg('');
    const token = googleAccessToken || getGoogleAccessToken();
    if (!token) {
      setNeedsGoogleAuth(true);
      setErrorMsg(
        'Conéctate con Google para consultar el estado en vivo del espacio en Google Meet API.'
      );
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `https://meet.googleapis.com/v2/${meetSession.spaceName}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (res.status === 401 || res.status === 403) {
        setNeedsGoogleAuth(true);
        throw new Error('Permiso requerido: vuelve a iniciar sesión con Google.');
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data?.error?.message || 'No se pudo consultar el estado de la sala en Google Meet.'
        );
      }

      setLiveSpaceDetails({
        name: data.name,
        meetingUri: data.meetingUri,
        meetingCode: data.meetingCode,
        accessType: data.config?.accessType || meetSession.accessType,
        activeConferenceRecord: data.activeConference?.conferenceRecord || null,
      });
      setStatusMsg('Estado de la sala sincronizado desde Google Meet API v2.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al consultar la sala en Google Meet.');
    } finally {
      setIsLoading(false);
    }
  };

  const executeUpdateAccessType = async (nextAccessType: GoogleMeetAccessType) => {
    if (!meetSession?.spaceName) return;
    setErrorMsg('');
    setStatusMsg('');
    const token = googleAccessToken || getGoogleAccessToken();
    if (!token) {
      setNeedsGoogleAuth(true);
      setErrorMsg(
        'Conéctate con Google para modificar la configuración de acceso de la sala.'
      );
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `https://meet.googleapis.com/v2/${meetSession.spaceName}?updateMask=config.accessType`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            config: {
              accessType: nextAccessType,
            },
          }),
        }
      );

      if (res.status === 401 || res.status === 403) {
        setNeedsGoogleAuth(true);
        throw new Error('Se requiere autorización con Google para editar la sala.');
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data?.error?.message ||
            'No se pudo actualizar la configuración del espacio en Google Meet.'
        );
      }

      const updatedSession: TournamentGoogleMeetSession = {
        ...meetSession,
        accessType: (data.config?.accessType as GoogleMeetAccessType) || nextAccessType,
        updatedAt: new Date().toISOString(),
      };

      await persistMeetToTournament(updatedSession);
      setLiveSpaceDetails((prev) => ({
        ...prev,
        accessType: updatedSession.accessType,
      }));
      setStatusMsg(
        `Configuración de Google Meet actualizada a ${updatedSession.accessType}.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al actualizar ajustes de Google Meet.');
    } finally {
      setIsLoading(false);
    }
  };

  const executeUnlinkSpace = async () => {
    setErrorMsg('');
    setStatusMsg('');
    setIsLoading(true);
    try {
      await persistMeetToTournament(null);
      setLiveSpaceDetails(null);
      setStatusMsg('La sesión de Google Meet fue desvinculada del torneo.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo desvincular la sala.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmPendingAction = async () => {
    if (!pendingConfirm) return;
    const action = pendingConfirm;
    setPendingConfirm(null);

    if (action.type === 'UPDATE_ACCESS_TYPE' && action.targetAccessType) {
      await executeUpdateAccessType(action.targetAccessType);
    } else if (action.type === 'REPLACE_SPACE') {
      await executeCreateGoogleMeetSpace();
    } else if (action.type === 'UNLINK_SPACE') {
      await executeUnlinkSpace();
    }
  };

  const handleCopyCode = () => {
    if (!meetSession) return;
    navigator.clipboard?.writeText(meetSession.meetingUri);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Partida actual del jugador inscrito (si tiene una activa o lista)
  const myNextSet = useMemo(() => {
    if (!matchedEntrant) return null;
    return (
      obfDoc.sets.find(
        (s) =>
          (s.entrant1ID === matchedEntrant.entrantID ||
            s.entrant2ID === matchedEntrant.entrantID) &&
          s.status !== 'COMPLETED'
      ) ||
      obfDoc.sets.find(
        (s) =>
          s.entrant1ID === matchedEntrant.entrantID ||
          s.entrant2ID === matchedEntrant.entrantID
      ) ||
      null
    );
  }, [matchedEntrant, obfDoc.sets]);

  return (
    <div className="mb-3 rounded-xl border border-emerald-500/30 bg-slate-900/90 px-4 py-3 shadow-lg backdrop-blur-md">
      {/* Barra Compacta Principal */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/15 text-emerald-300">
            <Video className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black tracking-wider text-white uppercase">
                Google Meet & Chat de Brackets
              </span>
              <span className="rounded border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                {obfDoc.event.name}
              </span>
              {meetSession ? (
                <span className="inline-flex items-center gap-1 rounded border border-emerald-400/50 bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  SALA ACTIVA · {meetSession.meetingCode}
                </span>
              ) : (
                <span className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                  SIN SALA MEET · CHAT DE BRACKETS ACTIVO
                </span>
              )}
              {matchedEntrant ? (
                <span className="inline-flex items-center gap-1 rounded border border-cyan-400/40 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                  <CheckCircle2 className="h-3 w-3" />
                  Inscrito: {matchedEntrant.entrantTag}
                </span>
              ) : isTournamentStaff ? (
                <span className="inline-flex items-center gap-1 rounded border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  <ShieldCheck className="h-3 w-3" />
                  Staff / Organizador ({effectiveRole})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded border border-rose-400/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                  <Lock className="h-3 w-3" />
                  Meet exclusivo para los {obfDoc.entrants.length} inscritos
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              {meetSession
                ? `${meetSession.topic || `Lobby de Voz y Video — ${obfDoc.event.name}`} · El chat muestra automáticamente todos los brackets (quién contra quién) en Texto y 2D.`
                : `Al iniciar el torneo o la sala Google Meet, el chat publica automáticamente todos los brackets en Texto y 2D de quién contra quién le toca.`}
            </p>
          </div>
        </div>

        {/* Acciones Rápidas según estado de inscripción */}
        <div className="flex flex-wrap items-center gap-2">
          {meetSession && canJoinTournamentMeet && (
            <>
              <a
                href={meetSession.meetingUri}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/60 bg-emerald-500 px-3.5 py-2 text-xs font-black text-slate-950 shadow-sm transition hover:bg-emerald-400"
              >
                <Video className="h-4 w-4" />
                Unirse a Google Meet (Opcional)
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/90 px-2.5 py-2 font-mono text-xs text-slate-200 transition hover:border-emerald-400/50 hover:text-white"
                title="Copiar enlace de Google Meet"
              >
                <Copy className="h-3.5 w-3.5 text-emerald-400" />
                {copiedCode ? '¡Enlace copiado!' : meetSession.meetingCode}
              </button>
            </>
          )}

          {meetSession && !canJoinTournamentMeet && (
            <button
              type="button"
              onClick={onOpenSelfRegister}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/50 bg-cyan-500/20 px-3 py-2 text-xs font-bold text-cyan-200 transition hover:bg-cyan-500/30"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Inscribirme al Torneo para Unirme al Meet
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsChatOpen((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition ${
              isChatOpen
                ? 'border-sky-400/60 bg-sky-500/20 text-sky-200'
                : 'border-slate-700 bg-slate-800/80 text-slate-200 hover:border-sky-400/40'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5 text-sky-400" />
            {isChatOpen
              ? 'Ocultar Chat de Brackets (Texto / 2D)'
              : `Ver Chat de Brackets (${obfDoc.sets.length} Sets)`}
          </button>

          {!meetSession && (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/30"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Habilitar Sala Google Meet
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            <Settings className="h-3.5 w-3.5" />
            {isExpanded ? 'Ocultar Ajustes Meet' : 'Gestionar Meet / Inscritos'}
          </button>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* CHAT AUTOMÁTICO DEL TORNEO Y SALA MEET CON TODOS LOS BRACKETS (TEXTO Y 2D) */}
      {/* ======================================================================= */}
      {isChatOpen && (
        <div className="mt-3 rounded-xl border border-sky-500/30 bg-slate-950/95 p-3.5 shadow-inner">
          {/* Encabezado del Chat con Controles de Vista Texto / 2D / Copiar para Google Meet */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/15 px-2.5 py-1 text-xs font-black tracking-wide text-sky-300 uppercase">
                <MessageSquare className="h-3.5 w-3.5" />
                Chat Inicial del Torneo — ¿Quién contra quién le toca?
              </span>
              <span className="rounded border border-slate-800 bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                {obfDoc.sets.length} enfrentamientos generados · {obfDoc.entrants.length} jugadores
              </span>
              {myNextSet && matchedEntrant && (
                <button
                  type="button"
                  onClick={() => onSelectSet?.(myNextSet.setID)}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-200 transition hover:bg-emerald-500/30"
                >
                  <Swords className="h-3 w-3" />
                  Tu llave actual: [{myNextSet.setID}] ({myNextSet.roundLabel})
                </button>
              )}
            </div>

            {/* Selector de Modo en el Chat: Texto | 2D | Ambos + Copiar para Meet */}
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900 p-0.5">
                <button
                  type="button"
                  onClick={() => setBracketViewMode('BOTH')}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                    bracketViewMode === 'BOTH'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Texto + 2D
                </button>
                <button
                  type="button"
                  onClick={() => setBracketViewMode('2D')}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                    bracketViewMode === '2D'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LayoutGrid className="h-3 w-3" />
                  Bracket 2D
                </button>
                <button
                  type="button"
                  onClick={() => setBracketViewMode('TEXT')}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                    bracketViewMode === 'TEXT'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="h-3 w-3" />
                  Bracket en Texto
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyBracketText}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-bold text-emerald-200 transition hover:bg-emerald-500/25"
                title="Copia todos los enfrentamientos en formato texto para pegarlos también dentro de la llamada de Google Meet"
              >
                <Copy className="h-3.5 w-3.5" />
                {copiedBracketText
                  ? '¡Brackets copiados para Meet!'
                  : 'Copiar Brackets para Chat de Meet'}
              </button>

              {currentUser && (
                <button
                  type="button"
                  onClick={() => handleSendChatMessage(undefined, 'BRACKET_ANNOUNCEMENT')}
                  disabled={isSendingChat}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-bold text-amber-200 transition hover:bg-amber-500/25 disabled:opacity-50"
                  title="Volver a publicar el estado actualizado de todos los brackets en el chat"
                >
                  <RefreshCw className={`h-3 w-3 ${isSendingChat ? 'animate-spin' : ''}`} />
                  Publicar Brackets al Chat
                </button>
              )}
            </div>
          </div>

          {/* Mensaje Automático Fijado #1: Todos los Brackets (En Texto y/o 2D) */}
          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-sky-500/30 bg-slate-900/90 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300">
                    <Swords className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-xs font-black text-white">
                    Bot Oficial del Torneo · Cuadro Completo de Enfrentamientos (Quién contra Quién)
                  </span>
                  <span className="rounded bg-sky-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-300">
                    MENSAJE AUTOMÁTICO AL INICIAR
                  </span>
                </div>
                {availablePhases.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPhaseFilter('ALL')}
                      className={`rounded px-2 py-0.5 text-[10px] font-bold transition ${
                        phaseFilter === 'ALL'
                          ? 'bg-sky-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Todas las Fases ({obfDoc.sets.length})
                    </button>
                    {availablePhases.map((phase) => (
                      <button
                        key={phase}
                        type="button"
                        onClick={() => setPhaseFilter(phase)}
                        className={`rounded px-2 py-0.5 text-[10px] font-bold transition ${
                          phaseFilter === phase
                            ? 'bg-sky-500 text-slate-950'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {phase}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div
                className={`mt-3 grid gap-3 ${
                  bracketViewMode === 'BOTH'
                    ? 'grid-cols-1 xl:grid-cols-12'
                    : 'grid-cols-1'
                }`}
              >
                {/* VISTA 2D DEL BRACKET EN EL CHAT */}
                {(bracketViewMode === '2D' || bracketViewMode === 'BOTH') && (
                  <div
                    className={`rounded-xl border border-slate-800 bg-slate-950/90 p-3 ${
                      bracketViewMode === 'BOTH' ? 'xl:col-span-7' : ''
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-sky-300 uppercase">
                        <LayoutGrid className="h-3.5 w-3.5" />
                        Vista 2D en el Chat — Llaves y Cruces por Ronda
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Haz clic en cualquier partida para abrirla
                      </span>
                    </div>

                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {rounds2D.map((roundGroup) => (
                        <div
                          key={roundGroup.key}
                          className="min-w-[235px] shrink-0 rounded-xl border border-slate-800/90 bg-slate-900/70 p-2.5"
                        >
                          <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-1.5">
                            <div>
                              <span className="block font-mono text-[9px] font-bold text-sky-400 uppercase">
                                {roundGroup.phase}
                              </span>
                              <h5 className="text-xs font-black text-white">
                                {roundGroup.roundLabel}
                              </h5>
                            </div>
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                              {roundGroup.sets.length} sets
                            </span>
                          </div>

                          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                            {roundGroup.sets.map((set) => {
                              const p1 = resolveSlotSummary(set.entrant1ID, 1, set);
                              const p2 = resolveSlotSummary(set.entrant2ID, 2, set);
                              const isMyMatch = p1.isCurrentUser || p2.isCurrentUser;
                              const isCompleted = set.status === 'COMPLETED';
                              const isReady = set.status === 'READY';
                              const isInProgress = set.status === 'IN_PROGRESS';

                              return (
                                <div
                                  key={set.setID}
                                  onClick={() => onSelectSet?.(set.setID)}
                                  className={`cursor-pointer rounded-lg border p-2 text-xs transition ${
                                    isMyMatch
                                      ? 'border-emerald-400/70 bg-emerald-500/15 shadow-sm'
                                      : isInProgress
                                        ? 'border-amber-400/60 bg-amber-500/10'
                                        : isReady
                                          ? 'border-sky-500/40 bg-slate-950/90 hover:border-sky-400'
                                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                                  }`}
                                >
                                  <div className="mb-1.5 flex items-center justify-between gap-1 text-[10px]">
                                    <span className="font-mono font-bold text-slate-300">
                                      [{set.setID}] · Bo{set.bestOf}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      {set.other?.station && (
                                        <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] text-slate-300">
                                          {set.other.station}
                                        </span>
                                      )}
                                      {isMyMatch && (
                                        <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-[9px] font-black text-slate-950">
                                          TU MATCH
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Jugador 1 */}
                                  <div
                                    className={`flex items-center justify-between gap-1.5 rounded px-1.5 py-1 ${
                                      isCompleted && set.winnerID === set.entrant1ID
                                        ? 'bg-emerald-500/20 font-bold text-emerald-200'
                                        : p1.isPending
                                          ? 'text-slate-500 italic'
                                          : 'text-slate-200'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 truncate">
                                      {p1.seed !== undefined && (
                                        <span className="font-mono text-[10px] text-slate-400">
                                          #{p1.seed}
                                        </span>
                                      )}
                                      <span className="truncate">{p1.tag}</span>
                                      {p1.character && (
                                        <span className="shrink-0 rounded bg-slate-800 px-1 py-0.5 text-[9px] text-sky-300">
                                          {p1.character}
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-mono text-[11px] font-bold">
                                      {set.entrant1ID ? set.entrant1Score : '-'}
                                    </span>
                                  </div>

                                  <div className="my-0.5 flex items-center justify-between px-1.5 text-[9px] font-bold text-slate-500">
                                    <span>VS</span>
                                    <span>
                                      {isCompleted
                                        ? 'FINALIZADO'
                                        : isInProgress
                                          ? 'EN JUEGO'
                                          : isReady
                                            ? 'LISTO'
                                            : 'ESPERANDO'}
                                    </span>
                                  </div>

                                  {/* Jugador 2 */}
                                  <div
                                    className={`flex items-center justify-between gap-1.5 rounded px-1.5 py-1 ${
                                      isCompleted && set.winnerID === set.entrant2ID
                                        ? 'bg-emerald-500/20 font-bold text-emerald-200'
                                        : p2.isPending
                                          ? 'text-slate-500 italic'
                                          : 'text-slate-200'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 truncate">
                                      {p2.seed !== undefined && (
                                        <span className="font-mono text-[10px] text-slate-400">
                                          #{p2.seed}
                                        </span>
                                      )}
                                      <span className="truncate">{p2.tag}</span>
                                      {p2.character && (
                                        <span className="shrink-0 rounded bg-slate-800 px-1 py-0.5 text-[9px] text-sky-300">
                                          {p2.character}
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-mono text-[11px] font-bold">
                                      {set.entrant2ID ? set.entrant2Score : '-'}
                                    </span>
                                  </div>

                                  {(set.nextWinSetID || set.nextLoseSetID) && (
                                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 border-t border-slate-800/80 pt-1 font-mono text-[9px] text-slate-400">
                                      {set.nextWinSetID && (
                                        <span>Ganador → [{set.nextWinSetID}]</span>
                                      )}
                                      {set.nextLoseSetID && (
                                        <span>Perdedor → [{set.nextLoseSetID}]</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* VISTA EN TEXTO DEL BRACKET EN EL CHAT */}
                {(bracketViewMode === 'TEXT' || bracketViewMode === 'BOTH') && (
                  <div
                    className={`flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/90 p-3 ${
                      bracketViewMode === 'BOTH' ? 'xl:col-span-5' : ''
                    }`}
                  >
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-emerald-300 uppercase">
                          <FileText className="h-3.5 w-3.5" />
                          Bracket Completo en Texto (Quién contra Quién)
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyBracketText}
                          className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 hover:border-emerald-400"
                        >
                          {copiedBracketText ? '¡Copiado!' : 'Copiar texto'}
                        </button>
                      </div>
                      <pre className="max-h-72 overflow-y-auto rounded-lg border border-slate-800/90 bg-slate-900/90 p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-slate-200">
                        {formattedBracketText}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Historial de Mensajes en Vivo del Chat del Torneo / Lobby Meet */}
            {chatMessages.filter((m) => m.messageType !== 'BRACKET_ANNOUNCEMENT')
              .length > 0 && (
              <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/70 p-2.5">
                {chatMessages
                  .filter((m) => m.messageType !== 'BRACKET_ANNOUNCEMENT')
                  .map((msg) => (
                    <div
                      key={msg.id}
                      className="flex items-start justify-between gap-2 rounded-lg border border-slate-800/80 bg-slate-950/80 px-3 py-1.5 text-xs"
                    >
                      <div>
                        <span className="font-bold text-sky-300">
                          {msg.senderName}
                          {msg.senderTag ? ` (${msg.senderTag})` : ''}:
                        </span>{' '}
                        <span className="text-slate-200">{msg.text}</span>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-slate-500">
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            {/* Barra para Enviar Mensajes en el Chat del Torneo */}
            <form
              onSubmit={(e) => handleSendChatMessage(e, 'USER_MESSAGE')}
              className="flex flex-wrap items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={
                  currentUser
                    ? `Escribe en el chat del torneo (${currentUser.gamerTag || currentUser.displayName})...`
                    : 'Inicia sesión para escribir en el chat del torneo...'
                }
                className="min-w-[220px] flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSendingChat || !chatInput.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3.5 py-2 text-xs font-black text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                Enviar al Chat
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Panel Expandido de Gestión Google Meet API v2 + Lista de Inscritos con Acceso */}
      {isExpanded && (
        <div className="mt-3 border-t border-slate-800 pt-3">
          {errorMsg && (
            <div className="mb-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {errorMsg}
            </div>
          )}
          {statusMsg && (
            <div className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              {statusMsg}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Columna Izquierda: Configuración y API de Google Meet */}
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold tracking-wider text-emerald-300 uppercase">
                    Integración Oficial Google Meet REST API v2
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Crea o administra el espacio virtual exclusivo para{' '}
                    <span className="font-semibold text-white">{obfDoc.event.name}</span>.
                  </p>
                </div>

                {/* Botón Oficial Sign in with Google si falta token OAuth en memoria */}
                {needsGoogleAuth ? (
                  <button
                    type="button"
                    onClick={handleGoogleMeetAuth}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-100 disabled:opacity-50"
                  >
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      className="h-4 w-4 shrink-0"
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                      <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                    <span>Sign in with Google</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Google Meet OAuth Conectado
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-300">
                    Título / Tema de la Sala del Torneo
                  </label>
                  <input
                    type="text"
                    value={desiredTopic}
                    onChange={(e) => setDesiredTopic(e.target.value)}
                    placeholder={`Lobby Oficial — ${obfDoc.event.name}`}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-300">
                    Nivel de Acceso (Google Meet Space Config)
                  </label>
                  <select
                    value={desiredAccessType}
                    onChange={(e) =>
                      setDesiredAccessType(e.target.value as GoogleMeetAccessType)
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none"
                  >
                    <option value="OPEN">
                      OPEN — Entrada directa con el enlace del torneo
                    </option>
                    <option value="TRUSTED">
                      TRUSTED — Miembros verificados de la organización
                    </option>
                    <option value="RESTRICTED">
                      RESTRICTED — Solo invitados con aprobación
                    </option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {!meetSession ? (
                  <button
                    type="button"
                    onClick={executeCreateGoogleMeetSpace}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/60 bg-emerald-500 px-3.5 py-2 text-xs font-black text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                  >
                    <Video className="h-4 w-4" />
                    {isLoading
                      ? 'Creando sala y publicando brackets...'
                      : 'Crear Sala Google Meet y Publicar Brackets en el Chat'}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleInspectSpaceStatus}
                      disabled={isLoading}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-emerald-400/50 hover:text-white disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
                      />
                      Consultar Estado en Google Meet
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setPendingConfirm({
                          type: 'UPDATE_ACCESS_TYPE',
                          title: 'Confirmar actualización de acceso en Google Meet',
                          description: `¿Deseas actualizar la configuración del espacio "${meetSession.spaceName}" en Google Meet para cambiar su tipo de acceso de ${meetSession.accessType} a ${desiredAccessType}?`,
                          targetAccessType: desiredAccessType,
                        })
                      }
                      disabled={isLoading}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/25 disabled:opacity-50"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Actualizar Acceso a {desiredAccessType}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setPendingConfirm({
                          type: 'REPLACE_SPACE',
                          title: 'Confirmar reemplazo de sala Google Meet',
                          description: `¿Estás seguro de generar una nueva sala de Google Meet y reemplazar la sala actual (${meetSession.meetingCode}) para el torneo "${obfDoc.event.name}"?`,
                        })
                      }
                      disabled={isLoading}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/25 disabled:opacity-50"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Reemplazar Sala
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setPendingConfirm({
                          type: 'UNLINK_SPACE',
                          title: 'Confirmar desvinculación de sala Google Meet',
                          description: `¿Confirmas que deseas desvincular la sala de Google Meet (${meetSession.meetingCode}) del torneo "${obfDoc.event.name}"? Los participantes inscritos dejarán de ver el botón de acceso directo.`,
                        })
                      }
                      disabled={isLoading}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/25 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Desvincular
                    </button>
                  </>
                )}
              </div>

              {meetSession && (
                <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/90 p-2.5 font-mono text-[11px] text-slate-300">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Recurso API:{' '}
                      <strong className="text-emerald-300">{meetSession.spaceName}</strong>
                    </span>
                    <span>
                      Acceso:{' '}
                      <strong className="text-cyan-300">
                        {liveSpaceDetails?.accessType || meetSession.accessType}
                      </strong>
                    </span>
                    <span>
                      Creada por:{' '}
                      <strong className="text-white">
                        {meetSession.createdByName ||
                          meetSession.createdByEmail ||
                          'Organizador'}
                      </strong>
                    </span>
                  </div>
                  {liveSpaceDetails && (
                    <div className="mt-1.5 border-t border-slate-800 pt-1.5 text-[10px] text-slate-400">
                      Conferencia Activa:{' '}
                      <span className="text-emerald-300">
                        {liveSpaceDetails.activeConferenceRecord ||
                          'Lista para que los inscritos se conecten'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Columna Derecha: Lista de Personas Inscritas en este Torneo con Acceso Opcional */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 lg:col-span-5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-cyan-300 uppercase">
                    <Users className="h-4 w-4" />
                    Inscritos Habilitados ({obfDoc.entrants.length})
                  </h4>
                  <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                    Conexión Opcional
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Todas las personas inscritas en{' '}
                  <strong className="text-slate-200">{obfDoc.event.name}</strong> pueden
                  entrar opcionalmente a la sala para coordinación de sets, check-in por
                  voz o transmisión comunitaria:
                </p>

                <div className="mt-2.5 max-h-36 space-y-1.5 overflow-y-auto pr-1">
                  {obfDoc.entrants.map((entrant) => {
                    const isCurrentUserEntrant =
                      matchedEntrant?.entrantID === entrant.entrantID;
                    return (
                      <div
                        key={entrant.entrantID}
                        className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs ${
                          isCurrentUserEntrant
                            ? 'border-emerald-400/50 bg-emerald-500/15 text-white'
                            : 'border-slate-800 bg-slate-900/70 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-mono text-[10px] text-slate-400">
                            #{entrant.initialSeed}
                          </span>
                          <span className="truncate font-semibold">
                            {entrant.entrantTag}
                          </span>
                          {isCurrentUserEntrant && (
                            <span className="rounded bg-emerald-500/30 px-1.5 py-0.5 text-[9px] font-bold text-emerald-200 uppercase">
                              Tú
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {entrant.platform && (
                            <span className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] text-slate-300">
                              {entrant.platform}
                            </span>
                          )}
                          <span className="text-[10px] text-emerald-400">
                            Acceso Meet ✓
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {!matchedEntrant && (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-2.5">
                  <span className="text-[11px] text-cyan-200">
                    ¿Aún no estás en la lista de inscritos de este torneo?
                  </span>
                  <button
                    type="button"
                    onClick={onOpenSelfRegister}
                    className="shrink-0 rounded-lg bg-cyan-500 px-2.5 py-1.5 text-[11px] font-black text-slate-950 transition hover:bg-cyan-400"
                  >
                    Inscribirme Ahora
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación Explícita para Operaciones que Modifican o Desvinculan Datos (MANDATORY) */}
      {pendingConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/15 text-amber-300">
                  <Video className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-black text-white">
                  {pendingConfirm.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              {pendingConfirm.description}
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmPendingAction}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-emerald-400"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
