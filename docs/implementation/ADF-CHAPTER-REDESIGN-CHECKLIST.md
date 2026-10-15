# ADF Study Guide: chapter redesign checklist

How to redesign a chapter of the ADF Study Guide (`backend/app/content/packs/adf/`). It records the
rules settled while Chapters 1 to 3 were rebuilt, so the next chapter starts from the same place.

## 1. Process and git

- [ ] Work on a feature branch cut from the verified `origin/main`. Do not push or merge unless asked.
- [ ] Commit only when asked, and add specific files by name.
- [ ] Inspect first: the chapter in the pack, its roadmap topics, the tests that pin its text, and the renderer's limits.
- [ ] Never touch the learner's real database. Run test servers on a throwaway database and your own ports (8210, 5383), and stop them afterwards.

## 2. Versioning

- [ ] `v1.json` is the original guide and never changes. A backend test pins it by fingerprint.
- [ ] Edit the newest version file (`v2.json` today). A change a learner could notice, or a new batch of chapters, gets a new version file, with its own fingerprint test.
- [ ] A skill stays on the version it pinned until the learner upgrades.
- [ ] Chapter ids and order stay the same in every version, so links, scenarios and diagnostics keep resolving.
- [ ] Tests that record answers against `adf@1` stay on v1. Tests that check what new learners see read the latest version.

## 3. Sources and accuracy

- [ ] Check every technical claim against the current official documentation, not the old text or memory.
- [ ] State conditions and limits exactly as documented. No blanket claims.
- [ ] Where two pages disagree, say so and tell the learner to check their own value.
- [ ] No connector counts, prices, performance figures or percentages.
- [ ] Label your own inference as inference.
- [ ] Never ask the learner to fact-check the content.

## 4. Structure

- [ ] Follow the documentation's teaching order for the main sections: short paragraphs, definitions before jargon, one running example.
- [ ] Cover every roadmap topic of the chapter. Flag anything added outside its scope.
- [ ] 3 to 5 "What Microsoft Doesn't Say" callouts: practical implication, why it matters, what to do, verify further. Leave one out rather than invent it.
- [ ] End with an Interview takeaway and a practice block tied to the roadmap's learning evidence.
- [ ] Examples are plain examples: no "PrepBench example" or vendor labels.
- [ ] Tables only where they help a decision.

## 5. Wording

- [ ] Do not name the vendor over and over. Say "the documentation", or just state the fact. Product names (Microsoft Fabric, Entra) and the callout title stay.
- [ ] No inline `Source:` lines and no "official documentation used" lists. The page footer carries the one source line. "Verify further" links stay inside callouts.
- [ ] The chapter summary is one short sentence.

## 6. Roadmap alignment

- [ ] The pack keeps the `Roadmap alignment` block: the server parses it and the roadmap links depend on it.
- [ ] Keep the topic lines and the learning evidence unchanged. Update only `Relevant sections` so it names headings that exist.
- [ ] The chapter page shows it in its own tab, never at the top. Chapter 1's block also holds "How to read the labels in this guide".
- [ ] See `docs/research/ADF_Study_Guide_Roadmap_Alignment_Blocks.md`.

## 7. Renderer limits

- [ ] Markdown supports only bold, code, bullets, numbered lists, https links, and `/assets` images on their own line. No italics, headings or blockquotes: use bold labels.
- [ ] Table cells are plain text with no `**`. A block holds only a heading, markdown and a table.
- [ ] Images live in `frontend/public/assets/content/packs/adf/` and need real alt text. Check the image's reuse terms before relying on it.

## 8. Tests that pin chapter text

- [ ] Every "chapter N" mention must resolve to the right chapter. Update the cross-reference list in `backend/tests/test_content_packs.py`.
- [ ] The Behaviour Lab cites exact sentences (for example "Retry defaults to 0." and "Every activity has four exits"). Keep those phrases.
- [ ] The e2e heading matcher uses the chapter title. A test pins 21 chapters.

## 9. Before calling it done

- [ ] Backend `pytest -q`, and frontend typecheck, lint and `vitest run`, all pass.
- [ ] Render the chapter in the browser: images load, no raw markdown, no console errors, no horizontal overflow at 375px in dark mode.
- [ ] Scan for leftover `Source:`, vendor-name and label text.
- [ ] Next and Previous open the next chapter at the top (screens reset the scroll on every path change).
