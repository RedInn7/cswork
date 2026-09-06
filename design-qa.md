# Problem statement layout QA

final result: passed

## Visual target and evidence
- User target: `/var/folders/7c/r4hwfvc92w36gxfm_gs3fvzw0000gn/T/codex-clipboard-53a556bc-8c87-48a8-a443-b6690888abbf.png`.
- Combined reference/implementation screenshot: `.local/statement-preview/comparison.jpg`.
- Rendered actual Workspace and StatementMarkdown: http://127.0.0.1:4388/comparison.html .
- Browser viewport: 1117 × 906 CSS pixels. Source: 1322 × 1422 pixels, normalized to 661 × 711 CSS pixels. Actual statement panel: 661 CSS pixels. Both comparison columns receive the same 0.8 scale to fit the browser.
- State: English Two Sum, light theme. Preview uses an explicitly labeled mock accepted submission; production completion remains derived from real formal submissions. Description/Submission tabs and language switch are existing product controls outside the supplied crop.

## Comparison history
1. Preview fixture initially omitted the workspace ancestor, so scoped typography/tokens did not apply. Fixed preview wrapper and serialized English selector state; no production defect was inferred from this fixture error.
2. First normalized comparison found smaller sample text and looser body leading than the reference. Increased example text from 14 to 16 px and reduced body leading from 1.75 to 1.6. Recaptured the combined view.
3. Final combined capture checked title, difficulty pill, body paragraphs, inline code, all three examples, and constraints. No actionable P0/P1/P2 issues remain. These details are legible in the combined screenshot, so a separate focused crop was unnecessary.

## Fidelity surfaces
- Typography: 26 px heading, 16 px body and examples, bold input/output labels. Existing product font stack retained. Original imported wording and emphasis retained rather than substituting the screenshot's wording.
- Spacing: title precedes tools; natural paragraphs; white examples with a thin left rule. Existing split-pane padding causes occasional extra wrapping versus the reference crop; this is intentional for the actual workspace.
- Colors: neutral white surface, subtle code chips and dividers, semantic difficulty/success colors; existing dark-theme tokens preserved.
- Images/icons: no raster illustration in the reference. Existing icon library supplies topic/hint/check icons. Original problem diagrams remain rendered when present.
- Content: complete bilingual statement, examples and constraints retained. No fake company data, source badges or irrelevant version metadata. Topics/hints appear only with relevant data.

## Interaction verification
- Actual React Workspace test covers title, accepted state, topic expansion/collapse, bilingual selection, mode switching, and independent drafts.
- TypeScript validation passed. Production browser verification follows deployment; the local SSR preview intentionally stubs the editor and does not claim to exercise authentication or judging.

## Follow-up polish
- Imported mathematical exponent notation remains as supplied; mathematical typesetting is outside this visual change.
