// The rules that decide what counts as a design role and at what level, from the job title alone, plus the rough
// reading of the years of experience a posting asks for. Copied unchanged from the 12 October 2026 count
// (experiments/p19-who-trains-the-judge/classify-roles.mjs and fetch-boards.mjs), so a re-run with these rules
// can be compared with that day. If you change a rule, say so in your results: the counts stop being comparable.
//
// Two known quirks, kept so the rules match that day (README.md, "Known quirks"):
// - "industrial design" is in the hardware rule, which is checked first, so the industrial-design sensitivity rule
//   never fires. On 12 October one title ("Industrial Designer") was left out as hardware for this reason.
// - A bare "Design Intern" matches no family and is reported as unplaced. "Product Design Intern" is placed.

// 1. The wide net: any title that might be a design role.
export const NET = /design|\bux\b|\bui\b|user experience|user research|product researcher|experience researcher|ux writer|content strateg/i;

// 2. Uses of "design" that are another discipline. Each rule has a name so every exclusion can be checked.
export const EXCLUDE = [
  ["hardware or chip design", /design verification|physical design|rtl design|chip design|silicon design|codesign|mechanical|industrial design|electrical|data center design|\bav engineer/i],
  ["game design (sensitivity)", /game ?design|gameplay design|level design|narrative design|technical designer in animation|mobile game designer/i],
  ["industrial design (sensitivity)", /industrial designer/i],
  ["learning or instructional design (sensitivity)", /learning (experience )?design|instructional design|enablement designer/i],
  ["policy, compensation, process or event design", /policy design|compensation|incentive design|process designer|event design|construction|age-appropriate design/i],
  ["recruiting, people or support role in a design org", /recruit|sourcer|people (business )?partner|people partners|executive assistant|administrative|transformation owner|program manager|project manager|designer advocate/i],
  ["engineering role (not design engineering)", /software engineer|frontend engineer|backend engineer|full[- ]?stack engineer|engineering manager|product manager|member of technical staff|java engineer|ui engineer|ui programmer|ui software|tools programmer|research engineer|designated|engineering - interaction|machine learning/i],
  ["product engineering with design in the team name", /product design ?(and|\/) ?(engineering|development)|engineering and product design/i],
  ["research title that may not be design research", /^researcher\b|quantitative researcher|security researcher|legal researcher|fraud researcher|ai researcher/i],
  ["marketing writing or content strategy", /copywriter|technical writer|^writer|content strategist(?!, product)|content strategy|aeo content|editorial/i],
];

// 3. Families, first match wins. A title that passes the net and the exclusions but matches no family is "unplaced".
export const FAMILY = [
  ["design engineering", /design engineer|ux engineer/i],
  ["design research", /ux (quantitative |qualitative )?research|user research|experience researcher|product researcher|design research/i],
  ["content design", /content design|ux writer|content strategist, product/i],
  ["brand", /brand/i],
  ["visual, motion and web", /visual designer|graphic designer|motion designer|web designer|presentation designer|production designer|creative designer|designer, web|creative director, digital design/i],
  ["UI", /\bui designer|ui artist|technical ui/i],
  ["UX and service", /\bux\b|user experience|experience design|service designer/i],
  ["product design and general", /product design|designer|design lead|lead, design|design systems lead|director, design|director of design|head of design|design manager|manager, design|, design\b/i],
];

// 4. Levels. Early-career levels are checked first; then manager or director; then the most senior named level,
// except that a range ("Senior / Staff") counts at its lower end. A title with no level is "mid".
export const EARLY = [
  ["intern", /\bintern(ship)?\b|co-op|apprentice/i],
  ["new grad or entry", /new grad|graduate|entry[- ]level|early career|university/i],
  ["junior", /\bjunior\b|\bjr\.?\b/i],
  ["associate", /\bassociate\b(?! ?(creative )?director| manager)/i],
  ["level I", /\b(designer|researcher|writer|engineer) i\b(?!i)/i],
];
const SENIOR_ORDER = ["senior", "lead", "staff", "principal"];
const SENIOR = { senior: /\bsenior\b|\bsr\.?(?=\s)/i, lead: /\blead\b/i, staff: /\bstaff\b/i, principal: /\bprincipal\b/i };
const RANGE = /\b(senior|sr\.?|lead|staff|principal)\s*(?:\/|or)\s*(senior|lead|staff|principal)\b/i;
const MANAGER = /\bmanager\b|\bdirector\b|\bhead of\b|\bvp\b|vice president|\bchief\b/i;

export const LEVELS = ["intern", "new grad or entry", "junior", "associate", "level I", "mid", "senior", "lead", "staff", "principal", "manager or director"];
export const EARLY_LEVELS = new Set(EARLY.map(([n]) => n));
export const SENIOR_LEVELS = new Set(["senior", "lead", "staff", "principal", "manager or director"]);
export const FAMILIES = [...new Set(FAMILY.map(([n]) => n))];

export function level(title) {
  for (const [name, re] of EARLY) if (re.test(title)) return name;
  if (MANAGER.test(title)) return "manager or director";
  const r = title.match(RANGE);
  if (r) {
    const norm = (s) => (s.toLowerCase().startsWith("sr") ? "senior" : s.toLowerCase());
    return [norm(r[1]), norm(r[2])].sort((a, b) => SENIOR_ORDER.indexOf(a) - SENIOR_ORDER.indexOf(b))[0];
  }
  for (const name of ["principal", "staff", "lead", "senior"]) if (SENIOR[name].test(title)) return name;
  return "mid";
}

// Sorts one title. Returns null if the net doesn't catch it, or { excluded: rule }, { unplaced: true },
// or { family, level, early }.
export function classify(rawTitle) {
  const title = String(rawTitle ?? "").replace(/\s+/g, " ").trim();
  if (!NET.test(title)) return null;
  const ex = EXCLUDE.find(([, re]) => re.test(title));
  if (ex) return { title, excluded: ex[0], level: level(title) };
  const fam = FAMILY.find(([, re]) => re.test(title));
  if (!fam) return { title, unplaced: true };
  const lv = level(title);
  return { title, family: fam[0], level: lv, early: EARLY_LEVELS.has(lv) };
}

// The largest minimum number of years of experience the posting text asks for, or null if it names none.
// Rough on purpose: "3-5 years" counts as 3, "5+ years" as 5, "at least two years" as 2; numbers over 20 are ignored.
// It can pick up a number from an unrelated sentence about experience.
const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15 };
export function yearsAsked(text) {
  const t = String(text ?? "").toLowerCase().replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen)\b/g, (w) => WORDS[w]);
  const re = /(\d{1,2})\s*(?:\+|plus)?\s*(?:(?:-|–|—|to)\s*\d{1,2}\s*\+?\s*)?(?:or more\s+)?(?:years?|yrs?)\b(?![\s-]*old)[^.;]{0,90}?\bexperience/g;
  const re2 = /experience[^.;]{0,40}?\b(?:at least|minimum of|min\.?|over)\s+(\d{1,2})\s*\+?\s*(?:years?|yrs?)/g;
  const found = [];
  for (const m of t.matchAll(re)) found.push(+m[1]);
  for (const m of t.matchAll(re2)) found.push(+m[1]);
  const ok = found.filter((n) => n >= 0 && n <= 20);
  return ok.length ? Math.max(...ok) : null;
}
