---
name: gtm-ai-cli
description: This skill should be used when searching for or enriching companies and contacts, surfacing buyer intent signals, fetching real-time business events (scoops) or company news, reading or updating GTM context (offerings, ICPs, personas, competitors), looking up reference values (industries, metros, intent topics, tech products), or doing any ZoomInfo / GTM data lookup from the terminal. Activates when the user asks to "find companies", "search contacts", "enrich a contact", "find lookalike companies", "research a company / person", "get intent signals", "find scoops", "fetch company news", "show our GTM context", "look up industry codes", or any task involving ZoomInfo data lookup from the terminal.
version: 0.1.0
---

# GTM AI CLI Skill

Use the `gtm` CLI to drive ZoomInfo's GTM AI MCP from the terminal: search and enrich companies and contacts, surface intent signals, find real-time business events (scoops), pull news, read/update your organization's GTM context, and look up reference values. Output defaults to JSON for `jq` piping; use `-f, --format` to switch to `jsonl`, `csv`, `yaml`, or `table`.

## Authentication

Before running any command, confirm the user is authenticated:

```bash
gtm auth whoami
```

If not logged in:

```bash
gtm auth login
```

To force a fresh OAuth registration (rare — only needed if the saved client_id is stale):

```bash
rm ~/.config/gtm-ai/client_id ~/.config/gtm-ai/credentials
gtm auth login
```

## The `lookup` workflow — read this first

ZoomInfo's search endpoints reject free-text industry/metro/topic strings with HTTP 422. **Always look up the canonical ID first**, then pass it to the search filters. Treat `gtm lookup` as a required first step for any filtered search.

```bash
# Industries containing "software"
gtm lookup --field industries --fuzzy software -f table

# Management levels (canonical names: Board Member, C Level Exec, VP Level Exec, Director, Manager, Non Manager)
gtm lookup --field management-levels -f table

# Intent topics
gtm lookup --field intent-topics --fuzzy cloud -f table

# Tech products require TWO lookups: vendor first, then products under that vendor
gtm lookup --field tech-vendors --fuzzy hubspot
gtm lookup --field tech-products --vendor "HubSpot, Inc"

# Metro regions (US + Canada only)
gtm lookup --field metro-regions --fuzzy "san francisco"
```

Valid `--field` values: `industries`, `metro-regions`, `states`, `countries`, `continents`, `management-levels`, `departments`, `job-functions`, `employee-count`, `revenue-ranges`, `company-types`, `company-rankings`, `intent-topics`, `scoop-topics`, `scoop-types`, `scoop-departments`, `news-categories`, `naics-codes`, `sic-codes`, `tech-vendors`, `tech-products`, `tech-categories`, `tech-skills`, `hashtags`, `buying-groups`, `board-members`, `years-of-experience`, `sub-unit-types`, `job-titles`.

The response is keyed by field name: `.<fieldName>.data[]` where each entry is `{ attributes: { name }, id, type }`. Pass the `id` value (not `attributes.name`) into search filters.

## Commands

### Companies

**Search.** Requires at least one filter.

```bash
gtm companies search --name "ZoomInfo"
gtm companies search --industry software --metro "CA - San Francisco" --employees "100to249,250to499"
gtm companies search --type public --country "United States" --revenue-min 1000000 --sort -revenue --page-size 10
gtm companies search --tech "<tech_product_id>" --metro "MA - Boston"
gtm companies search --naics "541511,541512"
```

Common filters: `--name`, `--domain`, `--industry`, `--metro`, `--state`, `--country`, `--continent`, `--zip`, `--employees`, `--employees-min`/`-max`, `--revenue`, `--revenue-min`/`-max`, `--type`, `--ticker`, `--tech`, `--naics`, `--sic`, `--funding-min`/`-max`, `--funding-start`/`-end`, `--sort`, `--page`, `--page-size`. Run with no flags to see the full list and a guidance error.

**Enrich.** Provide any identifier (most accurate: `--id`).

```bash
gtm companies enrich --id 344589814
gtm companies enrich --domain stripe.com
gtm companies enrich --name "Stripe"
gtm companies enrich --ticker NVDA
gtm companies enrich --domain stripe.com --fields name description website revenue employeeCount industries

# Bulk: up to 10 via --file (JSON array of identifier objects)
gtm companies enrich --file ./companies.json
```

The `--fields` flag controls which fields the MCP returns. Valid values (subset): `name`, `description`, `website`, `phone`, `street`, `city`, `state`, `country`, `revenue`, `revenueRange`, `employeeCount`, `employeeRange`, `industries`, `primaryIndustry`, `companyFunding`, `recentFundingAmount`, `recentFundingDate`, `totalFundingAmount`, `foundedYear`, `socialMediaUrls`, `ultimateParentName`, `parentName`. Omit `--fields` to get the defaults (`name`, `description`, `city`, `state`, `country`, `revenue`, `industries`).

**Find similar companies** (ML-ranked look-alikes — useful for territory planning, lookalike prospecting):

```bash
gtm companies similar --id 344589814
gtm companies similar --name "Stripe"   # less accurate; CLI resolves a best-match company first
```

### Contacts

**Search.** Requires at least one filter.

```bash
gtm contacts search --first-name Henry --last-name Schuck
gtm contacts search --job-title "CFO OR VP Finance OR Treasurer" --employees "1000to4999,5000to9999"
gtm contacts search --management-level "C Level Exec,VP Level Exec" --company-id 344589814
gtm contacts search --management-level Manager --department "Engineering & Technical" --industry software --metro "CA - San Francisco" --required email,phone
gtm contacts search --management-level "VP Level Exec" --department Sales --accuracy-min 90
```

Common filters: `--first-name`, `--last-name`, `--full-name`, `--email`, `--job-title` (free-text OR queries OK), `--exact-job-title`, `--management-level` (canonical names only — use lookup), `--department`, `--job-function`, `--company-id`, `--company-name`, `--company-domain`, `--industry`, `--metro`, `--state`, `--country`, `--employees`, `--revenue`, `--tech`, `--accuracy-min`/`-max` (70-99), `--required` (subset of `email,phone,directPhone,mobilePhone,personalEmail`), `--executives-only`, `--sort`, `--page`, `--page-size`.

**Enrich.** Valid identifier combinations:

```bash
gtm contacts enrich --id 1260398587                                      # most accurate
gtm contacts enrich --email henry@zoominfo.com
gtm contacts enrich --phone 555-303-1234
gtm contacts enrich --first-name Henry --last-name Schuck --company "ZoomInfo"
gtm contacts enrich --full-name "Henry Schuck" --company-id 344589814
gtm contacts enrich --email jane@acme.com --fields phone jobTitle managementLevel email

# Bulk: up to 10 via --file
gtm contacts enrich --file ./contacts.json
```

Returns business-verified data only (corporate emails / business phones). The `--fields` flag is a comma-separated list. Default returns: `firstName`, `lastName`, `email`, `companyId`, `companyName`.

**Similar contacts** (people who look like a reference person):

```bash
gtm contacts similar --person-id 1260398587
gtm contacts similar --person-id 1260398587 --company-id 239305146   # similar contacts within Salesforce
```

**Recommended contacts** at a target company, based on your account's interaction history:

```bash
gtm contacts recommended --company-id 344589814 --use-case PROSPECTING
gtm contacts recommended --company-id 344589814 --use-case DEAL_ACCELERATION
gtm contacts recommended --company-id 344589814 --use-case RENEWAL_AND_GROWTH
```

Use-case picker:
- `PROSPECTING` (default) — cold-start friendly; based on people the user has viewed/copied/exported on the ZoomInfo platform
- `DEAL_ACCELERATION` — similar to contacts in closed-won opportunities (new business)
- `RENEWAL_AND_GROWTH` — similar to contacts in closed-won renewal opportunities

### Intent signals

Every intent call requires `--topics` (1-50 names — use `gtm lookup --field intent-topics` to find exact names).

**Search across all companies:**

```bash
gtm intent search --topics "Cloud Applications" "Java" --signal-score-min 70
gtm intent search --topics "Mobile Apps" --signal-score-min 80 --signal-start 2026-05-01 --signal-end 2026-05-31 --industry software --country "United States"
gtm intent search --topics "AI Agents" --audience-strength-min B --audience-strength-max A
```

**Enrich** — fetch intent for a specific company:

```bash
gtm intent enrich --company-id 344589814 --topics "Cloud Applications" "Java"
gtm intent enrich --name "ZoomInfo" --topics "AI Agents" --signal-score-min 70
gtm intent enrich --website https://www.stripe.com --topics "Payments"
```

Signal scores range 60-100 (higher = stronger interest). Audience strength is A-E (A = largest audience researching). Use `--audience-strength-min E --audience-strength-max A` to include all; tighter ranges narrow to bigger groups.

### Scoops (real-time business events)

Scoops capture funding, M&A, leadership moves, layoffs, product launches, partnerships, awards, hiring plans, and more. Search requires at least one filter.

```bash
gtm scoops search --scoop-types Funding --industry software --metro "MA - Boston" --published-start 2026-05-01 --published-end 2026-05-31
gtm scoops search --scoop-types "New Hire" "Executive Move" --department C-Suite --published-start 2026-05-27
gtm scoops search --scoop-types Layoffs --employees "10000plus" --published-start 2026-01-01
gtm scoops search --scoop-types "Product Launch" --description "artificial intelligence" --published-start 2026-04-01
```

Valid `--scoop-types`: `Earnings`, `Funding`, `Initial Public Offering (IPO)`, `Mergers & Acquisitions (M&A)`, `Divestiture`, `Award`, `Event`, `Facilities Relocation / Expansion`, `Product Launch`, `Partnership`, `Hiring Plans`, `Open Position`, `New Hire`, `Lateral Move`, `Promotion`, `Left Company`, `Layoffs`, `Management Move`, `Executive Move`, `Pain Point`, `Project`, `Commentary`, `Person-Based`.

**Enrich** — get scoops for a specific company:

```bash
gtm scoops enrich --company-id 344589814 --scoop-types "New Hire" Promotion
gtm scoops enrich --name "Stripe" --published-start 2026-01-01
gtm scoops enrich --websites https://www.zoominfo.com https://www.salesforce.com
```

### News

Currently only enrich (no search). Requires `--company-id` (integer).

```bash
gtm news enrich --company-id 344589814 --categories FINANCIAL_RESULTS FUNDING
gtm news enrich --company-id 344589814 --categories PRODUCT --publishing-start 2026-03-01 --publishing-end 2026-05-31
gtm news enrich --company-id 344589814 --categories PERSON
```

Valid `--categories`: `FINANCIAL_RESULTS`, `FUNDING`, `GENERAL_NEWS`, `GENERAL_PRESS_RELEASE`, `MERGER_OR_ACQUISITION`, `PERSON`, `PRODUCT`.

### GTM Context

The org's GTM configuration (offerings, ICPs, buyer personas, competitors, strategic priorities). Reading is free (zero credits). Updates require admin permissions.

```bash
gtm-context get                                                     # compressed (~1k tokens)
gtm-context get --detailed -f yaml                                  # full expanded profiles
gtm-context update --query "Update competitive intelligence" --source "Our main competitors are X, Y, Z…"
gtm-context update --query "Create buyer personas from these interviews" --source-file ./interview-notes.txt
```

The `update` query frames the agent's intent; `--source` / `--source-file` provides the substance to analyze (max ~2,000 words per call). When omitted, the update agent operates on existing configuration directly (good for archive, rename, simple edits).

### Feedback

```bash
gtm feedback submit --category DATA_QUALITY --message "Henry Schuck's company should be ZoomInfo Technologies, not ZoomInfo"
gtm feedback submit --category FEATURE_REQUEST --message "Want a --csv-headers flag to control column order"
```

Categories: `DATA_QUALITY`, `FEATURE_REQUEST`, `ACCESS_ENTITLEMENT_ISSUE`, `OTHER`.

### Raw — universal escape hatch

Use when you need a tool that doesn't have a curated wrapper (currently: `account_research`, `contact_research`).

```bash
gtm raw list-tools -f table                                                          # show every MCP tool the server exposes
gtm raw call account_research --args '{"companyId":"344589814"}'
gtm raw call contact_research --args '{"personId":"1260398587"}'
gtm raw call find_similar_companies --args '{"companyName":"Stripe"}'
```

---

## Output formats

Every subcommand accepts `-f, --format <format>`:

| Format | When to use |
|---|---|
| `json` (default) | Pretty-printed JSON, preserves exact response shape. Pipe to `jq`. |
| `jsonl` | One JSON object per line. Stream into log/data pipelines. |
| `csv` | Flat CSV with headers; one-level-nested objects are dot-flattened (`company.name`), arrays are JSON-stringified. |
| `yaml` | Human-readable diffs of deeply nested responses. |
| `table` | ASCII bordered table. JSON:API envelopes are auto-unwrapped and `attributes` is hoisted to top-level columns. Best for terminal browsing of small responses. |

```bash
gtm companies search --industry software -f table
gtm contacts search --management-level "C Level Exec" -f jsonl > c-level-contacts.jsonl
gtm-context get -f yaml
```

For deeply nested responses, prefer `json` + `jq` or `yaml`. `csv` / `table` will stringify second-level-nested structures into a single cell.

---

## Piping with `jq`

ZoomInfo responses follow JSON:API conventions: `{ data: [...], meta: {...} }` where each item is `{ attributes: {...}, id, type }`. So `jq` queries always go through `.data[].attributes` for the useful fields.

```bash
# Names of every result
gtm companies search --industry software --metro "CA - San Francisco" \
  | jq -r '.data[].attributes.name'

# Sorted by revenue, top 5 names + revenue
gtm companies search --type public --country "United States" --revenue-min 1000000 --page-size 50 \
  | jq '[.data[] | { name: .attributes.name, revenue: .attributes.revenue }] | sort_by(-.revenue) | .[0:5]'

# Email + phone TSV for every contact result
gtm contacts search --company-id 344589814 -f jsonl \
  | jq -r '[.attributes.email, .attributes.phone] | @tsv'

# Top 5 intent signals by score
gtm intent search --topics "Cloud Applications" --signal-score-min 80 \
  | jq '.data | sort_by(-.attributes.score) | .[0:5]'

# Lookup → extract IDs → search
INDUSTRY_IDS=$(gtm lookup --field industries --fuzzy software | jq -r '.industries.data[].id' | paste -sd, -)
gtm companies search --industry "$INDUSTRY_IDS" --metro "CA - San Francisco"
```

---

## Common multi-step workflows

> **Doing many calls? Pick the cheapest option in this order:**
>
> 1. **Native bulk (`--file`) — preferred.** `enrich` accepts up to 10 identifiers in a single MCP call, so there's no loop and no rate concern. Use it whenever you're enriching a set. (Only `enrich` has bulk mode — `search`/`similar`/`scoops`/`intent`/`news` are single-call per invocation.)
>     ```bash
>     gtm companies enrich --file ./companies.json   # up to 10 in one round trip
>     gtm contacts enrich  --file ./contacts.json
>     ```
>     For >10, split into chunks of 10.
> 2. **Bounded parallelism — alternative to the sleep loop.** For commands without bulk mode (e.g. enriching from search IDs), fan out with a *small* concurrency cap instead of a sequential loop:
>     ```bash
>     gtm companies search --industry "$IDS" --page-size 20 \
>       | jq -r '.data[].id' \
>       | xargs -P4 -I{} gtm companies enrich --id {}     # max 4 in-flight
>     # or: ... | parallel -j4 gtm companies enrich --id {}
>     ```
>     Keep the cap small (`-P3`/`-P4`) — unbounded fan-out trips a 429 just like a tight loop.
> 3. **Sequential loop — fallback.** If you loop one call per item, sleep **at most 1 second** between successive calls; never longer.
>
> Parallelism and the 1s-sleep rule both exist to respect the subscription's per-tier rate limits, so they're mutually exclusive: use bounded parallelism **or** a sequential ≤1s-sleep loop, never both, and never unbounded fan-out.

### Search → enrich (top results)

```bash
gtm companies search --industry software --metro "CA - San Francisco" --page-size 3 \
  | jq -r '.data[].id' \
  | xargs -I{} gtm companies enrich --id {}
```

### Lookalikes → enrich

```bash
gtm companies similar --id 344589814 \
  | jq -r '.data[0:10][].id' \
  | xargs -I{} gtm companies enrich --id {} --fields name domain employeeCount revenue industries
```

### Export to spreadsheet

```bash
gtm contacts search --management-level "VP Level Exec" --department Sales --company-id 344589814 -f csv > vp-sales.csv
```

### Intent signal monitoring loop

```bash
# Daily run: companies showing strong intent for our topics, exclude those we already touched
gtm intent search --topics "Cloud Applications" "Data Warehouse" --signal-score-min 80 --signal-start "$(date -v-7d +%Y-%m-%d)" \
  | jq '.data[] | { company: .attributes.companyName, score: .attributes.score, topic: .attributes.topic }'
```

---

## JSON Response Keys

Every MCP search/enrich endpoint returns JSON:API shape (`{ data: [...], meta: {...} }`). Each item under `.data[]` has `{ attributes, id, type }`.

| Command | Top-level key | Item shape |
|---|---|---|
| `companies search` / `similar` | `.data[]` | `{ attributes: { name, city, country, revenue, employeeCount, … }, id, type:"Company" }` |
| `companies enrich` | `.data[]` (one per input) | `{ attributes: { …enriched fields per --fields }, id, type:"Company" }` |
| `contacts search` / `similar` / `recommended` | `.data[]` | `{ attributes: { firstName, lastName, jobTitle, email, phone, managementLevel, company:{id,name}, hasEmail, hasPhone, … }, id, type:"Contact" }` |
| `contacts enrich` | `.data[]` (one per input) | `{ attributes: { …enriched fields per --fields }, id, type:"Contact" }` |
| `intent search` / `enrich` | `.data[]` | `{ attributes: { topic, score, audienceStrength, signalDate, companyName, companyId, … }, id, type:"Intent" }` |
| `scoops search` / `enrich` | `.data[]` | `{ attributes: { scoopType, description, link, originalPublishedDate, companyName, … }, id, type:"Scoop" }` |
| `news enrich` | `.data[]` | `{ attributes: { title, url, publishingDate, category, snippet, … }, id, type:"NewsArticle" }` |
| `lookup` | `.<fieldName>.data[]` | `{ attributes: { name }, id, type }` — **pass `id` (not `attributes.name`) into search filters** |
| `gtm-context get` | `.result` | `{ user, organization, buyerPersonas:[…], idealCustomerProfiles:[…], competitors:[…], offerings:[…] }` |
| `gtm-context update` | `.result` | varies by update operation |
| `feedback submit` | top-level | confirmation object |
| `raw list-tools` | top-level array | `[{ name, description, inputSchema }, …]` |
| `raw call <tool>` | varies | depends on the tool — fall back to `-f yaml` to inspect |

Pagination lives at `.meta.page.{number, total}` and `.meta.totalResults` for searches.

---

## Important behaviors

- **Search commands refuse to run with zero filters.** Running e.g. `gtm companies search` with no flags exits with a guidance error listing common filters. This is intentional — unfiltered searches return unbounded uninteresting results.
- **Filter values must be canonical IDs / names** from the `lookup` endpoint. Free-text industry / metro / topic strings return HTTP 422.
- **Bulk enrich caps at 10 entries per call.** Prefer `enrich --file` (one MCP call for up to 10 identifiers) over looping. For larger sets, batch into chunks of 10.
- **For high-volume calls, prefer in this order:** (1) native bulk `enrich --file`; (2) bounded shell parallelism (`xargs -P4` / `parallel -j4`); (3) a sequential loop sleeping **at most 1 second** between calls. Use bounded parallelism **or** the ≤1s-sleep loop, never both, and never unbounded fan-out — both guards exist to respect the subscription's rate limits. See the callout at the top of *Common multi-step workflows*.
- **Some MCP tools double-encode their response payload** (the text content block is a JSON string of a JSON object). The CLI handles this transparently — agents shouldn't need to care.
- **`lookup` for `tech-products` requires a two-step flow:** first lookup `tech-vendors` with a fuzzy match, then lookup `tech-products` with `--vendor "<exact vendor name>"`. Passing `--field tech-products` without `--vendor` returns nothing useful.
- **Compliance:** This skill drives ZoomInfo data. Apply data-minimization (only fetch what you need), respect the rate limits of the user's subscription tier, and never use the data for unsolicited bulk outreach without a legal basis. ZoomInfo's Terms of Service apply to everything accessed through this CLI.
