"""The per-line variant of the step. Before a film is built, the pipeline cuts the narration into lines and has each
line transcribed with a shorter instruction (videos/build/split_performance.py, 29 October 2026). Everything else is
the whole-film step in transcribe.py: the audio, temperature 0 and the word counting.
"""
import importlib.util
from pathlib import Path

_spec = importlib.util.spec_from_file_location("transcribe", Path(__file__).with_name("transcribe.py"))
_base = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_base)

PROMPT = "Transcribe this speech verbatim, word for word. Output only the transcript."
PASS_AT = _base.PASS_AT
cases, score, words = _base.cases, _base.score, _base.words


def request(model, case):
    body = _base.request(model, case)
    body["messages"][0]["content"][0]["text"] = PROMPT
    return body
