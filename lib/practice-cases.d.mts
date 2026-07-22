import type { RepositoryLearningPackage } from "./repository-learning";

export type PracticeCaseKind = "official" | "explicit-reference";

export type PracticeCase = {
  id: string;
  sourceRepository: string;
  targetRepository: string;
  title: string;
  kind: PracticeCaseKind;
  summary: string;
  recommendedEntry: string;
  estimatedMinutes: number;
  verifiedAt: string;
  evidence: { label: string; url: string };
};

export type PracticeTask = {
  id: string;
  caseId: string;
  completed: number[];
  steps: string[];
};

export type PracticeCaseTarget = {
  id: string;
  fullName: string;
  url: string;
};

export function extractOfficialCases(pkg: RepositoryLearningPackage): PracticeCase[];
export function hasExplicitReference(markdown: string, target: PracticeCaseTarget): boolean;
export function normalizeExternalCase(
  candidate: { name?: string; full_name: string; html_url: string; description?: string | null },
  target: PracticeCaseTarget,
  readme: string,
  checkedAt?: string,
): PracticeCase | null;
export function buildReproductionTask(practiceCase: PracticeCase): PracticeTask;
export function parseRepositoryIdentity(value: string): {
  owner: string;
  repository: string;
  fullName: string;
  url: string;
} | null;
export function buildVerifiedCaseSearchQuery(fullName: string): string;
