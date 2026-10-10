// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_SOURCE_HOSTS, CHECKED_ON, IDENTITY_CLAIMS, IDENTITY_SOURCES, claimById,
} from './identitySources';
import {
  GOVERNANCE_CHALLENGE, IDENTITY_CHALLENGE, ORDERS, PLAN_IDS, REDESIGNS, TEST_USERS, WORKLOADS,
  evaluateEstate, evaluatePlan, keepsPurpose, legacyView, redesignView, usedClaimIds,
} from './identityModel';

// The approved register: docs/research/lakehouse-p1-5-identity-governance-research.md (revision 2). Read from
// disk: Vite will not serve a raw file from outside the frontend.
const research = readFileSync(
  resolve(__dirname, '../../../../docs/research/lakehouse-p1-5-identity-governance-research.md'), 'utf8',
);

describe('the source register', () => {
  it('has unique ids, and every source is an official page checked on the stated date', () => {
    expect(new Set(IDENTITY_SOURCES.map((s) => s.id)).size).toBe(IDENTITY_SOURCES.length);
    expect(new Set(IDENTITY_CLAIMS.map((c) => c.id)).size).toBe(IDENTITY_CLAIMS.length);
    for (const s of IDENTITY_SOURCES) {
      const url = new URL(s.url);
      expect(url.protocol).toBe('https:');
      expect(ALLOWED_SOURCE_HOSTS).toContain(url.host);
      expect(s.checkedOn).toBe(CHECKED_ON);
      // The research file lists the same page under the same id.
      expect(research).toContain(`| ${s.id} | ${s.title} | ${s.url} |`);
    }
  });

  it('gives every fact a source, and no assumption or convention one', () => {
    const ids = new Set(IDENTITY_SOURCES.map((s) => s.id));
    for (const c of IDENTITY_CLAIMS) {
      if (c.kind === 'fact') {
        expect(c.sourceIds.length, c.id).toBeGreaterThan(0);
        c.sourceIds.forEach((s) => expect(ids.has(s), `${c.id} cites ${s}`).toBe(true));
      } else {
        expect(c.sourceIds, c.id).toEqual([]);
      }
    }
  });

  it('holds exactly the claims of the approved research file, with the same kinds', () => {
    const inFile = [...research.matchAll(/^\| (F\d+|A\d+|K\d+) \| .+? \| (fact|assumption|convention) \|/gm)]
      .map((m) => `${m[1]}:${m[2]}`).sort();
    expect(IDENTITY_CLAIMS.map((c) => `${c.id}:${c.kind}`).sort()).toEqual(inFile);
  });

  it('states every feature status with its date', () => {
    for (const c of IDENTITY_CLAIMS.filter((x) => /Beta|Preview|Generally Available/i.test(x.text))) {
      expect(c.text, c.id).toContain('as of 10 October 2026');
    }
    // Nothing is called Generally Available: no page read says so.
    expect(IDENTITY_CLAIMS.some((c) => /Generally Available/i.test(c.text))).toBe(false);
  });

  it('cites only claims that exist, and only facts or assumptions, everywhere the model reasons', () => {
    for (const id of usedClaimIds()) {
      const c = claimById(id);
      expect(c, id).toBeDefined();
      expect(c!.kind).not.toBe('convention');
    }
  });
});

describe('identity at cutover', () => {
  it('has exactly one plan that cannot authenticate: the on-premises server given a managed identity', () => {
    const results = evaluateEstate();
    const failing = results.filter((r) => !r.result.works).map((r) => r.workload.id);
    expect(failing).toEqual(['tool-feed']);
    expect(IDENTITY_CHALLENGE.answer).toBe('tool-feed');
    expect(results.find((r) => r.workload.id === 'tool-feed')!.result.claimIds).toEqual(['F5', 'F7']);
  });

  it('keeps the distractor honest: the Databricks-managed service principal works without an Entra token', () => {
    const byId = Object.fromEntries(evaluateEstate().map((r) => [r.workload.id, r.result]));
    expect(byId['report-refresh']).toMatchObject({ works: true, issuer: 'databricks' });
    expect(byId['report-refresh'].claimIds).toContain('F11');
    expect(byId['yield-etl']).toMatchObject({ works: true, issuer: 'entra' });
    expect(byId['lot-sync']).toMatchObject({ works: true, issuer: 'entra' });
  });

  it('lets the failing workload work under every other plan, and says who issues the token', () => {
    const toolFeed = WORKLOADS.find((w) => w.id === 'tool-feed')!;
    expect(toolFeed.onPremises).toBe(true);
    expect(evaluatePlan(toolFeed, 'system-mi')).toMatchObject({ works: false, issuer: 'none' });
    expect(evaluatePlan(toolFeed, 'entra-app')).toMatchObject({ works: true, issuer: 'entra' });
    expect(evaluatePlan(toolFeed, 'databricks-sp')).toMatchObject({ works: true, issuer: 'databricks' });
    expect(evaluatePlan(toolFeed, 'rehost-user-mi')).toMatchObject({ works: true, issuer: 'entra' });
    expect(PLAN_IDS).toHaveLength(4);
    // Changing its plan changes nothing for the others.
    const fixed = evaluateEstate({ 'tool-feed': 'entra-app' });
    expect(fixed.every((r) => r.result.works)).toBe(true);
  });

  it('offers the four workloads as the prediction, by stable id', () => {
    expect(IDENTITY_CHALLENGE.id).toBe('lakehouse.i.identity-cutover');
    expect(IDENTITY_CHALLENGE.options.map((o) => o.id)).toEqual(WORKLOADS.map((w) => w.id));
  });

  it('names only fictional hosts and realms', () => {
    for (const w of WORKLOADS) {
      expect(w.name).toMatch(/^svc-[a-z-]+$/);
      if (w.host.includes('.')) expect(w.host).toMatch(/\.fab\.example$/);
    }
  });
});

describe('governance redesign', () => {
  const view = (fn: (u: (typeof TEST_USERS)[number]) => unknown) => Object.fromEntries(TEST_USERS.map((u) => [u.id, fn(u)]));

  it('reads the legacy Ranger policy in order: first match wins, an empty filter is no restriction', () => {
    expect(view(legacyView)).toEqual({
      ana: { rows: 6, ssn: 'last-four' },
      ben: { rows: 3, ssn: 'last-four' },
      cara: { rows: 6, ssn: 'full' },
      dev: { rows: 0, ssn: 'none' },
    });
    // In both regional groups: the first item listed, national_mgmt, decides.
    expect(legacyView({ id: 'x', groups: ['midwest_sales', 'national_mgmt'] }).rows).toBe(ORDERS.length);
  });

  it('keeps the purpose with row filter and column mask functions only', () => {
    expect(REDESIGNS.filter((r) => keepsPurpose(r.id)).map((r) => r.id)).toEqual(['r1']);
    expect(GOVERNANCE_CHALLENGE.answer).toBe('r1');
    expect(GOVERNANCE_CHALLENGE.id).toBe('lakehouse.i.governance-redesign');
  });

  it('shows each wrong redesign failing the way its fact says', () => {
    // is_member checks workspace-level groups; the groups are account-level: no test passes.
    expect(view((u) => redesignView('r2', u).rows)).toEqual({ ana: 0, ben: 0, cara: 0, dev: 0 });
    // A DENY policy denies a privilege; nothing filters rows or masks the SSN.
    expect(view((u) => redesignView('r3', u))).toEqual({
      ana: { rows: 6, ssn: 'full' }, ben: { rows: 6, ssn: 'full' }, cara: { rows: 6, ssn: 'full' }, dev: { rows: 6, ssn: 'full' },
    });
    // The STRING state cast to INT becomes NULL with ANSI off: only the regional rule breaks.
    expect(view((u) => redesignView('r4', u))).toEqual({ ...view(legacyView), ben: { rows: 0, ssn: 'none' } });
  });

  it('cites a fact for every candidate', () => {
    for (const r of REDESIGNS) {
      expect(r.claimIds.length, r.id).toBeGreaterThan(0);
      expect(r.claimIds.some((id) => claimById(id)?.kind === 'fact'), r.id).toBe(true);
    }
  });

  it('uses identity numbers in a range no real person has', () => {
    for (const o of ORDERS) expect(o.ssn).toMatch(/^000-\d{2}-\d{4}$/);
  });
});
