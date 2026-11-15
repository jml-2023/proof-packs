#!/usr/bin/env python3
"""Migration trial: run one step of your pipeline on the model it uses now and on the models you might move it to,
with the same cases and the same request, and write down what changed.

    OPENROUTER_API_KEY=<your key> python3 -I trial.py --step steps/transcribe.py --cases cases/librispeech \
        --models google/gemini-3.8-flash,openai/gpt-audio-mini --sends 4 --out runs/my-trial

The first model is the one you use now. Each case is sent --sends times to each model. Only a dropped connection or a
busy server is tried again; a refusal or an empty reply is counted as what it is, because that is what your pipeline
would get. Writes results.json (every call), summary.md (the tables) and transcripts/ under --out.

    --provider google-ai-studio    send every call to one host only (OpenRouter's provider slug), to test whether
                                   the same model name behaves the same at each host
    --summarise runs/x/results.json  rebuild summary.md from saved calls, without sending anything

Set BASE_URL to use another OpenAI-compatible service instead of OpenRouter. Cost is only reported where the service
returns it (OpenRouter does, in usage.cost).
"""
import argparse
import concurrent.futures
import datetime
import hashlib
import importlib.util
import json
import os
import ssl
import statistics
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path

BASE = os.environ.get("BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
REFUSALS = ("SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "RECITATION")


def load_step(path):
    spec = importlib.util.spec_from_file_location("step", path)
    step = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(step)
    return step


def post(body, key, tries=5):
    """One request; returns (reply, seconds, retries, error)."""
    ctx = ssl.create_default_context()
    # Connections from my Mac to OpenRouter sometimes reset mid-handshake; TLS 1.2 and a few tries get through.
    ctx.maximum_version = ssl.TLSVersion.TLSv1_2
    data = json.dumps(body).encode()
    retries = 0
    for attempt in range(tries):
        req = urllib.request.Request(f"{BASE}/chat/completions", data=data,
                                     headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        start = time.monotonic()
        try:
            with urllib.request.urlopen(req, timeout=300, context=ctx) as r:
                return json.load(r), round(time.monotonic() - start, 2), retries, None
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:1000]
            if e.code in (408, 429, 500, 502, 503, 504) and attempt < tries - 1:
                retries += 1
                time.sleep(3 * (attempt + 1))
                continue
            return None, round(time.monotonic() - start, 2), retries, f"HTTP {e.code}: {detail}"
        except (OSError, urllib.error.URLError) as e:
            if attempt < tries - 1:
                retries += 1
                time.sleep(3 * (attempt + 1))
                continue
            return None, round(time.monotonic() - start, 2), retries, f"{type(e).__name__}: {e}"


def classify(text, finish, native, failed, attached=None):
    """ok, cut (a safety stop after a few words), refused (a safety stop with nothing, or a request blocked for
    safety), empty or error. A safety stop counts as such even when the service also attaches an error."""
    safety = finish == "content_filter" or str(native).upper() in REFUSALS or any(
        s in json.dumps(attached or "") for s in ("SAFETY", "content_policy_violation"))
    if text:
        return "cut" if safety else "ok"
    if safety:
        return "refused"
    return "error" if failed else "empty"


def outcome(reply, error):
    """The outcome, the finish reasons the service gave, the text, and any error it attached."""
    if error or reply is None or reply.get("error"):
        attached = error or (reply or {}).get("error")
        return classify(None, None, None, True, attached), None, None, None, attached
    choice = (reply.get("choices") or [{}])[0]
    text = (choice.get("message") or {}).get("content")
    if isinstance(text, list):  # some services answer in parts
        text = "".join(p.get("text", "") for p in text if isinstance(p, dict))
    text = text.strip() if isinstance(text, str) and text.strip() else None
    finish, native = choice.get("finish_reason"), choice.get("native_finish_reason")
    return classify(text, finish, native, bool(choice.get("error")), choice.get("error")), finish, native, text, choice.get("error")


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--step", help="the step file, for instance steps/transcribe.py")
    ap.add_argument("--cases", help="the folder of cases the step reads")
    ap.add_argument("--models", help="comma-separated; the first is the one you use now")
    ap.add_argument("--sends", type=int, default=4, help="how many times each case goes to each model (default 4)")
    ap.add_argument("--out", help="where to write the results")
    ap.add_argument("--provider", help="send every call to this one host (an OpenRouter provider slug), with no fallback")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--summarise", metavar="RESULTS_JSON", help="rebuild the summary from a saved results.json; sends nothing")
    args = ap.parse_args()

    if args.summarise:
        saved = json.loads(Path(args.summarise).read_text())
        for r in saved["calls"]:
            r["outcome"] = classify(r["text"], r["finish_reason"], r["native_finish_reason"], r["outcome"] == "error", r["error"])
        saved["summary"] = summarise(saved["meta"]["models"], saved["meta"]["cases"], saved["calls"])
        Path(args.summarise).write_text(json.dumps(saved, indent=1) + "\n")
        Path(args.summarise).with_name("summary.md").write_text(report(saved["meta"], saved["summary"]))
        print(report(saved["meta"], saved["summary"]))
        return

    if not (args.step and args.cases and args.models and args.out):
        ap.error("--step, --cases, --models and --out are needed for a run")
    key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("API_KEY")
    if not key:
        sys.exit("Set OPENROUTER_API_KEY (or API_KEY) first.")
    step = load_step(args.step)
    cases = step.cases(args.cases)
    if not cases:
        sys.exit(f"No cases in {args.cases}.")
    models = [m.strip() for m in args.models.split(",") if m.strip()]
    out = Path(args.out)
    (out / "transcripts").mkdir(parents=True, exist_ok=True)

    jobs = [(m, c, s) for m in models for c in cases for s in range(1, args.sends + 1)]
    print(f"{len(cases)} cases x {len(models)} models x {args.sends} sends = {len(jobs)} calls", file=sys.stderr)

    def run(job):
        model, case, send = job
        # "model@host" sends that model to one host only, so one run can compare the same model at two hosts.
        model_id, _, host = model.partition("@")
        body = step.request(model_id, case)
        if host or args.provider:
            body["provider"] = {"order": [host or args.provider], "allow_fallbacks": False}
        reply, seconds, retries, error = post(body, key)
        kind, finish, native, text, attached = outcome(reply, error)
        usage = (reply or {}).get("usage") or {}
        row = {"model": model, "case": case["id"], "send": send, "outcome": kind, "finish_reason": finish,
               "native_finish_reason": native, "provider": (reply or {}).get("provider"), "served_model": (reply or {}).get("model"),
               "seconds": seconds, "retries": retries, "error": attached, "prompt_tokens": usage.get("prompt_tokens"),
               "completion_tokens": usage.get("completion_tokens"), "cost": usage.get("cost"), "usage": usage,
               "id": (reply or {}).get("id"), "text": text}
        if text is not None:
            row["score"] = step.score(case, text)
            name = f"{model.replace('/', '_').replace('~', '').replace('@', '__at__')}__{case['id']}__{send}.txt"
            (out / "transcripts" / name).write_text(text + "\n")
        mark = row["score"]["wer"] if kind == "ok" else kind
        print(f"  {model:40} {case['id']:24} send {send}: {mark}", file=sys.stderr)
        return row

    with concurrent.futures.ThreadPoolExecutor(args.workers) as ex:
        rows = list(ex.map(run, jobs))

    meta = {"date": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"), "base_url": BASE,
            "step": args.step, "step_sha256": sha256(args.step), "models": models, "sends": args.sends,
            "provider_pinned": args.provider,
            "cases": [{"id": c["id"], "seconds": c["seconds"], "audio_sha256": sha256(c["audio"]), "words": len(step.words(c["text"]))
                       if hasattr(step, "words") else None} for c in cases]}
    summary = summarise(models, meta["cases"], rows)
    (out / "results.json").write_text(json.dumps({"meta": meta, "summary": summary, "calls": rows}, indent=1) + "\n")
    (out / "summary.md").write_text(report(meta, summary))
    print(report(meta, summary))


def summarise(models, cases, rows):
    incumbent = models[0]
    minutes = sum(c["seconds"] for c in cases) / 60
    texts = {}  # (model, case) -> list of transcripts
    for r in rows:
        if r["outcome"] == "ok":
            texts.setdefault((r["model"], r["case"]), []).append(r["text"])

    def majority_verdict(model, case_id):
        v = Counter(r["score"]["verdict"] for r in rows if r["model"] == model and r["case"] == case_id and r["outcome"] == "ok")
        return v.most_common(1)[0][0] if v else None

    out = {}
    for m in models:
        mine = [r for r in rows if r["model"] == m]
        ok = [r for r in mine if r["outcome"] == "ok"]
        errors = sum(r["score"]["errors"] for r in ok)
        words = sum(r["score"]["words"] for r in ok)
        costs = [r["cost"] for r in mine if isinstance(r["cost"], (int, float))]
        sends_per_case = max(1, len(mine) // max(1, len(cases)))
        same_twice = [len(set(texts[(m, c["id"])])) == 1 for c in cases if len(texts.get((m, c["id"]), [])) >= 2]
        same_as_incumbent = [t in set(texts.get((incumbent, c["id"]), [])) for c in cases for t in texts.get((m, c["id"]), [])]
        flips = [c["id"] for c in cases if m != incumbent and majority_verdict(m, c["id"]) and majority_verdict(incumbent, c["id"])
                 and majority_verdict(m, c["id"]) != majority_verdict(incumbent, c["id"])]
        by_host = {}
        for r in mine:
            by_host.setdefault(r["provider"] or "none", Counter())[r["outcome"]] += 1
        out[m] = {
            "sends": len(mine),
            "ok": len(ok),
            "cut": sum(r["outcome"] == "cut" for r in mine),
            "refused": sum(r["outcome"] == "refused" for r in mine),
            "empty": sum(r["outcome"] == "empty" for r in mine),
            "error": sum(r["outcome"] == "error" for r in mine),
            "retries": sum(r["retries"] for r in mine),
            "pooled_wer": round(errors / words, 6) if words else None,
            "worst_wer": max((r["score"]["wer"] for r in ok), default=None),
            "pass_share": round(sum(r["score"]["verdict"] == "pass" for r in ok) / len(ok), 3) if ok else None,
            "cases_same_every_send": f"{sum(same_twice)} of {len(same_twice)}" if same_twice else None,
            "transcripts_identical_to_incumbent": f"{sum(same_as_incumbent)} of {len(same_as_incumbent)}" if same_as_incumbent else None,
            "verdicts_changed_vs_incumbent": flips if m != incumbent else None,
            "median_seconds": round(statistics.median(r["seconds"] for r in ok), 2) if ok else None,
            "cost_total": round(sum(costs), 6) if costs else None,
            "cost_per_audio_minute": round(sum(costs) / (minutes * sends_per_case), 6) if costs and minutes else None,
            "outcomes_by_host": {h: dict(c) for h, c in by_host.items()},
        }
    return out


def report(meta, summary):
    lines = [f"# Migration trial, {meta['date'][:10]}", "",
             f"Step `{meta['step']}`, {len(meta['cases'])} cases ({round(sum(c['seconds'] for c in meta['cases']) / 60, 2)} minutes of audio), "
             f"{meta['sends']} sends of each case to each model"
             + (f", every call sent to {meta['provider_pinned']} only" if meta.get("provider_pinned") else "")
             + ". The first model is the one in use now.", "",
             "| Model | Sends | Answered | Cut off | Refused | Empty | Errors | Word error rate (pooled) | Worst send | Sends at 2% or less | Cost per audio minute | Median seconds |",
             "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    pct = lambda v: "–" if v is None else f"{v * 100:.1f}%"
    for m, s in summary.items():
        cost = "–" if s["cost_per_audio_minute"] is None else f"${s['cost_per_audio_minute']:.5f}"
        lines.append(f"| {m} | {s['sends']} | {s['ok']} | {s.get('cut', 0)} | {s['refused']} | {s['empty']} | {s['error']} | {pct(s['pooled_wer'])} | "
                     f"{pct(s['worst_wer'])} | {pct(s['pass_share'])} | {cost} | {s['median_seconds'] if s['median_seconds'] is not None else '–'} |")
    lines += ["", "| Model | Same transcript on every send | Transcripts identical to the incumbent's | Cases whose verdict changes | Outcomes by host | Calls retried |",
              "|---|---|---|---|---|---|"]
    for m, s in summary.items():
        flips = "–" if s["verdicts_changed_vs_incumbent"] is None else (", ".join(s["verdicts_changed_vs_incumbent"]) or "none")
        hosts = "; ".join(f"{h}: " + ", ".join(f"{k} {v}" for k, v in sorted(c.items())) for h, c in s["outcomes_by_host"].items()) or "–"
        lines.append(f"| {m} | {s['cases_same_every_send'] or '–'} | {s['transcripts_identical_to_incumbent'] or '–'} | {flips} | {hosts} | {s['retries']} |")
    lines += ["", "Answered means a whole reply. Cut off means the safety filter stopped the reply after a few words, which a "
                  "pipeline that only checks for text would take as the transcript. Refused means a safety stop with nothing, or a "
                  "request blocked for safety. The word error rate counts only answered sends. A model written as model@host was "
                  "sent to that host only. Every call, with its transcript, finish reasons, host, tokens and cost, is in `results.json`."]
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    main()
