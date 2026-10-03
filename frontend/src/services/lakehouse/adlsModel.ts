// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

// Station B's model: where batches land in ADLS, and who can touch them (PRD P0-5, design §4.7).
//
// Pure and deterministic. There are NO landing files in v1 (design §4.5): the landing zone
// exists only here, and batches go straight from the generator into the bronze tables.
//
// Four levers, each with a consequence the model computes rather than states:
//   hierarchical namespace  -> whether a directory rename is one atomic operation or a copy
//                              and delete of every object under it; whether ACLs exist at all
//   landing layout          -> how many folders and files a day of data is spread over, so how
//                              expensive a rename or a listing is
//   the access puzzle       -> a vendor needs write access to one folder only. RBAC at container
//                              scope is too broad; a directory ACL needs execute on every parent
//   access tier + lifecycle -> storage and read cost, relative to keeping everything hot
//
// Every figure is a teaching constant from the pack, labelled as one. None is a price.

export type Layout = 'hdfs-copy' | 'redesigned';
export type StorageTier = 'hot' | 'cool';
export type Grant = 'rbac-container' | 'directory-acl';

export interface AdlsLevers {
  hierarchicalNamespace: boolean;
  layout: Layout;
  grant: Grant;
  /** What the directory ACL gives the vendor on the target folder, and on each parent. */
  acl: { targetRead: boolean; targetWrite: boolean; targetExecute: boolean; parentsExecute: boolean[] };
  tier: StorageTier;
  /** Move data older than this many days to cool; null for no rule. */
  lifecycleDays: number | null;
}

export interface TreeNode {
  name: string;
  children: TreeNode[];
}

export interface AdlsConfig {
  constants: {
    objects: Record<Layout, { foldersPerDay: number; filesPerFolder: number }>;
    volumeGb: number;
    retentionDays: number;
    storageRate: Record<StorageTier, number>;
    accessRate: Record<StorageTier, number>;
    readShareByAge: { upToDays: number; share: number }[];
    costWeights: { storage: number; access: number };
  };
  constantLabels: Record<'objects' | 'volume' | 'retention' | 'storageRate' | 'accessRate' | 'readShare' | 'costWeights', string>;
  request: { principal: string; path: string[]; needs: 'write' };
  tree: TreeNode;
}

/** The scenario's starting point for the access puzzle: nothing granted yet. */
export function defaultAdlsLevers(config: AdlsConfig): AdlsLevers {
  return {
    hierarchicalNamespace: true, layout: 'redesigned', grant: 'directory-acl',
    acl: { targetRead: true, targetWrite: true, targetExecute: true, parentsExecute: config.request.path.slice(0, -1).map(() => false) },
    tier: 'hot', lifecycleDays: null,
  };
}

export type ParsedAdls = { ok: true; config: AdlsConfig } | { ok: false; reason: string };

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function parseTree(v: unknown): TreeNode | null {
  if (!isObj(v) || typeof v.name !== 'string' || !Array.isArray(v.children)) return null;
  const children: TreeNode[] = [];
  for (const c of v.children) {
    const node = parseTree(c);
    if (!node) return null;
    children.push(node);
  }
  return { name: v.name, children };
}

/** The pack's ADLS content, checked. A pack without it gets a reason, not a guessed model. */
export function parseAdls(pipeline: unknown): ParsedAdls {
  const fail = (reason: string): ParsedAdls => ({ ok: false, reason });
  if (!isObj(pipeline) || !isObj(pipeline.adls)) return fail('The pack has no pipeline content for Station B.');
  const a = pipeline.adls;
  const c = isObj(a.constants) ? a.constants : null;
  if (!c) return fail('The pack has no ADLS teaching constants.');
  const value = (key: string): unknown => (isObj(c[key]) ? (c[key] as Raw).value : undefined);
  const label = (key: string) => (isObj(c[key]) && typeof (c[key] as Raw).label === 'string' ? ((c[key] as Raw).label as string) : '');

  const objRaw = value('object_count');
  const objects = {} as AdlsConfig['constants']['objects'];
  for (const [layout, key] of [['hdfs-copy', 'hdfs_copy'], ['redesigned', 'redesigned']] as const) {
    const o = isObj(objRaw) && isObj(objRaw[key]) ? (objRaw[key] as Raw) : null;
    const folders = o ? num(o.folders_per_day) : null;
    const files = o ? num(o.files_per_folder) : null;
    if (folders === null || files === null || folders < 1 || files < 1) return fail(`The pack has no object counts for the ${layout} layout.`);
    objects[layout] = { foldersPerDay: folders, filesPerFolder: files };
  }
  const volume = num(value('volume_gb'));
  const retention = num(value('retention_days'));
  const rates = (key: string) => {
    const r = value(key);
    const hot = isObj(r) ? num(r.hot) : null;
    const cool = isObj(r) ? num(r.cool) : null;
    return hot !== null && cool !== null && hot > 0 && cool > 0 ? { hot, cool } : null;
  };
  const storageRate = rates('storage_rate');
  const accessRate = rates('access_rate');
  const weightsRaw = value('cost_weights');
  const weights = isObj(weightsRaw) && num(weightsRaw.storage) !== null && num(weightsRaw.access) !== null
    ? { storage: weightsRaw.storage as number, access: weightsRaw.access as number } : null;
  const shareRaw = value('read_share_by_age');
  if (volume === null || volume <= 0 || retention === null || retention <= 0 || !storageRate || !accessRate || !weights
    || !Array.isArray(shareRaw) || shareRaw.length === 0) {
    return fail('The pack’s ADLS teaching constants are incomplete.');
  }
  const readShareByAge = shareRaw.map((s) => ({ upToDays: isObj(s) ? num(s.up_to_days) : null, share: isObj(s) ? num(s.share) : null }));
  if (readShareByAge.some((s) => s.upToDays === null || s.share === null)) return fail('A read share is malformed.');
  const buckets = readShareByAge as { upToDays: number; share: number }[];
  if (Math.abs(buckets.reduce((n, s) => n + s.share, 0) - 1) > 1e-9 || buckets[buckets.length - 1].upToDays !== retention
    || buckets.some((b, i) => i > 0 && b.upToDays <= buckets[i - 1].upToDays)) {
    return fail('The pack’s read shares must add up to 1 and cover the retention period, oldest last.');
  }

  const req = isObj(a.access_request) ? a.access_request : null;
  const path = req && Array.isArray(req.path) ? req.path.map(String) : [];
  const tree = parseTree(a.tree);
  if (!req || typeof req.principal !== 'string' || path.length < 2 || req.needs !== 'write' || !tree) {
    return fail('The pack’s access request or folder tree is incomplete.');
  }
  // The requested folder has to exist in the tree, or the puzzle asks for something that isn't there.
  let node: TreeNode | undefined = tree.name === path[0] ? tree : undefined;
  for (const part of path.slice(1)) node = node?.children.find((n) => n.name === part);
  if (!node) return fail('The requested folder isn’t in the pack’s folder tree.');

  return {
    ok: true,
    config: {
      constants: { objects, volumeGb: volume, retentionDays: retention, storageRate, accessRate, readShareByAge: buckets, costWeights: weights },
      constantLabels: {
        objects: label('object_count'), volume: label('volume_gb'), retention: label('retention_days'),
        storageRate: label('storage_rate'), accessRate: label('access_rate'), readShare: label('read_share_by_age'),
        costWeights: label('cost_weights'),
      },
      request: { principal: req.principal, path, needs: 'write' },
      tree,
    },
  };
}

// ---- layout ---------------------------------------------------------------------------

export interface LayoutResult {
  /** An example path for one day of one source, as the learner would see it. */
  examplePath: string;
  foldersPerDay: number;
  objectsPerDay: number;
  /** What renaming one day's folder takes. */
  rename: { atomic: boolean; operations: number };
  /** Requests to list one day's data: one per folder, plus the listing of the parent. */
  listRequests: number;
}

export function layoutResult(config: AdlsConfig, levers: AdlsLevers): LayoutResult {
  const { foldersPerDay, filesPerFolder } = config.constants.objects[levers.layout];
  const objects = foldersPerDay * filesPerFolder;
  return {
    examplePath: levers.layout === 'redesigned'
      ? 'lake/bronze/mes/2026/09/24/'
      : 'lake/user/hive/warehouse/yield.db/defects/dt=2026-09-24/hr=00/',
    foldersPerDay, objectsPerDay: objects,
    // A flat namespace has no directories: renaming a "folder" copies then deletes every object under it.
    rename: levers.hierarchicalNamespace ? { atomic: true, operations: 1 } : { atomic: false, operations: 2 * objects },
    listRequests: foldersPerDay + 1,
  };
}

// ---- access ---------------------------------------------------------------------------

export type AccessOutcome = 'allowed' | 'too-broad' | 'denied' | 'unavailable';

export interface AccessResult {
  outcome: AccessOutcome;
  /** The first folder the vendor is stopped at, and what it lacks there. */
  deniedAt?: { path: string[]; missing: 'execute' | 'write' };
  /** Every folder the vendor can write to. */
  writable: string[][];
  explanation: string;
}

/** Every folder in the tree, as a path. */
export function allFolders(tree: TreeNode, prefix: string[] = []): string[][] {
  const here = [...prefix, tree.name];
  return [here, ...tree.children.flatMap((c) => allFolders(c, here))];
}

/** Can the vendor write to the requested folder, and to what else? */
export function accessResult(config: AdlsConfig, levers: AdlsLevers): AccessResult {
  const target = config.request.path;
  const shown = (p: string[]) => `${p.join('/')}/`;
  if (levers.grant === 'rbac-container') {
    // A data-plane role at container scope is checked before any ACL and covers everything in it.
    return {
      outcome: 'too-broad', writable: allFolders(config.tree),
      explanation: `Container-scope RBAC works, but it also grants write access to every folder in ${config.tree.name}/, including silver/ and gold/.`,
    };
  }
  if (!levers.hierarchicalNamespace) {
    return {
      outcome: 'unavailable', writable: [],
      explanation: 'Without a hierarchical namespace there are no directories to put an ACL on. Only RBAC at container scope or a shared access signature remain, and both reach further than the request.',
    };
  }
  const parents = target.slice(0, -1);
  for (let i = 0; i < parents.length; i += 1) {
    if (!levers.acl.parentsExecute[i]) {
      return {
        outcome: 'denied', deniedAt: { path: target.slice(0, i + 1), missing: 'execute' }, writable: [],
        explanation: `${config.request.principal} can’t get through ${shown(target.slice(0, i + 1))} without execute (x) on it, and on each parent folder above the target.`,
      };
    }
  }
  if (!levers.acl.targetExecute || !levers.acl.targetWrite) {
    return {
      outcome: 'denied', deniedAt: { path: target, missing: !levers.acl.targetWrite ? 'write' : 'execute' }, writable: [],
      explanation: `Writing into ${shown(target)} needs both write (w) and execute (x) on it.`,
    };
  }
  return {
    outcome: 'allowed', writable: [target],
    explanation: `Write and execute on ${shown(target)} and execute on each parent: exactly what was asked, and nothing more.`,
  };
}

// ---- tier and lifecycle -----------------------------------------------------------------

export interface TierResult {
  /** All relative to keeping everything hot (1.0). */
  storageIndex: number;
  accessIndex: number;
  totalIndex: number;
  /** The share of the stored data that sits in the cool tier. */
  coolShare: number;
}

export function tierResult(config: AdlsConfig, levers: AdlsLevers): TierResult {
  const c = config.constants;
  let lo = 0;
  let storage = 0;
  let access = 0;
  let cool = 0;
  for (const bucket of c.readShareByAge) {
    const hi = bucket.upToDays;
    const width = hi - lo;
    // The part of this age band that is in the cool tier.
    const coolFraction = levers.tier === 'cool' ? 1
      : levers.lifecycleDays === null ? 0
        : Math.max(0, Math.min(hi, c.retentionDays) - Math.max(lo, levers.lifecycleDays)) / width;
    const dataFraction = width / c.retentionDays;
    storage += dataFraction * (coolFraction * c.storageRate.cool + (1 - coolFraction) * c.storageRate.hot);
    access += bucket.share * (coolFraction * c.accessRate.cool + (1 - coolFraction) * c.accessRate.hot);
    cool += dataFraction * coolFraction;
    lo = hi;
  }
  const hotStorage = c.storageRate.hot;
  const hotAccess = c.accessRate.hot;
  const storageIndex = storage / hotStorage;
  const accessIndex = access / hotAccess;
  return {
    storageIndex, accessIndex,
    totalIndex: c.costWeights.storage * storageIndex + c.costWeights.access * accessIndex,
    coolShare: cool,
  };
}
