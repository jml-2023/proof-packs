"""Sign a file with a Content Credential, or check whether a file still carries a valid one.

A Content Credential is the C2PA standard's receipt: a signed record embedded in the file, holding a hash of the
file's bytes (the "hard binding"). This uses the Content Authenticity Initiative's open-source C2PA library
(pip install c2pa-python).

    python3 -I credential.py sign <in> <out> --cert chain.pem --key signer.key [--parent signed-original]
    python3 -I credential.py check <file>... [--trust root.pem] [--json]

`sign` records the input as the parent of the output. With --parent, it records that file instead, which is how a
service that resizes a signed picture can keep its history: it signs the new file and names the old one as its parent.

`check` reports, for each file: whether a credential is there at all; whether the hash inside it still matches the
file's bytes; whether the signer is trusted; and the library's overall state (Trusted, Valid or Invalid). Without
--trust, nobody is trusted unless they are on the library's default list, so a file signed with a test certificate
reads Valid at best. With --trust root.pem, that root is trusted for this check only.
"""
import json
import sys

import c2pa

HASH_OK = ("assertion.dataHash.match", "assertion.bmffHash.match", "assertion.boxesHash.match", "assertion.collectionHash.match")
HASH_BAD = ("assertion.dataHash.mismatch", "assertion.bmffHash.mismatch", "assertion.boxesHash.mismatch", "assertion.collectionHash.mismatch")


def sign(src, dst, cert, key, parent=None, title=None):
    manifest = {"claim_generator_info": [{"name": "hash-receipt pack", "version": "1"}], "title": title or dst.rsplit("/", 1)[-1]}
    if parent:
        manifest["assertions"] = [{"label": "c2pa.actions", "data": {"actions": [{"action": "c2pa.edited"}]}}]
    info = c2pa.C2paSignerInfo(c2pa.C2paSigningAlg.ES256, open(cert, "rb").read(), open(key, "rb").read(), None)
    signer = c2pa.Signer.from_info(info)
    builder = c2pa.Builder.from_json(manifest)
    builder.set_intent(c2pa.C2paBuilderIntent.EDIT)
    if parent:
        fmt = "video/mp4" if parent.lower().endswith((".mp4", ".mov", ".m4v")) else "image/jpeg"
        with open(parent, "rb") as f:
            builder.add_ingredient({"title": parent.rsplit("/", 1)[-1], "relationship": "parentOf"}, fmt, f)
    builder.sign_file(src, dst, signer)


def check(path, trust=None):
    out = {"file": path, "credential": "absent", "hash": None, "signer": None, "state": None, "failures": []}
    context = None
    if trust:
        context = c2pa.Context(c2pa.Settings.from_dict({"trust": {"user_anchors": open(trust).read()}}))
    try:
        reader = c2pa.Reader(path, context=context) if context else c2pa.Reader(path)
    except Exception as e:  # the library raises when there is no credential, or the file is not one it can read
        text = str(e)
        out["detail"] = text[:160]
        if "ManifestNotFound" not in text and "no JUMBF" not in text:
            out["credential"] = "unreadable"
        return out
    results = reader.get_validation_results() or {}
    active = results.get("activeManifest", {})
    ok = [x["code"] for x in active.get("success", [])]
    bad = [x["code"] for x in active.get("failure", [])]
    out["credential"] = "present"
    out["hash"] = "match" if any(c in HASH_OK for c in ok) else "mismatch" if any(c in HASH_BAD for c in bad) else "not checked"
    out["signer"] = "trusted" if "signingCredential.trusted" in ok else "untrusted" if "signingCredential.untrusted" in bad else "unknown"
    out["state"] = reader.get_validation_state()
    out["failures"] = bad
    manifest = reader.get_active_manifest() or {}
    out["parents"] = [i.get("title") for i in manifest.get("ingredients", []) if i.get("relationship") == "parentOf"]
    return out


def main(argv):
    if not argv or argv[0] not in ("sign", "check"):
        print(__doc__.strip().split("\n\n")[1], file=sys.stderr)
        return 2
    opt = lambda f: argv[argv.index(f) + 1] if f in argv else None
    values = {opt(f) for f in ("--cert", "--key", "--trust", "--parent")}
    files = [a for a in argv[1:] if not a.startswith("--") and a not in values]
    if argv[0] == "sign":
        if len(files) != 2 or not opt("--cert") or not opt("--key"):
            print("usage: credential.py sign <in> <out> --cert chain.pem --key signer.key [--parent file]", file=sys.stderr)
            return 2
        sign(files[0], files[1], opt("--cert"), opt("--key"), parent=opt("--parent"))
        print(f"signed {files[1]}")
        return 0
    rows = [check(f, opt("--trust")) for f in files]
    if "--json" in argv:
        print(json.dumps(rows, indent=1))
    else:
        for r in rows:
            print(f"{r['file']}: credential {r['credential']}" + (f", hash {r['hash']}, signer {r['signer']}, state {r['state']}" if r["credential"] == "present" else ""))
    return 0 if all(r["credential"] == "present" and r["hash"] == "match" for r in rows) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
