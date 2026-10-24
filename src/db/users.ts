import crypto from 'crypto';
import { desc, eq, and } from 'drizzle-orm';
import { db } from './index.ts';
import {
  users,
  gameAccounts,
  userGamePrefs,
  organizations,
  tournaments,
  tournamentRoles,
  tournamentEntrants,
  tournamentSets,
  tournamentPayments,
  auditLogs,
  type PlatformType,
} from './schema.ts';
import type { OBFDocument, UserRole } from '../engine/nikBracketsEngine.ts';

export type { PlatformType };
export { getOrCreateUser as ensureUserInDb };

const OWNER_ADMIN_EMAILS = new Set([
  'niklaussmauricio@gmail.com',
  'admin@nikbrackets.pro',
]);

export function hashPassword(password: string, salt?: string): string {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, usedSalt, 64).toString('hex');
  return `${usedSalt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string | null): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHex] = storedHash.split(':');
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(originalHex, 'hex'), Buffer.from(candidate, 'hex'));
}

export async function getOrCreateUser(params: {
  uid: string;
  email: string;
  displayName?: string;
  gamerTag?: string;
  avatarUrl?: string | null;
  authProvider?: 'google' | 'email';
  defaultRole?: UserRole;
}) {
  try {
    const normalizedEmail = params.email.trim().toLowerCase();
    const isOwnerAdmin = OWNER_ADMIN_EMAILS.has(normalizedEmail);
    const derivedName =
      params.displayName?.trim() ||
      normalizedEmail.split('@')[0] ||
      'Competitor';
    const derivedTag =
      params.gamerTag?.trim() ||
      `${derivedName.replace(/\s+/g, '')}#${Math.floor(100 + Math.random() * 899)}`;

    // Check if a user with this email already exists (e.g. pre-seeded or registered via email then logging in with Google)
    const existingByEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingByEmail.length > 0 && existingByEmail[0].uid !== params.uid) {
      const updated = await db
        .update(users)
        .set({
          uid: params.uid,
          displayName: params.displayName || existingByEmail[0].displayName,
          avatarUrl: params.avatarUrl ?? existingByEmail[0].avatarUrl,
          globalRole: isOwnerAdmin ? 'SUPER_ADMIN' : existingByEmail[0].globalRole,
          lastLoginAt: new Date(),
        })
        .where(eq(users.email, normalizedEmail))
        .returning();
      return updated[0];
    }

    const initialRole: UserRole = isOwnerAdmin
      ? 'SUPER_ADMIN'
      : params.defaultRole || 'USER';

    const result = await db
      .insert(users)
      .values({
        uid: params.uid,
        email: normalizedEmail,
        displayName: derivedName,
        gamerTag: derivedTag,
        avatarUrl: params.avatarUrl || null,
        authProvider: params.authProvider || 'google',
        globalRole: initialRole,
        lastLoginAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: normalizedEmail,
          displayName: derivedName,
          avatarUrl: params.avatarUrl || null,
          ...(isOwnerAdmin ? { globalRole: 'SUPER_ADMIN' } : {}),
          lastLoginAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user profile in PostgreSQL.', {
      cause: error,
    });
  }
}

export async function registerUserWithEmailPassword(params: {
  email: string;
  password: string;
  displayName: string;
  gamerTag?: string;
  avatarUrl?: string;
  authProvider?: string;
  mainCharacter?: string;
  country?: string;
  teamName?: string;
  firebaseUid?: string;
}) {
  try {
    const normalizedEmail = params.email.trim().toLowerCase();
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      throw new Error('EMAIL_ALREADY_EXISTS');
    }

    const isOwnerAdmin = OWNER_ADMIN_EMAILS.has(normalizedEmail);
    const uid = params.firebaseUid || `usr_${crypto.randomUUID()}`;
    const passwordHash = hashPassword(params.password);
    const totpSecret = `NIK-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const cleanName = params.displayName.trim() || normalizedEmail.split('@')[0] || 'Player';
    const derivedGamerTag =
      params.gamerTag?.trim() ||
      `${cleanName.replace(/[^a-zA-Z0-9]/g, '') || 'Player'}#${Math.floor(100 + Math.random() * 899)}`;

    const inserted = await db
      .insert(users)
      .values({
        uid,
        email: normalizedEmail,
        displayName: cleanName,
        gamerTag: derivedGamerTag,
        avatarUrl: params.avatarUrl || null,
        authProvider: params.authProvider || 'email',
        passwordHash,
        globalRole: isOwnerAdmin ? 'SUPER_ADMIN' : 'USER',
        mainCharacter: params.mainCharacter || 'Reina',
        country: params.country || 'PE',
        teamName: params.teamName || 'Free Agent',
        profileCompleted: false,
        totpSecret,
        twoFactorEnabled: false,
        lastLoginAt: new Date(),
      })
      .returning();

    return inserted[0];
  } catch (error: any) {
    if (error?.message === 'EMAIL_ALREADY_EXISTS') {
      throw error;
    }
    console.error('Database query failed in registerUserWithEmailPassword:', error);
    throw new Error('Could not register user in database.', { cause: error });
  }
}

export async function verifyUserEmailPassword(identifier: string, password: string) {
  try {
    const cleanInput = identifier.trim();
    const normalizedLower = cleanInput.toLowerCase();

    const foundByEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedLower))
      .limit(1);

    let userRecord = foundByEmail[0];

    if (!userRecord) {
      const allRows = await db.select().from(users);
      userRecord = allRows.find(
        (u) =>
          u.email.toLowerCase() === normalizedLower ||
          u.displayName.toLowerCase() === normalizedLower ||
          u.gamerTag.toLowerCase() === normalizedLower ||
          u.gamerTag.split('#')[0].toLowerCase() === normalizedLower
      )!;
    }

    if (!userRecord) {
      return null;
    }

    if (!verifyPassword(password, userRecord.passwordHash)) {
      return null;
    }

    const updated = await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.uid, userRecord.uid))
      .returning();

    return updated[0];
  } catch (error) {
    console.error('Database query failed in verifyUserEmailPassword:', error);
    throw new Error('Authentication query failed.', { cause: error });
  }
}

export async function getUserByUid(uid: string) {
  try {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1);
    return rows[0] || null;
  } catch (error) {
    console.error('Database query failed in getUserByUid:', error);
    throw new Error('Failed to load user record.', { cause: error });
  }
}

export async function getAllUsers() {
  try {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  } catch (error) {
    console.error('Database query failed in getAllUsers:', error);
    throw new Error('Failed to fetch users list from PostgreSQL.', { cause: error });
  }
}

export async function updateUserRoleAndStatus(params: {
  targetUid: string;
  globalRole: UserRole;
  accountStatus?: 'ACTIVE' | 'SUSPENDED';
}) {
  try {
    const updated = await db
      .update(users)
      .set({
        globalRole: params.globalRole,
        ...(params.accountStatus ? { accountStatus: params.accountStatus } : {}),
      })
      .where(eq(users.uid, params.targetUid))
      .returning();
    return updated[0] || null;
  } catch (error) {
    console.error('Database query failed in updateUserRoleAndStatus:', error);
    throw new Error('Failed to update user role in PostgreSQL.', { cause: error });
  }
}

export async function updateUserProfileInDb(params: {
  uid: string;
  displayName?: string;
  gamerTag?: string;
  mainCharacter?: string;
  country?: string;
  city?: string;
  phone?: string;
  whatsapp?: string;
  discordHandle?: string;
  twitchHandle?: string;
  profileCompleted?: boolean;
  teamName?: string;
}) {
  try {
    const updated = await db
      .update(users)
      .set({
        ...(params.displayName !== undefined ? { displayName: params.displayName.trim() } : {}),
        ...(params.gamerTag !== undefined ? { gamerTag: params.gamerTag.trim() } : {}),
        ...(params.mainCharacter !== undefined ? { mainCharacter: params.mainCharacter.trim() } : {}),
        ...(params.country !== undefined ? { country: params.country.trim().toUpperCase() } : {}),
        ...(params.city !== undefined ? { city: params.city.trim() } : {}),
        ...(params.phone !== undefined ? { phone: params.phone.trim() } : {}),
        ...(params.whatsapp !== undefined ? { whatsapp: params.whatsapp.trim() } : {}),
        ...(params.discordHandle !== undefined ? { discordHandle: params.discordHandle.trim() } : {}),
        ...(params.twitchHandle !== undefined ? { twitchHandle: params.twitchHandle.trim() } : {}),
        ...(params.profileCompleted !== undefined ? { profileCompleted: params.profileCompleted } : {}),
        ...(params.teamName !== undefined ? { teamName: params.teamName.trim() } : {}),
      })
      .where(eq(users.uid, params.uid))
      .returning();
    return updated[0] || null;
  } catch (error) {
    console.error('Database query failed in updateUserProfileInDb:', error);
    throw new Error('Failed to update user profile in PostgreSQL.', { cause: error });
  }
}

export async function getUserGameAccounts(userUid: string) {
  try {
    return await db
      .select()
      .from(gameAccounts)
      .where(eq(gameAccounts.userUid, userUid))
      .orderBy(desc(gameAccounts.isPrimary), desc(gameAccounts.createdAt));
  } catch (error) {
    console.error('Database query failed in getUserGameAccounts:', error);
    return [];
  }
}

export async function getAllGameAccounts() {
  try {
    return await db
      .select()
      .from(gameAccounts)
      .orderBy(desc(gameAccounts.isPrimary), desc(gameAccounts.createdAt));
  } catch (error) {
    console.error('Database query failed in getAllGameAccounts:', error);
    return [];
  }
}

export async function upsertUserGameAccount(params: {
  userUid: string;
  gameSlug: string;
  platform: PlatformType;
  inGameId: string;
  isPrimary?: boolean;
}) {
  try {
    const cleanId = params.inGameId.trim();
    if (!cleanId) return null;

    if (params.isPrimary) {
      await db
        .update(gameAccounts)
        .set({ isPrimary: false })
        .where(
          and(
            eq(gameAccounts.userUid, params.userUid),
            eq(gameAccounts.gameSlug, params.gameSlug)
          )
        );
    }

    const existing = await db
      .select()
      .from(gameAccounts)
      .where(
        and(
          eq(gameAccounts.userUid, params.userUid),
          eq(gameAccounts.gameSlug, params.gameSlug),
          eq(gameAccounts.platform, params.platform)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const updated = await db
        .update(gameAccounts)
        .set({
          inGameId: cleanId,
          ...(params.isPrimary !== undefined ? { isPrimary: params.isPrimary } : {}),
        })
        .where(eq(gameAccounts.id, existing[0].id))
        .returning();
      return updated[0];
    }

    const inserted = await db
      .insert(gameAccounts)
      .values({
        userUid: params.userUid,
        gameSlug: params.gameSlug,
        platform: params.platform,
        inGameId: cleanId,
        isPrimary: Boolean(params.isPrimary),
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in upsertUserGameAccount:', error);
    throw new Error('Failed to save multi-platform game account.', { cause: error });
  }
}

export async function deleteUserGameAccount(id: number, userUid: string) {
  try {
    await db
      .delete(gameAccounts)
      .where(and(eq(gameAccounts.id, id), eq(gameAccounts.userUid, userUid)));
  } catch (error) {
    console.error('Database query failed in deleteUserGameAccount:', error);
    throw new Error('Failed to delete game account.', { cause: error });
  }
}

export async function getUserGamePrefs(userUid: string) {
  try {
    return await db
      .select()
      .from(userGamePrefs)
      .where(eq(userGamePrefs.userUid, userUid));
  } catch (error) {
    console.error('Database query failed in getUserGamePrefs:', error);
    return [];
  }
}

export async function getAllUserGamePrefs() {
  try {
    return await db.select().from(userGamePrefs);
  } catch (error) {
    console.error('Database query failed in getAllUserGamePrefs:', error);
    return [];
  }
}

export async function upsertUserGamePref(params: {
  userUid: string;
  gameSlug: string;
  mainCharacterId: string;
  secondaryCharId?: string | null;
}) {
  try {
    const existing = await db
      .select()
      .from(userGamePrefs)
      .where(
        and(
          eq(userGamePrefs.userUid, params.userUid),
          eq(userGamePrefs.gameSlug, params.gameSlug)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const updated = await db
        .update(userGamePrefs)
        .set({
          mainCharacterId: params.mainCharacterId,
          ...(params.secondaryCharId !== undefined
            ? { secondaryCharId: params.secondaryCharId }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(userGamePrefs.id, existing[0].id))
        .returning();
      return updated[0];
    }

    const inserted = await db
      .insert(userGamePrefs)
      .values({
        userUid: params.userUid,
        gameSlug: params.gameSlug,
        mainCharacterId: params.mainCharacterId,
        secondaryCharId: params.secondaryCharId || null,
        updatedAt: new Date(),
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in upsertUserGamePref:', error);
    throw new Error('Failed to save game character preference.', { cause: error });
  }
}

export async function getTournamentRoles(tournamentSlug: string) {
  try {
    return await db
      .select()
      .from(tournamentRoles)
      .where(eq(tournamentRoles.tournamentSlug, tournamentSlug))
      .orderBy(desc(tournamentRoles.createdAt));
  } catch (error) {
    console.error('Database query failed in getTournamentRoles:', error);
    throw new Error('Failed to fetch tournament role assignments.', { cause: error });
  }
}

export async function assignTournamentStaffRole(params: {
  tournamentSlug: string;
  userUid: string;
  userEmail: string;
  userDisplayName: string;
  role: UserRole;
  assignedStation?: string;
  assignedByUid: string;
}) {
  try {
    // Remove previous assignment for same user & tournament to keep unique per tournament
    await db
      .delete(tournamentRoles)
      .where(
        and(
          eq(tournamentRoles.tournamentSlug, params.tournamentSlug),
          eq(tournamentRoles.userUid, params.userUid)
        )
      );

    const inserted = await db
      .insert(tournamentRoles)
      .values({
        tournamentSlug: params.tournamentSlug,
        userUid: params.userUid,
        userEmail: params.userEmail,
        userDisplayName: params.userDisplayName,
        role: params.role,
        assignedStation: params.assignedStation || 'All Stations',
        assignedByUid: params.assignedByUid,
      })
      .returning();

    return inserted[0];
  } catch (error) {
    console.error('Database query failed in assignTournamentStaffRole:', error);
    throw new Error('Failed to assign tournament staff role.', { cause: error });
  }
}

export async function removeTournamentStaffRole(id: number) {
  try {
    await db.delete(tournamentRoles).where(eq(tournamentRoles.id, id));
  } catch (error) {
    console.error('Database query failed in removeTournamentStaffRole:', error);
    throw new Error('Failed to remove tournament staff role.', { cause: error });
  }
}

export async function recordAuditLog(params: {
  userUid: string;
  userEmail: string;
  userRole: string;
  action: string;
  tournamentSlug?: string;
  targetId?: string;
  details: string;
}) {
  try {
    const inserted = await db
      .insert(auditLogs)
      .values({
        userUid: params.userUid,
        userEmail: params.userEmail,
        userRole: params.userRole,
        action: params.action,
        tournamentSlug: params.tournamentSlug || null,
        targetId: params.targetId || null,
        details: params.details,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in recordAuditLog:', error);
    throw new Error('Failed to record audit log.', { cause: error });
  }
}

export async function getRecentAuditLogs(limitCount = 50) {
  try {
    return await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limitCount);
  } catch (error) {
    console.error('Database query failed in getRecentAuditLogs:', error);
    throw new Error('Failed to fetch audit logs.', { cause: error });
  }
}

export async function getTournamentPayments(tournamentSlug: string) {
  try {
    return await db
      .select()
      .from(tournamentPayments)
      .where(eq(tournamentPayments.tournamentSlug, tournamentSlug))
      .orderBy(desc(tournamentPayments.createdAt));
  } catch (error) {
    console.error('Database query failed in getTournamentPayments:', error);
    throw new Error('Failed to fetch tournament payments.', { cause: error });
  }
}

export async function createOrUpdatePayment(params: {
  tournamentSlug: string;
  entrantId: string;
  entrantTag: string;
  userUid?: string;
  paymentType: 'ENTRY_FEE' | 'PRIZE_PAYOUT';
  amountUsd: number;
  method: 'QR_INSTANT' | 'STRIPE_PIX' | 'CASH_DESK' | 'BANK_WIRE';
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'PAID_OUT';
  verifiedByUid?: string;
}) {
  try {
    const qrReferenceCode = `NIK-QR-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const inserted = await db
      .insert(tournamentPayments)
      .values({
        tournamentSlug: params.tournamentSlug,
        entrantId: params.entrantId,
        entrantTag: params.entrantTag,
        userUid: params.userUid || null,
        paymentType: params.paymentType,
        amountUsd: params.amountUsd,
        method: params.method,
        qrReferenceCode,
        status: params.status,
        verifiedByUid: params.verifiedByUid || null,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed in createOrUpdatePayment:', error);
    throw new Error('Failed to save payment record.', { cause: error });
  }
}

export async function updatePaymentStatusById(params: {
  paymentId: number;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'PAID_OUT';
  verifiedByUid: string;
}) {
  try {
    const updated = await db
      .update(tournamentPayments)
      .set({
        status: params.status,
        verifiedByUid: params.verifiedByUid,
      })
      .where(eq(tournamentPayments.id, params.paymentId))
      .returning();
    return updated[0] || null;
  } catch (error) {
    console.error('Database query failed in updatePaymentStatusById:', error);
    throw new Error('Failed to update payment status.', { cause: error });
  }
}

export async function syncObfTournamentToPostgres(obfDoc: OBFDocument, createdByUid = 'system') {
  try {
    const slug = obfDoc.event.tournamentSlug;
    const snapshotStr = JSON.stringify(obfDoc);

    await db
      .insert(tournaments)
      .values({
        slug,
        organizationSlug: obfDoc.event.organizationSlug || 'nikbrackets-pro',
        name: obfDoc.event.name,
        gameName: obfDoc.event.gameName,
        gameSlug: obfDoc.event.gameSlug,
        format: obfDoc.event.format,
        date: obfDoc.event.date,
        venueFee: obfDoc.event.venueFee,
        entryFee: obfDoc.event.entryFee,
        prizePool: obfDoc.event.prizePool,
        registrationOpen: true,
        createdByUid,
        obfSnapshotJson: snapshotStr,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: tournaments.slug,
        set: {
          name: obfDoc.event.name,
          gameName: obfDoc.event.gameName,
          gameSlug: obfDoc.event.gameSlug,
          format: obfDoc.event.format,
          prizePool: obfDoc.event.prizePool,
          obfSnapshotJson: snapshotStr,
          updatedAt: new Date(),
        },
      });

    // Synchronize relational entrants for this tournament
    await db
      .delete(tournamentEntrants)
      .where(eq(tournamentEntrants.tournamentSlug, slug));

    if (obfDoc.entrants.length > 0) {
      await db.insert(tournamentEntrants).values(
        obfDoc.entrants.map((e) => ({
          tournamentSlug: slug,
          entrantId: e.entrantID,
          userUid: null,
          entrantTag: e.entrantTag,
          initialSeed: e.initialSeed,
          eloRating: e.eloRating,
          gameAccountId: e.gameAccountId ?? null,
          platform: e.platform || 'PS5',
          inGameId: e.inGameId || null,
          mainCharacter: e.mainCharacter || 'Reina',
          secondaryCharacter: e.secondaryCharacter || null,
          country: e.country || 'US',
          teamName: e.teamName || 'Free Agent',
          checkedIn: Boolean(e.checkedIn),
          paymentStatus: e.checkedIn ? 'PAID' : 'PENDING',
        }))
      );
    }

    // Synchronize relational sets for this tournament
    await db
      .delete(tournamentSets)
      .where(eq(tournamentSets.tournamentSlug, slug));

    if (obfDoc.sets.length > 0) {
      await db.insert(tournamentSets).values(
        obfDoc.sets.map((s) => ({
          tournamentSlug: slug,
          setId: s.setID,
          phase: s.phase,
          round: s.round,
          roundLabel: s.roundLabel,
          entrant1Id: s.entrant1ID,
          entrant2Id: s.entrant2ID,
          entrant1Score: s.entrant1Score,
          entrant2Score: s.entrant2Score,
          winnerId: s.winnerID,
          status: s.status,
          station: s.other?.station || null,
          disputeReason: s.other?.disputeReason || null,
          proofImageUrl: s.other?.proofImageUrl || null,
          updatedAt: new Date(),
        }))
      );
    }
  } catch (error) {
    console.error('Database query failed in syncObfTournamentToPostgres:', error);
    throw new Error('Failed to synchronize tournament OBF to PostgreSQL.', {
      cause: error,
    });
  }
}

export async function loadTournamentsFromPostgres(): Promise<Record<string, OBFDocument>> {
  try {
    const rows = await db.select().from(tournaments);
    const map: Record<string, OBFDocument> = {};
    for (const row of rows) {
      try {
        map[row.slug] = JSON.parse(row.obfSnapshotJson) as OBFDocument;
      } catch {
        // Ignore malformed snapshot
      }
    }
    return map;
  } catch (error) {
    console.error('Database query failed in loadTournamentsFromPostgres:', error);
    throw new Error('Failed to load tournaments from PostgreSQL.', { cause: error });
  }
}

export async function getAllTournamentRoleAssignments() {
  try {
    return await db
      .select()
      .from(tournamentRoles)
      .orderBy(desc(tournamentRoles.createdAt));
  } catch (error) {
    console.error('Database query failed in getAllTournamentRoleAssignments:', error);
    throw new Error('Failed to fetch all tournament role assignments.', { cause: error });
  }
}

export async function getTournamentCreatorsMap(): Promise<Record<string, string>> {
  try {
    const rows = await db.select().from(tournaments);
    const map: Record<string, string> = {};
    for (const r of rows) {
      if (r.createdByUid) {
        map[r.slug] = r.createdByUid;
      }
    }
    return map;
  } catch (error) {
    console.error('Database query failed in getTournamentCreatorsMap:', error);
    return {};
  }
}

export async function seedInitialPostgresDataIfEmpty(defaultTournaments: Record<string, OBFDocument>) {
  try {
    const existingUsers = await db.select().from(users).limit(1);
    if (existingUsers.length === 0) {
      const seedStaff: Array<{
        uid: string;
        email: string;
        displayName: string;
        gamerTag: string;
        role: UserRole;
        elo: number;
        character: string;
        country: string;
        team: string;
        provider: 'google' | 'email';
      }> = [
        {
          uid: 'usr_owner_niklauss',
          email: 'niklaussmauricio@gmail.com',
          displayName: 'Niklauss Mauricio (Founder)',
          gamerTag: 'Niklauss#KR1',
          role: 'SUPER_ADMIN',
          elo: 2250,
          character: 'Reina',
          country: 'PE',
          team: 'nikBrackets Pro HQ',
          provider: 'google',
        },
        {
          uid: 'usr_to_director',
          email: 'director@nikbrackets.pro',
          displayName: 'Carlos Mendoza (Head TO)',
          gamerTag: 'MendozaTO#MX',
          role: 'TOURNAMENT_DIRECTOR',
          elo: 2010,
          character: 'Kazuya Mishima',
          country: 'MX',
          team: 'Nexus Grid Ops',
          provider: 'email',
        },
        {
          uid: 'usr_ref_station1',
          email: 'referee01@nikbrackets.pro',
          displayName: 'Akira Sato (Marshal S01)',
          gamerTag: 'JudgeSato#JP',
          role: 'REFEREE',
          elo: 1920,
          character: 'Jin Kazama',
          country: 'JP',
          team: 'FGC Officials',
          provider: 'email',
        },
        {
          uid: 'usr_streamer_main',
          email: 'broadcast@nikbrackets.pro',
          displayName: 'Elena Vance (Broadcast Producer)',
          gamerTag: 'VanceLive#US',
          role: 'STREAMER',
          elo: 1840,
          character: 'Azucena',
          country: 'US',
          team: 'Nexus Broadcast',
          provider: 'email',
        },
        {
          uid: 'usr_treasury_pay',
          email: 'treasury@nikbrackets.pro',
          displayName: 'Mateo Silva (Prize & QR Auditor)',
          gamerTag: 'SilvaPay#BR',
          role: 'PAY_EDITOR',
          elo: 1790,
          character: 'King',
          country: 'BR',
          team: 'Finance Ops',
          provider: 'email',
        },
        {
          uid: 'usr_player_arslan',
          email: 'arslan.ash@twistedminds.gg',
          displayName: 'Arslan Siddique',
          gamerTag: 'ArslanAsh#PK',
          role: 'PLAYER',
          elo: 2180,
          character: 'Nina Williams',
          country: 'PK',
          team: 'Twisted Minds',
          provider: 'google',
        },
      ];

      for (const s of seedStaff) {
        await db
          .insert(users)
          .values({
            uid: s.uid,
            email: s.email,
            displayName: s.displayName,
            gamerTag: s.gamerTag,
            authProvider: s.provider,
            passwordHash: hashPassword('NikBrackets2026!'),
            globalRole: s.uid === 'usr_owner_niklauss' ? 'SUPER_ADMIN' : 'USER',
            eloRating: s.elo,
            mainCharacter: s.character,
            country: s.country,
            teamName: s.team,
            accountStatus: 'ACTIVE',
          })
          .onConflictDoNothing();
      }

      await db
        .insert(organizations)
        .values({
          slug: 'nikbrackets-pro',
          name: 'nikBrackets Pro Global Esports Circuit',
          description: 'Organización oficial OBF v1.0 con motor DAG O(1) y PostgreSQL Cloud SQL',
          ownerUid: 'usr_owner_niklauss',
          region: 'Global / LATAM',
          verified: true,
        })
        .onConflictDoNothing();

      await db.insert(tournamentRoles).values([
        // Torneo 1: nexus-tekken8-masters -> Niklauss es Admin/Creador, Sato es Reporteador, Arslan es Participante
        {
          tournamentSlug: 'nexus-tekken8-masters',
          userUid: 'usr_owner_niklauss',
          userEmail: 'niklaussmauricio@gmail.com',
          userDisplayName: 'Niklauss Mauricio (Founder)',
          role: 'TOURNAMENT_DIRECTOR',
          assignedStation: 'Creador & Control General',
          assignedByUid: 'usr_owner_niklauss',
        },
        {
          tournamentSlug: 'nexus-tekken8-masters',
          userUid: 'usr_to_director',
          userEmail: 'director@nikbrackets.pro',
          userDisplayName: 'Carlos Mendoza (Head TO)',
          role: 'TOURNAMENT_DIRECTOR',
          assignedStation: 'Bracket Control Desk',
          assignedByUid: 'usr_owner_niklauss',
        },
        {
          tournamentSlug: 'nexus-tekken8-masters',
          userUid: 'usr_ref_station1',
          userEmail: 'referee01@nikbrackets.pro',
          userDisplayName: 'Akira Sato (Marshal S01)',
          role: 'REFEREE',
          assignedStation: 'Station 01 - Stage Alpha',
          assignedByUid: 'usr_to_director',
        },
        {
          tournamentSlug: 'nexus-tekken8-masters',
          userUid: 'usr_streamer_main',
          userEmail: 'broadcast@nikbrackets.pro',
          userDisplayName: 'Elena Vance (Broadcast Producer)',
          role: 'STREAMER',
          assignedStation: 'Main Stream A (Twitch/YouTube)',
          assignedByUid: 'usr_to_director',
        },
        {
          tournamentSlug: 'nexus-tekken8-masters',
          userUid: 'usr_treasury_pay',
          userEmail: 'treasury@nikbrackets.pro',
          userDisplayName: 'Mateo Silva (Prize & QR Auditor)',
          role: 'PAY_EDITOR',
          assignedStation: 'Treasury & QR Check-in Desk',
          assignedByUid: 'usr_owner_niklauss',
        },
        // Torneo 2: capcom-pro-sf6-latam -> Mendoza es Admin/Creador, Niklauss y Arslan son Reporteadores (REFEREE)
        {
          tournamentSlug: 'capcom-pro-sf6-latam',
          userUid: 'usr_to_director',
          userEmail: 'director@nikbrackets.pro',
          userDisplayName: 'Carlos Mendoza (Head TO)',
          role: 'TOURNAMENT_DIRECTOR',
          assignedStation: 'Creador & Director SF6',
          assignedByUid: 'usr_to_director',
        },
        {
          tournamentSlug: 'capcom-pro-sf6-latam',
          userUid: 'usr_owner_niklauss',
          userEmail: 'niklaussmauricio@gmail.com',
          userDisplayName: 'Niklauss Mauricio (Founder)',
          role: 'REFEREE',
          assignedStation: 'Station 01 - Main Stage SF6',
          assignedByUid: 'usr_to_director',
        },
        {
          tournamentSlug: 'capcom-pro-sf6-latam',
          userUid: 'usr_player_arslan',
          userEmail: 'arslan.ash@twistedminds.gg',
          userDisplayName: 'Arslan Siddique',
          role: 'REFEREE',
          assignedStation: 'Station 02 - Pool B Referee',
          assignedByUid: 'usr_to_director',
        },
        // Torneo 3: evo-ggst-champions -> Arslan es Admin/Creador, Sato es Reporteador, Niklauss es solo Participante (PLAYER)
        {
          tournamentSlug: 'evo-ggst-champions',
          userUid: 'usr_player_arslan',
          userEmail: 'arslan.ash@twistedminds.gg',
          userDisplayName: 'Arslan Siddique',
          role: 'TOURNAMENT_DIRECTOR',
          assignedStation: 'Creador & Organizador GGST',
          assignedByUid: 'usr_player_arslan',
        },
        {
          tournamentSlug: 'evo-ggst-champions',
          userUid: 'usr_ref_station1',
          userEmail: 'referee01@nikbrackets.pro',
          userDisplayName: 'Akira Sato (Marshal S01)',
          role: 'REFEREE',
          assignedStation: 'Station 01 - GGST Arena',
          assignedByUid: 'usr_player_arslan',
        },
      ]);

      await db.insert(tournamentPayments).values([
        {
          tournamentSlug: 'nexus-tekken8-masters',
          entrantId: 'P2',
          entrantTag: 'ArslanAsh#PK',
          userUid: 'usr_player_arslan',
          paymentType: 'ENTRY_FEE',
          amountUsd: 50,
          method: 'QR_INSTANT',
          qrReferenceCode: 'NIK-QR-88F2A1',
          status: 'VERIFIED',
          verifiedByUid: 'usr_treasury_pay',
        },
        {
          tournamentSlug: 'nexus-tekken8-masters',
          entrantId: 'P3',
          entrantTag: 'Knee#KR',
          userUid: null,
          paymentType: 'ENTRY_FEE',
          amountUsd: 50,
          method: 'STRIPE_PIX',
          qrReferenceCode: 'NIK-QR-91C4B2',
          status: 'VERIFIED',
          verifiedByUid: 'usr_treasury_pay',
        },
        {
          tournamentSlug: 'nexus-tekken8-masters',
          entrantId: 'P19',
          entrantTag: 'Sephiblack#DE',
          userUid: null,
          paymentType: 'ENTRY_FEE',
          amountUsd: 50,
          method: 'QR_INSTANT',
          qrReferenceCode: 'NIK-QR-44D9E0',
          status: 'PENDING',
          verifiedByUid: null,
        },
        {
          tournamentSlug: 'nexus-tekken8-masters',
          entrantId: 'P2',
          entrantTag: 'ArslanAsh#PK',
          userUid: 'usr_player_arslan',
          paymentType: 'PRIZE_PAYOUT',
          amountUsd: 25000,
          method: 'BANK_WIRE',
          qrReferenceCode: 'NIK-PRIZE-TOP1',
          status: 'PENDING',
          verifiedByUid: null,
        },
      ]);

      await db.insert(auditLogs).values([
        {
          userUid: 'usr_owner_niklauss',
          userEmail: 'niklaussmauricio@gmail.com',
          userRole: 'SUPER_ADMIN',
          action: 'POSTGRES_CLOUDSQL_INITIALIZED',
          tournamentSlug: 'nexus-tekken8-masters',
          targetId: 'schema-v2',
          details: 'Esquema relacional PostgreSQL inicializado con roles dinámicos por torneo.',
        },
        {
          userUid: 'usr_to_director',
          userEmail: 'director@nikbrackets.pro',
          userRole: 'TOURNAMENT_DIRECTOR',
          action: 'STAFF_ROLES_ASSIGNED',
          tournamentSlug: 'nexus-tekken8-masters',
          targetId: 'Station 01',
          details: 'Asignados roles de Árbitro (Station 01), Streamer (Main Stream A) y Tesorero QR.',
        },
      ]);
    } else {
      // Ensure cross-tournament roles exist even if DB was seeded in previous turn
      const sf6Roles = await db
        .select()
        .from(tournamentRoles)
        .where(eq(tournamentRoles.tournamentSlug, 'capcom-pro-sf6-latam'))
        .limit(1);

      if (sf6Roles.length === 0) {
        await db.insert(tournamentRoles).values([
          {
            tournamentSlug: 'capcom-pro-sf6-latam',
            userUid: 'usr_to_director',
            userEmail: 'director@nikbrackets.pro',
            userDisplayName: 'Carlos Mendoza (Head TO)',
            role: 'TOURNAMENT_DIRECTOR',
            assignedStation: 'Creador & Director SF6',
            assignedByUid: 'usr_to_director',
          },
          {
            tournamentSlug: 'capcom-pro-sf6-latam',
            userUid: 'usr_owner_niklauss',
            userEmail: 'niklaussmauricio@gmail.com',
            userDisplayName: 'Niklauss Mauricio (Founder)',
            role: 'REFEREE',
            assignedStation: 'Station 01 - Main Stage SF6',
            assignedByUid: 'usr_to_director',
          },
          {
            tournamentSlug: 'capcom-pro-sf6-latam',
            userUid: 'usr_player_arslan',
            userEmail: 'arslan.ash@twistedminds.gg',
            userDisplayName: 'Arslan Siddique',
            role: 'REFEREE',
            assignedStation: 'Station 02 - Pool B Referee',
            assignedByUid: 'usr_to_director',
          },
          {
            tournamentSlug: 'evo-ggst-champions',
            userUid: 'usr_player_arslan',
            userEmail: 'arslan.ash@twistedminds.gg',
            userDisplayName: 'Arslan Siddique',
            role: 'TOURNAMENT_DIRECTOR',
            assignedStation: 'Creador & Organizador GGST',
            assignedByUid: 'usr_player_arslan',
          },
          {
            tournamentSlug: 'evo-ggst-champions',
            userUid: 'usr_ref_station1',
            userEmail: 'referee01@nikbrackets.pro',
            userDisplayName: 'Akira Sato (Marshal S01)',
            role: 'REFEREE',
            assignedStation: 'Station 01 - GGST Arena',
            assignedByUid: 'usr_player_arslan',
          },
        ]);
      }

      // Ensure Niklauss gamerTag matches Niklauss#KR1 and non-owner users use standard Global Role 'USER'
      await db
        .update(users)
        .set({ gamerTag: 'Niklauss#KR1', globalRole: 'SUPER_ADMIN' })
        .where(eq(users.email, 'niklaussmauricio@gmail.com'));

      for (const baseEmail of [
        'director@nikbrackets.pro',
        'referee01@nikbrackets.pro',
        'broadcast@nikbrackets.pro',
        'treasury@nikbrackets.pro',
        'arslan.ash@twistedminds.gg',
      ]) {
        await db
          .update(users)
          .set({ globalRole: 'USER' })
          .where(eq(users.email, baseEmail));
      }

      // Ensure EventParticipant contextual records exist for Arslan in Tekken 8 and Niklauss in GGST
      const existingTekkenArslan = await db
        .select()
        .from(tournamentRoles)
        .where(
          and(
            eq(tournamentRoles.tournamentSlug, 'nexus-tekken8-masters'),
            eq(tournamentRoles.userUid, 'usr_player_arslan')
          )
        )
        .limit(1);
      if (existingTekkenArslan.length === 0) {
        await db.insert(tournamentRoles).values({
          tournamentSlug: 'nexus-tekken8-masters',
          userUid: 'usr_player_arslan',
          userEmail: 'arslan.ash@twistedminds.gg',
          userDisplayName: 'Arslan Siddique',
          role: 'PLAYER',
          assignedStation: 'EventParticipant (Seed #1 · P2)',
          assignedByUid: 'usr_to_director',
        });
      }

      const existingGgstNiklauss = await db
        .select()
        .from(tournamentRoles)
        .where(
          and(
            eq(tournamentRoles.tournamentSlug, 'evo-ggst-champions'),
            eq(tournamentRoles.userUid, 'usr_owner_niklauss')
          )
        )
        .limit(1);
      if (existingGgstNiklauss.length === 0) {
        await db.insert(tournamentRoles).values({
          tournamentSlug: 'evo-ggst-champions',
          userUid: 'usr_owner_niklauss',
          userEmail: 'niklaussmauricio@gmail.com',
          userDisplayName: 'Niklauss Mauricio (Founder)',
          role: 'PLAYER',
          assignedStation: 'EventParticipant (Seed #5 · GG5)',
          assignedByUid: 'usr_player_arslan',
        });
      }
    }

    // Seed multi-platform GameAccounts (PS5, PC_STEAM, XBOX_SERIES) and UserGamePrefs if empty
    const existingGameAccounts = await db.select().from(gameAccounts).limit(1);
    if (existingGameAccounts.length === 0) {
      await db
        .update(users)
        .set({
          whatsapp: '+51 987 654 321',
          phone: '+51 987 654 321',
          city: 'Lima',
          country: 'PE',
          discordHandle: '@niklauss#0001',
          twitchHandle: 'twitch.tv/niklauss_fgc',
          profileCompleted: true,
        })
        .where(eq(users.uid, 'usr_owner_niklauss'));

      await db
        .update(users)
        .set({
          whatsapp: '+92 300 441 9920',
          phone: '+92 300 441 9920',
          city: 'Lahore',
          country: 'PK',
          discordHandle: '@arslanash#1995',
          twitchHandle: 'twitch.tv/arslanash95',
          profileCompleted: true,
        })
        .where(eq(users.uid, 'usr_player_arslan'));

      await db.insert(gameAccounts).values([
        // Niklauss#KR1 tiene cuenta de Tekken 8 en PS5 ("349Q-tay4-YYH8") y también en PC_STEAM ("2jdr-i7LF-23HT")
        {
          userUid: 'usr_owner_niklauss',
          gameSlug: 'tekken8',
          platform: 'PS5',
          inGameId: '349Q-tay4-YYH8',
          isPrimary: true,
        },
        {
          userUid: 'usr_owner_niklauss',
          gameSlug: 'tekken8',
          platform: 'PC_STEAM',
          inGameId: '2jdr-i7LF-23HT',
          isPrimary: false,
        },
        {
          userUid: 'usr_owner_niklauss',
          gameSlug: 'sf6',
          platform: 'PC_STEAM',
          inGameId: 'CFN-44901288',
          isPrimary: true,
        },
        // ArslanAsh#PK tiene IDs separados en PS5 y PC_STEAM
        {
          userUid: 'usr_player_arslan',
          gameSlug: 'tekken8',
          platform: 'PS5',
          inGameId: '77PK-ash9-TWST',
          isPrimary: true,
        },
        {
          userUid: 'usr_player_arslan',
          gameSlug: 'tekken8',
          platform: 'PC_STEAM',
          inGameId: '99PK-ash9-STEA',
          isPrimary: false,
        },
        {
          userUid: 'usr_player_arslan',
          gameSlug: 'sf6',
          platform: 'PS5',
          inGameId: 'CFN-77889900',
          isPrimary: true,
        },
      ]);

      await db.insert(userGamePrefs).values([
        {
          userUid: 'usr_owner_niklauss',
          gameSlug: 'tekken8',
          mainCharacterId: 'Dragunov',
          secondaryCharId: 'Reina',
        },
        {
          userUid: 'usr_owner_niklauss',
          gameSlug: 'sf6',
          mainCharacterId: 'Akuma',
          secondaryCharId: 'Ken Masters',
        },
        {
          userUid: 'usr_player_arslan',
          gameSlug: 'tekken8',
          mainCharacterId: 'Nina',
          secondaryCharId: 'Zafina',
        },
        {
          userUid: 'usr_player_arslan',
          gameSlug: 'sf6',
          mainCharacterId: 'Cammy',
          secondaryCharId: 'Luke',
        },
      ]);
    }

    const existingTournaments = await db.select().from(tournaments).limit(1);
    if (existingTournaments.length === 0) {
      for (const [slug, doc] of Object.entries(defaultTournaments)) {
        const creator =
          slug === 'capcom-pro-sf6-latam'
            ? 'usr_to_director'
            : slug === 'evo-ggst-champions'
            ? 'usr_player_arslan'
            : 'usr_owner_niklauss';
        await syncObfTournamentToPostgres(doc, creator);
      }
    }
  } catch (error) {
    console.error('Warning during seedInitialPostgresDataIfEmpty:', error);
  }
}

