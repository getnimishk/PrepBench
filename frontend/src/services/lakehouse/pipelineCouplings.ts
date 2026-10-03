// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

// The coupling ledgers for Station A (ADF + Lakeflow) and Station B (ADLS): every
// effect their models apply, typed arithmetic | assumption | convention, in the same
// shape as Station F's (factoryCouplings.ts) and the Agile Metrics sandbox's.
//
// The compositions are frozen by tests, so an effect can't slide in as arithmetic by
// default, and every entry reaches the screen (CouplingLedger renders them all, and a
// test checks it). Station A's findings name the entry they rest on (`ledgerId`), and a
// test checks that each of those ids is in this file.

import type { FactoryCoupling } from './factoryCouplings';

export const STATION_A_COUPLINGS: FactoryCoupling[] = [
  // ---- arithmetic -------------------------------------------------------------------
  {
    id: 'incremental-scope',
    type: 'arithmetic',
    formula: 'an incremental load copies the rows whose id (and so modified time) is above the stored watermark',
    uiLabel: 'An incremental load copies only the rows newer than the stored watermark.',
    effect: 'A watermark that moves -> a later starting point for the next run -> rows before it are never copied again.',
  },
  {
    id: 'append-repeats',
    type: 'arithmetic',
    formula: 'an append sink writes every row it is given',
    uiLabel: 'An append writes every row it is given, so a row given twice is stored twice.',
    effect: 'A repeated copy -> the same rows given again -> two rows for one id, and every count and sum inflated.',
  },
  {
    id: 'expected-vs-landed',
    type: 'arithmetic',
    formula: 'missed = expected ids that never landed; duplicated = ids stored more than once',
    uiLabel: 'A row is missed if it never landed, and duplicated if it is stored more than once.',
    effect: 'The manifest lists ids written -> compared with the ids expected -> exactly which rows are missing or repeated.',
  },

  // ---- assumptions ------------------------------------------------------------------
  {
    id: 'watermark-timing',
    type: 'assumption',
    formula: 'before: the watermark moves ahead of the copy; success: only when it succeeds; completion: also when it fails',
    uiLabel: 'Model assumption: the watermark is stored when the pipeline says (before the copy, on its success exit, or on its completion exit, which includes failing).',
    effect: 'A watermark that moves on a failed copy -> the next run starts after rows never copied -> those rows are lost.',
  },
  {
    id: 'transient-failure',
    type: 'assumption',
    formula: 'one failure interrupts the first attempt part-way; a retry succeeds',
    uiLabel: 'Model assumption: the injected failure interrupts the first attempt only, and a retry then succeeds.',
    effect: 'A failure part-way -> the rows already written stay written -> a retry writes them again.',
  },
  {
    id: 'late-file',
    type: 'assumption',
    formula: 'one of the ten files arrives after the run',
    uiLabel: 'Model assumption: one file of the window arrives after the scheduled run, and is older than the watermark that run stored.',
    effect: 'A file that lands late -> its rows are older than the new watermark -> an incremental run never copies them.',
  },
  {
    id: 'out-of-order',
    type: 'assumption',
    formula: 'two files land in the wrong order',
    uiLabel: 'Model assumption: two files land in the wrong order, the later one first.',
    effect: 'The later file loads first -> the watermark moves past the earlier one -> its rows are skipped when it lands.',
  },
  {
    id: 'tumbling-reruns',
    type: 'assumption',
    formula: 'a tumbling window copies its own window, and a window touched by a late file or a failure is re-run whole',
    uiLabel: 'Model assumption: a tumbling-window trigger copies its own window and re-runs the whole window after a failure or a late file, without using the watermark.',
    effect: 'A re-run window -> every row of the window copied again -> repeats unless the sink is idempotent.',
  },
  {
    id: 'event-per-file',
    type: 'assumption',
    formula: 'an event trigger runs once per file, each run using the stored watermark',
    uiLabel: 'Model assumption: an event trigger runs the pipeline once for each file that lands, each run using the stored watermark.',
    effect: 'A run per file -> a failure touches only its file -> but a file out of order or late is skipped by the watermark.',
  },
  {
    id: 'delete-invisible',
    type: 'assumption',
    formula: 'a watermark sees rows that changed; a row deleted at the source did not change, it went',
    uiLabel: 'Model assumption: a deleted row is invisible to a watermark, and stays in the destination unless a soft-delete flag or a MERGE removes it.',
    effect: 'A row deleted at the source -> no change for the watermark to see -> it stays in the destination.',
  },
  {
    id: 'owner-effects',
    type: 'assumption',
    formula: 'ADF owns triggers from outside Databricks; Lakeflow Jobs owns dependencies between jobs inside it',
    uiLabel: 'Model assumption: ADF should own the trigger from the on-prem feed and Lakeflow Jobs the dependency between jobs.',
    effect: 'The wrong owner -> a scheduler that can’t see the event, or a second one polling the first -> late starts and no task-level repair.',
  },

  // ---- conventions ------------------------------------------------------------------
  {
    id: 'recovery-run',
    type: 'convention',
    formula: 'the manifest shows the window after its retry, or the next run, has picked up what a failure left',
    uiLabel: 'Sandbox counting convention: what is shown is the window once its retry or the next run has happened.',
    effect: 'A failed run -> the next run picks up what the watermark says -> the manifest shows the state after that.',
  },
  {
    id: 'ten-files',
    type: 'convention',
    formula: 'a window arrives as ten equal files',
    uiLabel: 'Sandbox counting convention: a batch arrives as ten files of equal size.',
    effect: 'Equal files -> a late or swapped file is one tenth of the window -> a loss or a skip is a whole number of files.',
  },
  {
    id: 'modified-rises-with-id',
    type: 'convention',
    formula: 'a row’s modified time never runs backwards across the id order, so "newer than the watermark" means "a higher id"',
    uiLabel: 'Sandbox counting convention: rows are loaded in id order, and a higher id means a later modified time.',
    effect: 'Time rising with id -> the watermark is a single id -> "after the watermark" is easy to read and to check.',
  },
  {
    id: 'earlier-batches-clean',
    type: 'convention',
    formula: 'every earlier batch was loaded once, correctly',
    uiLabel: 'Sandbox counting convention: the batches before this one were each loaded once, correctly.',
    effect: 'A clean past -> only this load can add a problem -> any loss or repeat is traced to the levers on screen.',
  },
];

export const STATION_B_COUPLINGS: FactoryCoupling[] = [
  // ---- arithmetic -------------------------------------------------------------------
  {
    id: 'rename-operations',
    type: 'arithmetic',
    formula: 'rename operations = 1 with a hierarchical namespace; 2 × the objects under it (copy, then delete each) without',
    uiLabel: 'Renaming a folder takes one operation with a hierarchical namespace, and a copy and a delete of every object without.',
    effect: 'No hierarchical namespace -> a folder is only a name prefix -> renaming it copies and deletes every object under it.',
  },
  {
    id: 'list-requests',
    type: 'arithmetic',
    formula: 'list requests for one day = folders that day is spread over + 1',
    uiLabel: 'Listing one day of data takes one request for each folder it is spread over, and one for the parent.',
    effect: 'More folders for a day -> more list requests -> slower, costlier listing.',
  },
  {
    id: 'tier-cost',
    type: 'arithmetic',
    formula: 'cost index = storage weight × storage index + access weight × access index, each relative to all-hot',
    uiLabel: 'The combined cost index is the storage index and the read index, weighted, each relative to keeping everything hot.',
    effect: 'Colder data -> cheaper to store but dearer to read -> the saving depends on how much of it is read.',
  },

  // ---- assumptions ------------------------------------------------------------------
  {
    id: 'hns-atomic-rename',
    type: 'assumption',
    formula: 'with a hierarchical namespace a directory rename is a single atomic metadata operation',
    uiLabel: 'Model assumption: with a hierarchical namespace a directory rename is one atomic operation.',
    effect: 'Atomic rename -> a folder can be published or archived in one step -> no half-renamed state a reader could see.',
  },
  {
    id: 'acl-traversal',
    type: 'assumption',
    formula: 'writing into a folder needs write and execute on it, and execute on every folder above it',
    uiLabel: 'Model assumption: an ACL write needs write and execute on the folder and execute on each parent above it.',
    effect: 'Execute missing on a parent -> the path can’t be traversed -> the write is denied however the target is set.',
  },
  {
    id: 'rbac-container-scope',
    type: 'assumption',
    formula: 'a data role at container scope is checked first and applies to every folder in the container',
    uiLabel: 'Model assumption: a data role granted at container scope applies to every folder in it, whatever the ACLs say.',
    effect: 'A role at container scope -> access to every folder -> the vendor can also write to silver and gold.',
  },
  {
    id: 'acl-needs-hns',
    type: 'assumption',
    formula: 'directory ACLs exist only with a hierarchical namespace',
    uiLabel: 'Model assumption: directory ACLs need a hierarchical namespace; a flat namespace has no directories to put them on.',
    effect: 'No hierarchical namespace -> no ACL on a folder -> only container-wide grants are left.',
  },
  {
    id: 'layout-spread',
    type: 'assumption',
    formula: 'a day of data is spread over a fixed number of folders and files in each layout',
    uiLabel: 'Model assumption: a layout copied from HDFS spreads a day over many small folders and files; a redesigned one over few.',
    effect: 'A day spread over many folders -> more to list and more to rename -> slower and costlier at every step.',
  },
  {
    id: 'tier-rates',
    type: 'assumption',
    formula: 'cool storage costs less per gigabyte and more per read than hot',
    uiLabel: 'Model assumption: the hot and cool rates are teaching constants, never quoted prices.',
    effect: 'A cheaper tier for storage -> a dearer tier for reads -> only a saving if the data is read little.',
  },
  {
    id: 'read-shares',
    type: 'assumption',
    formula: 'most reads hit recent data, fewer hit older data',
    uiLabel: 'Model assumption: most reads land on recent data, by a fixed share for each age.',
    effect: 'Reads concentrated on recent data -> old data can go cool cheaply -> a lifecycle rule beats a cool tier for everything.',
  },
  {
    id: 'lifecycle-rule',
    type: 'assumption',
    formula: 'data older than the rule’s age moves from hot to cool',
    uiLabel: 'Model assumption: a lifecycle rule moves data older than its age to the cool tier, and only from hot.',
    effect: 'An age rule -> older data moves to cool -> storage falls while the busiest reads stay hot.',
  },

  // ---- conventions ------------------------------------------------------------------
  {
    id: 'no-landing-files',
    type: 'convention',
    formula: 'the landing zone exists only in this simulation; batches go straight into the bronze tables',
    uiLabel: 'Sandbox counting convention: the landing zone is simulated only; no files are written to it.',
    effect: 'A simulated landing zone -> layout choices change costs here -> they do not change the rows in Station C.',
  },
  {
    id: 'relative-index',
    type: 'convention',
    formula: 'every cost is an index relative to keeping everything hot, never a currency amount',
    uiLabel: 'Sandbox counting convention: costs are indexes relative to keeping everything hot, not prices.',
    effect: 'A relative index -> two choices compare directly -> and nothing is quoted as a real bill.',
  },
];
