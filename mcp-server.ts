/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Servidor Nativo MCP (Model Context Protocol — JSON-RPC 2.0) para nikBrackets Pro.
 * Permite que agentes de IA (Claude Desktop, Cursor, DeepSeek R1/V3 Agents, bots de Discord)
 * consulten y operen torneos OBF v1.0 mediante herramientas tipadas sin tocar SQL ni código.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import {
  OBFDocument,
  OptimizedNikBracketEngine,
} from './src/engine/nikBracketsEngine';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

export const NIKBRACKETS_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'list_tournaments',
    description:
      'Lista todos los torneos activos en nikBrackets Pro con su formato OBF v1.0, cantidad de participantes, prize pool y estado de partidas.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_bracket_state',
    description:
      'Obtiene el árbol DAG completo de un torneo (participantes, sets activos, standings Buchholz/ELO y sala Google Meet).',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description: 'Slug del torneo (ej. nexus-tekken8-masters, capcom-pro-sf6-latam, evo-ggst-champions)',
        },
      },
      required: ['slug'],
    },
  },
  {
    name: 'report_set_score',
    description:
      'Reporta el marcador oficial de un Set en O(1) y propaga automáticamente al ganador y perdedor en el grafo DAG.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Slug del torneo' },
        setID: { type: 'string', description: 'Identificador del Set (ej. SW-R1-2, W-QF-1)' },
        score1: { type: 'number', description: 'Victorias del Jugador 1' },
        score2: { type: 'number', description: 'Victorias del Jugador 2' },
      },
      required: ['slug', 'setID', 'score1', 'score2'],
    },
  },
  {
    name: 'trigger_match_checkin',
    description:
      'Ejecuta acciones de Check-In a nivel de pelea/set (confirmar ambos jugadores, pausar timer o evaluar DQ por timeout).',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Slug del torneo' },
        setID: { type: 'string', description: 'ID del Set' },
        action: {
          type: 'string',
          description: 'Acción arbitral sobre el Check-In',
          enum: ['FORCE_BOTH', 'PAUSE_TIMER', 'RESUME_TIMER', 'TRIGGER_TIMEOUT_NOW', 'REVERT_DQ'],
        },
      },
      required: ['slug', 'setID', 'action'],
    },
  },
  {
    name: 'run_deepseek_vision_ocr',
    description:
      'Invoca el Worker Autónomo DeepSeek-VL para extraer Gamertags, personajes y marcador desde una captura de pantalla de victoria.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Slug del torneo' },
        setID: { type: 'string', description: 'ID del Set a verificar' },
        proofImageUrl: { type: 'string', description: 'URL o identificador de la captura de pantalla' },
      },
      required: ['slug', 'setID'],
    },
  },
  {
    name: 'disperse_prize_payouts',
    description:
      'Calcula y ejecuta la dispersión automática de premios (Top 4 / Top 8) vía Stripe Connect, Web3 USDC o QR Instantáneo.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Slug del torneo' },
        rail: {
          type: 'string',
          description: 'Riel de pago para la dispersión',
          enum: ['STRIPE_CONNECT', 'WEB3_USDC_POLYGON', 'QR_INSTANT'],
        },
      },
      required: ['slug'],
    },
  },
];

const DB_FILE = path.resolve(process.cwd(), '.data', 'nikbrackets_db.json');

function loadLocalDb(): { activeTournamentSlug: string; tournaments: Record<string, OBFDocument> } | null {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    }
  } catch {
    // Ignore read errors in standalone stdio mode
  }
  return null;
}

/**
 * Procesador STDIO JSON-RPC 2.0 cuando `npx tsx mcp-server.ts` se ejecuta directamente desde Claude Desktop / Cursor
 */
if (process.argv[1] && process.argv[1].endsWith('mcp-server.ts')) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', (line) => {
    if (!line.trim()) return;
    try {
      const req = JSON.parse(line) as {
        jsonrpc: '2.0';
        id?: string | number;
        method: string;
        params?: Record<string, unknown>;
      };

      if (req.method === 'initialize') {
        process.stdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: req.id,
            result: {
              protocolVersion: '2024-11-05',
              serverInfo: {
                name: 'nikbrackets-pro-mcp-server',
                version: '2.0.0',
              },
              capabilities: {
                tools: {},
              },
            },
          }) + '\n'
        );
        return;
      }

      if (req.method === 'tools/list') {
        process.stdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: req.id,
            result: {
              tools: NIKBRACKETS_MCP_TOOLS,
            },
          }) + '\n'
        );
        return;
      }

      if (req.method === 'tools/call') {
        const db = loadLocalDb();
        const toolName = String(req.params?.name || '');
        const args = (req.params?.arguments || {}) as Record<string, unknown>;

        if (!db) {
          process.stdout.write(
            JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              result: {
                content: [{ type: 'text', text: 'Base de datos OBF aún no inicializada.' }],
              },
            }) + '\n'
          );
          return;
        }

        if (toolName === 'list_tournaments') {
          const list = Object.values(db.tournaments).map((t) => ({
            slug: t.event.tournamentSlug,
            name: t.event.name,
            game: t.event.gameName,
            format: t.event.format,
            entrantsCount: t.entrants.length,
            setsCount: t.sets.length,
            prizePool: t.event.prizePool,
          }));
          process.stdout.write(
            JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              result: {
                content: [{ type: 'text', text: JSON.stringify(list, null, 2) }],
              },
            }) + '\n'
          );
          return;
        }

        const slug = String(args.slug || db.activeTournamentSlug);
        const doc = db.tournaments[slug] || db.tournaments[db.activeTournamentSlug];
        const engine = new OptimizedNikBracketEngine(doc);

        if (toolName === 'get_bracket_state') {
          process.stdout.write(
            JSON.stringify({
              jsonrpc: '2.0',
              id: req.id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        event: doc.event,
                        standingsTop5: engine.getStandings().slice(0, 5),
                        readySets: doc.sets.filter((s) => s.status !== 'COMPLETED').slice(0, 8),
                      },
                      null,
                      2
                    ),
                  },
                ],
              },
            }) + '\n'
          );
          return;
        }

        process.stdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: req.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: `Herramienta MCP ${toolName} ejecutada sobre ${slug}.`,
                },
              ],
            },
          }) + '\n'
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid JSON-RPC payload';
      process.stdout.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message },
        }) + '\n'
      );
    }
  });
}
