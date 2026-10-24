import React, { useState } from 'react';
import { GoogleAuthProvider } from 'firebase/auth';
import {
  auth,
  googleAuthProvider,
  setGoogleAccessToken,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  firebaseSignOut,
} from '../lib/firebase';
import {
  type PlatformType,
  RBAC_PERMISSIONS_MATRIX,
  type UserRole,
} from '../engine/nikBracketsEngine';
import {
  ESPORTS_GAMES_CATALOG,
  TEKKEN_44_CHARACTERS,
  resolveCatalogCharacter,
} from '../i18n/translations';
import {
  CheckCircle2,
  CreditCard,
  Gamepad2,
  History,
  KeyRound,
  LogIn,
  LogOut,
  Plus,
  QrCode,
  Shield,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';

export interface GameAccountItem {
  id: number;
  userUid: string;
  gameSlug: string;
  platform: PlatformType;
  inGameId: string;
  isPrimary: boolean;
  createdAt?: string;
}

export interface UserGamePrefItem {
  id: number;
  userUid: string;
  gameSlug: string;
  mainCharacterId: string;
  secondaryCharId: string | null;
  updatedAt?: string;
}

export interface AuthenticatedUser {
  id?: number;
  uid: string;
  email: string;
  displayName: string;
  gamerTag: string;
  avatarUrl: string | null;
  authProvider: string;
  globalRole: UserRole;
  eloRating: number;
  mainCharacter: string | null;
  country: string | null;
  city?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  discordHandle?: string | null;
  twitchHandle?: string | null;
  profileCompleted?: boolean;
  teamName: string | null;
  accountStatus: string;
  twoFactorEnabled: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  gameAccounts?: GameAccountItem[];
  gamePrefs?: UserGamePrefItem[];
}

export interface TournamentRoleAssignment {
  id: number;
  tournamentSlug: string;
  userUid: string;
  userEmail: string;
  userDisplayName: string;
  role: UserRole;
  assignedStation: string | null;
  assignedByUid: string | null;
  createdAt: string;
}

export interface TournamentPaymentItem {
  id: number;
  tournamentSlug: string;
  entrantId: string;
  entrantTag: string;
  userUid: string | null;
  paymentType: 'ENTRY_FEE' | 'PRIZE_PAYOUT';
  amountUsd: number;
  method: 'QR_INSTANT' | 'STRIPE_PIX' | 'CASH_DESK' | 'BANK_WIRE';
  qrReferenceCode: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'PAID_OUT';
  verifiedByUid: string | null;
  createdAt: string;
}

export interface AuditLogItem {
  id: number;
  userUid: string;
  userEmail: string;
  userRole: string;
  action: string;
  tournamentSlug: string | null;
  targetId: string | null;
  details: string;
  createdAt: string;
}

export const PLATFORM_OPTIONS: Array<{
  value: PlatformType;
  label: string;
  shortLabel: string;
  sampleId: string;
  badgeColor: string;
}> = [
  {
    value: 'PS5',
    label: 'PlayStation 5 (PSN / Tekken ID)',
    shortLabel: 'PS5',
    sampleId: '349Q-tay4-YYH8',
    badgeColor: 'border-sky-400/50 bg-sky-500/15 text-sky-300',
  },
  {
    value: 'PC_STEAM',
    label: 'PC / Steam (Tekken ID / SteamID)',
    shortLabel: 'PC / Steam',
    sampleId: '2jdr-i7LF-23HT',
    badgeColor: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300',
  },
  {
    value: 'XBOX_SERIES',
    label: 'Xbox Series X|S (Xbox Live / Tekken ID)',
    shortLabel: 'Xbox Series',
    sampleId: '9XBX-k82M-77QP',
    badgeColor: 'border-lime-400/50 bg-lime-500/15 text-lime-300',
  },
  {
    value: 'NINTENDO_SWITCH',
    label: 'Nintendo Switch (Switch Friend Code)',
    shortLabel: 'Switch',
    sampleId: 'SW-8421-9039-1120',
    badgeColor: 'border-rose-400/50 bg-rose-500/15 text-rose-300',
  },
  {
    value: 'CROSSPLAY',
    label: 'Crossplay Universal (CFN / Riot ID / Fighter ID)',
    shortLabel: 'Crossplay',
    sampleId: 'CFN-9940-8812',
    badgeColor: 'border-purple-400/50 bg-purple-500/15 text-purple-300',
  },
];

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register' | 'profile';
  onClose: () => void;
  onNavigateToUserAdmin?: () => void;
  currentUser: AuthenticatedUser | null;
  authToken?: string;
  onAuthenticated: (
    user: AuthenticatedUser,
    token: string,
    tournamentRole?: UserRole | null,
    assignedStation?: string | null
  ) => void;
  onLogout: () => Promise<void>;
  onUpdateProfile: (profileData: {
    displayName: string;
    gamerTag: string;
    mainCharacter: string;
    secondaryCharacter?: string;
    platform?: PlatformType;
    inGameId?: string;
    gameSlug?: string;
    country: string;
    city?: string;
    phone?: string;
    whatsapp?: string;
    discordHandle?: string;
    twitchHandle?: string;
    profileCompleted?: boolean;
    teamName: string;
  }) => Promise<void>;
}

const QUICK_STAFF_ACCOUNTS: Array<{
  label: string;
  email: string;
  globalRoleLabel: string;
  contextualSummary: string;
}> = [
  {
    label: 'Niklauss#KR1 (2 IDs: PS5 + PC)',
    email: 'niklaussmauricio@gmail.com',
    globalRoleLabel: 'GLOBAL: SUPER_ADMIN',
    contextualSummary: 'PS5: 349Q-tay4-YYH8 · PC: 2jdr-i7LF-23HT · MAIN: Reina',
  },
  {
    label: 'ArslanAsh#PK (2 IDs: PS5 + PC)',
    email: 'arslan.ash@twistedminds.gg',
    globalRoleLabel: 'GLOBAL: USER',
    contextualSummary: 'PS5: 77PK-arsl-99AA · PC: 88ST-twst-11PK · MAIN: Nina',
  },
  {
    label: 'MendozaTO#LATAM (Director)',
    email: 'director@nikbrackets.pro',
    globalRoleLabel: 'GLOBAL: USER',
    contextualSummary: 'Contextual: TOURNAMENT_ADMIN (Director del Evento)',
  },
  {
    label: 'Referee01#OFFICIAL (Árbitro)',
    email: 'referee01@nikbrackets.pro',
    globalRoleLabel: 'GLOBAL: USER',
    contextualSummary: 'Contextual: REFEREE / POOL_CAPTAIN (Station 01)',
  },
  {
    label: 'VanceCast#OBS (Caster)',
    email: 'broadcast@nikbrackets.pro',
    globalRoleLabel: 'GLOBAL: USER',
    contextualSummary: 'Contextual: STREAMER / CASTER (Ve IDs PS5/PC y MAIN)',
  },
  {
    label: 'SilvaPay#BR (Tesorero)',
    email: 'treasury@nikbrackets.pro',
    globalRoleLabel: 'GLOBAL: USER',
    contextualSummary: 'Contextual: PAY_EDITOR / TREASURER (QR & Payouts)',
  },
];

export const AuthDialogModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode,
  onClose,
  onNavigateToUserAdmin,
  currentUser,
  authToken,
  onAuthenticated,
  onLogout,
  onUpdateProfile,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'profile'>(
    initialMode || (currentUser ? 'profile' : 'login')
  );
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>(currentUser?.displayName || '');
  const [gamerTag, setGamerTag] = useState<string>(currentUser?.gamerTag || '');
  const [mainCharacter, setMainCharacter] = useState<string>(
    resolveCatalogCharacter(currentUser?.mainCharacter || 'Reina', TEKKEN_44_CHARACTERS)
  );
  const [secondaryCharacter, setSecondaryCharacter] = useState<string>(
    currentUser?.gamePrefs?.[0]?.secondaryCharId || 'Jin'
  );
  const [country, setCountry] = useState<string>(currentUser?.country || 'PE');
  const [city, setCity] = useState<string>(currentUser?.city || 'Lima');
  const [phone, setPhone] = useState<string>(currentUser?.phone || '');
  const [whatsapp, setWhatsapp] = useState<string>(currentUser?.whatsapp || '');
  const [discordHandle, setDiscordHandle] = useState<string>(currentUser?.discordHandle || '');
  const [twitchHandle, setTwitchHandle] = useState<string>(currentUser?.twitchHandle || '');
  const [teamName, setTeamName] = useState<string>(currentUser?.teamName || 'Free Agent');
  const [goToAdminAfterRegister, setGoToAdminAfterRegister] = useState<boolean>(false);

  // Cuentas de Juego por Plataforma (GameAccount)
  const [newPlatform, setNewPlatform] = useState<PlatformType>('PS5');
  const [newInGameId, setNewInGameId] = useState<string>('349Q-tay4-YYH8');
  const [localGameAccounts, setLocalGameAccounts] = useState<GameAccountItem[]>(
    currentUser?.gameAccounts || []
  );

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  React.useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setSuccessMsg('');
    if (initialMode) {
      setMode(initialMode);
    } else {
      setMode(currentUser ? 'profile' : 'login');
    }
    if (currentUser) {
      setDisplayName(currentUser.displayName || '');
      setGamerTag(currentUser.gamerTag || '');
      setMainCharacter(
        resolveCatalogCharacter(currentUser.mainCharacter || 'Reina', TEKKEN_44_CHARACTERS)
      );
      setSecondaryCharacter(currentUser.gamePrefs?.[0]?.secondaryCharId || 'Jin');
      setCountry(currentUser.country || 'PE');
      setCity(currentUser.city || 'Lima');
      setPhone(currentUser.phone || '');
      setWhatsapp(currentUser.whatsapp || '');
      setDiscordHandle(currentUser.discordHandle || '');
      setTwitchHandle(currentUser.twitchHandle || '');
      setTeamName(currentUser.teamName || 'Free Agent');
      setLocalGameAccounts(currentUser.gameAccounts || []);
      if (currentUser.gameAccounts && currentUser.gameAccounts.length > 0) {
        setNewPlatform(currentUser.gameAccounts[0].platform);
        setNewInGameId(currentUser.gameAccounts[0].inGameId);
      }
    }
  }, [isOpen, initialMode, currentUser]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const credential = await signInWithPopup(auth, googleAuthProvider);
      const oauthCred = GoogleAuthProvider.credentialFromResult(credential);
      if (oauthCred?.accessToken) {
        setGoogleAccessToken(oauthCred.accessToken);
      }
      const idToken = await credential.user.getIdToken();
      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al sincronizar cuenta de Google.');
      }
      onAuthenticated(data.user, idToken, data.tournamentRole, data.assignedStation);
      onClose();
    } catch {
      // Fallback instantáneo 1-Click si el popup es bloqueado por el navegador/iframe
      await handleInstantOneClickGoogle();
    } finally {
      setLoading(false);
    }
  };

  // Registro / Login 1-Click con Google (CERO campos adicionales)
  const handleInstantOneClickGoogle = async () => {
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/auth/oauth-instant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'google',
          displayName: displayName.trim() || undefined,
          email: email.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo completar el acceso con Google.');
      }
      onAuthenticated(data.user, data.token, data.tournamentRole, data.assignedStation);
      if (goToAdminAfterRegister && onNavigateToUserAdmin) {
        onNavigateToUserAdmin();
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error en acceso rápido con Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (
    e: React.FormEvent,
    overrideEmail?: string,
    overridePassword?: string
  ) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    const targetIdentifier = (overrideEmail ?? email).trim();
    const targetPass = overridePassword ?? password;

    try {
      const res = await fetch('/api/auth/login-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetIdentifier, password: targetPass }),
      });

      if (res.ok) {
        const data = await res.json();
        onAuthenticated(data.user, data.token, data.tournamentRole, data.assignedStation);
        onClose();
        return;
      }

      if (targetIdentifier.includes('@')) {
        try {
          const cred = await signInWithEmailAndPassword(auth, targetIdentifier, targetPass);
          const idToken = await cred.user.getIdToken();
          const syncRes = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
          });
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            onAuthenticated(
              syncData.user,
              idToken,
              syncData.tournamentRole,
              syncData.assignedStation
            );
            onClose();
            return;
          }
        } catch {
          // Fallback to error from /api/auth/login-email
        }
      }

      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Usuario o contraseña incorrectos.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  // Paso 1: Registro Inicial Zero-Friction — Usuario, Contraseña (y Correo opcional)
  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const cleanUsername = displayName.trim() || email.trim().split('@')[0] || 'Jugador';
      const resolvedEmail =
        email.trim() && email.trim().includes('@')
          ? email.trim().toLowerCase()
          : `${cleanUsername.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user'}@nikbrackets.pro`;

      let firebaseUid: string | undefined;
      try {
        const fbCred = await createUserWithEmailAndPassword(auth, resolvedEmail, password);
        if (cleanUsername) {
          await updateProfile(fbCred.user, { displayName: cleanUsername });
        }
        firebaseUid = fbCred.user.uid;
      } catch {
        // Continue with direct PostgreSQL registration
      }

      const res = await fetch('/api/auth/register-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resolvedEmail,
          password,
          displayName: cleanUsername,
          gamerTag: `${cleanUsername.replace(/\s+/g, '')}#PRO`,
          firebaseUid,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo completar el registro.');
      }

      onAuthenticated(data.user, data.token, null, null);
      if (goToAdminAfterRegister && onNavigateToUserAdmin) {
        onNavigateToUserAdmin();
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al registrar cuenta.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddGameAccount = async () => {
    if (!authToken || !newInGameId.trim()) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/game-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          gameSlug: 'tekken8',
          platform: newPlatform,
          inGameId: newInGameId.trim(),
          isPrimary: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.gameAccounts) {
        setLocalGameAccounts(data.gameAccounts);
        setSuccessMsg(`ID de ${newPlatform} (${newInGameId.trim()}) guardado en tu biblioteca.`);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo guardar el ID de plataforma.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGameAccount = async (id: number) => {
    if (!authToken) return;
    const res = await fetch(`/api/auth/game-accounts/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.gameAccounts) setLocalGameAccounts(data.gameAccounts);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (authToken) {
        await fetch('/api/auth/game-prefs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            gameSlug: 'tekken8',
            mainCharacterId: mainCharacter,
            secondaryCharId: secondaryCharacter,
          }),
        });
      }
      await onUpdateProfile({
        displayName,
        gamerTag,
        mainCharacter,
        secondaryCharacter,
        platform: newPlatform,
        inGameId: newInGameId.trim() || undefined,
        gameSlug: 'tekken8',
        country,
        city,
        phone,
        whatsapp,
        discordHandle,
        twitchHandle,
        profileCompleted: true,
        teamName,
      });
      setSuccessMsg('Perfil competitivo, datos de contacto, IDs de consola y personajes actualizados.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar el perfil.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl my-auto">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-sky-400" />
            <div>
              <h2 className="text-lg font-bold text-white">
                {currentUser
                  ? 'Mi Biblioteca de IDs por Plataforma & Perfil Progresivo'
                  : mode === 'login'
                  ? 'Iniciar Sesión — nikBrackets Pro'
                  : '1. Registro Inicial Zero-Friction (0.5 segundos)'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {currentUser
                  ? 'Tus IDs por consola (PS5, PC/Steam, Xbox, Switch) y tu personaje MAIN se pre-llenan en 1 segundo al inscribirte.'
                  : 'Cero formularios largos: regístrate con 1-click y completa tus IDs de consola solo cuando te inscribas a tu primer torneo.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!currentUser && (
          <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'bg-sky-400 text-slate-950'
                  : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg('');
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'bg-sky-400 text-slate-950'
                  : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
              }`}
            >
              Registro 1-Click (0.5s · Sin Formularios Largos)
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-200">
            {successMsg}
          </div>
        )}

        {currentUser ? (
          <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
            {/* Tarjeta de estado de cuenta + Perfilado Progresivo */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{currentUser.displayName}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                      currentUser.profileCompleted
                        ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                        : 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    {currentUser.profileCompleted
                      ? 'Perfil Progresivo Completado (1-Sec Enroll Ready)'
                      : 'Cuenta Base 1-Click (Se completará en tu 1° Torneo)'}
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">{currentUser.email}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono text-sky-400 font-semibold">
                    {currentUser.gamerTag}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200 font-mono text-[11px]">
                    Rol Global: {currentUser.globalRole === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'USER'}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="text-emerald-300 font-mono text-[11px]">
                    MAIN: {mainCharacter} / SEC: {secondaryCharacter}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await firebaseSignOut(auth).catch(() => {});
                  await onLogout();
                  onClose();
                }}
                className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-900/40 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Cerrar Sesión
              </button>
            </div>

            {/* Nivel 1: Biblioteca de Cuentas de Juego por Plataforma (GameAccount) */}
            <div className="rounded-xl border border-sky-500/30 bg-slate-950/90 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono uppercase text-sky-400 font-semibold flex items-center gap-1.5">
                    <Gamepad2 className="w-4 h-4" />
                    1. Biblioteca de Cuentas por Consola / Plataforma (GameAccount)
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Un mismo juego (ej. Tekken 8) otorga un ID distinto en PS5 (<code>349Q-tay4-YYH8</code>) frente a PC/Steam (<code>2jdr-i7LF-23HT</code>). Guárdalos aquí para elegir con 1 clic al inscribirte.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {localGameAccounts.length === 0 ? (
                  <div className="sm:col-span-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
                    Aún no tienes IDs de consola guardados. Agrega tu ID de PS5 o PC abajo, o al inscribirte a tu primer torneo.
                  </div>
                ) : (
                  localGameAccounts.map((acc) => {
                    const meta =
                      PLATFORM_OPTIONS.find((p) => p.value === acc.platform) ||
                      PLATFORM_OPTIONS[0];
                    return (
                      <div
                        key={acc.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${meta.badgeColor}`}
                            >
                              {acc.platform}
                            </span>
                            <span className="font-mono font-bold text-white">
                              {acc.inGameId}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Juego: {acc.gameSlug.toUpperCase()}{' '}
                            {acc.isPrimary ? '· ID Principal' : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteGameAccount(acc.id)}
                          className="p-1 text-slate-400 hover:text-rose-400"
                          title="Eliminar ID de plataforma"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-slate-800">
                <select
                  value={newPlatform}
                  onChange={(e) => {
                    const p = e.target.value as PlatformType;
                    setNewPlatform(p);
                    const foundSample = PLATFORM_OPTIONS.find((o) => o.value === p)?.sampleId;
                    if (foundSample) setNewInGameId(foundSample);
                  }}
                  className="sm:col-span-5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white"
                >
                  {PLATFORM_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newInGameId}
                  onChange={(e) => setNewInGameId(e.target.value)}
                  placeholder="Ej. 349Q-tay4-YYH8 o 2jdr-i7LF-23HT"
                  className="sm:col-span-4 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono text-white"
                />
                <button
                  type="button"
                  onClick={handleAddGameAccount}
                  disabled={loading}
                  className="sm:col-span-3 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs px-3 py-2 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Vincular ID
                </button>
              </div>
            </div>

            {/* Nivel 2 y 3: Personajes Preferidos (UserGamePreference) + Datos de Contacto Progresivos */}
            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nombre Visible</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">GamerTag Oficial (OBF)</label>
                  <input
                    type="text"
                    value={gamerTag}
                    onChange={(e) => setGamerTag(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-emerald-300 mb-1 font-medium">
                    Personaje MAIN Preferido ({TEKKEN_44_CHARACTERS.length} A-Z)
                  </label>
                  <select
                    value={mainCharacter}
                    onChange={(e) => setMainCharacter(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  >
                    {TEKKEN_44_CHARACTERS.map((charName, idx) => (
                      <option key={charName} value={charName}>
                        {idx + 1}. {charName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-sky-300 mb-1 font-medium">
                    Personaje SECUNDARIO (Pocket Pick)
                  </label>
                  <select
                    value={secondaryCharacter}
                    onChange={(e) => setSecondaryCharacter(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  >
                    {TEKKEN_44_CHARACTERS.map((charName, idx) => (
                      <option key={charName} value={charName}>
                        {idx + 1}. {charName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">WhatsApp (Coordinación Torneo)</label>
                  <input
                    type="text"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="+51 999 888 777"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Teléfono Móvil</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+51 987 654 321"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Discord Handle</label>
                  <input
                    type="text"
                    value={discordHandle}
                    onChange={(e) => setDiscordHandle(e.target.value)}
                    placeholder="jugador#0001"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Canal de Twitch</label>
                  <input
                    type="text"
                    value={twitchHandle}
                    onChange={(e) => setTwitchHandle(e.target.value)}
                    placeholder="twitch.tv/jugador"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">País (ISO)</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={country}
                      onChange={(e) => setCountry(e.target.value.toUpperCase())}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Ciudad (LAN)</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Equipo / Clan</label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                {onNavigateToUserAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateToUserAdmin();
                      onClose();
                    }}
                    className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 cursor-pointer"
                  >
                    Ir a Administración de Usuario Completa →
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-sky-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-50 cursor-pointer ml-auto"
                >
                  {loading ? 'Guardando...' : 'Guardar Perfil, Contacto & Preferencias'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Banner de Flujo de Perfilado Progresivo */}
            <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-3 text-xs text-slate-200 flex items-start gap-2.5">
              <Zap className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white">UX de Perfilado Progresivo (Progressive Profiling):</span>{' '}
                En el primer inicio de sesión solicitamos <strong>cero datos adicionales (0.5 segundos)</strong>. Navega y explora los cuadros 3D sin interrupciones; tus datos de contacto, ID de consola (PS5/PC) y personaje MAIN se pedirán solo cuando decidas inscribirte a un torneo.
              </div>
            </div>

            {/* Único proveedor OAuth: Google */}
            <div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-sky-600" />
                Continuar con Google (1-Click)
              </button>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <div className="h-px flex-1 bg-slate-800" />
              <span>O CON USUARIO Y CONTRASEÑA</span>
              <div className="h-px flex-1 bg-slate-800" />
            </div>

            {mode === 'login' ? (
              <form onSubmit={handleEmailLogin} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Usuario o Correo Electrónico
                  </label>
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ej. Niklauss o usuario@nikbrackets.pro"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-sky-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-sky-400 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-sky-400 px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-50 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  {loading ? 'Verificando...' : 'Iniciar Sesión'}
                </button>

                {/* Acceso rápido a cuentas de cada Rol pre-sembradas */}
                <div className="pt-3 border-t border-slate-800">
                  <div className="text-[11px] text-slate-400 mb-2">
                    Cuentas Demo Pre-Sembradas (Con Múltiples IDs PS5 + PC Steam — 1 Clic):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {QUICK_STAFF_ACCOUNTS.map((acc) => (
                      <button
                        key={acc.email}
                        type="button"
                        disabled={loading}
                        onClick={(ev) =>
                          handleEmailLogin(
                            ev,
                            acc.email,
                            acc.email === 'niklaussmauricio@gmail.com'
                              ? 'NikBrackets2026!'
                              : 'Pro Tour 2026'
                          )
                        }
                        className="text-left rounded border border-slate-800 bg-slate-950/90 px-2.5 py-1.5 text-[11px] hover:border-sky-400/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-white truncate">{acc.label}</span>
                          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-900 text-emerald-400 shrink-0">
                            {acc.globalRoleLabel}
                          </span>
                        </div>
                        <div className="font-mono text-[10px] text-sky-400 truncate mt-0.5">
                          {acc.contextualSummary}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            ) : (
              /* REGISTRO ZERO-FRICTION: Usuario y Contraseña (y Correo opcional) */
              <form onSubmit={handleEmailRegister} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Usuario (Nickname)
                    </label>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Ej. Niklauss"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Contraseña (mín. 6 caracteres)
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Correo Electrónico (Opcional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jugador@esports.gg (opcional)"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>

                <label className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={goToAdminAfterRegister}
                    onChange={(e) => setGoToAdminAfterRegister(e.target.checked)}
                    className="rounded border-slate-700"
                  />
                  <span>
                    Al registrarme, llevarme directo a <strong>Administración de Usuario</strong> para colocar mis datos, IDs de consola (PS5/PC) y personaje MAIN ahora mismo.
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    onClick={() => setGoToAdminAfterRegister(false)}
                    className="flex items-center justify-center gap-2 rounded-lg bg-sky-400 px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-50 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    {loading
                      ? 'Creando cuenta...'
                      : 'Crear Cuenta (0.5s) y Explorar →'}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    onClick={() => setGoToAdminAfterRegister(true)}
                    className="flex items-center justify-center gap-2 rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-4 py-2.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50 cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" />
                    Crear e Ir a Admin de Mis Datos →
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 3. MODAL INTELIGENTE DE INSCRIPCIÓN A TORNEO (PROGRESSIVE PROFILING + MULTI-PLATFORM ID + MAIN CHARACTER)
// ============================================================================

export interface ProgressiveEnrollmentSubmitPayload {
  tournamentSlug: string;
  gamerTag: string;
  platform: PlatformType;
  inGameId: string;
  gameSlug: string;
  mainCharacter: string;
  secondaryCharacter?: string;
  whatsapp: string;
  country: string;
  city: string;
  discordHandle: string;
  teamName: string;
  paymentMethod: 'QR_INSTANT' | 'STRIPE_PIX' | 'CASH_DESK';
}

interface ProgressiveTournamentEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthenticatedUser | null;
  tournamentSlug: string;
  tournamentName: string;
  gameName: string;
  gameSlug: string;
  onSubmitEnrollment: (payload: ProgressiveEnrollmentSubmitPayload) => Promise<void>;
}

export const ProgressiveTournamentEnrollmentModal: React.FC<
  ProgressiveTournamentEnrollmentModalProps
> = ({
  isOpen,
  onClose,
  currentUser,
  tournamentSlug,
  tournamentName,
  gameName,
  gameSlug,
  onSubmitEnrollment,
}) => {
  const gameCatalog =
    ESPORTS_GAMES_CATALOG.find((g) => g.slug === gameSlug) || ESPORTS_GAMES_CATALOG[0];
  const roster =
    gameCatalog.slug === 'tekken8' ? TEKKEN_44_CHARACTERS : gameCatalog.characters;

  const savedAccounts = currentUser?.gameAccounts || [];
  const isReturningCompletedUser = Boolean(
    currentUser?.profileCompleted && savedAccounts.length > 0
  );

  const [gamerTag, setGamerTag] = useState<string>(currentUser?.gamerTag || '');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType>(
    savedAccounts[0]?.platform || 'PS5'
  );
  const [inGameId, setInGameId] = useState<string>(
    savedAccounts[0]?.inGameId || '349Q-tay4-YYH8'
  );
  const [mainCharacter, setMainCharacter] = useState<string>(
    resolveCatalogCharacter(
      currentUser?.gamePrefs?.[0]?.mainCharacterId ||
        currentUser?.mainCharacter ||
        roster[0],
      roster
    )
  );
  const [secondaryCharacter, setSecondaryCharacter] = useState<string>(
    resolveCatalogCharacter(
      currentUser?.gamePrefs?.[0]?.secondaryCharId || roster[1] || roster[0],
      roster
    )
  );
  const [whatsapp, setWhatsapp] = useState<string>(currentUser?.whatsapp || '+51 987 654 321');
  const [country, setCountry] = useState<string>(currentUser?.country || 'PE');
  const [city, setCity] = useState<string>(currentUser?.city || 'Lima');
  const [discordHandle, setDiscordHandle] = useState<string>(
    currentUser?.discordHandle || `${(currentUser?.gamerTag || 'player').toLowerCase()}`
  );
  const [teamName, setTeamName] = useState<string>(currentUser?.teamName || 'Free Agent');
  const [paymentMethod, setPaymentMethod] = useState<
    'QR_INSTANT' | 'STRIPE_PIX' | 'CASH_DESK'
  >('QR_INSTANT');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  React.useEffect(() => {
    if (!isOpen || !currentUser) return;
    setErrorMsg('');
    const accounts = currentUser.gameAccounts || [];
    const primaryAcc = accounts.find((a) => a.isPrimary) || accounts[0];
    setGamerTag(currentUser.gamerTag || '');
    setSelectedPlatform(primaryAcc?.platform || 'PS5');
    setInGameId(primaryAcc?.inGameId || '349Q-tay4-YYH8');
    setMainCharacter(
      resolveCatalogCharacter(
        currentUser.gamePrefs?.[0]?.mainCharacterId ||
          currentUser.mainCharacter ||
          roster[0],
        roster
      )
    );
    setSecondaryCharacter(
      resolveCatalogCharacter(
        currentUser.gamePrefs?.[0]?.secondaryCharId || roster[1] || roster[0],
        roster
      )
    );
    setWhatsapp(currentUser.whatsapp || '+51 987 654 321');
    setCountry(currentUser.country || 'PE');
    setCity(currentUser.city || 'Lima');
    setDiscordHandle(
      currentUser.discordHandle || `${(currentUser.gamerTag || 'player').toLowerCase()}`
    );
    setTeamName(currentUser.teamName || 'Free Agent');
  }, [isOpen, currentUser, roster]);

  if (!isOpen || !currentUser) return null;

  const handlePlatformSelect = (platform: PlatformType) => {
    setSelectedPlatform(platform);
    const savedForPlatform = savedAccounts.find((a) => a.platform === platform);
    if (savedForPlatform) {
      setInGameId(savedForPlatform.inGameId);
    } else {
      const sample = PLATFORM_OPTIONS.find((p) => p.value === platform)?.sampleId || '349Q-tay4-YYH8';
      setInGameId(sample);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    try {
      await onSubmitEnrollment({
        tournamentSlug,
        gamerTag: gamerTag.trim() || currentUser.gamerTag,
        platform: selectedPlatform,
        inGameId: inGameId.trim(),
        gameSlug,
        mainCharacter,
        secondaryCharacter,
        whatsapp: whatsapp.trim(),
        country: country.trim().toUpperCase() || 'PE',
        city: city.trim() || 'Lima',
        discordHandle: discordHandle.trim(),
        teamName: teamName.trim() || 'Free Agent',
        paymentMethod,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo completar la inscripción.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl my-auto">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase text-sky-400">
              <Zap className="w-3.5 h-3.5" />
              <span>
                {isReturningCompletedUser
                  ? '2°+ Torneo · Datos Pre-Cargados (Confirmación en 1 Segundo)'
                  : '1° Torneo · Perfilado Progresivo Contextual (Progressive Profiling)'}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-0.5">
              Inscripción Oficial (EventEntrant) — {tournamentName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Banner inteligente diferenciando 1° Torneo vs 2°+ Torneo */}
        {isReturningCompletedUser ? (
          <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-950/25 p-3.5 text-xs text-emerald-200 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">
                ¡Tus datos de contacto, IDs de consola y personaje MAIN ya están guardados!
              </strong>{' '}
              Solo elige con 1 clic cuál de tus IDs vinculados (ej. <code>PS5</code> vs{' '}
              <code>PC_STEAM</code>) usarás en este torneo y confirma en 1 segundo.
            </div>
          </div>
        ) : (
          <div className="mb-4 rounded-xl border border-sky-500/40 bg-sky-950/25 p-3.5 text-xs text-sky-200 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">
                Primera inscripción detectada (Perfilado Progresivo):
              </strong>{' '}
              Completa tus datos de contacto, tu ID en {gameName} según la consola y tu personaje{' '}
              <strong>MAIN</strong>. ¡Para tu 2° torneo ya quedarán guardados automáticamente!
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleConfirm} className="space-y-4 text-xs">
          {/* Nivel 1: Selector de Plataforma e ID de Juego (GameAccount: PS5 vs PC_STEAM vs XBOX vs SWITCH) */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold text-white flex items-center gap-1.5">
                <Gamepad2 className="w-4 h-4 text-sky-400" />
                <span>
                  1. Selecciona tu Plataforma e ID en {gameName} (Para Casters y Árbitros)
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                Soporta múltiples consolas por jugador
              </span>
            </div>

            {/* Si el jugador ya tiene cuentas guardadas (ej. PS5 y PC_STEAM), botones 1-click */}
            {savedAccounts.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] text-slate-400">
                  Tus IDs guardados en biblioteca (clic para usar en este torneo):
                </div>
                <div className="flex flex-wrap gap-2">
                  {savedAccounts.map((acc) => {
                    const active =
                      selectedPlatform === acc.platform && inGameId === acc.inGameId;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          setSelectedPlatform(acc.platform);
                          setInGameId(acc.inGameId);
                        }}
                        className={`px-3 py-2 rounded-lg border font-mono text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                          active
                            ? 'border-sky-400 bg-sky-500/20 text-white font-bold'
                            : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-sky-400">{acc.platform}:</span>
                        <span>{acc.inGameId}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-slate-400 mb-1">
                  Consola / Plataforma para este Torneo
                </label>
                <select
                  value={selectedPlatform}
                  onChange={(e) => handlePlatformSelect(e.target.value as PlatformType)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white font-medium"
                >
                  {PLATFORM_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">
                  ID de Juego en {selectedPlatform} (Ej. Tekken ID / Steam / PSN)
                </label>
                <input
                  type="text"
                  required
                  value={inGameId}
                  onChange={(e) => setInGameId(e.target.value)}
                  placeholder="Ej. 349Q-tay4-YYH8 o 2jdr-i7LF-23HT"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sky-300 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Nivel 2: Selección de Personaje MAIN y SECUNDARIO para este torneo */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-emerald-300 font-semibold mb-1">
                2. Personaje MAIN ({roster.length} A-Z)
              </label>
              <select
                value={mainCharacter}
                onChange={(e) => setMainCharacter(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
              >
                {roster.map((c, idx) => (
                  <option key={c} value={c}>
                    {idx + 1}. {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sky-300 font-semibold mb-1">
                Personaje SECUNDARIO
              </label>
              <select
                value={secondaryCharacter}
                onChange={(e) => setSecondaryCharacter(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
              >
                {roster.map((c, idx) => (
                  <option key={c} value={c}>
                    {idx + 1}. {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                GamerTag en el Bracket
              </label>
              <input
                type="text"
                required
                value={gamerTag}
                onChange={(e) => setGamerTag(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-white"
              />
            </div>
          </div>

          {/* Nivel 3: Datos de Contacto y Ubicación (Pre-llenados en el 2° torneo) */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">
                3. Datos de Contacto y Coordinación de Partidas
              </span>
              <span className="text-[11px] font-mono text-emerald-400">
                {isReturningCompletedUser ? 'Pre-cargado automáticamente' : 'Se guardará para futuros torneos'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-slate-400 mb-1">WhatsApp</label>
                <input
                  type="text"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+51 999 888 777"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Discord</label>
                <input
                  type="text"
                  required
                  value={discordHandle}
                  onChange={(e) => setDiscordHandle(e.target.value)}
                  placeholder="tag#0001"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">País / Ciudad</label>
                <div className="grid grid-cols-3 gap-1">
                  <input
                    type="text"
                    maxLength={2}
                    value={country}
                    onChange={(e) => setCountry(e.target.value.toUpperCase())}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-white uppercase text-center"
                  />
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ciudad"
                    className="col-span-2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Equipo / Clan</label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Método de Validación QR:</span>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(
                    e.target.value as 'QR_INSTANT' | 'STRIPE_PIX' | 'CASH_DESK'
                  )
                }
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-emerald-300"
              >
                <option value="QR_INSTANT">QR Instantáneo Verificado</option>
                <option value="STRIPE_PIX">Stripe / Pix / Yape</option>
                <option value="CASH_DESK">Pago en Mesa (Venue Desk)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/10 cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                {submitting
                  ? 'Confirmando EventEntrant...'
                  : isReturningCompletedUser
                  ? `Confirmar en 1 Segundo [${selectedPlatform}: ${inGameId}]`
                  : `Guardar Perfil e Inscribirme [${selectedPlatform}]`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export interface AdminProfileUpdatePayload {
  targetUid?: string;
  displayName: string;
  gamerTag: string;
  mainCharacter: string;
  secondaryCharacter?: string;
  platform?: PlatformType;
  inGameId?: string;
  gameSlug?: string;
  country: string;
  city: string;
  phone: string;
  whatsapp: string;
  discordHandle: string;
  twitchHandle: string;
  teamName: string;
  profileCompleted: boolean;
}

interface UsersRolesAndTreasuryPanelProps {
  currentUser: AuthenticatedUser | null;
  activeRole: UserRole;
  activeTournamentSlug: string;
  activeTournamentName: string;
  usersList: AuthenticatedUser[];
  tournamentRoles: TournamentRoleAssignment[];
  tournamentPayments: TournamentPaymentItem[];
  auditLogs: AuditLogItem[];
  onSaveUserProfileFromAdmin?: (payload: AdminProfileUpdatePayload) => Promise<void>;
  onUpsertGameAccountFromAdmin?: (payload: {
    targetUid?: string;
    gameSlug: string;
    platform: PlatformType;
    inGameId: string;
    isPrimary: boolean;
  }) => Promise<void>;
  onDeleteGameAccountFromAdmin?: (accountId: number, targetUid?: string) => Promise<void>;
  onChangeUserGlobalRole: (
    targetUid: string,
    newRole: UserRole,
    accountStatus?: 'ACTIVE' | 'SUSPENDED'
  ) => Promise<void>;
  onAssignTournamentStaff: (params: {
    userUid: string;
    userEmail: string;
    userDisplayName: string;
    role: UserRole;
    assignedStation: string;
  }) => Promise<void>;
  onRemoveTournamentStaff: (id: number) => Promise<void>;
  onSelfRegisterInTournament: (params: {
    mainCharacter: string;
    teamName: string;
    paymentMethod: 'QR_INSTANT' | 'STRIPE_PIX' | 'CASH_DESK';
  }) => Promise<void>;
  onOpenSmartEnrollmentModal?: () => void;
  onCreateTreasuryPayment: (params: {
    entrantId: string;
    entrantTag: string;
    paymentType: 'ENTRY_FEE' | 'PRIZE_PAYOUT';
    amountUsd: number;
    method: 'QR_INSTANT' | 'STRIPE_PIX' | 'CASH_DESK' | 'BANK_WIRE';
  }) => Promise<void>;
  onUpdatePaymentStatus: (
    paymentId: number,
    status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'PAID_OUT'
  ) => Promise<void>;
  onOpenAuthModal: () => void;
}

const GLOBAL_SYSTEM_ROLES: UserRole[] = ['SUPER_ADMIN', 'USER'];

const CONTEXTUAL_TOURNAMENT_ROLES: Array<{
  role: UserRole;
  codeStandard: string;
  description: string;
}> = [
  {
    role: 'TOURNAMENT_DIRECTOR',
    codeStandard: 'TOURNAMENT_ADMIN (Director)',
    description: 'Control total del evento, delega roles y modifica cualquier marcador.',
  },
  {
    role: 'REFEREE',
    codeStandard: 'REFEREE / POOL_CAPTAIN (Árbitro)',
    description: 'Edita y reporta marcadores de cualquier partida en su zona asignada y resuelve disputas.',
  },
  {
    role: 'STREAMER',
    codeStandard: 'STREAMER / CASTER (Producción OBS)',
    description: 'Acceso WebSocket de solo lectura sin riesgo de alterar marcadores accidentalmente.',
  },
  {
    role: 'PAY_EDITOR',
    codeStandard: 'PAY_EDITOR / TREASURER (Tesorería)',
    description: 'Cobro de Venue Fees, validación de pagos QR y liberación de premios (Payouts).',
  },
  {
    role: 'PLAYER',
    codeStandard: 'PARTICIPANT / ENTRANT (EventParticipant)',
    description: 'Alcance restringido: Check-in y reporte únicamente para sus propias partidas.',
  },
];

export const UsersRolesAndTreasuryPanel: React.FC<UsersRolesAndTreasuryPanelProps> = ({
  currentUser,
  activeRole,
  activeTournamentSlug,
  activeTournamentName,
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
  onSelfRegisterInTournament,
  onOpenSmartEnrollmentModal,
  onCreateTreasuryPayment,
  onUpdatePaymentStatus,
  onOpenAuthModal,
}) => {
  const [userSearch, setUserSearch] = useState<string>('');
  const [selectedStaffUid, setSelectedStaffUid] = useState<string>(
    usersList[0]?.uid || 'usr_ref_station1'
  );
  const [selectedStaffRole, setSelectedStaffRole] = useState<UserRole>('REFEREE');
  const [assignedStation, setAssignedStation] = useState<string>('Station 02 - Stage Beta');

  // Estado Tesorería QR
  const [payEntrantTag, setPayEntrantTag] = useState<string>('Niklauss#PE');
  const [payType, setPayType] = useState<'ENTRY_FEE' | 'PRIZE_PAYOUT'>('ENTRY_FEE');
  const [payAmount, setPayAmount] = useState<number>(50);
  const [payMethod, setPayMethod] = useState<'QR_INSTANT' | 'STRIPE_PIX' | 'CASH_DESK' | 'BANK_WIRE'>('QR_INSTANT');
  const [selfRegFeedback, setSelfRegFeedback] = useState<string>('');

  // ============================================================================
  // ESTADO DE ADMINISTRACIÓN DE DATOS DEL USUARIO (CONTACTO, CONSOLAS E IDs, MAIN/SEC)
  // ============================================================================
  const [editingTargetUid, setEditingTargetUid] = useState<string>(
    currentUser?.uid || ''
  );
  const targetUserObj =
    usersList.find((u) => u.uid === editingTargetUid) || currentUser;

  const [admDisplayName, setAdmDisplayName] = useState<string>(
    targetUserObj?.displayName || ''
  );
  const [admGamerTag, setAdmGamerTag] = useState<string>(
    targetUserObj?.gamerTag || ''
  );
  const [admWhatsapp, setAdmWhatsapp] = useState<string>(
    targetUserObj?.whatsapp || ''
  );
  const [admPhone, setAdmPhone] = useState<string>(
    targetUserObj?.phone || ''
  );
  const [admDiscord, setAdmDiscord] = useState<string>(
    targetUserObj?.discordHandle || ''
  );
  const [admTwitch, setAdmTwitch] = useState<string>(
    targetUserObj?.twitchHandle || ''
  );
  const [admCountry, setAdmCountry] = useState<string>(
    targetUserObj?.country || 'PE'
  );
  const [admCity, setAdmCity] = useState<string>(
    targetUserObj?.city || 'Lima'
  );
  const [admTeamName, setAdmTeamName] = useState<string>(
    targetUserObj?.teamName || 'Free Agent'
  );
  const [admGameSlug, setAdmGameSlug] = useState<string>('tekken8');
  const [admPlatform, setAdmPlatform] = useState<PlatformType>(
    targetUserObj?.gameAccounts?.[0]?.platform || 'PS5'
  );
  const [admInGameId, setAdmInGameId] = useState<string>(
    targetUserObj?.gameAccounts?.[0]?.inGameId || '349Q-tay4-YYH8'
  );
  const [admMainChar, setAdmMainChar] = useState<string>(
    resolveCatalogCharacter(
      targetUserObj?.gamePrefs?.[0]?.mainCharacterId ||
        targetUserObj?.mainCharacter ||
        'Reina',
      TEKKEN_44_CHARACTERS
    )
  );
  const [admSecondaryChar, setAdmSecondaryChar] = useState<string>(
    resolveCatalogCharacter(
      targetUserObj?.gamePrefs?.[0]?.secondaryCharId || 'Jin',
      TEKKEN_44_CHARACTERS
    )
  );
  const [admSaving, setAdmSaving] = useState<boolean>(false);
  const [admFeedback, setAdmFeedback] = useState<string>('');
  const [admError, setAdmError] = useState<string>('');

  const selectedGameCatalog =
    ESPORTS_GAMES_CATALOG.find((g) => g.slug === admGameSlug) ||
    ESPORTS_GAMES_CATALOG[0];
  const admRoster =
    selectedGameCatalog.slug === 'tekken8'
      ? TEKKEN_44_CHARACTERS
      : selectedGameCatalog.characters;

  const loadUserIntoAdminForm = React.useCallback(
    (userToLoad: AuthenticatedUser) => {
      setEditingTargetUid(userToLoad.uid);
      setAdmDisplayName(userToLoad.displayName || '');
      setAdmGamerTag(userToLoad.gamerTag || '');
      setAdmWhatsapp(userToLoad.whatsapp || '');
      setAdmPhone(userToLoad.phone || '');
      setAdmDiscord(userToLoad.discordHandle || '');
      setAdmTwitch(userToLoad.twitchHandle || '');
      setAdmCountry(userToLoad.country || 'PE');
      setAdmCity(userToLoad.city || 'Lima');
      setAdmTeamName(userToLoad.teamName || 'Free Agent');
      const firstAcc =
        userToLoad.gameAccounts?.find((a) => a.isPrimary) ||
        userToLoad.gameAccounts?.[0];
      setAdmPlatform(firstAcc?.platform || 'PS5');
      setAdmInGameId(firstAcc?.inGameId || '349Q-tay4-YYH8');
      setAdmGameSlug(firstAcc?.gameSlug || 'tekken8');
      setAdmMainChar(
        resolveCatalogCharacter(
          userToLoad.gamePrefs?.[0]?.mainCharacterId ||
            userToLoad.mainCharacter ||
            'Reina',
          TEKKEN_44_CHARACTERS
        )
      );
      setAdmSecondaryChar(
        resolveCatalogCharacter(
          userToLoad.gamePrefs?.[0]?.secondaryCharId || 'Jin',
          TEKKEN_44_CHARACTERS
        )
      );
      setAdmFeedback('');
      setAdmError('');
    },
    []
  );

  React.useEffect(() => {
    if (!currentUser) return;
    if (!editingTargetUid) {
      loadUserIntoAdminForm(currentUser);
      return;
    }
    const updatedTarget =
      usersList.find((u) => u.uid === editingTargetUid) ||
      (currentUser.uid === editingTargetUid ? currentUser : null);
    if (updatedTarget) {
      setAdmDisplayName(updatedTarget.displayName || '');
      setAdmGamerTag(updatedTarget.gamerTag || '');
      setAdmWhatsapp(updatedTarget.whatsapp || '');
      setAdmPhone(updatedTarget.phone || '');
      setAdmDiscord(updatedTarget.discordHandle || '');
      setAdmTwitch(updatedTarget.twitchHandle || '');
      setAdmCountry(updatedTarget.country || 'PE');
      setAdmCity(updatedTarget.city || 'Lima');
      setAdmTeamName(updatedTarget.teamName || 'Free Agent');
      const firstAcc =
        updatedTarget.gameAccounts?.find((a) => a.isPrimary) ||
        updatedTarget.gameAccounts?.[0];
      if (firstAcc) {
        setAdmPlatform(firstAcc.platform);
        setAdmInGameId(firstAcc.inGameId);
      }
      setAdmMainChar(
        resolveCatalogCharacter(
          updatedTarget.gamePrefs?.[0]?.mainCharacterId ||
            updatedTarget.mainCharacter ||
            'Reina',
          TEKKEN_44_CHARACTERS
        )
      );
      setAdmSecondaryChar(
        resolveCatalogCharacter(
          updatedTarget.gamePrefs?.[0]?.secondaryCharId || 'Jin',
          TEKKEN_44_CHARACTERS
        )
      );
    }
  }, [currentUser, usersList, editingTargetUid, loadUserIntoAdminForm]);

  const canManageRoles =
    activeRole === 'SUPER_ADMIN' || activeRole === 'TOURNAMENT_DIRECTOR';
  const canManagePayments =
    RBAC_PERMISSIONS_MATRIX[activeRole]?.canManageQrPaymentsAndPrizes ||
    activeRole === 'SUPER_ADMIN' ||
    activeRole === 'TOURNAMENT_DIRECTOR';

  const filteredUsers = (usersList || []).filter((u) => {
    const q = (userSearch || '').trim().toLowerCase();
    if (!q) return true;
    return (
      (u.displayName || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.gamerTag || '').toLowerCase().includes(q) ||
      (u.globalRole || '').toLowerCase().includes(q)
    );
  });

  const handleAdminProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !onSaveUserProfileFromAdmin) return;
    setAdmSaving(true);
    setAdmFeedback('');
    setAdmError('');
    try {
      await onSaveUserProfileFromAdmin({
        targetUid: editingTargetUid || currentUser.uid,
        displayName: admDisplayName.trim() || currentUser.displayName,
        gamerTag: admGamerTag.trim() || currentUser.gamerTag,
        mainCharacter: admMainChar,
        secondaryCharacter: admSecondaryChar,
        platform: admPlatform,
        inGameId: admInGameId.trim(),
        gameSlug: admGameSlug,
        country: admCountry.trim().toUpperCase() || 'PE',
        city: admCity.trim() || 'Lima',
        phone: admPhone.trim(),
        whatsapp: admWhatsapp.trim(),
        discordHandle: admDiscord.trim(),
        twitchHandle: admTwitch.trim(),
        teamName: admTeamName.trim() || 'Free Agent',
        profileCompleted: true,
      });
      setAdmFeedback(
        `¡Datos de usuario, contacto, ID de consola (${admPlatform}: ${admInGameId.trim()}) y personaje MAIN (${admMainChar}) guardados y sincronizados!`
      );
    } catch (err: any) {
      setAdmError(err?.message || 'Error al actualizar los datos del usuario.');
    } finally {
      setAdmSaving(false);
    }
  };

  const handleAdminAddConsoleId = async () => {
    if (!currentUser || !onUpsertGameAccountFromAdmin || !admInGameId.trim()) return;
    setAdmSaving(true);
    setAdmFeedback('');
    setAdmError('');
    try {
      await onUpsertGameAccountFromAdmin({
        targetUid: editingTargetUid || currentUser.uid,
        gameSlug: admGameSlug,
        platform: admPlatform,
        inGameId: admInGameId.trim(),
        isPrimary: true,
      });
      setAdmFeedback(
        `ID de plataforma ${admPlatform} (${admInGameId.trim()}) vinculado en la biblioteca del usuario.`
      );
    } catch (err: any) {
      setAdmError(err?.message || 'Error al guardar el ID de consola.');
    } finally {
      setAdmSaving(false);
    }
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUser = usersList.find((u) => u.uid === selectedStaffUid) || usersList[0];
    if (!targetUser) return;
    await onAssignTournamentStaff({
      userUid: targetUser.uid,
      userEmail: targetUser.email,
      userDisplayName: targetUser.displayName,
      role: selectedStaffRole,
      assignedStation,
    });
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreateTreasuryPayment({
      entrantId: `E-${Date.now().toString(36).slice(-3).toUpperCase()}`,
      entrantTag: payEntrantTag,
      paymentType: payType,
      amountUsd: payAmount,
      method: payMethod,
    });
  };

  const handleQuickSelfRegister = async () => {
    if (!currentUser) {
      onOpenAuthModal();
      return;
    }
    if (onOpenSmartEnrollmentModal) {
      onOpenSmartEnrollmentModal();
      return;
    }
    setSelfRegFeedback('');
    try {
      await onSelfRegisterInTournament({
        mainCharacter: currentUser.mainCharacter || 'Jin',
        teamName: currentUser.teamName || 'Free Agent',
        paymentMethod: 'QR_INSTANT',
      });
      setSelfRegFeedback(
        `¡Inscripción completada para ${currentUser.gamerTag} con comprobante QR verificado!`
      );
    } catch (err: any) {
      setSelfRegFeedback(err?.message || 'Error al inscribirse.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* BANNER DE CUENTA AUTENTICADA Y AUTO-INSCRIPCIÓN INTELIGENTE DE JUGADOR */}
      <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sm font-bold text-sky-300">
            {currentUser
              ? (currentUser.displayName || currentUser.gamerTag || 'U').slice(0, 2).toUpperCase()
              : 'G'}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-white">
                {currentUser
                  ? currentUser.displayName || currentUser.gamerTag || currentUser.email
                  : 'Sesión Invitado (Sin Autenticar)'}
              </span>
              {currentUser && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  {(currentUser.authProvider || 'email').toUpperCase()} ·{' '}
                  {currentUser.globalRole || 'USER'}
                </span>
              )}
              {currentUser?.gameAccounts && currentUser.gameAccounts.length > 0 && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {currentUser.gameAccounts
                    .map((g) => `${g.platform}: ${g.inGameId}`)
                    .join(' · ')}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {currentUser
                ? `${currentUser.email} · GamerTag: ${currentUser.gamerTag} · MAIN: ${currentUser.mainCharacter || 'Reina'} · ELO ${currentUser.eloRating}`
                : 'Inicia sesión 1-Click para gestionar roles, IDs por consola (PS5/PC) e inscribirte a torneos.'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleQuickSelfRegister}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3.5 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/40 cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Inscribirme en {activeTournamentName.split('—')[0]} (Modal Inteligente)
          </button>
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="flex items-center gap-1.5 rounded-lg bg-sky-400 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-300 cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" />
            {currentUser ? 'Modal Rápido de Perfil' : 'Registro 1-Click (0.5s)'}
          </button>
        </div>
      </div>

      {selfRegFeedback && (
        <div className="rounded-lg border border-sky-500/40 bg-sky-950/30 px-4 py-2.5 text-xs text-sky-200">
          {selfRegFeedback}
        </div>
      )}

      {/* ============================================================================
          SECCIÓN 0: ADMINISTRACIÓN DE MIS DATOS DE USUARIO (CONTACTO, IDs POR CONSOLA PS5/PC Y PERSONAJE MAIN)
          Disponible apenas se registra el usuario o en cualquier momento para colocar/actualizar sus datos
         ============================================================================ */}
      {currentUser && targetUserObj && (
        <div className="border border-sky-500/40 bg-slate-900/95 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-sky-400" />
                <h3 className="text-base font-bold text-white">
                  Administración de Mis Datos de Usuario, Contacto, IDs por Consola y Personaje MAIN
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                    targetUserObj.profileCompleted
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      : 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                  }`}
                >
                  {targetUserObj.profileCompleted
                    ? 'PERFIL COMPLETADO (LISTO PARA INSCRIPCIÓN EN 1 SEGUNDO)'
                    : 'CUENTA RECIÉN REGISTRADA (COLOCA TUS DATOS AQUÍ O AL INSCRIBIRTE)'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Puedes colocar o actualizar todos tus datos de <strong>Perfilado Progresivo</strong> (WhatsApp, Teléfono, Discord, Twitch, País, Ciudad), tus <strong>IDs por consola</strong> (<code>PS5</code>, <code>PC_STEAM</code>, <code>XBOX_SERIES</code>, <code>NINTENDO_SWITCH</code>) y tus personajes <strong>MAIN / SECUNDARIO</strong> aquí mismo apenas te registras o en cualquier momento.
              </p>
            </div>

            {canManageRoles && usersList.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-mono">Editando usuario:</span>
                <select
                  value={editingTargetUid || currentUser.uid}
                  onChange={(e) => {
                    const found = usersList.find((u) => u.uid === e.target.value);
                    if (found) loadUserIntoAdminForm(found);
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-mono text-sky-300"
                >
                  {usersList.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName} ({u.gamerTag}) {u.uid === currentUser.uid ? '★ TÚ' : ''}
                    </option>
                  ))}
                </select>
                {editingTargetUid !== currentUser.uid && (
                  <button
                    type="button"
                    onClick={() => loadUserIntoAdminForm(currentUser)}
                    className="px-2.5 py-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 text-sky-300 text-xs font-semibold cursor-pointer"
                  >
                    Volver a Mis Datos
                  </button>
                )}
              </div>
            )}
          </div>

          {admFeedback && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{admFeedback}</span>
            </div>
          )}

          {admError && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-2.5 text-xs text-rose-200">
              {admError}
            </div>
          )}

          <form onSubmit={handleAdminProfileSave} className="space-y-4 text-xs">
            {/* BLOQUE 1: DATOS DE IDENTIDAD, CONTACTO Y UBICACIÓN (PROGRESSIVE PROFILING) */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">
                  1. Datos de Identidad, Contacto (WhatsApp / Discord / Twitch) y Ubicación LAN
                </span>
                <span className="font-mono text-[11px] text-sky-400">
                  {targetUserObj.email}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Nombre Visible</label>
                  <input
                    type="text"
                    required
                    value={admDisplayName}
                    onChange={(e) => setAdmDisplayName(e.target.value)}
                    placeholder="Ej. Mauricio Niklauss"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">GamerTag Oficial (Bracket)</label>
                  <input
                    type="text"
                    required
                    value={admGamerTag}
                    onChange={(e) => setAdmGamerTag(e.target.value)}
                    placeholder="Ej. Niklauss#KR1"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sky-300 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">WhatsApp (Alertas de Partida)</label>
                  <input
                    type="text"
                    value={admWhatsapp}
                    onChange={(e) => setAdmWhatsapp(e.target.value)}
                    placeholder="+51 987 654 321"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Teléfono Móvil</label>
                  <input
                    type="text"
                    value={admPhone}
                    onChange={(e) => setAdmPhone(e.target.value)}
                    placeholder="+51 987 654 321"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Tag de Discord</label>
                  <input
                    type="text"
                    value={admDiscord}
                    onChange={(e) => setAdmDiscord(e.target.value)}
                    placeholder="jugador#0001"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Canal de Twitch</label>
                  <input
                    type="text"
                    value={admTwitch}
                    onChange={(e) => setAdmTwitch(e.target.value)}
                    placeholder="twitch.tv/jugador"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-white"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1">País (ISO)</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={admCountry}
                      onChange={(e) => setAdmCountry(e.target.value.toUpperCase())}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 font-mono text-white uppercase text-center"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-slate-400 mb-1">Ciudad (LAN)</label>
                    <input
                      type="text"
                      value={admCity}
                      onChange={(e) => setAdmCity(e.target.value)}
                      placeholder="Lima / CDMX / Bogotá"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Equipo / Clan / Org</label>
                  <input
                    type="text"
                    value={admTeamName}
                    onChange={(e) => setAdmTeamName(e.target.value)}
                    placeholder="Free Agent"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
                  />
                </div>
              </div>
            </div>

            {/* BLOQUE 2 Y 3: BIBLIOTECA MULTI-ID POR CONSOLA (PS5 / PC / XBOX / SWITCH) + PERSONAJES MAIN / SECUNDARIO */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Bloque 2: Biblioteca de IDs de Consola (GameAccount) */}
              <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-slate-950/90 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-white">
                      2. Biblioteca de IDs de Juego por Consola / Plataforma (GameAccount)
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Guarda múltiples IDs si juegas en distintas consolas (ej. <code>349Q-tay4-YYH8</code> en PS5 y <code>2jdr-i7LF-23HT</code> en PC/Steam).
                    </p>
                  </div>
                </div>

                {/* Lista de IDs guardados actualmente */}
                <div className="flex flex-wrap gap-2">
                  {targetUserObj.gameAccounts && targetUserObj.gameAccounts.length > 0 ? (
                    targetUserObj.gameAccounts.map((acc) => {
                      const isSelected =
                        admPlatform === acc.platform && admInGameId === acc.inGameId;
                      return (
                        <div
                          key={acc.id}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-xs ${
                            isSelected
                              ? 'border-sky-400 bg-sky-500/20 text-white'
                              : 'border-slate-800 bg-slate-900 text-slate-200'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setAdmPlatform(acc.platform);
                              setAdmInGameId(acc.inGameId);
                              setAdmGameSlug(acc.gameSlug || 'tekken8');
                            }}
                            className="flex items-center gap-1.5 text-left cursor-pointer"
                            title="Clic para cargar y editar este ID"
                          >
                            <span className="text-sky-400 font-bold">{acc.platform}:</span>
                            <span>{acc.inGameId}</span>
                            <span className="text-[10px] text-slate-400">
                              ({acc.gameSlug.toUpperCase()})
                            </span>
                          </button>
                          {onDeleteGameAccountFromAdmin && (
                            <button
                              type="button"
                              onClick={() =>
                                onDeleteGameAccountFromAdmin(acc.id, targetUserObj.uid)
                              }
                              className="text-slate-400 hover:text-rose-400 ml-1 cursor-pointer"
                              title="Eliminar este ID de consola"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-[11px] text-amber-300 font-mono">
                      Sin IDs de consola guardados todavía. Ingresa tu consola e ID abajo y haz clic en Vincular o Guardar.
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Consola / Plataforma
                    </label>
                    <select
                      value={admPlatform}
                      onChange={(e) => {
                        const nextPlat = e.target.value as PlatformType;
                        setAdmPlatform(nextPlat);
                        const existingForPlat = targetUserObj.gameAccounts?.find(
                          (a) => a.platform === nextPlat
                        );
                        if (existingForPlat) {
                          setAdmInGameId(existingForPlat.inGameId);
                        } else {
                          const sample =
                            PLATFORM_OPTIONS.find((p) => p.value === nextPlat)?.sampleId ||
                            '349Q-tay4-YYH8';
                          setAdmInGameId(sample);
                        }
                      }}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-white"
                    >
                      {PLATFORM_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[11px] text-slate-400 mb-1">
                      ID en {admPlatform} (Tekken ID / Steam / PSN)
                    </label>
                    <input
                      type="text"
                      value={admInGameId}
                      onChange={(e) => setAdmInGameId(e.target.value)}
                      placeholder="349Q-tay4-YYH8"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sky-300 font-bold"
                    />
                  </div>

                  <div className="sm:col-span-3 flex items-end">
                    <button
                      type="button"
                      disabled={admSaving}
                      onClick={handleAdminAddConsoleId}
                      className="w-full rounded-lg border border-sky-400/50 bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 font-semibold px-3 py-2 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Vincular ID
                    </button>
                  </div>
                </div>
              </div>

              {/* Bloque 3: Personajes Preferidos (UserGamePref: MAIN y SECUNDARIO) */}
              <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-950/90 p-4 space-y-3">
                <div>
                  <span className="font-semibold text-white">
                    3. Personajes Preferidos (UserGamePreference: MAIN y SECUNDARIO)
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Selecciona tu personaje <strong>MAIN</strong> y <strong>SECUNDARIO</strong> de los 44 personajes oficiales de Tekken 8 (A-Z) o del juego activo.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Juego eSports
                    </label>
                    <select
                      value={admGameSlug}
                      onChange={(e) => setAdmGameSlug(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-white"
                    >
                      {ESPORTS_GAMES_CATALOG.map((g) => (
                        <option key={g.slug} value={g.slug}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-emerald-300 font-semibold mb-1">
                      Personaje MAIN ({admRoster.length})
                    </label>
                    <select
                      value={admMainChar}
                      onChange={(e) => setAdmMainChar(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-white"
                    >
                      {admRoster.map((c, idx) => (
                        <option key={c} value={c}>
                          {idx + 1}. {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-sky-300 font-semibold mb-1">
                      Personaje SECUNDARIO
                    </label>
                    <select
                      value={admSecondaryChar}
                      onChange={(e) => setAdmSecondaryChar(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-white"
                    >
                      {admRoster.map((c, idx) => (
                        <option key={c} value={c}>
                          {idx + 1}. {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    type="submit"
                    disabled={admSaving}
                    className="w-full rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold px-4 py-2.5 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {admSaving
                      ? 'Guardando en Cloud SQL PostgreSQL...'
                      : 'Guardar / Actualizar Datos de Usuario, Consola y Personaje MAIN'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* SECCIÓN A: ROLES GLOBALES (NIVEL SISTEMA: SUPER_ADMIN vs USER) + BIBLIOTECA DE IDs POR CONSOLA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 border border-slate-800 bg-slate-900/80 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-400" />
                <h3 className="text-base font-semibold text-white">
                  A. Usuarios, Perfilado Progresivo e IDs por Plataforma (GameAccount)
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Muestra el estado de <strong>Progressive Profiling</strong>, los IDs por consola (<code>PS5</code>, <code>PC_STEAM</code>) y el personaje <strong>MAIN</strong> de cada jugador.
              </p>
            </div>
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Buscar por nombre, email, tag o rol..."
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white focus:border-sky-400 focus:outline-none"
            />
          </div>

          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3 font-medium">Usuario / Contacto</th>
                  <th className="py-2 px-3 font-medium">IDs por Consola & MAIN</th>
                  <th className="py-2 px-3 font-medium">Rol Global (Sistema)</th>
                  <th className="py-2 pl-3 font-medium text-right">Acciones / Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredUsers.map((u) => {
                  const normalizedGlobalRole: UserRole =
                    u.globalRole === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'USER';
                  const canEditThisUser =
                    Boolean(currentUser && currentUser.uid === u.uid) || canManageRoles;
                  return (
                    <tr key={u.uid} className="hover:bg-slate-800/30">
                      <td className="py-2.5 pr-3">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <span>{u.displayName}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                              u.profileCompleted
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-amber-500/15 text-amber-300'
                            }`}
                          >
                            {u.profileCompleted ? 'PROFILED' : '1-CLICK'}
                          </span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">{u.email}</div>
                        {(u.whatsapp || u.discordHandle) && (
                          <div className="font-mono text-[10px] text-slate-500">
                            {u.whatsapp ? `WA: ${u.whatsapp}` : ''}{' '}
                            {u.discordHandle ? `· DC: ${u.discordHandle}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-mono text-sky-400 font-semibold">
                          {u.gamerTag} · <span className="text-emerald-300">MAIN: {u.mainCharacter || 'Jin'}</span>
                        </div>
                        {u.gameAccounts && u.gameAccounts.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {u.gameAccounts.map((acc) => (
                              <span
                                key={acc.id}
                                className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono text-[10px] text-slate-200"
                              >
                                <strong className="text-sky-300">{acc.platform}:</strong> {acc.inGameId}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-500 uppercase">
                            Sin consola vinculada aún · ELO {u.eloRating}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={normalizedGlobalRole}
                          disabled={!canManageRoles}
                          onChange={(e) =>
                            onChangeUserGlobalRole(
                              u.uid,
                              e.target.value as UserRole,
                              u.accountStatus as 'ACTIVE' | 'SUSPENDED'
                            )
                          }
                          className="rounded border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-mono text-white focus:border-sky-400 focus:outline-none disabled:opacity-60"
                        >
                          {GLOBAL_SYSTEM_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r} — {RBAC_PERMISSIONS_MATRIX[r]?.labelEs || r}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canEditThisUser && (
                            <button
                              type="button"
                              onClick={() => loadUserIntoAdminForm(u)}
                              className="px-2 py-1 rounded text-[11px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 cursor-pointer"
                            >
                              Editar Datos
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={!canManageRoles}
                            onClick={() =>
                              onChangeUserGlobalRole(
                                u.uid,
                                normalizedGlobalRole,
                                u.accountStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
                              )
                            }
                            className={`px-2 py-1 rounded text-[11px] font-mono font-semibold ${
                              u.accountStatus === 'ACTIVE'
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {u.accountStatus}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECCIÓN B: ROLES CONTEXTUALES Y DELEGACIÓN DE PODERES POR TORNEO / ESTACIÓN */}
        <div className="lg:col-span-5 border border-slate-800 bg-slate-900/80 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <h3 className="text-base font-semibold text-white">
                    B. Roles Contextuales en {activeTournamentSlug}
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Delegación de Poderes: Un <strong>TOURNAMENT_ADMIN</strong> otorga roles contextuales a cualquier usuario registrado (<strong>USER</strong>).
                </p>
              </div>
            </div>

            <form onSubmit={handleStaffSubmit} className="space-y-3 mb-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Seleccionar Usuario Registrado (Rol Global: USER)
                </label>
                <select
                  value={selectedStaffUid}
                  onChange={(e) => setSelectedStaffUid(e.target.value)}
                  disabled={!canManageRoles}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  {usersList.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName} ({u.gamerTag}) — {u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Rol Contextual en este Torneo
                  </label>
                  <select
                    value={selectedStaffRole}
                    onChange={(e) => setSelectedStaffRole(e.target.value as UserRole)}
                    disabled={!canManageRoles}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
                  >
                    {CONTEXTUAL_TOURNAMENT_ROLES.map((item) => (
                      <option key={item.role} value={item.role}>
                        {item.codeStandard}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Pool / Estación / Ámbito Asignado
                  </label>
                  <input
                    type="text"
                    value={assignedStation}
                    onChange={(e) => setAssignedStation(e.target.value)}
                    disabled={!canManageRoles}
                    placeholder="Pool A / Station 01 / OBS Stream A"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-400">
                {
                  CONTEXTUAL_TOURNAMENT_ROLES.find((c) => c.role === selectedStaffRole)
                    ?.description
                }
              </div>

              <button
                type="submit"
                disabled={!canManageRoles}
                className="w-full rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
              >
                Delegar Rol Contextual en {activeTournamentSlug}
              </button>
            </form>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {tournamentRoles.map((tr) => (
                <div
                  key={tr.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs"
                >
                  <div>
                    <div className="font-semibold text-white">
                      {tr.userDisplayName}{' '}
                      <span className="font-mono text-sky-400">
                        [{RBAC_PERMISSIONS_MATRIX[tr.role]?.codeStandard || tr.role}]
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Ámbito: <span className="text-slate-200">{tr.assignedStation}</span> ·{' '}
                      {tr.userEmail}
                    </div>
                  </div>
                  {canManageRoles && (
                    <button
                      type="button"
                      onClick={() => onRemoveTournamentStaff(tr.id)}
                      className="text-rose-400 hover:text-rose-300 text-[11px] font-semibold"
                    >
                      Revocar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN C: TESORERÍA QR, INSCRIPCIONES Y PREMIOS (ROL PAY_EDITOR) + AUDITORÍA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 border border-slate-800 bg-slate-900/80 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-emerald-400" />
              <h3 className="text-base font-semibold text-white">
                Tesorería QR, Cuotas de Inscripción y Liquidación de Premios (PAY_EDITOR)
              </h3>
            </div>
            <span className="text-xs font-mono text-emerald-400">
              {tournamentPayments.length} operaciones registradas
            </span>
          </div>

          <form onSubmit={handlePaymentSubmit} className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
            <input
              type="text"
              value={payEntrantTag}
              onChange={(e) => setPayEntrantTag(e.target.value)}
              disabled={!canManagePayments}
              placeholder="GamerTag (ej. Knee#KR)"
              className="sm:col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
            />
            <select
              value={payType}
              onChange={(e) => setPayType(e.target.value as 'ENTRY_FEE' | 'PRIZE_PAYOUT')}
              disabled={!canManagePayments}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white"
            >
              <option value="ENTRY_FEE">Inscripción QR</option>
              <option value="PRIZE_PAYOUT">Pago Premio</option>
            </select>
            <input
              type="number"
              value={payAmount}
              onChange={(e) => setPayAmount(Number(e.target.value))}
              disabled={!canManagePayments}
              placeholder="Monto USD"
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
            />
            <button
              type="submit"
              disabled={!canManagePayments}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-50"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Emitir QR
            </button>
          </form>

          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-3 font-medium">Referencia QR</th>
                  <th className="py-2 px-3 font-medium">Competidor</th>
                  <th className="py-2 px-3 font-medium">Tipo & Método</th>
                  <th className="py-2 px-3 font-medium">Monto</th>
                  <th className="py-2 pl-3 font-medium text-right">Estado / Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {tournamentPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/30">
                    <td className="py-2 pr-3 font-mono text-sky-400">{p.qrReferenceCode}</td>
                    <td className="py-2 px-3 font-semibold text-white">{p.entrantTag}</td>
                    <td className="py-2 px-3 text-slate-300">
                      {p.paymentType} · <span className="font-mono text-[11px]">{p.method}</span>
                    </td>
                    <td className="py-2 px-3 font-mono font-semibold text-emerald-400">
                      ${p.amountUsd.toLocaleString()} USD
                    </td>
                    <td className="py-2 pl-3 text-right">
                      <select
                        value={p.status}
                        disabled={!canManagePayments}
                        onChange={(e) =>
                          onUpdatePaymentStatus(
                            p.id,
                            e.target.value as 'PENDING' | 'VERIFIED' | 'REJECTED' | 'PAID_OUT'
                          )
                        }
                        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-mono text-white"
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="VERIFIED">VERIFIED</option>
                        <option value="PAID_OUT">PAID_OUT</option>
                        <option value="REJECTED">REJECTED</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECCIÓN D: HISTORIAL INMUTABLE DE AUDITORÍA DE SEGURIDAD */}
        <div className="lg:col-span-5 border border-slate-800 bg-slate-900/80 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-sky-400" />
              <h3 className="text-base font-semibold text-white">
                Bitácora de Auditoría de Usuarios y Roles
              </h3>
            </div>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-mono font-semibold text-sky-400">
                    {log.action}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-slate-300 leading-relaxed">{log.details}</div>
                <div className="mt-1 text-[10px] font-mono text-slate-500">
                  Actor: {log.userEmail} [{log.userRole}]
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
