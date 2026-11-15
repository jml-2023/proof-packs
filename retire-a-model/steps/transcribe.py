"""The step under trial: transcribe a narration and compare it word for word with its script.

It copies the transcription check in the pipeline that builds my films (videos/build/asr2.py, 29 October 2026): the
same instruction, the same audio (mono, 16 kHz, 48 kbit/s mp3), temperature 0, and the same way of counting words.
So a word error rate here means what it means on a film's receipt, where 2% or less passes.

A case folder holds pairs of files with the same name: <id>.mp3 (the audio) and <id>.txt (what was said).
"""
import base64
import difflib
import json
import re
import subprocess
from pathlib import Path

PROMPT = ("Transcribe the narration in this audio verbatim, word for word, exactly as spoken. Do not correct, complete or "
          "tidy anything: if a word is slurred, cut off or wrong, write what you hear. Ignore music and sung lyrics. "
          "Output only the transcript.")

# The film receipt's rule (video-estate-audit-2026-10-22/demo/gen-replay.mjs:140): 2% or less passes, more is a warning.
PASS_AT = 0.02


def cases(folder):
    out = []
    for audio in sorted(Path(folder).glob("*.mp3")):
        text = audio.with_suffix(".txt")
        if not text.exists():
            continue
        seconds = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(audio)],
                                       check=True, capture_output=True, text=True).stdout.strip())
        out.append({"id": audio.stem, "audio": str(audio), "text": text.read_text().strip(), "seconds": round(seconds, 3)})
    return out


def request(model, case):
    return {
        "model": model,
        "temperature": 0,
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": PROMPT},
            {"type": "input_audio", "input_audio": {"data": base64.b64encode(Path(case["audio"]).read_bytes()).decode(), "format": "mp3"}},
        ]}],
    }


# From here on, the word counting is asr2.py's, line for line.
ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def spoken(n: int) -> str:
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + ("" if n % 10 == 0 else " " + ONES[n % 10])
    if n < 1000:
        return ONES[n // 100] + " hundred" + ("" if n % 100 == 0 else " " + spoken(n % 100))
    if 1900 <= n < 2100 and n % 100:
        return spoken(n // 100) + " " + spoken(n % 100)
    return spoken(n // 1000) + " thousand" + ("" if n % 1000 == 0 else " " + spoken(n % 1000))


def words(s: str) -> list[str]:
    s = s.lower().replace("’", "'").replace("%", " percent")
    # A transcript writes 23,000 for "twenty-three thousand"; read the group separator as part of the number.
    s = re.sub(r"(?<=\d),(?=\d{3}\b)", "", s)
    s = re.sub(r"\d+", lambda m: " " + spoken(int(m.group())) + " ", s)
    s = re.sub(r"[^a-z' ]+", " ", s.replace("-", " "))
    return [US.get(w, w) for w in (w.strip("'") for w in s.split()) if w]


# A transcript may spell the same spoken word the American way.
US = {"judgement": "judgment", "colour": "color", "colours": "colors", "harbour": "harbor", "favourite": "favorite", "grey": "gray",
      "centre": "center", "behaviour": "behavior", "organise": "organize", "recognise": "recognize", "realise": "realize"}


def score(case, text):
    a, b = words(case["text"]), words(text)
    m = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    errors = 0
    departures = []
    for op, i1, i2, j1, j2 in m.get_opcodes():
        if op == "equal":
            continue
        errors += max(i2 - i1, j2 - j1)
        departures.append({"op": op, "script": " ".join(a[i1:i2]), "heard": " ".join(b[j1:j2])})
    wer = errors / max(1, len(a))
    return {"words": len(a), "errors": errors, "wer": round(wer, 4), "verdict": "pass" if wer <= PASS_AT else "warn",
            "departures": departures}


if __name__ == "__main__":
    # Score a saved transcript against a case, to check this copy counts as asr2.py does:
    #   python3 -I steps/transcribe.py <case.txt> <transcript.txt>
    import sys
    gold, heard = Path(sys.argv[1]).read_text(), Path(sys.argv[2]).read_text()
    print(json.dumps(score({"text": gold}, heard), indent=1))
