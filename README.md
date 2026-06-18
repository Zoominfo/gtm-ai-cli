# GTM AI CLI

A command-line interface for searching [ZoomInfo](https://www.zoominfo.com/) go-to-market (GTM) data. 
Search and enrich companies and contacts, surface intent signals and news, manage GTM context, and pipe results 
through your shell as JSON, JSONL, CSV, YAML, or a table.

## Installation

### Homebrew (macOS and Linux)

The easiest way to install the GTM CLI on MacOS or Linux is using [Homebrew](https://brew.sh/).  

```shell
brew install zoominfo/gtm-ai/gtm-ai-cli
```

To upgrade to the latest version, run

```shell
brew upgrade gtm-ai-cli
```

### NPM

For Windows users or users unable to use Homebrew, you can also install the GTM CLI through NPM
or any other node package installer (yarn, bun, etc.)

Ensure that you install it as a **global** package

```shell
npm install -g @zoominfo/gtm-ai-cli
```

### Download a Prebuilt Binary

Download the latest binary from the [releases](https://github.com/Zoominfo/gtm-ai-cli/releases) page for your platform.
The platforms supported by this tool are:
* macOS w/ Apple Silicon (arm64)
* macOS w/ Intel processor (x64)
* Linux
* Windows

Make the downloaded package executable and place it on your PATH

**macOS and Linux**
```shell
chmod +x gtm-macos-arm64
mv gtm-macos-arm64 /usr/local/bin/gtm
xattr -d com.apple.quarantine /usr/local/bin/apollo #only required on macOS
```

**Windows**
```powershell
Move-Item .\gtm-windows-x64.exe "$env:USERPROFILE\bin\gtm.exe"
```

### From source (Node 18+)

```shell
git clone https://github.com/Zoominfo/gtm-ai-cli.git
cd gtm-ai-cli
npm install
npm run build
npm link        # makes `gtm` available globally
```

## Authentication

OAuth 2.0 + PKCE via your browser. Tokens are saved to `~/.config/gtm-ai/` at mode `0600`.

```shell
gtm auth login    # opens browser to authorize, saves token
gtm auth whoami   # show login status
gtm auth logout   # revoke token and remove saved credentials
```

If you ever need a clean slate (e.g. to re-trigger DCR), remove the saved client:

```shell
rm ~/.config/gtm-ai/client_id ~/.config/gtm-ai/credentials
gtm auth login
```

## Output formats

Every subcommand accepts `-f, --format`. The `table` and `csv` formats auto-flatten JSON:API envelopes (`data: [...]`) and one-level-nested objects (`company.id`, `company.name`); `json`, `jsonl`, and `yaml` preserve the exact response shape.

| Format | When to use |
|---|---|
| `json` (default) | Pretty-printed JSON. Pipe to `jq` for field extraction. |
| `jsonl` | One JSON object per line. Stream into log/data pipelines. |
| `csv` | Flat CSV with headers; nested objects are dot-flattened, arrays are stringified. |
| `yaml` | Human-readable diffs of deeply nested responses. |
| `table` | ASCII bordered table. Best for terminal browsing of small responses. |

```shell
gtm companies search --industry software -f table
gtm contacts search --management-level "C Level Exec" -f jsonl > c-level-contacts.jsonl
gtm-context get -f yaml
```

### Projecting fields with `--select`

Any command that returns records also accepts `--select <paths>` — a comma-separated list of
dotted paths to project from each record, applied before formatting. Handy for narrow CSVs or
quick scans without `jq`. (Distinct from the enrich commands' `--fields`, which selects which
fields ZoomInfo returns server-side.)

```shell
gtm companies search --industry software --page-size 5 --select id,name,revenue -f table
gtm companies search --industry software --select name,company.id -f csv > orgs.csv
```

---

## Commands

### `gtm lookup` — get exact filter values

ZoomInfo's search endpoints reject unknown industry/metro/topic strings with 422. **Always look up the canonical ID first**, then pass it to the search filters.

```shell
# Industries containing "software"
gtm lookup --field industries --fuzzy software -f table

# All management levels (C Level Exec, VP Level Exec, Director, …)
gtm lookup --field management-levels -f table

# Intent topics about cloud
gtm lookup --field intent-topics --fuzzy cloud -f table

# Tech-products requires a two-step lookup (vendor first, then products under that vendor)
gtm lookup --field tech-vendors --fuzzy hubspot
gtm lookup --field tech-products --vendor "HubSpot, Inc"

# Metro regions in California
gtm lookup --field metro-regions --fuzzy "san francisco"
```

Valid `--field` names: `industries`, `metro-regions`, `states`, `countries`, `continents`, `management-levels`, `departments`, `job-functions`, `employee-count`, `revenue-ranges`, `company-types`, `company-rankings`, `intent-topics`, `scoop-topics`, `scoop-types`, `scoop-departments`, `news-categories`, `naics-codes`, `sic-codes`, `tech-vendors`, `tech-products`, `tech-categories`, `tech-skills`, `hashtags`, `buying-groups`, `board-members`, `years-of-experience`, `sub-unit-types`, `job-titles`.

---

### `gtm companies` — search, enrich, find similar

**Search.** Requires at least one filter.

```shell
# By name
gtm companies search --name "ZoomInfo"

# Tech companies in San Francisco with 100-500 employees
gtm companies search --industry software --metro "CA - San Francisco" --employees "100to249,250to499"

# Public US companies with $1B+ revenue, sorted by revenue desc
gtm companies search --type public --country "United States" --revenue-min 1000000 --sort -revenue --page-size 10 -f table

# Companies using a specific tech product (lookup product IDs first)
gtm companies search --tech "5f1d1d5c123" --metro "MA - Boston" --employees "250to499,500to999"

# Series A-B funded ($1M-$20M) software companies in the US
gtm companies search --industry software --country "United States" --funding-min 1000 --funding-max 20000

# By NAICS / SIC codes
gtm companies search --naics "541511,541512"
```

**Enrich.** Provide any identifier:

```shell
gtm companies enrich --id 344589814
gtm companies enrich --domain stripe.com
gtm companies enrich --name "Stripe"
gtm companies enrich --ticker NVDA
gtm companies enrich --website https://www.zoominfo.com

# Restrict the returned fields
gtm companies enrich --domain stripe.com --fields name description website revenue employeeCount industries

# Bulk: up to 10 companies via JSON file
# companies.json: [{ "domain": "stripe.com" }, { "companyId": "344589814" }]
gtm companies enrich --file companies.json
```

**Similar companies** (machine-learning ranked list of look-alikes):

```shell
gtm companies similar --id 344589814
gtm companies similar --name "Stripe"
```

---

### `gtm contacts` — search, enrich, find similar, recommended

**Search.** Requires at least one filter.

```shell
# By name
gtm contacts search --first-name Henry --last-name Schuck

# By job title (free-text OR queries supported)
gtm contacts search --job-title "CFO OR VP Finance OR Treasurer" --employees "1000to4999,5000to9999"

# C-level and VP-level executives at a specific company
gtm contacts search --management-level "C Level Exec,VP Level Exec" --company-id 344589814

# Engineering managers at SF software companies, only ones with verified email + phone
gtm contacts search --management-level Manager --department "Engineering & Technical" \
  --industry software --metro "CA - San Francisco" --required email,phone

# Sales leaders with accuracy score ≥ 90
gtm contacts search --management-level "VP Level Exec" --department Sales --accuracy-min 90
```

**Enrich.** Provide any valid identifier combination — `personId` (most accurate), `email`, `phone`, or `firstName + lastName + (company OR companyId)`:

```shell
gtm contacts enrich --id 1260398587
gtm contacts enrich --email henry@zoominfo.com
gtm contacts enrich --phone 555-303-1234
gtm contacts enrich --first-name Henry --last-name Schuck --company "ZoomInfo"
gtm contacts enrich --full-name "Henry Schuck" --company-id 344589814

# Return only specific fields
gtm contacts enrich --email jane@acme.com --fields phone jobTitle managementLevel email

# Bulk: up to 10 contacts via JSON file
# contacts.json: [{ "email": "a@b.com" }, { "personId": "1260398587" }]
gtm contacts enrich --file contacts.json
```

**Similar contacts** (find people who look like a reference person; optionally constrain to a target company):

```shell
gtm contacts similar --person-id 1260398587
gtm contacts similar --person-id 1260398587 --company-id 239305146   # similar contacts within Salesforce
```

**Recommended contacts** at a target company, based on your interaction history:

```shell
gtm contacts recommended --company-id 344589814 --use-case PROSPECTING
gtm contacts recommended --company-id 344589814 --use-case DEAL_ACCELERATION
gtm contacts recommended --company-id 344589814 --use-case RENEWAL_AND_GROWTH
```

---

### `gtm intent` — buyer intent signals

Every request needs `--topics` (1-50). Look up exact topic names first.

```shell
gtm lookup --field intent-topics --fuzzy "data warehouse"

# Companies showing high intent for Cloud Applications + Java
gtm intent search --topics "Cloud Applications" "Java" --signal-score-min 70

# Strong intent in the last 30 days, mid-market US software companies
gtm intent search --topics "Mobile Apps" --signal-score-min 80 \
  --signal-start 2026-05-01 --signal-end 2026-05-31 \
  --industry software --country "United States" --employees "250to499,500to999"

# Audience strength A or B (largest groups researching)
gtm intent search --topics "AI Agents" --audience-strength-min B --audience-strength-max A
```

**Enrich** — pull intent signals for a specific company:

```shell
gtm intent enrich --company-id 344589814 --topics "Cloud Applications" "Java"
gtm intent enrich --name "ZoomInfo" --topics "AI Agents" --signal-score-min 70
gtm intent enrich --website https://www.stripe.com --topics "Payments"
```

---

### `gtm scoops` — real-time business events

Scoops capture earnings, funding, M&A, leadership moves, layoffs, product launches, awards, partnerships, and more. Search requires at least one filter.

```shell
# Funding announcements at SF software companies in May 2026
gtm scoops search --scoop-types Funding --industry software --metro "MA - Boston" \
  --published-start 2026-05-01 --published-end 2026-05-31

# C-suite hires across all companies in the last 7 days
gtm scoops search --scoop-types "New Hire" "Executive Move" --department C-Suite --published-start 2026-05-27

# Layoffs at enterprise companies
gtm scoops search --scoop-types Layoffs --employees "10000plus" --published-start 2026-01-01

# Product launches in the AI space
gtm scoops search --scoop-types "Product Launch" --description "artificial intelligence" --published-start 2026-04-01
```

**Enrich** — get scoops for a specific company:

```shell
gtm scoops enrich --company-id 344589814 --scoop-types "New Hire" Promotion
gtm scoops enrich --name "Stripe" --published-start 2026-01-01
```

---

### `gtm news` — news articles

`enrich_news` is currently the only news tool. Requires `--company-id`.

```shell
# Recent funding/financial news for ZoomInfo
gtm news enrich --company-id 344589814 --categories FINANCIAL_RESULTS FUNDING

# Product news in the last quarter
gtm news enrich --company-id 344589814 --categories PRODUCT --publishing-start 2026-03-01 --publishing-end 2026-05-31

# Leadership news (appointments, departures)
gtm news enrich --company-id 344589814 --categories PERSON
```

Valid `--categories`: `FINANCIAL_RESULTS`, `FUNDING`, `GENERAL_NEWS`, `GENERAL_PRESS_RELEASE`, `MERGER_OR_ACQUISITION`, `PERSON`, `PRODUCT`.

---

### `gtm gtm-context` — your organization's GTM configuration

This is the context that shapes how every other ZoomInfo tool interprets your queries — your offerings, ICPs, buyer personas, competitors, strategic priorities. Zero credits consumed.

```shell
# Compressed view (~1k tokens)
gtm-context get

# Full expanded profiles
gtm-context get --detailed -f yaml

# Update — synthesizes unstructured content into structured records (admin only)
gtm-context update --query "Update competitive intelligence" --source "Our main competitors are X, Y, Z. X is strong in …"

# From a file (large inputs)
gtm-context update --query "Create buyer personas from these interviews" --source-file ./interview-notes.txt
```

---

### `gtm feedback` — submit feedback to ZoomInfo

```shell
gtm feedback submit --category DATA_QUALITY --message "Henry Schuck's company should be ZoomInfo Technologies, not ZoomInfo"
gtm feedback submit --category FEATURE_REQUEST --message "Want a --csv-headers flag to control column order"
```

Categories: `DATA_QUALITY`, `FEATURE_REQUEST`, `ACCESS_ENTITLEMENT_ISSUE`, `OTHER`.

---

### `gtm research` — agentic account & contact research

Natural-language research that blends ZoomInfo market data with your CRM and conversation
history. Frame the goal in `--query` (the tool decides what to retrieve) rather than passing
keywords. Get the ZoomInfo IDs from `gtm companies search` / `gtm contacts search`.

```shell
# Company/account research
gtm research account --company-id 344589814 \
  --query "Prepping for a renewal call — relationship status, recent news, and open risks"

# Person/contact research
gtm research contact --contact-id 1260398587 \
  --query "Who is this person, their role, and our history with them before I reach out"
```

---

### `gtm raw` — universal escape hatch

Use this when you need a tool that doesn't have a curated wrapper yet.

```shell
# What tools does the MCP server expose?
gtm raw list-tools -f table

# Call any tool by name with a JSON argument blob
gtm raw call find_similar_companies --args '{"companyName":"Stripe"}'
gtm raw call search_intent --args '{"topics":["Cloud Applications"],"signalScoreMin":80}'
```

---

## Common workflows

### Pipe to `jq` for field extraction

```shell
# Just the company names from a search
gtm companies search --industry software --metro "CA - San Francisco" | jq '.data[].attributes.name'

# Email + phone for every result
gtm contacts search --company-id 344589814 -f jsonl | jq -r '[.attributes.email, .attributes.phone] | @tsv'

# Top intent signals sorted by score
gtm intent search --topics "Cloud Applications" --signal-score-min 80 | jq '.data | sort_by(-.attributes.score) | .[0:5]'
```

### Two-step: search companies, enrich top results

```shell
# Get top 3 company IDs, then enrich each with full details
gtm companies search --industry software --metro "CA - San Francisco" --page-size 3 -f json \
  | jq -r '.data[].id' \
  | xargs -I{} gtm companies enrich --id {}
```

### Export contacts to CSV

```shell
gtm contacts search --management-level "VP Level Exec" --department Sales --company-id 344589814 -f csv > vp-sales.csv
```

### Find lookalike companies, then enrich them

```shell
gtm companies similar --id 344589814 -f json \
  | jq -r '.data[0:10][].id' \
  | xargs -I{} gtm companies enrich --id {} --fields name domain employeeCount revenue industries
```

---

## Development

```shell
npm install
npm run typecheck                          # tsc --noEmit
npm test                                   # unit tests (Vitest, mocked)
npm run test:live                          # live MCP session (requires `gtm auth login`)

npx tsx src/index.ts <command>             # run from source (no compile)
node dist/js/index.js <command>            # run compiled output
```

The live suite (`src/live/`) drives the built CLI against the real MCP server, covering every
read-only command end-to-end (it skips when you're not logged in). Run it against the compiled
output and opt into the mutating tier explicitly:

```shell
GTM_CLI_CMD="node dist/js/index.js" npm run test:live           # read-only (default)
GTM_LIVE_WRITES=1 GTM_CLI_CMD="node dist/js/index.js" npm run test:live   # + feedback / gtm-context update
```

Build standalone single-file binaries (requires [Bun](https://bun.sh)):

```shell
npm run build                              # → dist/gtm (current platform)
npm run build:all                          # cross-compile macOS arm64/x64, Linux x64, Windows x64
```

## Agent integration

`.claude/skills/gtm-ai-cli/SKILL.md` is auto-discovered by Claude Code when this repo is opened. Agents in other repos can fetch the canonical version from:

```
https://raw.githubusercontent.com/zoominfo/gtm-ai-cli/main/.claude/skills/gtm-ai-cli/SKILL.md
```

## License

MIT
