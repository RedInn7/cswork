# SDE interview foundations

The `sde-interview-foundations` course is independently authored cswork teaching material. OI Wiki is linked for further reading at the end of each chapter; this release does not mirror OI Wiki articles, images or code. OI Wiki identifies its content licenses on its pages (CC BY-SA 4.0 and SATA; additional terms may apply). Future adaptations must retain attribution, identify changes and comply with the applicable source license.

## Content and publication

- `content/interview-catalog.json` defines chapter order and homework problem IDs.
- `content/lectures/interview-*.md` contains the teaching material.
- `algorithm-demo` fenced blocks accept only the registered IDs in `lib/algorithm-demo.ts`; content cannot execute scripts.
- `seedInterview` installs the complete course in one transaction, independently of GoMall. Later boots never replace instructor edits or republish an unpublished chapter.
- Existing enrollment rules still apply. Publishing a course does not grant access; the instructor explicitly grants existing students access at launch. Homework retains its original problem/course permissions.

## Exercise provenance

Homework uses existing, published Ling selected-500 problems. Links identify the original problem number. Selection is based on the algorithm being taught; it is not a claim that a particular company currently uses the question, nor a promise of interview success. OA Master paid content is not included in this release.

## Verification

Run `npx tsx --test tests/interview-course.test.ts tests/algorithm-demo.test.ts`, `npm run typecheck`, and the production build. The course tests validate homework membership and atomic, idempotent installation with preserved instructor edits. Demonstration tests check algorithm invariants against independent oracles. Check playback, pause, reset and mobile wrapping in the real renderer before publishing changes.
