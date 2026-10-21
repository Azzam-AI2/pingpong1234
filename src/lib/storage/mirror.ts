import type { Snapshot, TableName } from '../types'
import { EMPTY_SNAPSHOT } from '../types'

export interface Op {
  table: TableName
  type: 'insert' | 'update' | 'delete'
  row?: object
  id?: string
  patch?: object
}

/** Terapkan daftar operasi ke salinan snapshot (dipakai untuk cermin state di UI). */
export function terapkanKeSnapshot(snapshot: Snapshot, ops: Op[]): Snapshot {
  const next = JSON.parse(JSON.stringify(snapshot)) as Snapshot
  for (const op of ops) {
    const arr = next[op.table] as unknown as Array<Record<string, unknown>>
    if (op.type === 'insert' && op.row) {
      arr.push({ ...op.row })
    } else if (op.type === 'update' && op.id) {
      const idx = arr.findIndex((r) => r.id === op.id)
      if (idx < 0) continue
      arr[idx] = { ...arr[idx], ...(op.patch ?? {}) }
    } else if (op.type === 'delete' && op.id) {
      const idx = arr.findIndex((r) => r.id === op.id)
      if (idx >= 0) arr.splice(idx, 1)
    }
  }
  return pangkasYatim(next)
}

/** Buang baris yang induknya sudah hilang (padanan on delete cascade). */
export function pangkasYatim(s: Snapshot): Snapshot {
  const clubIds = new Set(s.clubs.map((c) => c.id))
  const turnamenIds = new Set(s.tournaments.map((t) => t.id))
  const rondeIds = new Set(s.americano_rounds.map((r) => r.id))
  return {
    clubs: s.clubs,
    members: s.members.filter((m) => clubIds.has(m.club_id)),
    tournaments: s.tournaments.filter((t) => clubIds.has(t.club_id)),
    participants: s.participants.filter((p) => turnamenIds.has(p.tournament_id)),
    knockout_matches: s.knockout_matches.filter((m) => turnamenIds.has(m.tournament_id)),
    americano_rounds: s.americano_rounds.filter((r) => turnamenIds.has(r.tournament_id)),
    americano_matches: s.americano_matches.filter(
      (m) => turnamenIds.has(m.tournament_id) && rondeIds.has(m.round_id),
    ),
    league_rounds: s.league_rounds.filter((r) => turnamenIds.has(r.tournament_id)),
    league_matches: s.league_matches.filter(
      (m) => turnamenIds.has(m.tournament_id) && rondeIds.has(m.round_id),
    ),
  }
}

export function snapshotKosong(): Snapshot {
  return JSON.parse(JSON.stringify(EMPTY_SNAPSHOT)) as Snapshot
}
