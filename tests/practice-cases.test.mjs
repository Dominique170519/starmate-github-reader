import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReproductionTask,
  buildVerifiedCaseSearchQuery,
  extractOfficialCases,
  hasExplicitReference,
  normalizeExternalCase,
  parseRepositoryIdentity,
} from "../lib/practice-cases.mjs";
import {
  externalCandidate,
  packageWithDemo,
  packageWithoutDemo,
} from "./fixtures/practice-packages.mjs";

test("extracts official demos with source evidence", () => {
  const cases = extractOfficialCases(packageWithDemo);

  assert.equal(cases.length, 1);
  assert.equal(cases[0].kind, "official");
  assert.equal(cases[0].recommendedEntry, "examples/chat-app/README.md");
  assert.match(cases[0].evidence.url, /tree\/main\/examples\/chat-app$/);
  assert.equal(cases[0].verifiedAt, packageWithDemo.sourceUpdatedAt);
});

test("does not treat ordinary documentation as an official case", () => {
  assert.deepEqual(extractOfficialCases(packageWithoutDemo), []);
});

test("requires a full repository identity for an external reference", () => {
  assert.equal(
    hasExplicitReference("Built with acme/source.", packageWithDemo),
    true,
  );
  assert.equal(
    hasExplicitReference(
      "Built with https://github.com/acme/source for reading.",
      packageWithDemo,
    ),
    true,
  );
  assert.equal(
    hasExplicitReference("This project uses a similar source reader.", packageWithDemo),
    false,
  );
});

test("normalizes only an external repository with explicit evidence", () => {
  const verifiedAt = "2026-07-22T08:00:00.000Z";
  const practiceCase = normalizeExternalCase(
    externalCandidate,
    packageWithDemo,
    "See https://github.com/acme/source for the implementation.",
    verifiedAt,
  );

  assert.equal(practiceCase.kind, "explicit-reference");
  assert.equal(practiceCase.targetRepository, packageWithDemo.fullName);
  assert.equal(practiceCase.verifiedAt, verifiedAt);
  assert.match(practiceCase.evidence.url, /someone\/reader-app#readme$/);
  assert.match(buildReproductionTask(practiceCase).steps[1], /acme\/source/);
  assert.equal(
    normalizeExternalCase(
      externalCandidate,
      packageWithDemo,
      "An unrelated README.",
      verifiedAt,
    ),
    null,
  );
});

test("builds a three-step in-app reproduction task", () => {
  const practiceCase = extractOfficialCases(packageWithDemo)[0];
  const task = buildReproductionTask(practiceCase);

  assert.equal(task.steps.length, 3);
  assert.equal(task.completed.length, 0);
  assert.equal(task.steps.every(Boolean), true);
  assert.equal(task.caseId, practiceCase.id);
});

test("accepts only an exact owner and repository identity", () => {
  assert.deepEqual(parseRepositoryIdentity("acme/source"), {
    owner: "acme",
    repository: "source",
    fullName: "acme/source",
    url: "https://github.com/acme/source",
  });
  assert.equal(parseRepositoryIdentity("acme/source/issues"), null);
  assert.equal(parseRepositoryIdentity("../source"), null);
});

test("builds a quoted GitHub search that excludes forks and archives", () => {
  assert.equal(
    buildVerifiedCaseSearchQuery("acme/source"),
    '"acme/source" in:readme fork:false archived:false',
  );
});
