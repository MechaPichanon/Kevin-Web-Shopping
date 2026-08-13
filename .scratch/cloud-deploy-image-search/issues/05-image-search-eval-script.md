# 05 — Image search: Precision@k eval script

**What to build:** a runnable script that scores the image-search pipeline
against a small hand-labeled set of query photos with known correct
matches, printing a Precision@k metric — a thesis-paper artifact, not a CI
test. Mirror the shape of the existing chatbot eval scripts in
`backend/chatbot/tests/` (e.g. `compare_intent_f1.py` + its
`intent_eval_dataset.json`), but lighter weight, since this is a new
pipeline rather than a tuned one. See `../spec.md` §"Testing Decisions" for
the full rationale (no automated test suite/CI for this project, per ADR
0003 — this script is evaluation tooling, not a test).

**Blocked by:** 04 (needs a working, backfilled image-search pipeline to
score against).

**Status:** resolved

- [x] A hand-labeled dataset file exists: a small set of query product
      photos, each with its known-correct product match.
- [x] A runner script calls `POST /image-search` (or the underlying search
      function directly) for each query and computes Precision@k.
- [x] Running the script against the backfilled catalogue prints a concrete
      Precision@k number.
- [x] The script and dataset live alongside the existing chatbot eval
      scripts, following their existing file-naming/structure conventions.
