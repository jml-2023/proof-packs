# A receipt bound to the file: the instrument pack

A score, a check or an approval is only about the file it measured. This pack writes a receipt that is bound to a file's bytes, checks it later, and shows what happens to that binding when a file is copied, moved, edited, converted or re-encoded on its way to someone else.

It does that twice, side by side:

- **A receipt beside the file** (`receipt.mjs`): a small JSON file next to yours, recording its SHA-256 (a 64-character fingerprint of every byte), its size, what it measured, every check that ran, and who accepted it and when. This is how my own film pipeline works.
- **A credential inside the file** (`credential.py`): a Content Credential, the C2PA standard's signed record, embedded in the file and holding a hash of its bytes. This uses the Content Authenticity Initiative's open-source C2PA library.

`run.mjs` runs the whole experiment from the essay on public material: a public-domain picture and a test film that ffmpeg draws itself.

## What's in it

- `receipt.mjs`: writes, checks, accepts, finds and indexes receipts. Node 18 or later and nothing else; uses ffprobe for duration and frames when it's installed.
- `credential.py`: signs a file with a Content Credential, or checks whether a file still carries a valid one. Needs `c2pa-python`.
- `make-test-cert.sh`: makes a throwaway test certificate with openssl. Nobody trusts it, on purpose. Its signing key is private, so `run.mjs` makes it in a temporary folder that is deleted when the run ends.
- `run.mjs`: the experiment. Writes everything to `runs/<date>/`.
- `runs/2026-10-30/`: my run for the essay (`results.md`, `results.json`, `transcript.txt`, and the files themselves). Its `cert/` keeps only the public certificates: that run's two private test keys were deleted on 30 October, and checking a file needs only `cert/root.pem`.

## Install

You need Node 18+, ffmpeg (with ffprobe), exiftool, openssl and Python 3.10+. On a Mac with Homebrew: `brew install node ffmpeg exiftool openssl`. Then, in this folder:

```
python3 -m venv .venv
.venv/bin/pip install c2pa-python
```

I used c2pa-python 0.38.2 (C2PA library 0.91.6), ffmpeg 8.0, exiftool 13.55 and OpenSSL 3.6.4.

## Run the experiment

```
node run.mjs --python .venv/bin/python
```

It takes under a minute. It downloads one picture from Wikimedia Commons (Hokusai's *The Great Wave off Kanagawa*, public domain) into a new folder of its own, draws a ten-second test film, makes a test certificate, signs both files, writes a receipt beside each, and then puts each signed file through ten ordinary things: a copy, a move, one metadata field edited, metadata stripped, re-encoded, resized or trimmed, converted, one byte appended, and a transform followed by a fresh signature that names the original as its parent. After each, it checks both kinds of receipt against the result.

Last, it replays the fault from the essay: a receipt for a 10-second film, the film rebuilt at 11.27 seconds under the same name, the receipt checked, an acceptance attempted, and the old bytes found again by their hash.

No network? Pass any JPEG with `--picture photo.jpg`. The test film needs no download.

## Use it on your own files

```
node receipt.mjs write film.mp4 --check gate=pass --check loudness=pass=-16.1 --require gate --require loudness
node receipt.mjs verify film.mp4.receipt.json
node receipt.mjs accept film.mp4.receipt.json --name "Your Name"
node receipt.mjs index ~/Films
```

- `write` hashes the file and records the checks you name (`id=status` or `id=status=value`; status is pass, fail, warn or not-run). `--require` names checks that must be there; `--block` marks a check whose failure blocks the file.
- `verify` hashes the file again. It fails when the file has changed since the receipt (and, for media, says what changed: "the receipt says 10.00 s, 300 frames; the file is 11.27 s, 338 frames"), when a required check is missing or didn't run, or when an acceptance has no name, date or hash. `--file other.mp4` checks the receipt against a different file.
- `accept` records a person's name and a date against the hash, and refuses when `verify` fails.
- `find --in <folder>` looks for the receipt's bytes anywhere in a folder, by hash. `relink` points a receipt at a file in a new place, only if the bytes match.
- `index` checks every receipt under a folder and counts how many match their file and how many carry an acceptance.

To check a picture or film someone sent you for a Content Credential:

```
.venv/bin/python -I credential.py check received.jpg
```

## Read the result

- **Intact**: the credential is there, the hash inside it matches the file, and the signature checks out.
- **Broken**: the credential is there, but its hash no longer matches the file. The standard is working as designed: the file changed after it was signed.
- **Stripped**: no credential is left. A missing credential tells you nothing either way about where the file came from.
- **Valid or Trusted**: the library calls a credential "Valid" when it is intact but signed by someone it has no reason to trust, and "Trusted" when the signer's certificate leads to a root it trusts. My test certificate reads Valid. In `run.mjs` the test root is trusted for the check, so intact files read Trusted. A credential that ordinary checkers trust needs a certificate from an authority on the C2PA trust list.
- **Matches or does not match**: whether the receipt beside the original describes the bytes of the result.

## Limits

- The operations are ones I ran with local tools: ffmpeg, exiftool and file copies. They stand in for what an upload, an editing app or a content delivery network does, but they aren't those services. What a particular platform keeps is something to test on that platform.
- One picture, one film and one run. The counts would differ with other tools or settings. For instance, Cloudflare's image service can keep a credential through a resize and sign the result, if the site's owner switches that on (Cloudflare's blog, 3 February 2025).
- The test certificate is throwaway. Don't use it to sign anything you publish.
- A receipt proves which bytes were checked. It can't prove the checks were right, or that what the file shows is true.
- File sizes after signing depend on the library's settings. By default it embeds small preview pictures, which roughly doubled my 1,280-pixel picture and added under 4 KB to the film.

## Safety

The picture is downloaded into a new, empty folder inside the run, and every Python call runs with `-I`, so nothing in a download can load as code. The pack writes only inside `runs/`, apart from the test keys, which live in a temporary folder deleted when the run ends. If a private key turns up inside the run's folder, the run stops with an error before it writes its results.
