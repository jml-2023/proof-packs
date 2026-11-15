"""The listening job on the local route: transcribes the ten narrations with faster-whisper on this machine's GPU.

    pip install faster-whisper
    python listen_local.py tasks/listening results/listening-local-raw.json [--model large-v3] [--device cuda]

Loads the model once (timed separately), then transcribes each narration in English with beam search of 5, the
library's default, and without conditioning each stretch on the text before it. That is how the author's own film word
check runs Whisper. The library's default conditions on the previous text, and in the author's first run with it
Whisper made up 106 words in two of the ten narrations; pass --condition-on-previous-text to see that for yourself.
Writes the raw transcripts with timings; score them with `node score-listening.mjs <raw>`.
Nothing leaves the machine. The model weights download on first use unless they are already cached.
"""
import argparse
import json
import socket
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument("tasks")
p.add_argument("out")
p.add_argument("--model", default="large-v3")
p.add_argument("--device", default="cuda")
p.add_argument("--compute-type", default="float16")
p.add_argument("--beam-size", type=int, default=5)
p.add_argument("--limit", type=int, default=0)
p.add_argument("--condition-on-previous-text", action="store_true")
a = p.parse_args()

import av  # noqa: E402
import numpy as np  # noqa: E402
import faster_whisper  # noqa: E402
from faster_whisper import WhisperModel  # noqa: E402

now = lambda: datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def decode(path, rate=16000):
    """The narration as 16 kHz mono floats, decoded as faster-whisper's own decode_audio does. That function passes
    av.open a keyword (metadata_errors) that newer PyAV releases reject, so the audio is decoded here and handed over."""
    resampler = av.audio.resampler.AudioResampler(format="s16", layout="mono", rate=rate)
    chunks = []
    with av.open(str(path), mode="r") as container:
        for frame in container.decode(audio=0):
            chunks += [f.to_ndarray() for f in resampler.resample(frame)]
        chunks += [f.to_ndarray() for f in resampler.resample(None)]
    return np.concatenate(chunks, axis=1).reshape(-1).astype(np.float32) / 32768.0


tasks = Path(a.tasks)
narrations = json.loads((tasks / "narrations.json").read_text())["narrations"]
if a.limit:
    narrations = narrations[: a.limit]

started = now()
t0 = time.perf_counter()
model = WhisperModel(a.model, device=a.device, compute_type=a.compute_type)
load_seconds = time.perf_counter() - t0
items = []
for n in narrations:
    s0, t1 = now(), time.perf_counter()
    segments, info = model.transcribe(decode(tasks / n["file"]), language="en", beam_size=a.beam_size,
                                      condition_on_previous_text=a.condition_on_previous_text)
    text = " ".join(seg.text.strip() for seg in segments)  # the generator does the work as it is read
    wall = time.perf_counter() - t1
    items.append({"id": n["id"], "text": text, "started_at": s0, "ended_at": now(), "wall_ms": round(wall * 1000),
                  "audio_seconds": round(info.duration, 2)})
    print(f"{len(items)}/{len(narrations)} {n['id']} {wall:.1f} s", file=sys.stderr)
ended = now()

Path(a.out).parent.mkdir(parents=True, exist_ok=True)
Path(a.out).write_text(json.dumps({
    "job": "listening", "route": "local", "server": os.environ.get("LOCAL_HOST_LABEL", "local-workstation"),
    "settings": {"model": f"faster-whisper {a.model}", "library": f"faster-whisper {faster_whisper.__version__}",
                 "device": a.device, "compute_type": a.compute_type, "beam_size": a.beam_size, "language": "en",
                 "condition_on_previous_text": a.condition_on_previous_text},
    "started_at": started, "ended_at": ended, "load_seconds": round(load_seconds, 2), "items": items,
}, indent=2) + "\n")
print(f"wrote {a.out}", file=sys.stderr)
