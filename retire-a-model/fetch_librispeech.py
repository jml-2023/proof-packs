#!/usr/bin/env python3
"""Builds the public cases: six clips of LibriSpeech test-clean, each one reader going through a chapter for about as
long as one of my film narrations, with the exact words read.

    python3 -I fetch_librispeech.py cases/librispeech

LibriSpeech (Panayotov, Chen, Povey and Khudanpur, 2015) is read speech from LibriVox audiobooks, published at
https://www.openslr.org/12 under CC BY 4.0. The rows come from Hugging Face's public copy (openslr/librispeech_asr),
through its datasets-server API, so nothing larger than the clips is downloaded. Needs ffmpeg and ffprobe.
"""
import json
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

ROWS = "https://datasets-server.huggingface.co/rows?dataset=openslr%2Flibrispeech_asr&config=clean&split=test&offset={}&length={}"
# Six starting rows spread through the 2,620 rows of test-clean; each clip keeps to the speaker and chapter it starts in.
OFFSETS = [0, 440, 880, 1320, 1760, 2200]
TARGET_SECONDS = 75   # the films' narrations run 53 to 142 seconds
GAP = 0.25            # silence between two sentences of the same chapter


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "retire-a-model/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def seconds(path):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                                check=True, capture_output=True, text=True).stdout.strip())


def main():
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "cases/librispeech")
    out.mkdir(parents=True, exist_ok=True)
    manifest = {"source": "LibriSpeech ASR corpus, test-clean (https://www.openslr.org/12), CC BY 4.0, via "
                          "https://huggingface.co/datasets/openslr/librispeech_asr", "clips": []}
    for offset in OFFSETS:
        rows = [r["row"] for r in json.loads(get(ROWS.format(offset, 60)))["rows"]]
        # Start at the first chapter in the window with at least eight sentences, so no clip is a stray line.
        groups = [(r["speaker_id"], r["chapter_id"]) for r in rows]
        speaker, chapter = next(g for g in dict.fromkeys(groups) if groups.count(g) >= 8)
        rows = [r for r in rows if (r["speaker_id"], r["chapter_id"]) == (speaker, chapter)]
        with tempfile.TemporaryDirectory() as tmp:
            parts, texts, total, ids = [], [], 0.0, []
            for r in rows:
                if (r["speaker_id"], r["chapter_id"]) != (speaker, chapter) or total >= TARGET_SECONDS:
                    break
                flac = Path(tmp) / f"{r['id']}.flac"
                flac.write_bytes(get(r["audio"][0]["src"]))
                total += seconds(flac) + GAP
                parts.append(flac)
                texts.append(r["text"])
                ids.append(r["id"])
            clip = f"ls-{speaker}-{chapter}"
            listing = Path(tmp) / "list.txt"
            silence = Path(tmp) / "gap.flac"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono", "-t", str(GAP), str(silence)], check=True)
            listing.write_text("".join(f"file '{p}'\nfile '{silence}'\n" for p in parts))
            # The same audio the film check sends: mono, 16 kHz, 48 kbit/s mp3.
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(listing),
                            "-ac", "1", "-ar", "16000", "-b:a", "48k", str(out / f"{clip}.mp3")], check=True)
        (out / f"{clip}.txt").write_text(" ".join(texts) + "\n")
        manifest["clips"].append({"clip": clip, "speaker_id": speaker, "chapter_id": chapter, "utterances": ids,
                                  "seconds": round(seconds(out / f"{clip}.mp3"), 2), "words": sum(len(t.split()) for t in texts)})
        print(f"{clip}: {len(ids)} sentences, {manifest['clips'][-1]['seconds']} s", file=sys.stderr)
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n")


if __name__ == "__main__":
    main()
