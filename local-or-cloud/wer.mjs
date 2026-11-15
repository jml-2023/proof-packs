// Word error rate, with one normaliser for every route so no transcriber gains from formatting. The normaliser is
// adapted from the author's film word check (videos/build/asr2.py): lower case, numbers read as spoken words,
// punctuation dropped, British spellings read as American (LibriSpeech's texts are mostly American). Three changes:
// years are read in pairs from 1100 to 2099, not only from 1900, because these are old books; the spelling list is
// longer and maps a few old spellings to modern ones; and a compound split on one side and joined on the other
// counts as one word (see joinCompounds). The changes were made after a one-narration cloud trial and before any
// local transcript existed, and they apply to every route.
const ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" ");
const TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split(" ");
const US = {
  judgement: "judgment", colour: "color", colours: "colors", harbour: "harbor", favourite: "favorite", grey: "gray",
  centre: "center", behaviour: "behavior", organise: "organize", recognise: "recognize", realise: "realize",
  honour: "honor", honours: "honors", labour: "labor", neighbour: "neighbor", neighbours: "neighbors", parlour: "parlor",
  // old spellings in the books against modern ones
  gayly: "gaily", gayety: "gaiety", connexion: "connection",
};

function spoken(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
  if (n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + spoken(n % 100) : "");
  if (n >= 1100 && n < 2100 && n % 100) return spoken(Math.floor(n / 100)) + " " + spoken(n % 100);
  return spoken(Math.floor(n / 1000)) + " thousand" + (n % 1000 ? " " + spoken(n % 1000) : "");
}

export function words(s) {
  s = String(s).toLowerCase().replace(/[’‘]/g, "'").replace(/%/g, " percent");
  s = s.replace(/(?<=\d),(?=\d{3}\b)/g, "");
  s = s.replace(/\d+/g, (m) => " " + spoken(Number(m)) + " ");
  s = s.replace(/-/g, " ").replace(/[^a-z' ]+/g, " ");
  return s.split(/\s+/).map((w) => w.replace(/^'+|'+$/g, "")).filter(Boolean).map((w) => US[w] ?? w);
}

// Levenshtein alignment over words: substitutions, deletions and insertions against the reference.
export function align(ref, hyp) {
  const n = ref.length, m = hyp.length;
  const d = Array.from({ length: n + 1 }, (_, i) => Int32Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1));
    }
  }
  let i = n, j = m, sub = 0, del = 0, ins = 0;
  const departures = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1)) {
      if (ref[i - 1] !== hyp[j - 1]) { sub++; departures.push({ op: "replace", ref: ref[i - 1], heard: hyp[j - 1] }); }
      i--; j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      del++; departures.push({ op: "delete", ref: ref[i - 1], heard: "" }); i--;
    } else {
      ins++; departures.push({ op: "insert", ref: "", heard: hyp[j - 1] }); j--;
    }
  }
  return { ref_words: n, sub, del, ins, errors: sub + del + ins, wer: n ? (sub + del + ins) / n : 0, departures: departures.reverse() };
}

// A compound written as one word on one side and two on the other ("checker board", "checkerboard") is the same
// spoken words, so the pair is joined wherever the other side has the joined form. Applied to every route alike.
function joinCompounds(xs, other) {
  const out = [];
  for (let i = 0; i < xs.length; i++) {
    if (i + 1 < xs.length && other.has(xs[i] + xs[i + 1]) && !other.has(xs[i])) { out.push(xs[i] + xs[i + 1]); i++; } else out.push(xs[i]);
  }
  return out;
}

export function wer(reference, transcript) {
  let r = words(reference), h = words(transcript);
  r = joinCompounds(r, new Set(h));
  h = joinCompounds(h, new Set(r));
  return align(r, h);
}
