# Compact practice list — design QA

- Source visual truth: `.local/compact-list/reference.png` (user screenshot, original 1322 × 1510 pixels).
- Implementation screenshots: `.local/compact-list/comparison.jpg`, `.local/compact-list/mobile.jpg`.
- Reference normalized to 661 × 755 CSS pixels (2× source). Real StudyLibrary component rendered with current CSS at 661px, displayed beside the source at equal 0.57 comparison scale in the in-app browser. Comparison capture: 795 × 906 pixels. Focused mobile frame: 375 × 812 CSS pixels at 1× within the same capture viewport.
- State: English, first row highlighted, same first 15 problem names and solved/attempted/unstarted states. Preview data is a fixture and does not create production submissions.

## Findings

No actionable P0/P1/P2 findings remain.

- Typography: existing Arial/system sans stack, 15px desktop / 14px mobile, single-line title with ellipsis; full title retained in accessible text and hover title. Reference uses roughly 16px. Difference is intentional to fit the existing sidebar layout.
- Layout: 48px row height, fixed status slot and difficulty column. Number and title align consistently with empty status slots. 15 rows fit in approximately the same height as the normalized reference. Removed secondary title, section/stage, learning reason and readiness/action labels.
- Colors: alternate near-white rows, dark hover/focus row, green solved check, neutral attempted circle, teal/amber/red difficulty. Amber is darker than the screenshot for legibility on white. English Medium remains spelled out rather than Med.
- Assets: no raster assets in the requested list. Existing Lucide Check/Circle/Clock3 match the reference's simple outline symbols. No generated assets or custom SVG drawings needed.
- Content: titles respect current language; existing actual per-round verdicts retained. Current selection order and filtering stay unchanged.
- Responsive: focused 375px iframe capture confirms long English names truncate without displacing difficulty or causing horizontal overflow. Rows remain 48px touch targets.

## Comparison history

Initial comparison frame was wider than the in-app viewport and clipped the right-hand reference comparison. Reduced the comparison canvas scale equally for both images, then recaptured the full comparison. This was a QA capture correction, not an application layout issue. No visual implementation fixes required after comparison.

## Verification

Actual React UI regression test covers localized long titles, compact three-column markup, direct navigation, status accessibility, progress refresh, judging-to-accepted polling and round/filter behavior. TypeScript and production build checked before release. Browser visual comparisons use real component output with fixture API data; live navigation/filter verification follows deployment.

## Follow-up polish

No required follow-ups. Project-wide header/overview layout is outside this row-density request.

final result: passed
