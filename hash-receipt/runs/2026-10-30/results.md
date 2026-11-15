# hash-receipt results, 2026-10-30

Run folder: `runs/2026-10-30`. Tools: node v24.4.0, ffmpeg 8.0, exiftool 13.55, openssl OpenSSL 3.6.4, c2pa 0.38.2 (library 0.91.6).

Inputs: Katsushika Hokusai, The Great Wave off Kanagawa (about 1830 to 1832), public domain; Wikimedia Commons' 1280-pixel copy (sha256 54c3d6b7a70b, 444875 bytes, from https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Tsunami_by_hokusai_19th_century.jpg/1280px-Tsunami_by_hokusai_19th_century.jpg); ffmpeg testsrc2 and a 440 Hz tone, 10 s, drawn on this machine (sha256 8c3006c7de53).

Each was signed with a Content Credential from a throwaway test certificate and given a receipt beside it. "Intact" means the credential is there, the hash inside it matches the file, and the signature checks out with the test root trusted. "Broken" means the credential is there but its hash no longer matches the file. "Stripped" means no credential is left. The receipt column says whether the receipt beside the original describes the bytes of the result.

## Picture

| What happened to the file | Credential inside the file | Receipt beside the file |
|---|---|---|
| a byte-for-byte copy | intact | matches |
| moved to another folder | intact | no file at its path; found again by hash, matches after relink |
| one metadata field changed (the artist's name), with exiftool | broken | does not match |
| all metadata removed, with exiftool | stripped | does not match |
| decoded and saved again as JPEG at the same size, with ffmpeg | stripped | does not match |
| resized to 800 pixels wide, with ffmpeg | stripped | does not match |
| converted to PNG, with ffmpeg | stripped | does not match |
| converted to WebP, with ffmpeg | stripped | does not match |
| one byte added to the end of the file | broken | does not match |
| resized, then signed again naming the original as its parent | intact | does not match |

## Film

| What happened to the file | Credential inside the file | Receipt beside the file |
|---|---|---|
| a byte-for-byte copy | intact | matches |
| moved to another folder | intact | no file at its path; found again by hash, matches after relink |
| one metadata field changed (the title), with exiftool | broken | does not match |
| metadata removed while copying the streams, with ffmpeg | stripped | does not match |
| the same video and sound copied into a new MP4 file, with ffmpeg | stripped | does not match |
| reordered for streaming on the web (faststart), with ffmpeg | stripped | does not match |
| encoded again (H.264 and AAC), with ffmpeg | stripped | does not match |
| the first second cut off, with ffmpeg | stripped | does not match |
| one byte added to the end of the file | broken | does not match |
| encoded again, then signed again naming the original as its parent | intact | does not match |

## Summary

- picture: of 10 things that happened to the file, the credential stayed intact in 3, was stripped in 5 and was left broken in 2. The receipt beside the original matched the result in 1. Signing added 460616 bytes. With no trust settings the signed file reads "Valid"; with the test root trusted, "Trusted".
- film: of 10 things that happened to the file, the credential stayed intact in 3, was stripped in 5 and was left broken in 2. The receipt beside the original matched the result in 1. Signing added 3677 bytes. With no trust settings the signed file reads "Valid"; with the test root trusted, "Trusted".

## The drift case

**write a receipt for the 10-second film, with its loudness measured** (exit 0)

```
$ node receipt.mjs write work/drift/film.mp4 --check duration=pass=10.00 --check loudness=pass=-21.8 LUFS --require duration --require loudness
wrote work/drift/film.mp4.receipt.json
  film.mp4 sha256 8c3006c7de53 10.00 s, 300 frames, 640×360 verdict pass
```

**verify it** (exit 0)

```
$ node receipt.mjs verify work/drift/film.mp4.receipt.json
OK    work/drift/film.mp4.receipt.json
```

**the film is rebuilt at 11.27 s under the same name; verify the old receipt** (exit 1)

```
$ node receipt.mjs verify work/drift/film.mp4.receipt.json
STALE work/drift/film.mp4.receipt.json
        the file changed after its receipt: sha256 c844a2e2c24e on disk, 8c3006c7de53 in the receipt; the receipt says 10.00 s, 300 frames, 640×360, the file is 11.27 s, 338 frames, 640×360
```

**try to accept it** (exit 1)

```
$ node receipt.mjs accept work/drift/film.mp4.receipt.json --name A reader --at 2026-10-30
refused: the file changed after its receipt: sha256 c844a2e2c24e on disk, 8c3006c7de53 in the receipt; the receipt says 10.00 s, 300 frames, 640×360, the file is 11.27 s, 338 frames, 640×360
```

**look for the receipt's bytes by their hash** (exit 0)

```
$ node receipt.mjs find work/drift/film.mp4.receipt.json --in work/drift
found 8c3006c7de53 at work/drift/archive/film-v1.mp4
```

**point the receipt at the bytes it describes** (exit 0)

```
$ node receipt.mjs relink work/drift/film.mp4.receipt.json work/drift/archive/film-v1.mp4
relinked work/drift/film.mp4.receipt.json to work/drift/archive/film-v1.mp4
```

**accept those bytes** (exit 0)

```
$ node receipt.mjs accept work/drift/film.mp4.receipt.json --name A reader --at 2026-10-30
accepted: work/drift/film.mp4.receipt.json
```

**index every receipt in the drift folder** (exit 0)

```
$ node receipt.mjs index work/drift
OK    film.mp4.receipt.json  accepted by A reader

1 of 1 receipts match the file on disk; 1 carry an acceptance
```

## What a receipt costs

- work/picture/signed.jpg: 905491 bytes hashed in 11.3 ms
- work/film/signed.mp4: 1091617 bytes hashed in 11.9 ms

Every command and its output is in `transcript.txt`.
