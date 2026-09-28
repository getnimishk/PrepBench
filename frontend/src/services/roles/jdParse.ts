// PrepBench - Copyright (c) 2026 Nimish Kanungo
// Licensed under the PolyForm Noncommercial License 1.0.0 (see LICENSE).
// Commercial use requires a separate licence from the copyright holder.

/**
 * Read a pasted job description into requirements, without AI.
 *
 * Job descriptions put requirements in bullet lists under headings like
 * "Mandatory skills" or "Preferred". This reads those lists and nothing else: a
 * bullet under a "preferred / nice to have" heading is preferred, any other
 * bullet is mandatory. It never guesses a requirement that isn't a bullet, and
 * the learner confirms each one before it's used, so a miss costs a click, not
 * a wrong plan.
 */

export type RequirementKind = 'mandatory' | 'preferred';

export interface ParsedRequirement {
  text: string;
  kind: RequirementKind;
}

// Bullet marks only. ⭐ and 🔑 are left out on purpose: postings use them to
// decorate headings ("⭐ Preferred Technical Exposure"), not list items.
const BULLET = /^\s*(?:[-*•·▪◦‣✅✔☑]|\d+[.)])\s*/u;
const NUMBERED = /^\s*\d+[.)]\s*/;
const PREFERRED_HEADING = /\b(preferred|nice[\s-]+to[\s-]+have|good[\s-]+to[\s-]+have|desirable|bonus|plus)\b/i;
const MANDATORY_HEADING = /\b(mandatory|required|requirements|must[\s-]+have|essential|qualifications|skills)\b/i;

/** Bold markers and emoji a posting wraps around words, removed from the text. */
function clean(line: string): string {
  return line
    .replace(BULLET, '')
    .replace(/\*\*|__/g, '')
    .replace(/[\p{Extended_Pictographic}️]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseJobDescription(text: string): ParsedRequirement[] {
  const found: ParsedRequirement[] = [];
  const seen = new Set<string>();
  let section: RequirementKind = 'mandatory';

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  lines.forEach((raw, i) => {
    // A numbered line with symbol bullets under it ("1. Preferred
    // qualifications" then "- Power BI") is an outline heading, not an item.
    // Decided by structure, not words: "1. Strong SQL skills" says "skills" too.
    const next = lines[i + 1];
    const numberedHeading = NUMBERED.test(raw) && !!next && BULLET.test(next) && !NUMBERED.test(next);
    if (BULLET.test(raw) && !numberedHeading) {
      const t = clean(raw);
      const key = t.toLowerCase();
      // A bullet that is only a symbol, or a repeat, adds nothing.
      if (t.length >= 2 && !seen.has(key)) {
        seen.add(key);
        found.push({ text: t, kind: section });
      }
      return;
    }
    // A non-bullet line may be a heading that changes the section. Short lines
    // only: a long sentence mentioning "preferred" is prose, not a heading.
    const line = clean(raw);
    if (line.length <= 60) {
      if (PREFERRED_HEADING.test(line)) section = 'preferred';
      else if (MANDATORY_HEADING.test(line)) section = 'mandatory';
    }
  });
  return found;
}

/** What a link suggestion can be made from: a Skill and the guides attached to it. */
export interface LinkCandidate {
  id: number;
  name: string;
  content_packs?: { pack_id: string; title: string }[];
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Does `text` mention `phrase` as whole words, ignoring case? */
function mentions(text: string, phrase: string): boolean {
  const p = phrase.trim();
  if (p.length < 3) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(p.toLowerCase())}($|[^a-z0-9])`).test(text.toLowerCase());
}

/**
 * The Skill a requirement names, as a suggestion only (D8): the learner
 * confirms or clears it, and nothing is saved until they do.
 *
 * A Skill is suggested when the requirement mentions its name, the title of a
 * guide attached to it, or that guide's short id ("ADF") -- a phrase the
 * learner or the pack chose, never a shared common word, so "data" or
 * "system" can't link a requirement to anything. Null when none is named, or
 * when two Skills are named equally (the learner picks).
 */
export function suggestLink<T extends LinkCandidate>(requirement: string, skills: T[]): T | null {
  const named = skills.filter((s) => mentions(requirement, s.name)
    || (s.content_packs ?? []).some((p) => mentions(requirement, p.title) || mentions(requirement, p.pack_id)));
  return named.length === 1 ? named[0] : null;
}
