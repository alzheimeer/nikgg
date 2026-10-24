/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Utilidades de Exportación de Reportes Oficiales (CSV, OBF JSON y Reporte PDF Vectorial)
 */

import { OBFDocument, StandingsRow } from '../engine/nikBracketsEngine';

export function exportStandingsToCsv(obf: OBFDocument, standings: StandingsRow[]): void {
  const headers = [
    'Rank',
    'Seed',
    'Gamertag',
    'Team',
    'Country',
    'MainCharacter',
    'InitialELO',
    'ELODelta',
    'MatchesPlayed',
    'Wins',
    'Losses',
    'WinRatePct',
    'GamesWon',
    'GamesLost',
    'GameDiff',
    'BuchholzScore',
    'Min3TargetMet',
  ];

  const rows = standings.map((r) => [
    r.rank,
    r.entrant.initialSeed,
    `"${r.entrant.entrantTag.replace(/"/g, '""')}"`,
    `"${(r.entrant.teamName || 'Free Agent').replace(/"/g, '""')}"`,
    r.entrant.country || 'CO',
    `"${(r.entrant.mainCharacter || 'N/A').replace(/"/g, '""')}"`,
    r.entrant.eloRating,
    r.eloDelta >= 0 ? `+${r.eloDelta}` : String(r.eloDelta),
    r.matchesPlayed,
    r.wins,
    r.losses,
    `${r.winRatePct}%`,
    r.gamesWon,
    r.gamesLost,
    r.gameDifferential,
    r.buchholzScore,
    r.guaranteedTargetMet ? 'YES' : 'NO',
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${obf.event.tournamentSlug}-standings-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportObfJsonFile(obf: OBFDocument): void {
  const jsonContent = JSON.stringify(obf, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${obf.event.tournamentSlug}-obf-v1.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Genera y descarga un archivo PDF real (estructura nativa %PDF-1.4 con tablas de posiciones,
 * metadatos del torneo OBF v1.0 y resumen de sets completados) para que funcione directamente
 * en cualquier navegador o visor PDF sin depender de popups bloqueados.
 */
export function exportTournamentPdfReport(obf: OBFDocument, standings: StandingsRow[]): void {
  const lines: string[] = [
    `REPORTE OFICIAL DE TORNEO - NIKBRACKETS PRO (OBF v1.0)`,
    `====================================================================`,
    `Torneo: ${obf.event.name}`,
    `Juego: ${obf.event.gameName}  |  Formato: ${obf.event.format.toUpperCase()}`,
    `Fecha: ${obf.event.date}  |  Bolsa de Premios: USD $${obf.event.prizePool.toLocaleString()}`,
    `Participantes: ${obf.entrants.length}  |  Sets Totales: ${obf.sets.length}`,
    `--------------------------------------------------------------------`,
    `TABLA DE POSICIONES (BUCHHOLZ & DIFERENCIAL ELO)`,
    `--------------------------------------------------------------------`,
    `POS | SEED | GAMERTAG             | ELO (DELTA) | W-L | DIFF | BUCHHOLZ`,
    `--------------------------------------------------------------------`,
  ];

  standings.forEach((s) => {
    const pos = String(s.rank).padEnd(3, ' ');
    const seed = `#${s.entrant.initialSeed}`.padEnd(4, ' ');
    const tag = s.entrant.entrantTag.substring(0, 20).padEnd(20, ' ');
    const deltaStr = s.eloDelta >= 0 ? `+${s.eloDelta}` : `${s.eloDelta}`;
    const elo = `${s.entrant.eloRating} (${deltaStr})`.padEnd(11, ' ');
    const wl = `${s.wins}-${s.losses}`.padEnd(3, ' ');
    const diff = (s.gameDifferential >= 0 ? `+${s.gameDifferential}` : `${s.gameDifferential}`).padEnd(4, ' ');
    const buch = String(s.buchholzScore);
    lines.push(`${pos} | ${seed} | ${tag} | ${elo} | ${wl} | ${diff} | ${buch}`);
  });

  lines.push(`--------------------------------------------------------------------`);
  lines.push(`ULTIMOS SETS REGISTRADOS EN EL GRAFO DAG O(1):`);
  lines.push(`--------------------------------------------------------------------`);

  const entrantMap = new Map(obf.entrants.map((e) => [e.entrantID, e.entrantTag]));
  obf.sets.slice(0, 18).forEach((set) => {
    const p1 = set.entrant1ID ? entrantMap.get(set.entrant1ID) || set.entrant1ID : 'TBD';
    const p2 = set.entrant2ID ? entrantMap.get(set.entrant2ID) || set.entrant2ID : 'TBD';
    lines.push(
      `[${set.setID}] ${set.roundLabel}: ${p1} (${set.entrant1Score}) vs (${set.entrant2Score}) ${p2} - ${set.status}`
    );
  });

  // Construcción de documento PDF 1.4 válido con fuente Courier monoespaciada para alineación tabular
  const sanitizePdfText = (str: string) =>
    str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[()\\]/g, '');

  const contentLines = lines.map(
    (line, idx) => `1 0 0 1 36 ${790 - idx * 14} Tm (${sanitizePdfText(line)}) Tj`
  );

  const streamBody = `BT\n/F1 8.5 Tf\n${contentLines.join('\n')}\nET`;
  const pdfObjects = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 842] /Contents 5 0 R >>\nendobj`,
    `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj`,
    `5 0 obj\n<< /Length ${streamBody.length} >>\nstream\n${streamBody}\nendstream\nendobj`,
  ];

  let pdfString = `%PDF-1.4\n`;
  const offsets: number[] = [0];
  for (const obj of pdfObjects) {
    offsets.push(pdfString.length);
    pdfString += obj + `\n`;
  }
  const xrefStart = pdfString.length;
  pdfString += `xref\n0 ${pdfObjects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    pdfString += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdfString += `trailer\n<< /Size ${pdfObjects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const blob = new Blob([pdfString], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${obf.event.tournamentSlug}-reporte-oficial.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
