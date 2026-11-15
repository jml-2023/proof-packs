# Design roles open to beginners: one day's sample, 2026-10-12

**What this is.** A count of the open roles on 80 job boards on 2026-10-12, from the public job-board APIs of Greenhouse, Lever and Ashby, fetched one request at a time on 12 October 2026 between 13:37 and 13:40 UTC, with the same fetching and parsing code that fetch.mjs uses (the original script is experiments/p19-who-trains-the-judge/fetch-boards.mjs). Levels come from the job title alone. It is one day's sample: it shows no trend, and it can't show what caused any of these numbers.

## Headline

| | Count |
|---|---|
| Boards counted | 80 |
| Open roles of every kind | 13,191 |
| Design postings | 277 (2.1% of all roles), at 60 companies |
| **Open to beginners** (intern, graduate or entry level, junior, associate, level I) | **23 of 277 (8.3%)**, at 9 companies |
| Senior and above (senior, lead, staff, principal, manager or director) | 179 (64.6%) |
| Postings that name the years of experience they want | 168; of those, 129 ask for five or more (median 6) |

## By level

| Level | Postings | Distinct titles per company |
|---|---|---|
| intern | 13 | 10 |
| new grad or entry | 9 | 6 |
| junior | 1 | 1 |
| associate | 0 | 0 |
| level I | 0 | 0 |
| no level in the title | 75 | 69 |
| senior | 60 | 50 |
| lead | 16 | 14 |
| staff | 67 | 57 |
| principal | 7 | 7 |
| manager or director | 29 | 27 |

## Where the beginner roles are

By company: Coinbase 2, Databricks 2, Deliveroo 1, DoorDash 2, Figma 2, Lyft 1, Palantir 10, Pinterest 1, Roblox 2.

- Coinbase: Product Design Intern
- Coinbase: User Research Intern
- Databricks: Product Design Intern (2027 Start)
- Databricks: Product Design New Grad (2027 Start)
- Deliveroo: Junior Designer - Kuwaiti National Only
- DoorDash: Product Design, Entry-Level (2027 start)
- DoorDash: Product Design, Intern (Summer 2027)
- Figma: Early Career, Product Designer (2027)
- Figma: Product Design Intern (2027)
- Lyft: UX Research Intern (Summer 2027)
- Palantir: Product Designer, Internship
- Palantir: Product Designer, Internship - US Government
- Palantir: Product Designer, New Grad
- Palantir: Product Designer, New Grad - US Government
- Pinterest: UX Quantitative Research Intern (USA)
- Roblox: [2027] Associate Product Designer, Early Career
- Roblox: [Summer 2027] Product Design Intern

## Same count, counted differently

| Variant | Design postings | Open to beginners | Share |
|---|---|---|---|
| As counted | 277 | 23 | 8.3% |
| With game, industrial and learning design | 303 | 27 | 8.9% |
| Distinct titles per company | 241 | 17 | 7.1% |
| Without the largest beginner hirer (Palantir) | 263 | 13 | 4.9% |
| Product-designer titles only | 158 | 19 | 12.0% |

## Check the sorting

116 titles were caught by the wide net and left out, each with a named rule (excluded-titles.csv). 0 titles matched no family. Read design-roles.csv before you trust the level counts.

## What this can't show

- A trend. It is one day. Count again on the same boards, in the same month of the year, before you say anything moved.
- Hires. One posting can hire several people, one role can be posted in several cities, and some postings stay open all year.
- Roles that never reach a public board. Many beginners arrive through referrals and internships.
- Cause. A thin bottom rung fits several explanations, and a count of postings can't tell them apart.

*Written by count.mjs (packs/count-the-entry-roles). No model was called.*
