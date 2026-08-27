import type { ConceptId } from '../../types/learning';
import { CONCEPTS, CONCEPT_LIST, prerequisitesOf } from './concepts';

// The mechanism behind the leakage tests.
//
// The rule from the PRD: a prediction prompt, its options, its distractors and
// any pre-commitment hint may use only vocabulary the learner has already been
// given. A distractor that names an unintroduced concept teaches the answer
// through the option list -- and worse, it scores a correct prediction from a
// learner who reasoned nothing.
//
// This is enforced mechanically rather than by review, because it is exactly
// the kind of defect that survives review: every individual sentence looks
// fine, and the leak is only visible when you know what the learner has and
// has not been told yet.

/** Terms a learner may see when working on `conceptId`. */
export function allowedVocabulary(conceptId: ConceptId): Set<string> {
  const allowed = new Set<string>();
  const available: ConceptId[] = [conceptId, ...prerequisitesOf(conceptId)];
  for (const id of available) {
    for (const term of CONCEPTS[id].introducedVocabulary) allowed.add(term);
  }
  return allowed;
}

/** Concepts whose vocabulary is NOT yet available at `conceptId`. */
function unavailableConcepts(conceptId: ConceptId): ConceptId[] {
  const available = new Set<ConceptId>([conceptId, ...prerequisitesOf(conceptId)]);
  return CONCEPT_LIST.filter((c) => !available.has(c.id)).map((c) => c.id);
}

/**
 * Whether `term` occurs in `text` as a term rather than as a fragment.
 *
 * Word-bounded on both ends so "wip" does not match "swipe" and "vary" does
 * not match "variable". Multi-word terms are matched with the same bounds
 * around the whole phrase.
 */
function containsTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Curly and straight apostrophes are interchangeable for matching purposes.
  const flexible = escaped.replace(/['’]/g, "['’]");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${flexible}($|[^\\p{L}\\p{N}])`, 'iu').test(text);
}

export interface Leak {
  term: string;
  from: ConceptId;
}

/**
 * Terms in `text` that belong to a concept the learner has not reached yet.
 *
 * Returns every leak rather than the first, so a failing test names all of
 * them and the author fixes the text once.
 */
export function leakedTerms(text: string, conceptId: ConceptId): Leak[] {
  const leaks: Leak[] = [];
  for (const other of unavailableConcepts(conceptId)) {
    for (const term of CONCEPTS[other].introducedVocabulary) {
      if (containsTerm(text, term)) leaks.push({ term, from: other });
    }
  }
  return leaks;
}

/** Words too common to carry meaning in a near-duplicate check. */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'it', 'its', 'in', 'on', 'at', 'to', 'of',
  'for', 'from', 'by', 'with', 'that', 'this', 'these', 'those', 'not', 'no', 'do', 'does',
  'how', 'what', 'which', 'as', 'are', 'was', 'were', 'be', 'been', 'has', 'have', 'had',
  'you', 'your', 'they', 'their', 'them', 'can', 'will', 'more', 'much', 'up', 'down',
]);

function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w));
}

/**
 * Whether a concept's referential card gives away the relationship it is
 * supposed to teach.
 *
 * Two checks, and it is worth being honest about their limits. Full paraphrase
 * detection is not mechanisable offline, so this catches the two failures that
 * actually occur in practice and a human still reads the card:
 *
 *   1. VOCABULARY the learner has not reached. A card for WIP that says
 *      "throughput" has handed over the next lesson. This one is exact.
 *   2. NEAR-DUPLICATION. Four consecutive content words shared with the target
 *      relationship means the card is restating it, however it is worded.
 *
 * What it does NOT catch is a fully reworded relational claim built entirely
 * from already-available vocabulary. That is a review responsibility, and
 * pretending otherwise would be worse than saying so.
 */
export function relationshipLeakInCard(conceptId: ConceptId): string[] {
  const concept = CONCEPTS[conceptId];
  const card = [concept.referentDefinition, concept.whereToSeeIt, concept.whyItMatters].join(' ');

  const problems = leakedTerms(card, conceptId).map(
    (l) => `unreached vocabulary "${l.term}" (from ${l.from})`,
  );

  if (concept.targetRelationship !== null) {
    const target = contentWords(concept.targetRelationship);
    const cardWords = contentWords(card).join(' ');
    for (let i = 0; i + 4 <= target.length; i++) {
      const phrase = target.slice(i, i + 4).join(' ');
      if (cardWords.includes(phrase)) {
        problems.push(`restates the relationship: "${phrase}"`);
      }
    }
  }

  return problems;
}

/** Hedge words. One hedged option among absolutes is picked on instinct. */
const HEDGES = ['may', 'might', 'possibly', 'could', 'perhaps', 'probably', 'likely', 'maybe'];

/**
 * Options where exactly one is hedged, or one is markedly longer.
 *
 * Both are stylistic tells that let a learner score a correct prediction
 * without reasoning, which corrupts the primary mastery signal.
 */
export function unbalancedOptions(texts: string[]): string[] {
  const problems: string[] = [];
  if (texts.length < 2) return problems;

  const hedged = texts.filter((t) => HEDGES.some((h) => containsTerm(t, h)));
  if (hedged.length === 1) {
    problems.push(`exactly one option is hedged: "${hedged[0]}"`);
  }

  const lengths = texts.map((t) => t.trim().length);
  const shortest = Math.min(...lengths);
  const longest = Math.max(...lengths);
  // A 2.5x spread is the point at which length alone identifies the odd one
  // out, regardless of what any of them say.
  if (shortest > 0 && longest / shortest > 2.5) {
    problems.push(`option lengths range ${shortest}..${longest}, which singles one out`);
  }

  return problems;
}
