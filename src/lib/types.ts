// Tipe data inti Pingpong Club Manager.
// Nama field sengaja sama dengan kolom tabel Supabase (snake_case) supaya
// tidak perlu mapping saat baca/tulis dari database.

export type Gender = 'L' | 'P'
export type TournamentType = 'knockout' | 'americano' | 'liga'
export type TournamentStatus = 'draft' | 'ongoing' | 'finished'
export type KnockoutFormat = 'single' | 'double'
export type BestOf = 3 | 5
export type TargetPoints = 11 | 15 | 21 | 24

export interface Club {
  id: string
  name: string
  logo_url: string | null
  created_at: string
}

export interface Member {
  id: string
  club_id: string
  name: string
  photo_url: string | null
  gender: Gender
  created_at: string
}

export interface Tournament {
  id: string
  club_id: string
  name: string
  date: string
  type: TournamentType
  format: KnockoutFormat | null
  best_of: BestOf | null
  target_points: TargetPoints | null
  match_duration_min: number | null
  status: TournamentStatus
  created_at: string
  /** Khusus Liga: tanggal selesai. */
  date_end: string | null
  /** Khusus Liga: jumlah ronde yang direncanakan (null = semua peserta bertemu sekali). */
  rounds_planned: number | null
}

/** Peserta turnamen. Single = 1 anggota, Double = 2 anggota. */
export interface Participant {
  id: string
  tournament_id: string
  label: string
  member_ids: string[]
}

export interface Game {
  a: number
  b: number
}

export interface KnockoutMatch {
  id: string
  tournament_id: string
  round: number
  position: number
  participant_a: string | null
  participant_b: string | null
  games: Game[]
  winner_id: string | null
  next_match_id: string | null
  next_slot: 'a' | 'b' | null
}

export interface AmericanoRound {
  id: string
  tournament_id: string
  round_no: number
}

export interface AmericanoMatch {
  id: string
  tournament_id: string
  round_id: string
  round_no: number
  table_no: number
  team_a: string[]
  team_b: string[]
  score_a: number | null
  score_b: number | null
}

/** Liga: satu ronde berisi beberapa pertandingan. */
export interface LeagueRound {
  id: string
  tournament_id: string
  round_no: number
}

/**
 * Liga: satu pertandingan. team_a/team_b berisi id anggota
 * (1 orang untuk Single, 2 orang untuk Double).
 */
export interface LeagueMatch {
  id: string
  tournament_id: string
  round_id: string
  round_no: number
  court_no: number
  team_a: string[]
  team_b: string[]
  score_a: number | null
  score_b: number | null
}

export interface Snapshot {
  clubs: Club[]
  members: Member[]
  tournaments: Tournament[]
  participants: Participant[]
  knockout_matches: KnockoutMatch[]
  americano_rounds: AmericanoRound[]
  americano_matches: AmericanoMatch[]
  league_rounds: LeagueRound[]
  league_matches: LeagueMatch[]
}

export const EMPTY_SNAPSHOT: Snapshot = {
  clubs: [],
  members: [],
  tournaments: [],
  participants: [],
  knockout_matches: [],
  americano_rounds: [],
  americano_matches: [],
  league_rounds: [],
  league_matches: [],
}

export type TableName = keyof Snapshot
