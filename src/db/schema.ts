import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export type PlatformType =
  | 'PS5'
  | 'PC_STEAM'
  | 'XBOX_SERIES'
  | 'NINTENDO_SWITCH'
  | 'CROSSPLAY';

// ======================================================
// 1. USUARIO (REGISTRO ULTRARRÁPIDO + PERFIL PROGRESIVO OPCIONAL)
// ======================================================
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  gamerTag: text('gamer_tag').notNull(),
  avatarUrl: text('avatar_url'),
  authProvider: text('auth_provider').notNull().default('google'),
  passwordHash: text('password_hash'),
  globalRole: text('global_role').notNull().default('USER'),
  eloRating: integer('elo_rating').notNull().default(1850),
  mainCharacter: text('main_character').default('Reina'),
  country: text('country').default('PE'),
  city: text('city'),
  phone: text('phone'),
  whatsapp: text('whatsapp'),
  discordHandle: text('discord_handle'),
  twitchHandle: text('twitch_handle'),
  profileCompleted: boolean('profile_completed').notNull().default(false),
  teamName: text('team_name').default('Free Agent'),
  accountStatus: text('account_status').notNull().default('ACTIVE'),
  totpSecret: text('totp_secret'),
  twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
  lastLoginAt: timestamp('last_login_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ======================================================
// 2. IDS DE JUEGO MULTIPLATAFORMA (PS5, PC_STEAM, XBOX_SERIES, NINTENDO_SWITCH, CROSSPLAY)
// ======================================================
export const gameAccounts = pgTable('game_accounts', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  gameSlug: text('game_slug').notNull(),
  platform: text('platform').notNull().default('PS5'),
  inGameId: text('in_game_id').notNull(),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ======================================================
// 3. PREFERENCIA DE PERSONAJE MAIN Y SECUNDARIO POR JUEGO
// ======================================================
export const userGamePrefs = pgTable('user_game_prefs', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  gameSlug: text('game_slug').notNull(),
  mainCharacterId: text('main_character_id'),
  secondaryCharId: text('secondary_char_id'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  ownerUid: text('owner_uid').notNull(),
  region: text('region').default('Global / LATAM'),
  verified: boolean('verified').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tournaments = pgTable('tournaments', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  organizationSlug: text('organization_slug').notNull(),
  name: text('name').notNull(),
  gameName: text('game_name').notNull(),
  gameSlug: text('game_slug').notNull(),
  format: text('format').notNull(),
  date: text('date').notNull(),
  venueFee: integer('venue_fee').notNull().default(25),
  entryFee: integer('entry_fee').notNull().default(25),
  prizePool: integer('prize_pool').notNull().default(25000),
  registrationOpen: boolean('registration_open').notNull().default(true),
  createdByUid: text('created_by_uid'),
  obfSnapshotJson: text('obf_snapshot_json').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tournamentRoles = pgTable('tournament_roles', {
  id: serial('id').primaryKey(),
  tournamentSlug: text('tournament_slug').notNull(),
  userUid: text('user_uid').notNull(),
  userEmail: text('user_email').notNull(),
  userDisplayName: text('user_display_name').notNull(),
  role: text('role').notNull(),
  assignedStation: text('assigned_station'),
  assignedByUid: text('assigned_by_uid'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ======================================================
// 4. INSCRIPCIÓN FINAL AL EVENTO / TORNEO (EventEntrant)
// ======================================================
export const tournamentEntrants = pgTable('tournament_entrants', {
  id: serial('id').primaryKey(),
  tournamentSlug: text('tournament_slug').notNull(),
  entrantId: text('entrant_id').notNull(),
  userUid: text('user_uid'),
  entrantTag: text('entrant_tag').notNull(),
  initialSeed: integer('initial_seed').notNull(),
  eloRating: integer('elo_rating').notNull().default(1800),
  gameAccountId: integer('game_account_id'),
  platform: text('platform').default('PS5'),
  inGameId: text('in_game_id'),
  mainCharacter: text('main_character').default('Reina'),
  secondaryCharacter: text('secondary_character'),
  country: text('country').default('US'),
  teamName: text('team_name').default('Free Agent'),
  checkedIn: boolean('checked_in').notNull().default(false),
  paymentStatus: text('payment_status').notNull().default('PAID'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const tournamentSets = pgTable('tournament_sets', {
  id: serial('id').primaryKey(),
  tournamentSlug: text('tournament_slug').notNull(),
  setId: text('set_id').notNull(),
  phase: text('phase').notNull(),
  round: integer('round').notNull(),
  roundLabel: text('round_label').notNull(),
  entrant1Id: text('entrant1_id'),
  entrant2Id: text('entrant2_id'),
  entrant1Score: integer('entrant1_score').notNull().default(0),
  entrant2Score: integer('entrant2_score').notNull().default(0),
  winnerId: text('winner_id'),
  status: text('status').notNull().default('WAITING'),
  station: text('station'),
  reportedByUid: text('reported_by_uid'),
  disputeReason: text('dispute_reason'),
  proofImageUrl: text('proof_image_url'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tournamentPayments = pgTable('tournament_payments', {
  id: serial('id').primaryKey(),
  tournamentSlug: text('tournament_slug').notNull(),
  entrantId: text('entrant_id').notNull(),
  entrantTag: text('entrant_tag').notNull(),
  userUid: text('user_uid'),
  paymentType: text('payment_type').notNull().default('ENTRY_FEE'),
  amountUsd: integer('amount_usd').notNull(),
  method: text('method').notNull().default('QR_INSTANT'),
  qrReferenceCode: text('qr_reference_code').notNull(),
  status: text('status').notNull().default('VERIFIED'),
  verifiedByUid: text('verified_by_uid'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  userEmail: text('user_email').notNull(),
  userRole: text('user_role').notNull(),
  action: text('action').notNull(),
  tournamentSlug: text('tournament_slug'),
  targetId: text('target_id'),
  details: text('details').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  tournamentRoles: many(tournamentRoles),
  gameAccounts: many(gameAccounts),
  userGamePrefs: many(userGamePrefs),
  auditLogs: many(auditLogs),
}));

export const gameAccountsRelations = relations(gameAccounts, ({ one }) => ({
  user: one(users, {
    fields: [gameAccounts.userUid],
    references: [users.uid],
  }),
}));

export const userGamePrefsRelations = relations(userGamePrefs, ({ one }) => ({
  user: one(users, {
    fields: [userGamePrefs.userUid],
    references: [users.uid],
  }),
}));

export const tournamentRolesRelations = relations(tournamentRoles, ({ one }) => ({
  user: one(users, {
    fields: [tournamentRoles.userUid],
    references: [users.uid],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userUid],
    references: [users.uid],
  }),
}));
