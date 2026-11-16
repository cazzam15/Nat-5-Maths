# Nat 5 Maths Scotland: rules for AI sessions

Free N5 and Higher Maths revision app at https://nat5mathsscotland.com, served by GitHub Pages from `main`. It sits alongside nat5scotland.com, which covers the other subjects.

## Never break

- **Pushing to `main` is live** in about a minute. Work on a branch, commit, and let Caroline push or merge.
- **Every answer must be right.** Check each new answer numerically (for example in `node`) before committing, and match Qualifications Scotland (formerly SQA) N5 and Higher Maths course content and notation.
- **The audience is under 18.** No prices, selling or shop links in questions, explanations or social posts. Shop or affiliate links on the page need Caroline's OK.
- **Release together:** when `assets/` changes, bump `?v=N` on every asset link in `index.html` and in the `ASSETS` list in `sw.js`, and bump `CACHE_NAME` in `sw.js`, or pupils keep the old files from their offline cache.

## Working on the app

- `index.html`, `assets/styles.css`, `assets/app.js` and `assets/data.js`. No build step.
- Answer format in `assets/data.js`: `|` separates accepted alternatives; a top-level `,` separates parts that must all be given, in any order.
- Add new questions at the end of a topic's list; never insert or reorder, or saved worksheets point at the wrong questions.
- The tone is "serious but fun": keep the streak, daily goal and topic accuracy. No XP or level-up system.
- New public pages go in `sitemap.xml`. Test at phone width (390px) as well as desktop.

## Backlog

- A static page per topic (13 N5, 10 Higher, for example `/nat5/sine-rule/`) with a short explanation, key formulas, worked examples from `data.js` and a "Practise this topic" link into the app. The app is one URL, so Google indexes one page; this is the main SEO gap.

## Writing

- Follow `~/home-repo/docs/standards.md`: British English and the Stop Slop rules.
- Plain, encouraging and exact. Write for a 15 to 17-year-old revising on a phone.
