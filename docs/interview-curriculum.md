# SDE interview foundations

The `sde-interview-foundations` course is independently authored cswork teaching material. OI Wiki is linked for further reading at the end of each chapter; this release does not mirror OI Wiki articles, images or code. OI Wiki identifies its content licenses on its pages (CC BY-SA 4.0 and SATA; additional terms may apply). Future adaptations must retain attribution, identify changes and comply with the applicable source license.

## Content and publication

- `content/interview-catalog.json` defines chapter order and homework problem IDs.
- `content/lectures/interview-*.md` contains the teaching material.
- `algorithm-demo` fenced blocks accept only the registered IDs in `lib/algorithm-demo.ts`; content cannot execute scripts.
- `seedInterview` installs the complete course in one transaction, independently of GoMall. The v2 upgrade checks the original v1 body hash, version and revision before replacing packaged text, keeps the old revision, and preserves instructor edits, publication status and learner progress.
- Existing enrollment rules still apply. Publishing a course does not grant access; the instructor explicitly grants existing students access at launch. Homework retains its original problem/course permissions.

## Exercise provenance

Homework uses existing, published Ling selected-500 problems. Links identify the original problem number. Selection is based on the algorithm being taught; it is not a claim that a particular company currently uses the question, nor a promise of interview success. OA Master paid content is not included in this release.

## Verification

Run `npx tsx --test tests/interview-course.test.ts tests/algorithm-demo.test.ts tests/knowledge-progress.test.ts`, `node --import tsx --test tests/knowledge-navigation-ui.test.mjs`, `npm run typecheck`, and the production build. Course tests validate homework membership and atomic installation/upgrade with preserved instructor edits and progress. Demonstration tests check algorithm invariants against independent oracles. Knowledge homework status uses all formal submissions in the user's active round, retains AC after later failures, and ignores sample runs. The knowledge list is separate from engineering courses; homework appears after the article with current-round completion and hints.
