# Built-in campus intelligence

Updated 19 October 2026. The original local demo helper now includes an in-house multinomial Naive Bayes category classifier trained lazily in browser memory from 90 fictional developer-authored English examples, across nine named classes. Other is an abstention fallback. Explicit boys/girls hostel context is a transparent routing rule. Model scores are not calibrated confidence probabilities, and no accuracy percentage is displayed.

Students: Report an issue → write a draft → Analyze draft & find similar issues. Suggested wording is template-based and still requires explicit application. Category inference uses the local model. Limited pattern privacy scanning and redaction remain available. Matching uses TF-IDF/cosine similarity on the already-authorized issue feed; it excludes every private report and every Resolved/Closed report and returns at most three candidates. It does not auto-merge reports or add support. Opening a match warns about losing the unsaved draft.

Admins: Overview → administration brief provides deterministic queue totals and largest active categories. Issue details → Quick issue summary extracts up to three sentences from the pattern-redacted description. It does not summarize comments or attachments. These summaries are not generative AI and never change priorities or resolutions.

No AI provider, pretrained model, new endpoint, dependency, API key, database migration, credential access or autonomous action. Existing submission, visibility, session and upload flows remain in place. Computation occurs in the viewer's browser; normal issue reads and explicit submissions still use the existing backend. There is no automatic learning from student complaints or persistent feedback collection.

Files: lib/campus-training.mjs, lib/campus-intelligence.mjs, lib/report-assistance.mjs, app/report-assistant.tsx, app/admin-brief.tsx, app/page.tsx. Tests: tests/campus-intelligence.mjs, tests/report-assistance.mjs, tests/admin-analytics.mjs, tests/student-privacy-edge.mjs. TypeScript and production build passed. No browser QA was available. The Cloudflare deployment remains blocked by the previously observed OAuth/network authorization failure; source is prepared for later redeploy. Publish the matching Sites version through the source workflow.

Limits: English-only tokenization; small synthetic training corpus; no semantic embeddings, OCR, image recognition, translation, speech recognition, calibrated confidence, real-world accuracy measurement or false-positive guarantees. Similarity can miss differently phrased duplicates. Privacy patterns can both miss details and redact innocent text. No text extraction can determine whether a complaint is true. Admin oversight remains required.


## Intelligence revision 2

Vocabulary normalization includes common hostel/Wi-Fi spelling variations and aliases such as faucet/tap, restroom/washroom, PC/computer and gymnasium/gym. Category scores use unique recognized terms and downweight terms shared by many classes. Unknown or weak-evidence input abstains. UI shows matching terms, alternative categories for uncertain cases and questions that can help students add missing information. No confidence percentage or unsupported accuracy claim is shown. Uncertain suggestions do not overwrite the student’s manually selected category.

Related reports show shared-term explanations. Input edits clear stale previews, privacy findings and similarity results. No-close-match feedback explains lexical retrieval limits. Privacy checks now recognize separated mobile digits and avoid treating “I am facing wifi problems” as a person’s name. These remain limited patterns, not guaranteed PII detection.

Extractive summaries preserve the first sentence and choose less-redundant later sentences, retaining source wording and order. No claim is made that every qualifier or important fact is retained.

The synthetic development set in tests/intelligence-evaluation-data.mjs contains 34 fixed cases and is not imported by runtime or training code. The previous model returned the expected category on 18/34; revision 2 returns it on 34/34. This set was inspected during development, so it is not a blind evaluation or estimate of production accuracy. A fresh de-identified college evaluation remains necessary. Focused regression checks cover privacy/closed exclusions, unknown input abstention, source-preserving summaries, alias matching and privacy false-positive fixes.
