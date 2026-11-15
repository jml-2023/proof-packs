# Count the entry roles: the instrument pack

This pack counts the design roles open on public job boards on one day, sorts them by the level in the job title, and reports how many are open to beginners. It repeats the count behind "Who trains the next judge?": on 12 October 2026, 80 job boards listed 13,191 open roles, 277 of them design postings, and 23 of those were open to beginners. On 30 October 2026 the pack ran again on the same 80 boards: 13,363 open roles, 277 design postings, and 25 open to beginners.

A result from this pack is one day's sample. It shows no trend on its own, and it can't show what caused the numbers. Compare only with a count on the same boards, in the same month of the year.

## What's in it

- `boards.json`: the 80 boards counted on 12 October 2026 (55 on Greenhouse, 2 on Lever, 23 on Ashby).
- `fetch.mjs`: fetches the open roles on a list of boards, one request at a time, and keeps only each role's title, location and a rough reading of the years of experience it asks for.
- `count.mjs`: sorts the roles, counts them and writes `results.md`, `results.json`, `design-roles.csv` and `excluded-titles.csv`. It can also read titles you copied by hand, keep only roles in your city, and compare with an earlier day.
- `rules.mjs`: the rules for what counts as a design role and at what level, unchanged from 12 October.
- `titles-template.csv`: the shape for titles copied by hand from any job board.
- `results-template.md`: the empty results table, if you'd rather count by hand.
- `example-2026-10-12/`: the 12 October count, produced by `count.mjs` from that day's saved titles, with every design role and every title left out.
- `runs/2026-10-30/`: the 30 October run, made with the two commands below. `raw/` holds each board's titles, locations and years asked; `fetch-log.json` holds the request log; `results.md` and `results.json` hold the count and its comparison with 12 October; `count-stdout.txt` is what `count.mjs` printed.

## Run it

You need Node 18 or later. Nothing is installed and no key is needed, because the three job-board systems publish their boards without a login.

Repeat the 12 October count on the same 80 boards:

```
node fetch.mjs
node count.mjs runs/<today> --compare example-2026-10-12/results.json
```

`fetch.mjs` takes about three minutes, because it waits 1.5 seconds between requests. The comparison uses only the boards counted both times, since some boards will have closed or moved. It reports the share open to beginners as counted and with each day's largest beginner hirer left out, and says whether both are at least a quarter lower than on 12 October, which is how the forecast in the essay is scored.

### In your own market

There are three ways, depending on where the companies near you post their jobs.

1. **Companies that use Greenhouse, Lever or Ashby.** Open a company's careers page. If its job links go to `boards.greenhouse.io/<name>`, `jobs.lever.co/<name>` or `jobs.ashbyhq.com/<name>`, then `<name>` is its board. Write your list in the same shape as `boards.json` and run `node fetch.mjs my-boards.json`, then `node count.mjs runs/<today>`.
2. **The same boards, only the roles in your city.** Add a location filter, for instance `node count.mjs runs/<today> --where "Dubai|Abu Dhabi|United Arab Emirates|UAE"`. Many large companies list roles in several countries, so check that the filter catches how they write your city.
3. **Any other board.** Copy every open role from the boards you chose into a file shaped like `titles-template.csv`: company, title, location, and the years of experience the posting asks for if it names a number. Then run `node count.mjs --csv my-titles.csv --date <the day you copied them>`. Copy all roles, not only design ones, if you want the share of all roles.

Write your list down before you look at any results, and keep it fixed when you count again. A list chosen after seeing the numbers can be made to show anything.

### Be a good guest

`fetch.mjs` sends one request at a time, with a pause between requests and a User-Agent that says what it is. Don't shorten the pause or run it in parallel. `count.mjs` sends no requests. Posting text is read in memory to find the years of experience and is never saved; no names, recruiter details or salaries are kept. Check each board's terms before you publish anything built on it.

## Read the result

- **Open to beginners** means the title names an internship (or a co-op or apprenticeship), a graduate, new-grad, university, entry-level or early-career place, or the level junior, associate or I. "Associate director" and "associate manager" don't count. A plain "Product Designer" has no level and counts as "no level in the title", even though some of those roles would take a beginner.
- **Check the sorting before you trust it.** Read `design-roles.csv` and `excluded-titles.csv`. Every title left out carries the rule that left it out. If any title is marked unplaced, decide it by hand and say what you decided. On 30 October three titles were unplaced, and none was a design role: a research scientist in antibody design, a games creative director and a workplace design coordinator. Read the beginner titles too: see "Known quirks" for one that wasn't a design role.
- **Years asked** is the largest minimum number of years the posting text names: "3–5 years" counts as 3, "5+ years" as 5. It is rough and can pick up a number from an unrelated sentence.
- **Same count, counted differently** shows how much the headline depends on choices: counting distinct titles instead of postings, leaving out the largest beginner hirer, or including game, industrial and learning design. On 12 October, leaving out the largest hirer took the share from 8.3% to 4.9%, because one company posted the same four beginner roles in several cities. On 30 October the same company was the largest beginner hirer again, and leaving it out took the share from 9.0% to 5.7%.

## What it can't show

- **A trend.** One day is one sample, and two days in the same month are two samples. If many American companies post next summer's internships in the autumn, as the essay's author believes but hasn't checked, that would raise the count in October. 9 of the 23 beginner roles on 12 October named 2027, and 12 of the 25 on 30 October did.
- **Hires.** One posting can hire several people; some postings stay open all year.
- **Roles that never reach a public board.** In the experience of Rishi Sharma, whose count is cited in the essay, junior designers arrive through a referral or an internship more often than through a public listing.
- **Cause.** A thin bottom rung fits several explanations: agents doing beginners' work, companies hiring fewer people at every level, or beginners being hired in ways a board doesn't show. A count of postings can't tell them apart, and two counts a year apart can't either.

## Known quirks

The rules are the ones used on 12 October, so that a new count can be compared with that day. Three quirks are kept on purpose:

- The hardware rule contains "industrial design" and is checked first, so the industrial-design rule never fires. On 12 October one "Industrial Designer" title was left out under the hardware rule. Counted with the neighbouring disciplines instead, that variant would be 27 of 304 rather than 27 of 303, which is 8.9% either way.
- A bare "Design Intern" matches no design family and is reported as unplaced. On 12 October and 30 October every intern title named its discipline, so none was unplaced.
- Each title is checked against the exclusions first and then against the design families. So "Principal Software Engineer, Ads User Experience" (Roblox) is left out as an engineering role on both days, but a title that no exclusion catches and that names user experience counts as a UX role, whatever its discipline. On 30 October "Product Management Intern, End User Experience - Winter 2027" (1Password) was counted as a beginner UX role, though it is a product-management internship: the engineering rule catches "product manager" but not "product management". Left out by hand, the 30 October count is 24 of 276 (8.7%) as counted and 14 of 262 (5.3%) without the largest beginner hirer. The rules weren't changed after seeing this, so the comparison with 12 October still uses the same rules on both days; report the hand-corrected figure beside it, as the essay does.

The 12 October list of 80 was written from memory by an AI agent and leans towards large American technology companies. One company that qualified, Contentful, was left off by mistake; its only design role was a senior manager, so adding it changes no headline number.

## How it was tested

- On 29 October 2026, `count.mjs` re-counted the 12 October titles saved in `experiments/p19-who-trains-the-judge/out/raw/` and matched every one of the 19 figures in that experiment's `summary.json` exactly.
- On 30 October 2026, `count.mjs` re-counted the saved 12 October titles again (`node count.mjs ../../experiments/p19-who-trains-the-judge/out --out <scratch folder>`). All 19 figures matched `summary.json`, and `results.json` matched `example-2026-10-12/results.json` in every field but the one-line method.
- On 30 October 2026, `node fetch.mjs` fetched all 80 boards between 10:36:37 and 10:39:17 UTC (the time each request started). All 80 answered HTTP 200 with 13,363 open roles. `node count.mjs runs/2026-10-30 --compare example-2026-10-12/results.json` then counted them and compared them with 12 October on the 80 boards counted both days: 25 of 277 open to beginners (9.0%) against 23 of 277 (8.3%), and 15 of 263 (5.7%) against 13 of 263 (4.9%) without the largest beginner hirer. Both shares were higher, so the forecast's fall of a quarter was not met. The essay reports this run as its second day's count.
- On 30 October 2026 the same count was run again from the saved titles in `runs/2026-10-30/raw/`, writing to a scratch folder with `--out`. All four files and the printed report were identical, byte for byte, to the ones in `runs/2026-10-30/`.
- On 30 October 2026 the hand-copied path was tested on `titles-template.csv` and on a made-up file of six titles, four in Dubai and two in London (`node count.mjs --csv <file> --date 2026-10-30 --out <scratch folder>`). The template gave 2 design roles, 1 of them open to beginners. The six titles gave 4 design roles, 2 of them open to beginners, and reported the bare "Design Intern" as unplaced. With `--where "Dubai"` the two London roles were left out, and the count was 2 design roles, 1 open to beginners.

No model is called. A run of the 80 boards costs nothing but about three minutes and 80 requests.
