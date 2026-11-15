# What the meter counts: the instrument pack

This pack reads the public pricing pages of fifteen AI vendors and sorts them by what each one charges for: a seat, usage, outcomes or accepted outputs. For every vendor it keeps the exact lines on its own pages that show how it charges, and a script re-reads those pages and checks the lines are still there. It also holds the forecast ledger from "From seats to outcomes", with a check on each forecast's starting point.

A result from this pack is one reading of public list prices. It shows what the pages say on the day you run it. It can't show what anyone pays under contract, and the sorting is a person's reading of the quoted lines, which the script then checks.

## What's in it

- `vendors.json`: the fifteen vendors, plus one example of a tool you pay for yourself, with each vendor's pages (40 in all), the 109 lines that show what it charges for, and a short summary. Each line is marked with what it shows: `seat`, `usage`, `outcome`, `accepted-output`, `definition` (what the vendor counts) or `context`.
- `watch.mjs`: reads every page one at a time, checks each quoted line, counts the pricing words on each page, runs the forecast checks and writes the results.
- `ledger.json`: the four forecasts, each with its outcome, P50 and P80 dates, first review, what would prove it wrong, its starting point on 29–30 October 2026, and the checks `watch.mjs` runs for it.
- `ledger.mjs`: lists the forecasts due on a review date, scores the ledger's calibration, and prints it as a table.
- `runs/2026-10-30/`: the run of 30 October 2026: `table.md`, `signals.md` and `results.json`.

## Run it

You need Node 18 or later. Nothing is installed, no key is needed and no model is called.

```
node watch.mjs
```

It takes about two minutes and writes `runs/<today>/table.md`, `signals.md` and `results.json`. Compare `table.md` with `runs/2026-10-30/table.md` to see what changed since the essay.

Some options:

- `node watch.mjs --only intercom,zendesk` reads just those vendors.
- `node watch.mjs --keep-pages` also saves the text of every page in `runs/<today>/pages/`, so you can read exactly what the script read.
- `node watch.mjs --no-archive` never falls back to the Wayback Machine (see below).
- `node watch.mjs --out runs/my-name` writes somewhere else.

For the ledger:

```
node ledger.mjs table
node ledger.mjs due 2027-03-31
node ledger.mjs score 2028-12-31
```

`due` lists the open forecasts to review on that date, with how far away their P50 and P80 dates are. `score` reads the rows marked `hit` or `miss` and reports how many came true by their P50 and P80 dates. `table` prints the ledger.

### With your own tools

The last entry in `vendors.json` is Ollama, a plan I pay for myself. Replace it with yours, or start a file of your own in the same shape:

1. For each tool, list the pages that state its price: the pricing page, the billing help, the terms.
2. Copy the line on each page that shows what you pay for, exactly as written, and mark what it shows. Copy the line that says what the vendor counts as well, and mark it `definition`.
3. Run `node watch.mjs --vendors my-tools.json --ledger none`. The `--ledger none` skips the essay's forecast checks.
4. Run it again next quarter. A line that has gone missing is the first sign that what you're paying for has changed.

Then ask each vendor three questions:

- What exactly do you count, and who decides whether it counted?
- Can I see every unit I was charged for, and how do I contest one?
- Can I cap the meter, and what happens when I reach the cap?

## Read the result

- **Charges for** is my reading of the quoted lines. **Confirmed today** says, for each way of charging, whether at least one line showing it is still on the vendor's pages. **Lines found** counts every quoted line, the definitions and context included.
- **Read** says how the pages were read: `live` from the vendor's site, or `archive <date>` from a Wayback Machine copy. Pages marked `history` in `vendors.json` are dated Wayback copies on purpose, because they show an old price.
- **Lines not found today** lists every missing line. Read each one on the page before concluding anything. A missing line means the page changed, the page refused the read, or the line moved behind a script, and only the first is news.
- **Pricing words** counts words that suggest each way of charging, such as "per user", "credits" or "per resolution", on the first read of each page. They show where to look. A long marketing page can say "tokens" many times without charging for them.
- **signals.md** runs each forecast's checks. Each looks for a phrase on a page read in this run and compares it with the starting point in `ledger.json`: "as on the baseline" means nothing to read, "changed: read the page" means a person should read it before the next review. No check scores a forecast by itself.

A quoted line counts as found if it appears on the page with any difference in capitals, curly or straight quotation marks, dashes or spacing. The script looks first in the page's visible text and then in its source, which also holds any text kept inside the page's scripts. Text a page loads after it opens is in neither, so a line like that is reported missing.

## Score the ledger

At each quarter end from a forecast's first review, read the pages its checks point to, and mark the row `open`, `hit` (with `hit_on` and the page as `evidence`) or `miss`. Keep misses in the ledger with a one-line reason. Calibration is read across the whole ledger: of the forecasts whose P50 date has passed, about half should have come true by it, and of those whose P80 date has passed, about four in five. F-002 also has a date before which a hit would be too fast; `score` counts that as a miss.

`made_on` stays empty until the essay is published, because a forecast counts from the day readers can see it.

## What it can't show

- **What buyers pay.** These are list prices on public pages. Large buyers negotiate, and contracts aren't visible.
- **Change over time, from one run.** One run is one reading. Two runs show that a page changed, not why.
- **Whether a way of charging costs a buyer more or less.** Nothing here measures the bill.
- **How often a billed outcome was a wrong answer.** The pages say what the vendor counts. They don't say how often what it counted was wrong.
- **Prices behind a sign-in, in a picture, or drawn entirely by script.** Those pages need reading by hand.

## Known quirks

- **Intercom now calls itself Fin, and Salesforce has agreed to buy it.** Its pricing and help pages are still on intercom.com and still say Intercom, so the pack does too. If the pages move after the purchase, point `vendors.json` at the new ones and keep the same quoted lines. Forecast F-004 follows Fin's list price wherever it's sold.
- **Intercom serves two designs of its pricing page at random.** One shows the voice price ($1.99 per voice outcome) and a line saying a reopened conversation is refunded; the other doesn't. When a quoted line is missing from a live read, the script reads the page again, up to five reads, and counts a line as found if any read shows it. Five reads still miss the voice design about once in 32 runs, so if that line is the only one missing, run the script again before concluding anything. The refund rule is quoted from Intercom's help page, which is the same on every read.
- **microsoft.com refuses some automated reads.** It answers curl with a page that says "Your request has been blocked" (with HTTP status 200), which is why the reading of 29 October missed its current price. On 30 October 2026 microsoft.com let the script's User-Agent through, so the script reads the Copilot pricing page live. If that changes, the script sees the message and reads the latest Wayback copy instead.
- **openai.com and chatgpt.com refuse automated reads.** On 30 October 2026 both answered the script and a plain headless browser with HTTP 403, so the script reads their latest Wayback Machine copies. That day those were from 29 October 2026 (ChatGPT) and 18 June 2026 (OpenAI's business pricing), so treat the second as four months old.
- **Google shows Workspace prices in your local currency**, partly drawn by script. The check uses the line "Price is per user/month", not a price.
- **Some pages draw part of their content inside a shadow root** (`<template shadowrootmode="open">`), which browsers show. The script keeps that text and drops other templates, which are hidden. Gorgias draws its price cards this way.
- **The Wayback Machine sends larger response headers than Node's `fetch` accepts.** The script falls back to Node's own `http` module for those reads.
- **When a live page refuses a read** (an error, a status other than 200, under 400 characters of text, or a "blocked" message), the script reads the latest Wayback Machine copy instead and says so in the Read column. Use `--no-archive` to turn that off. The service that finds the latest copy sometimes answers with an error page, so the script asks it up to three times.

## Be a good guest

The script reads one page at a time, waits 1.5 seconds between requests and sends a User-Agent that says what it is. Don't shorten the pause or run it in parallel. It keeps no personal data; page text is kept only if you ask for it with `--keep-pages`, and then only on your machine.

## How it was tested

- On 29 October 2026 every price and definition used in the essay was read by hand on the vendor's own page, or on a dated Wayback Machine copy of it.
- On 30 October 2026 at 11:01 UTC, `node watch.mjs` read 34 pages and found all 78 quoted lines, and all 17 forecast checks were as on the baseline.
- Later that morning four more pages went in: Salesforce's Help Agent price and its announcement, Salesforce's agreement to buy Fin, and Zendesk's article on disputing a resolution's tier. Forecasts F-002, F-003 and F-004 were reworded to match. At 11:50 UTC `node watch.mjs --keep-pages` read all 38 pages and found all 101 lines, and all 19 forecast checks were as on the baseline.
- The first try of that run found 98 of 101 lines and flagged two checks. Both causes were faults in the script, now fixed: the Wayback lookup for OpenAI's two pages answered once with an error page (the script now asks again), and a check missed a phrase on Zendesk's page because a link split it across two lines of text (checks now read the text with its line breaks as spaces).
- After the title of F-003 and Zendesk's summary were reworded, the same command ran again at 12:09 UTC, took 1 minute 56 seconds and had the same result.
- An independent check of the essay's claims then found that Gorgias publishes its price on its pricing page, so that page went in with six more lines: 39 pages and 107 lines in all. The run at 12:24 UTC found all 107, but two of Gorgias's lines, its prices per ticket and per automated interaction, only in the page source. Gorgias draws its price cards inside a shadow root, which browsers show and the script had dropped as hidden; it now keeps that text.
- The run at 12:30 UTC found 106 of 107. The missing line was Intercom's voice price: all three reads had drawn the design without it. The script now reads up to five times.
- The run at 12:32 UTC took 1 minute 59 seconds. It read all 39 pages and found all 107 lines in the pages' text, and all 19 forecast checks were as on the baseline. Intercom showed its voice design on the first read, so the extra reads weren't needed.
- Microsoft's Copilot pricing page then went in, with its two price lines, after a test showed the script could read it: three reads with the script's User-Agent returned the page and its price, while curl still got the blocked page. That made 40 pages and 109 lines, and F-001 gained a check that Microsoft 365 Copilot is still sold per user.
- The run at 13:08 UTC found 106 of 109 and flagged one check. The Internet Archive was briefly offline, so the lookups for OpenAI's two pages failed all three tries and those pages weren't read. Once the archive answered again, the run at 13:13 UTC took 2 minutes 10 seconds. It read all 40 pages and found all 109 lines in the pages' text, and all 20 forecast checks were as on the baseline; Intercom took two reads.
- `results.json` also kept a snippet of page text around each pricing word, which copied unrelated text into the results, such as customer stories. Nothing used the snippets, so the script now keeps only the counts. The run at 13:23 UTC lost OpenAI's two pages again: by then the archive's lookup was answering "429 Too Many Requests" after a day of test runs. After a pause of about ten minutes, the run at 13:36 UTC took 1 minute 58 seconds. It read all 40 pages and found all 109 lines in the pages' text, and all 20 forecast checks were as on the baseline; Google's pricing page took two reads and Intercom's three. That run is in `runs/2026-10-30/` (the page texts stay on the machine that ran it).
- The first run of all, before the one at 11:01 UTC, found 68 of 73 lines. The five misses were the three kinds a reader will meet: an archived page the script couldn't read (the header limit above, now handled), a page that had changed overnight (GitHub corrected "an GitHub Enterprise Cloud license" to "a GitHub…", so the quoted line was updated), and Intercom's second design (now read again).
- The re-reading was tested on a page served locally in two alternating designs. With up to five reads, a line on both designs was found on 5 of 5 reads, a line on one design on 2 of 5, and a line on neither was reported missing after five reads. The same test with three reads, the earlier limit, gave 3 of 3, 1 of 3 and missing.
- `ledger.mjs` was run with `table`, `due 2027-03-31` and `score`, and `score` was checked by hand on a made-up ledger with a hit before P50, a hit between P50 and P80, a miss and a hit that was too fast.
