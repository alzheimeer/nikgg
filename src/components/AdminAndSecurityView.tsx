/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Consola de Administración Global:
 * - Configuración de API Key de DeepSeek (DeepSeek-V3 / DeepSeek-R1 / DeepSeek-VL)
 * - Centro de Autenticación de Dos Factores (2FA TOTP RFC 6238)
 * - Matriz de Permisos por Rol (RBAC) y Emisión de Tokens Efímeros
 * - API REST v1 para Integración de Aplicaciones de Terceros
 * - Copias de Seguridad y Restauración en Almacenamiento en la Nube (S3 / GCS / R2)
 */

import React, { useEffect, useState } from 'react';
import {
  type DoubleDqRule,
  type LosersBracketDqPenalty,
  type OBFEventMetadata,
  RBAC_PERMISSIONS_MATRIX,
  TokenScope,
  UserRole,
} from '../engine/nikBracketsEngine';
import {
  CheckCircle2,
  CloudUpload,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Webhook,
} from 'lucide-react';

export interface AdminSummaryState {
  hasDeepSeekKey: boolean;
  deepseekKeyMasked: string;
  deepseekModel: 'deepseek-chat' | 'deepseek-reasoner' | 'deepseek-vl';
  deepseekEndpoint: string;
  redisTtlSeconds: number;
  cloudProvider: 'AWS S3' | 'Google Cloud Storage' | 'Cloudflare R2';
  cloudBucketUri: string;
  autoBackupEnabled: boolean;
  twoFactorRequiredForAdmin: boolean;
  twoFactorVerified: boolean;
  currentTotpPreview: string;
}

export interface EphemeralTokenItem {
  token: string;
  userId: string;
  name: string;
  scope: TokenScope;
  role: UserRole;
  expiresAt: string;
  createdAt: string;
}

export interface ThirdPartyApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  fullKey: string;
  scopes: TokenScope[];
  createdAt: string;
  lastUsedAt: string | null;
  requestsCount: number;
}

export interface CloudBackupSummaryItem {
  id: string;
  name: string;
  provider: string;
  bucketUri: string;
  checksumSha256: string;
  sizeBytes: number;
  createdAt: string;
  tournamentCount: number;
}

interface AdminAndSecurityViewProps {
  activeRole: UserRole;
  adminSummary: AdminSummaryState;
  ephemeralTokens: EphemeralTokenItem[];
  thirdPartyApiKeys: ThirdPartyApiKeyItem[];
  cloudBackups: CloudBackupSummaryItem[];
  activeTournamentSlug: string;
  activeTournamentEvent?: OBFEventMetadata;
  onSaveTournamentCheckInConfig?: (config: {
    enableMatchCheckIn: boolean;
    matchCheckInTimeoutMinutes: number;
    enableAutoDq: boolean;
    doubleDqRule: DoubleDqRule;
    losersBracketDqPenalty: LosersBracketDqPenalty;
  }) => Promise<void>;
  onSaveAdminConfig: (config: Partial<AdminSummaryState> & { deepseekApiKey?: string }) => Promise<void>;
  onVerify2FA: (code: string) => Promise<{ verified: boolean; message?: string; error?: string }>;
  onRotate2FASecret: () => Promise<{ totpSecret: string; currentTotpPreview: string }>;
  onCreateEphemeralToken: (name: string, role: UserRole, scope: TokenScope) => Promise<void>;
  onRevokeEphemeralToken: (token: string) => Promise<void>;
  onCreateThirdPartyKey: (name: string) => Promise<void>;
  onDeleteThirdPartyKey: (id: string) => Promise<void>;
  onCreateCloudBackup: (label: string) => Promise<void>;
  onRestoreCloudBackup: (backupId: string) => Promise<void>;
}

export const AdminAndSecurityView: React.FC<AdminAndSecurityViewProps> = ({
  activeRole,
  adminSummary,
  ephemeralTokens,
  thirdPartyApiKeys,
  cloudBackups,
  activeTournamentSlug,
  activeTournamentEvent,
  onSaveTournamentCheckInConfig,
  onSaveAdminConfig,
  onVerify2FA,
  onRotate2FASecret,
  onCreateEphemeralToken,
  onRevokeEphemeralToken,
  onCreateThirdPartyKey,
  onDeleteThirdPartyKey,
  onCreateCloudBackup,
  onRestoreCloudBackup,
}) => {
  // Estado de Reglas Graduables de Match Check-In y DQ del Torneo Activo
  const [enableMatchCheckIn, setEnableMatchCheckIn] = useState<boolean>(
    activeTournamentEvent?.enableMatchCheckIn ?? true
  );
  const [matchCheckInTimeoutMinutes, setMatchCheckInTimeoutMinutes] = useState<number>(
    activeTournamentEvent?.matchCheckInTimeoutMinutes ?? 5
  );
  const [enableAutoDq, setEnableAutoDq] = useState<boolean>(
    activeTournamentEvent?.enableAutoDq ?? true
  );
  const [doubleDqRule, setDoubleDqRule] = useState<DoubleDqRule>(
    activeTournamentEvent?.doubleDqRule ?? 'AUTO_BYE_NEXT_ROUND'
  );
  const [losersBracketDqPenalty, setLosersBracketDqPenalty] =
    useState<LosersBracketDqPenalty>(
      activeTournamentEvent?.losersBracketDqPenalty ?? 'DROP_TO_LOSERS'
    );
  const [checkInConfigSavedBanner, setCheckInConfigSavedBanner] = useState<string>('');

  useEffect(() => {
    setEnableMatchCheckIn(activeTournamentEvent?.enableMatchCheckIn ?? true);
    setMatchCheckInTimeoutMinutes(activeTournamentEvent?.matchCheckInTimeoutMinutes ?? 5);
    setEnableAutoDq(activeTournamentEvent?.enableAutoDq ?? true);
    setDoubleDqRule(activeTournamentEvent?.doubleDqRule ?? 'AUTO_BYE_NEXT_ROUND');
    setLosersBracketDqPenalty(
      activeTournamentEvent?.losersBracketDqPenalty ?? 'DROP_TO_LOSERS'
    );
  }, [
    activeTournamentSlug,
    activeTournamentEvent?.enableMatchCheckIn,
    activeTournamentEvent?.matchCheckInTimeoutMinutes,
    activeTournamentEvent?.enableAutoDq,
    activeTournamentEvent?.doubleDqRule,
    activeTournamentEvent?.losersBracketDqPenalty,
  ]);
  const [deepseekInputKey, setDeepseekInputKey] = useState<string>('');
  const [deepseekModel, setDeepseekModel] = useState<'deepseek-chat' | 'deepseek-reasoner' | 'deepseek-vl'>(
    adminSummary.deepseekModel || 'deepseek-chat'
  );
  const [deepseekEndpoint, setDeepseekEndpoint] = useState<string>(
    adminSummary.deepseekEndpoint || 'https://api.deepseek.com/v1/chat/completions'
  );
  const [redisTtl, setRedisTtl] = useState<number>(adminSummary.redisTtlSeconds || 300);
  const [cloudProvider, setCloudProvider] = useState<'AWS S3' | 'Google Cloud Storage' | 'Cloudflare R2'>(
    adminSummary.cloudProvider || 'Google Cloud Storage'
  );
  const [cloudBucketUri, setCloudBucketUri] = useState<string>(
    adminSummary.cloudBucketUri || 'gs://nikbrackets-cloud-vault-2026/obf-snapshots'
  );
  const [autoBackupEnabled, setAutoBackupEnabled] = useState<boolean>(adminSummary.autoBackupEnabled);
  const [configSavedBanner, setConfigSavedBanner] = useState<string>('');

  // Estado 2FA
  const [totpCodeInput, setTotpCodeInput] = useState<string>('');
  const [totpFeedback, setTotpFeedback] = useState<string>('');
  const [totpPreview, setTotpPreview] = useState<string>(adminSummary.currentTotpPreview);

  // Estado Tokens Efímeros
  const [tokenName, setTokenName] = useState<string>('Tablet Árbitro Estación 02');
  const [tokenRole, setTokenRole] = useState<UserRole>('REFEREE');
  const [tokenScope, setTokenScope] = useState<TokenScope>('SCORE_REPORTER');

  // Estado API Terceros
  const [apiKeyName, setApiKeyName] = useState<string>('Bot Discord Resultados en Vivo');
  const [apiTestOutput, setApiTestOutput] = useState<string>('');

  // Estado Cloud Backup
  const [backupLabel, setBackupLabel] = useState<string>('Snapshot Oficial Pre-Playoffs');

  const canConfigureAdmin = RBAC_PERMISSIONS_MATRIX[activeRole]?.canConfigureDeepSeekAndSecurity;
  const canConfigureTournamentRules =
    canConfigureAdmin ||
    activeRole === 'TOURNAMENT_DIRECTOR' ||
    activeRole === 'REFEREE';

  const handleSaveCheckInRules = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveTournamentCheckInConfig) return;
    await onSaveTournamentCheckInConfig({
      enableMatchCheckIn,
      matchCheckInTimeoutMinutes,
      enableAutoDq,
      doubleDqRule,
      losersBracketDqPenalty,
    });
    setCheckInConfigSavedBanner(
      'Reglas de Match Check-In, Single DQ y Double DQ actualizadas en vivo (Worker BullMQ sincronizado).'
    );
    setTimeout(() => setCheckInConfigSavedBanner(''), 4000);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveAdminConfig({
      deepseekApiKey: deepseekInputKey.trim() || undefined,
      deepseekModel,
      deepseekEndpoint,
      redisTtlSeconds: redisTtl,
      cloudProvider,
      cloudBucketUri,
      autoBackupEnabled,
    });
    setDeepseekInputKey('');
    setConfigSavedBanner('Configuración de DeepSeek, Redis y Cloud Storage guardada correctamente.');
    setTimeout(() => setConfigSavedBanner(''), 4000);
  };

  const handleTestThirdPartyApi = async () => {
    const firstKey = thirdPartyApiKeys[0]?.fullKey || '';
    const res = await fetch(`/api/v1/tournaments/${activeTournamentSlug}/obf`, {
      headers: firstKey ? { 'X-API-Key': firstKey } : {},
    });
    const data = await res.json();
    setApiTestOutput(
      JSON.stringify(
        {
          endpoint: `GET /api/v1/tournaments/${activeTournamentSlug}/obf`,
          status: res.status,
          apiVersion: data.apiVersion,
          engine: data.engine,
          tournament: data.obf?.event?.name,
          entrantsCount: data.obf?.entrants?.length,
          setsCount: data.obf?.sets?.length,
          topStanding: data.standings?.[0]?.entrant?.entrantTag,
        },
        null,
        2
      )
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {!canConfigureAdmin && (
        <div className="border border-amber-500/40 bg-amber-950/20 rounded-xl p-4 text-xs text-amber-200">
          Estás visualizando en rol <strong>{activeRole}</strong>. Para editar la API Key de DeepSeek o rotar secretos 2FA, selecciona el rol <strong>SUPER_ADMIN</strong> en el selector superior.
        </div>
      )}

      {/* SECCIÓN 0: REGLAS GRADUABLES DE MATCH CHECK-IN Y DESCALIFICACIÓN AUTOMÁTICA (DQ / DOUBLE DQ) */}
      <form
        onSubmit={handleSaveCheckInRules}
        className="border border-amber-500/40 bg-slate-900/90 rounded-xl p-5 flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-white">
              00. Reglas Graduables de Match Check-In por Pelea/Set & Descalificación Automática (BullMQ Worker)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Torneo activo: <strong className="text-sky-300">{activeTournamentEvent?.name || activeTournamentSlug}</strong> · Evita que el torneo se congele esperando a jugadores ausentes.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-mono font-semibold">
            {enableMatchCheckIn
              ? `Check-In Activo (${matchCheckInTimeoutMinutes} min)`
              : 'Check-In Desactivado'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* 1. Habilitar Check-In por Pelea */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-2">
            <div>
              <label className="font-semibold text-white block mb-1">
                Habilitar Check-In por Pelea (enableMatchCheckIn)
              </label>
              <p className="text-[11px] text-slate-400">
                Exige que ambos jugadores confirmen presencia antes de abrir el reporte de marcador.
              </p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <label className="flex items-center gap-2 text-slate-200 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableMatchCheckIn}
                  disabled={!canConfigureTournamentRules}
                  onChange={(e) => setEnableMatchCheckIn(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900"
                />
                {enableMatchCheckIn ? 'Activado' : 'Desactivado'}
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-amber-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableAutoDq}
                  disabled={!canConfigureTournamentRules || !enableMatchCheckIn}
                  onChange={(e) => setEnableAutoDq(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900"
                />
                Auto-DQ BullMQ
              </label>
            </div>
          </div>

          {/* 2. Tiempo Límite de Check-In (Graduable 2 a 30 min) */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-white">
                  Tiempo Límite (matchCheckInTimeoutMinutes)
                </label>
                <span className="font-mono tabular-nums font-bold text-amber-300">
                  {matchCheckInTimeoutMinutes} min
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Graduable de <strong>2 a 30 minutos</strong> (Valor por defecto: 5 minutos).
              </p>
            </div>
            <div className="pt-1">
              <input
                type="range"
                min={2}
                max={30}
                step={1}
                value={matchCheckInTimeoutMinutes}
                disabled={!canConfigureTournamentRules || !enableMatchCheckIn}
                onChange={(e) => setMatchCheckInTimeoutMinutes(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-0.5">
                <span>2 min</span>
                <span>5 min (Default)</span>
                <span>15 min</span>
                <span>30 min</span>
              </div>
            </div>
          </div>

          {/* 3. Acción ante Descalificación Doble (doubleDqRule) */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-2">
            <div>
              <label className="font-semibold text-white block mb-1">
                Acción ante Double DQ (doubleDqRule)
              </label>
              <p className="text-[11px] text-slate-400">
                Define cómo resuelve el motor cuando ninguno de los 2 rivales hace Check-In.
              </p>
            </div>
            <select
              value={doubleDqRule}
              disabled={!canConfigureTournamentRules || !enableMatchCheckIn}
              onChange={(e) => setDoubleDqRule(e.target.value as DoubleDqRule)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white"
            >
              <option value="AUTO_BYE_NEXT_ROUND">
                AUTO_BYE_NEXT_ROUND (Recomendado: Rival siguiente recibe BYE)
              </option>
              <option value="RANDOM_COIN_FLIP">
                RANDOM_COIN_FLIP (Avanza uno al azar Coin Flip)
              </option>
              <option value="PAUSE_FOR_ADMIN">
                PAUSE_FOR_ADMIN (Pausar nodo y alertar a Árbitro/Admin)
              </option>
            </select>
          </div>

          {/* 4. Penalización en Doble Eliminación (losersBracketDqPenalty) */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-2">
            <div>
              <label className="font-semibold text-white block mb-1">
                Penalización en Doble Eliminación (losersBracketDqPenalty)
              </label>
              <p className="text-[11px] text-slate-400">
                Comportamiento si un jugador recibe DQ estando en Winners Bracket.
              </p>
            </div>
            <select
              value={losersBracketDqPenalty}
              disabled={!canConfigureTournamentRules || !enableMatchCheckIn}
              onChange={(e) =>
                setLosersBracketDqPenalty(e.target.value as LosersBracketDqPenalty)
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white"
            >
              <option value="DROP_TO_LOSERS">
                DROP_TO_LOSERS (Cae a Losers Bracket para jugar si llega tarde)
              </option>
              <option value="ELIMINATE_FROM_EVENT">
                ELIMINATE_FROM_EVENT (Eliminado de todo el torneo inmediatamente)
              </option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
          <span className="text-xs text-emerald-400">{checkInConfigSavedBanner}</span>
          <button
            type="submit"
            disabled={!canConfigureTournamentRules}
            className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-semibold text-xs whitespace-nowrap shrink-0 cursor-pointer"
          >
            Guardar Reglas de Match Check-In y DQ
          </button>
        </div>
      </form>

      {/* SECCIÓN 1: CONFIGURACIÓN DE DEEPSEEK API KEY Y MOTOR IA MULTIMODAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSaveConfig}
          className="lg:col-span-7 border border-slate-800 bg-slate-900/80 rounded-xl p-5 flex flex-col justify-between gap-4"
        >
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-400" />
                <h2 className="text-base font-semibold text-white">
                  01. Configuración de API Key de DeepSeek & Funciones IA del Torneo
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Estado: {adminSummary.hasDeepSeekKey ? `Clave Activa (${adminSummary.deepseekKeyMasked})` : 'Modo Heurístico Local + Listo para Clave'}
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Ingresa tu clave de API de DeepSeek (<span className="font-mono text-slate-300">sk-...</span>) para habilitar las funciones avanzadas en vivo:
              <strong> DeepSeek-VL Vision</strong> (verificación de capturas de victoria en estación),
              <strong> DeepSeek-R1 Seeding</strong> (balanceo inteligente por ELO evitando colisiones regionales) y
              <strong> DeepSeek-V3 Broadcast Narrative</strong> (generador de storylines para comentaristas).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  DeepSeek API Key (Configuración de Administrador)
                </label>
                <input
                  type="password"
                  value={deepseekInputKey}
                  onChange={(e) => setDeepseekInputKey(e.target.value)}
                  disabled={!canConfigureAdmin}
                  placeholder={
                    adminSummary.hasDeepSeekKey
                      ? `Clave configurada: ${adminSummary.deepseekKeyMasked} (Escribe para reemplazar)`
                      : 'sk-deepseek-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-mono text-white focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Modelo Principal DeepSeek
                </label>
                <select
                  value={deepseekModel}
                  onChange={(e) =>
                    setDeepseekModel(e.target.value as 'deepseek-chat' | 'deepseek-reasoner' | 'deepseek-vl')
                  }
                  disabled={!canConfigureAdmin}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  <option value="deepseek-chat">deepseek-chat (DeepSeek-V3 Narrativa & Operaciones)</option>
                  <option value="deepseek-reasoner">deepseek-reasoner (DeepSeek-R1 Seeding & Auditoría DAG)</option>
                  <option value="deepseek-vl">deepseek-vl (DeepSeek-VL Visión Arbitral de Capturas)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  TTL Caché Distribuida Redis (Segundos)
                </label>
                <input
                  type="number"
                  min={10}
                  max={86400}
                  value={redisTtl}
                  onChange={(e) => setRedisTtl(Number(e.target.value))}
                  disabled={!canConfigureAdmin}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono tabular-nums text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Proveedor Cloud Backup
                </label>
                <select
                  value={cloudProvider}
                  onChange={(e) =>
                    setCloudProvider(e.target.value as 'AWS S3' | 'Google Cloud Storage' | 'Cloudflare R2')
                  }
                  disabled={!canConfigureAdmin}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  <option value="Google Cloud Storage">Google Cloud Storage (GCS)</option>
                  <option value="AWS S3">Amazon S3 Bucket</option>
                  <option value="Cloudflare R2">Cloudflare R2 Object Storage</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  URI del Bucket de Copias de Seguridad
                </label>
                <input
                  type="text"
                  value={cloudBucketUri}
                  onChange={(e) => setCloudBucketUri(e.target.value)}
                  disabled={!canConfigureAdmin}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoBackupEnabled}
                onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                disabled={!canConfigureAdmin}
                className="rounded border-slate-700 bg-slate-950"
              />
              Ejecutar copia de seguridad automática en la nube al concluir la Grand Final
            </label>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <span className="text-xs text-emerald-400">{configSavedBanner}</span>
            <button
              type="submit"
              disabled={!canConfigureAdmin}
              className="px-4 py-2 rounded-lg bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-slate-950 font-semibold text-xs whitespace-nowrap shrink-0"
            >
              Guardar Configuración de Admin
            </button>
          </div>
        </form>

        {/* SECCIÓN 2: AUTENTICACIÓN DE DOS FACTORES (2FA TOTP RFC 6238) */}
        <div className="lg:col-span-5 border border-slate-800 bg-slate-900/80 rounded-xl p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h2 className="text-base font-semibold text-white">
                  02. Autenticación de Dos Factores (2FA TOTP)
                </h2>
              </div>
              <span className="text-xs font-mono text-emerald-400">
                {adminSummary.twoFactorVerified ? '2FA Verificado' : 'Pendiente Verificación'}
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Protección de operaciones críticas mediante códigos temporales de 6 dígitos (RFC 6238 HMAC-SHA1 cada 30s) compatibles con Google Authenticator y Authy.
            </p>

            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 mb-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-slate-400">
                  Código TOTP Activo (Ventana 30s actual):
                </div>
                <div className="text-xl font-mono tabular-nums font-bold text-sky-400 tracking-widest mt-0.5">
                  {totpPreview || adminSummary.currentTotpPreview}
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const rotated = await onRotate2FASecret();
                  setTotpPreview(rotated.currentTotpPreview);
                  setTotpFeedback('Secreto 2FA rotado. Verifica con el nuevo código de 6 dígitos.');
                }}
                disabled={!canConfigureAdmin}
                className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Rotar Secreto
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={6}
                value={totpCodeInput}
                onChange={(e) => setTotpCodeInput(e.target.value)}
                placeholder="Ingresa código 6 dígitos..."
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-mono tabular-nums text-white"
              />
              <button
                type="button"
                onClick={async () => {
                  const res = await onVerify2FA(totpCodeInput || totpPreview || adminSummary.currentTotpPreview);
                  setTotpFeedback(res.message || res.error || '');
                }}
                className="px-4 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Lock className="w-3.5 h-3.5" />
                Verificar 2FA
              </button>
            </div>

            {totpFeedback && (
              <div className="mt-3 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{totpFeedback}</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 font-mono">
            Algoritmo: HMAC-SHA1 · Ventana: 30s · Tolerancia de deriva: ±1 bloque
          </div>
        </div>
      </div>

      {/* SECCIÓN 3: TOKENS EFÍMEROS RBAC & API DE INTEGRACIÓN DE TERCEROS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Tokens Efímeros para Árbitros Móviles, OBS y MCP */}
        <div className="lg:col-span-6 border border-slate-800 bg-slate-900/80 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">
                03. Tokens Efímeros por Rol (RBAC Estaciones & OBS)
              </h3>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {ephemeralTokens.length} activos
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="Etiqueta de estación..."
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
            />
            <select
              value={tokenRole}
              onChange={(e) => setTokenRole(e.target.value as UserRole)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
            >
              <option value="REFEREE">REFEREE (Árbitro)</option>
              <option value="STREAMER">STREAMER (Broadcast)</option>
              <option value="TOURNAMENT_DIRECTOR">TOURNAMENT_DIRECTOR</option>
            </select>
            <button
              type="button"
              onClick={() => onCreateEphemeralToken(tokenName, tokenRole, tokenScope)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Emitir Token 1h
            </button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {ephemeralTokens.map((t) => (
              <div
                key={t.token}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-200 truncate">{t.name}</div>
                  <div className="font-mono text-[11px] text-sky-400 truncate">
                    {t.token} · Rol: {t.role} · Scope: {t.scope}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRevokeEphemeralToken(t.token)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400"
                  title="Revocar Token"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* API REST de Terceros (/api/v1/*) */}
        <div className="lg:col-span-6 border border-slate-800 bg-slate-900/80 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Webhook className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-semibold text-white">
                04. API REST para Integración de Aplicaciones de Terceros
              </h3>
            </div>
            <button
              type="button"
              onClick={handleTestThirdPartyApi}
              className="px-3 py-1 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs whitespace-nowrap shrink-0"
            >
              Probar GET /api/v1/obf
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={apiKeyName}
              onChange={(e) => setApiKeyName(e.target.value)}
              placeholder="Nombre de la integración externa..."
              className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
            />
            <button
              type="button"
              onClick={() => onCreateThirdPartyKey(apiKeyName)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Crear API Key
            </button>
          </div>

          <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
            {thirdPartyApiKeys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-200">{k.name}</div>
                  <div className="font-mono text-[11px] text-slate-400 truncate">
                    Key: <span className="text-emerald-400">{k.fullKey}</span> · {k.requestsCount} llamadas
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteThirdPartyKey(k.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {apiTestOutput && (
            <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-36">
              {apiTestOutput}
            </pre>
          )}
        </div>
      </div>

      {/* SECCIÓN 4: COPIAS DE SEGURIDAD EN LA NUBE (CLOUD STORAGE SNAPSHOTS) & MATRIZ RBAC */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 border border-slate-800 bg-slate-900/80 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <CloudUpload className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-semibold text-white">
                05. Copias de Seguridad en la Nube ({adminSummary.cloudProvider})
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {cloudBackups.length} snapshots verificados con SHA-256
            </span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={backupLabel}
              onChange={(e) => setBackupLabel(e.target.value)}
              placeholder="Etiqueta de la copia de seguridad..."
              className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
            <button
              type="button"
              onClick={() => onCreateCloudBackup(backupLabel)}
              className="px-4 py-2 rounded-lg bg-sky-400 hover:bg-sky-300 text-slate-950 font-semibold text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              Respaldar en Cloud Ahora
            </button>
          </div>

          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {cloudBackups.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs"
              >
                <div>
                  <div className="font-semibold text-white">{b.name}</div>
                  <div className="text-[11px] font-mono tabular-nums text-slate-400">
                    {b.provider} · {(b.sizeBytes / 1024).toFixed(1)} KB · SHA-256: {b.checksumSha256} · {new Date(b.createdAt).toLocaleTimeString()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRestoreCloudBackup(b.id)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  Restaurar Snapshot
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Matriz de Permisos por Rol (RBAC) */}
        <div className="lg:col-span-5 border border-slate-800 bg-slate-900/80 rounded-xl p-5 overflow-x-auto">
          <h3 className="text-sm font-semibold text-white pb-3 mb-3 border-b border-slate-800">
            06. Matriz de Control de Acceso por Roles (RBAC)
          </h3>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400">
                <th className="py-2 pr-2">Rol</th>
                <th className="py-2 px-2">Crear Torneo</th>
                <th className="py-2 px-2">Reportar</th>
                <th className="py-2 pl-2">Admin/IA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {Object.values(RBAC_PERMISSIONS_MATRIX).map((r) => (
                <tr
                  key={r.role}
                  className={r.role === activeRole ? 'bg-sky-500/10' : ''}
                >
                  <td className="py-2 pr-2 font-mono font-semibold text-white">
                    {r.role}
                  </td>
                  <td className="py-2 px-2 font-mono">
                    {r.canCreateTournaments ? 'SÍ' : '—'}
                  </td>
                  <td className="py-2 px-2 font-mono">
                    {r.canReportStationScores ? 'SÍ' : '—'}
                  </td>
                  <td className="py-2 pl-2 font-mono">
                    {r.canConfigureDeepSeekAndSecurity ? 'SÍ' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
