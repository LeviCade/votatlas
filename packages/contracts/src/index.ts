/** Canonical v0.1 cross-package contract. Conductor-owned. No party assumptions. */
export type CandidateId = string;
export type GeoId = string;
export type DataStatus = "official" | "estimated" | "synthetic";
export interface Candidate {
  id: CandidateId;
  name: string;
  partyLabel?: string;
  color: string;
  ballotOrder: number;
}
export type GeoScope =
  | { kind: "national" }
  | { kind: "state"; stateId: string }
  | { kind: "county"; countyIds: GeoId[] }
  | { kind: "district"; districtIds: GeoId[]; vintage: string }
  | { kind: "precinct"; precinctIds: GeoId[]; vintage: string };
export interface ElectionDefinition {
  id: string;
  title: string;
  office: string;
  year?: number;
  geographyVintage: string;
  dataStatus: DataStatus;
  candidates: Candidate[];
}
export interface BaseUnitResult {
  /** Exactly five characters for US county FIPS IDs in v0.1. */
  geoId: GeoId;
  stateId: string;
  /** Eligible voter count for turnout limits; may be null if unavailable. */
  eligibleVoters: number | null;
  votes: Record<CandidateId, number>;
  otherBallots: number;
}
export type Redistribution =
  | { kind: "proportional-other" }
  | { kind: "explicit-donors"; candidateIds: CandidateId[] };
export type Adjustment =
  | {
      type: "TRANSFER_PP"; id: string; scope: GeoScope;
      fromCandidateId: CandidateId; toCandidateId: CandidateId;
      points: number;
    }
  | {
      type: "SET_SHARE"; id: string; scope: GeoScope;
      candidateId: CandidateId; targetPercent: number;
      redistribution: Redistribution;
    }
  | {
      type: "TURNOUT_SCALE"; id: string; scope: GeoScope;
      factor: number; allocation: "proportional-candidates";
    };
export interface Scenario {
  schemaVersion: 1;
  electionId: string;
  actions: Adjustment[];
}
export interface ResultTotals {
  votes: Record<CandidateId, number>;
  otherBallots: number;
  ballots: number;
  winnerCandidateId: CandidateId | null;
  tie: boolean;
}
export interface UnitResult extends BaseUnitResult { ballots: number }
export interface SimulationResult {
  electionId: string;
  schemaVersion: 1;
  units: UnitResult[];
  byState: Record<string, ResultTotals>;
  national: ResultTotals;
  dataStatus: DataStatus;
}
