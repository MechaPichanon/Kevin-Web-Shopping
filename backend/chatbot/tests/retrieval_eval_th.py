"""
Thai retrieval eval — Hit@1 / Hit@3 / MRR of retrieve_products() on
retrieval_eval_th.json. Calls retrieval directly (no LLM), so it measures only
the RAG step.

Run inside the chatbot container (it has DATABASE_URL + Ollama access):
    docker exec -w /app/backend/chatbot kevin-web-shopping-backend-1 \
        python tests/retrieval_eval_th.py <label>
Output: tests/reports/retrieval_eval_th_<label>.json
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import retrieval  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))


def run(label: str):
    with open(os.path.join(HERE, "retrieval_eval_th.json"), encoding="utf-8") as f:
        queries = json.load(f)["queries"]

    rows = []
    for q in queries:
        got = [retrieval._product_id(p) for p in retrieval.retrieve_products(q["query"])][:3]
        names = [retrieval._product_name(retrieval._get_index()["product_by_id"][pid]) for pid in got]
        exp = set(q["expected"])
        if not exp:  # out of scope: pass when nothing is retrieved
            hit1 = hit3 = rr = 1.0 if not got else 0.0
        else:
            ranks = [i for i, pid in enumerate(got) if pid in exp]
            hit1 = 1.0 if ranks and ranks[0] == 0 else 0.0
            hit3 = 1.0 if ranks else 0.0
            rr = 1.0 / (ranks[0] + 1) if ranks else 0.0
        rows.append({**q, "top3": got, "top3_names": names, "hit1": hit1, "hit3": hit3, "rr": rr})
        mark = "✓" if hit3 else "✗"
        print(f"  {mark} Q{q['id']:>2} {q['query']:<34} → {names}")

    in_scope = [r for r in rows if r["expected"]]
    oos = [r for r in rows if not r["expected"]]
    summary = {
        "hit1": sum(r["hit1"] for r in in_scope) / len(in_scope),
        "hit3": sum(r["hit3"] for r in in_scope) / len(in_scope),
        "mrr": sum(r["rr"] for r in in_scope) / len(in_scope),
        "oos_pass": sum(r["hit3"] for r in oos) / len(oos) if oos else None,
        "n_in_scope": len(in_scope), "n_oos": len(oos),
    }
    print(f"\n[{label}] Hit@1 {summary['hit1']:.3f} · Hit@3 {summary['hit3']:.3f} · "
          f"MRR {summary['mrr']:.3f} · out-of-scope empty {summary['oos_pass']:.2f} "
          f"({len(in_scope)} in-scope, {len(oos)} out-of-scope)")

    os.makedirs(os.path.join(HERE, "reports"), exist_ok=True)
    with open(os.path.join(HERE, "reports", f"retrieval_eval_th_{label}.json"), "w", encoding="utf-8") as f:
        json.dump({"label": label, "summary": summary, "results": rows}, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    run(sys.argv[1] if len(sys.argv) > 1 else "run")
