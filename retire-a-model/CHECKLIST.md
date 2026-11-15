# When to retire a model: the checklist

The model a step depends on is really three things: a **name** (the model id in your code), a **host** (the company's
service that answers the call) and, if you use one, a **router** that picks the host for you. Each can change without
your code changing. This checklist is for one person or a small team running steps on hosted models. Go through it for
every step that calls a model.

## 1. Write the dependency down

For each step, one line:

| Step | Name in the code | Hosts it can reach | Who picks the host | Fallback | The cases you test it on | Last trial |
|---|---|---|---|---|---|---|

`models.json` is this list for `watch.py`. If you can't fill in "the cases you test it on", start there: a handful of
real inputs with the answer you expect, including every input that has ever failed.

## 2. Signs that a model is on its way out

Any one of these means: run the trial (section 3) this week.

- **A date.** The provider sets a shutdown date, or OpenRouter sets an `expiration_date` (`watch.py` lists the ones it
  can see). Read the provider's page for each host you can reach: on 30 October 2026, Google gave Gemini 3.7 Flash a
  retirement date of 28 January 2027 on Vertex AI, while its Gemini API page said the same name already routed to
  3.8 Flash, and OpenRouter's list gave it no date at all. A provider's earliest shutdown date can also move.
- **A re-pointed name.** The provider's page says the name now routes to a newer model, or you call an alias such as
  `-latest`. Your code still says the old name, and the router's list still shows the old date and price.
- **A new kind of failure on your own inputs.** Refusals, replies cut off after a few words, empty replies, a format
  you didn't ask for. Count them per host, not just per model.
- **A different host.** The router starts sending your calls somewhere else, a host's status drops, or a host is added
  or removed. The same model can behave differently at two hosts of the same company.
- **A price change**, at the list price or at the host you're actually sent to, beyond what you set as your limit.
- **Restricted access**, for instance a model kept only for people who already use it.
- **A better candidate.** Something cheaper, faster or steadier passes your trial.

## 3. The trial, before you move or keep anything

1. Use the step's real request: the same instruction, input format and settings. Copy its scoring, don't rewrite it.
2. Send every case several times to the model you use now and to each candidate, as `trial.py` does. Four sends is a
   start; send the input that failed twenty times.
3. Count every outcome: whole answer, cut off, refused, empty, error. A check that only asks "did text come back?"
   will pass a reply cut off after two words.
4. If a model is served by more than one host, run it once pinned to each (`model@host`).
5. Run a set of public cases as well as your own. Your own inputs may be too clean to separate the models: on four of
   my films every candidate passed, and on six public recordings with names in them the cheapest missed nearly three times as
   many words.
6. Check the scorer before you blame the model. A candidate can lose words it heard correctly ("St." for "Saint", an
   accent the script leaves out). `rescore.py` re-counts a saved run with extra word rules applied to every model alike.
7. Compare what the step would decide: how many cases change verdict, as well as the scores.
8. Write down the date, the cost of the trial and how long it took.

## 4. When to retire it

Retire the model from a step when any of these is true, and a candidate has passed the trial:

- the provider has set a date, at the host your calls reach, and the date is closer than your next two trials;
- the name no longer points at the model you trialled, and the model it now points at fails your cases;
- it fails your own cases at the host your calls actually go to, and pinning a host that passes is not possible or
  not reliable;
- a candidate from another company passes the same cases at the same or better quality for clearly less money.

Keep it, and pin the host, when it passes at one host and fails at another. Pinning also chooses which of the
provider's promises you live under: one host may promise the name for a year while the other can re-point it at any
time. Pick the host that passes your cases, and let the trial tell you when the model behind the name changes.

## 5. How to move

1. Change the name in one place. If the request has to change shape, the trial already told you.
2. Pin the host when hosts differ, and turn off the router's fallback to other hosts for that step. Then the router
   can no longer route around that host's outages, so your own fallback has to catch its errors as well as refusals.
3. Make the fallback a model from **another company**, trialled on the same cases. The same company's previous version
   is not a second supplier: its name can be pointed at the model it backs up, or it can retire first.
4. Check the finish reason as well as the text. Treat a safety stop with a few words of text as a refusal.
5. Write down which model and host answered, next to the result, so an odd number can be traced.
6. Keep the old model's name in the code, unused, for one trial period, so you can move back in one line.
7. Run `watch.py` every week and `trial.py` every month, and whenever the watch reports a change.
