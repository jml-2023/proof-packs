#!/bin/sh
# Runs the whole pack from public material: downloads the three npm packages the data comes from, checks their hashes,
# extracts the data again and confirms it matches data/, runs every check, and compares the results with mine.
# Usage: sh run.sh            (set SKIP_RENDER=1 to skip the browser step; set PLAYWRIGHT_FROM to a package.json whose
#                              node_modules has playwright if this folder doesn't)
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
OUT="$HERE/out"
WORK=$(mktemp -d)
START=$(date +%s)
mkdir -p "$OUT"
cd "$HERE"

echo "1. Download the public packages and check their hashes (in $WORK)"
fetch() { # name@version, expected sha1 from the npm registry's dist.shasum
  dir="$WORK/$(echo "$1" | tr '/@' '__')"
  mkdir -p "$dir/x"
  (cd "$dir" && npm pack "$1" --ignore-scripts --silent >/dev/null)
  got=$(shasum -a 1 "$dir"/*.tgz | cut -d' ' -f1)
  if [ "$got" != "$2" ]; then echo "   $1: hash $got, expected $2; stopping"; exit 1; fi
  tar -xzf "$dir"/*.tgz -C "$dir/x"
  echo "   $1: hash matches ($2)"
}
fetch tailwindcss@4.2.2 688fb0751c8ca9044e890546510a2ee817308e87
fetch tailwindcss@3.4.17 ae8406c0f96696a631c790768ff319d46d5e5a63
fetch @carbon/type@11.70.0 bf2a104076ce082bed292f8aa54872645791675e

echo "2. Extract the data again and compare it with data/"
mkdir -p "$WORK/data"
node extract-public.mjs "$WORK/tailwindcss_4.2.2/x/package" "$WORK/tailwindcss_3.4.17/x/package" "$WORK/_carbon_type_11.70.0/x/package" "$WORK/data" >/dev/null
for f in tailwind-4.2.2-type.json tailwind-3.4.17-palette.json carbon-type-11.70.0.json; do
  if cmp -s "$WORK/data/$f" "data/$f"; then echo "   $f: same as data/$f"; else echo "   $f: differs from data/$f; stopping"; exit 1; fi
done

echo "3. Type checks"
node check-type.mjs
echo "4. Faces"
python3 -I faces.py fonts/faces.json "$OUT/faces.json"
echo "5. Gradients, computed"
node check-gradients.mjs
if [ "${SKIP_RENDER:-0}" = "1" ]; then echo "6. Gradients, drawn in a browser: skipped (SKIP_RENDER=1)"
else echo "6. Gradients, drawn in a browser"; node render-gradients.mjs; fi
echo "7. The stylesheet check on examples/gradients.css (it exits 1 because three of the examples fail the gate)"
OUT_JSON="$OUT/css-examples.json" node check-css.mjs examples/gradients.css || true

echo "8. Compare with my results (results-30-october/)"
for f in type.json faces.json gradients.json rendered.json css-examples.json; do
  if [ ! -f "$OUT/$f" ]; then echo "   $f: not made"; elif cmp -s "$OUT/$f" "results-30-october/$f"; then echo "   $f: same as mine"; else echo "   $f: differs from mine"; fi
done
echo "Done in $(( $(date +%s) - START )) seconds. Results in $OUT"
rm -rf "$WORK"
