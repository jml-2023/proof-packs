This run's test certificate: the public parts only.

The run made a throwaway test root and signer (make-test-cert.sh). Its two private keys, root.key and signer.key, were
deleted on 30 October 2026, after the run, so that no private key travels with the pack. They signed only the test files
in this run, and nobody trusts this root. The transcript still names cert/signer.key in the signing commands, because
that is where the key was when the run used it.

Checking needs only the public root:

  python3 -I credential.py check runs/2026-10-30/work/picture/signed.jpg --trust runs/2026-10-30/cert/root.pem

From that change on, run.mjs makes the keys in a temporary folder outside the run, deletes it when the run ends, and stops
with an error before writing results if a private key is found anywhere in the run's folder.
