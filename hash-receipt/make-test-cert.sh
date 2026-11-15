#!/bin/sh
# Makes a throwaway signing certificate for trying Content Credentials: a test root and a signer it vouches for.
# Nobody trusts this root, which is the point: a file signed with it reads "Valid" (intact, but from a signer nobody
# vouches for) unless you pass the root to `credential.py check --trust`. A certificate that ordinary checkers trust
# has to come from a certificate authority on the C2PA trust list.
#
#   sh make-test-cert.sh <folder>      writes root.pem, chain.pem, signer.pem and the private signer.key there
# signer.key is a private key: keep that folder out of anything you share. run.mjs uses a temporary folder for it.
set -eu
out="${1:?usage: sh make-test-cert.sh <folder>}"
mkdir -p "$out"
cd "$out"
cat > root.cnf <<'EOF'
[req]
distinguished_name = dn
prompt = no
[dn]
CN = hash-receipt test root (trusted by nobody)
O = hash-receipt pack
[ext]
basicConstraints = critical, CA:true
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
EOF
cat > signer.cnf <<'EOF'
[req]
distinguished_name = dn
prompt = no
[dn]
CN = hash-receipt test signer
O = hash-receipt pack
[ext]
basicConstraints = critical, CA:false
keyUsage = critical, digitalSignature
extendedKeyUsage = emailProtection
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
EOF
openssl ecparam -name prime256v1 -genkey -noout -out root.key 2>/dev/null
openssl req -new -x509 -key root.key -sha256 -days 3650 -config root.cnf -extensions ext -out root.pem
openssl ecparam -name prime256v1 -genkey -noout -out signer.ec 2>/dev/null
openssl pkcs8 -topk8 -nocrypt -in signer.ec -out signer.key
openssl req -new -key signer.key -config signer.cnf -out signer.csr
openssl x509 -req -in signer.csr -CA root.pem -CAkey root.key -CAcreateserial -sha256 -days 825 \
  -extfile signer.cnf -extensions ext -out signer.pem 2>/dev/null
cat signer.pem root.pem > chain.pem
rm -f signer.ec signer.csr root.srl root.key   # the root's private key is needed only to sign signer.pem
echo "test certificate in $out: chain.pem, signer.key, root.pem"
