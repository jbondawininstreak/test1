# datasearch-cli

CLI for the [DataSearch API](https://docs.global-search.at) — search billions of records by name, phone, email, ID document, and more.

**Zero dependencies.** Requires Node.js 18+.

## Install

```bash
# Clone and link globally
git clone <this-repo>
cd datasearch-cli
npm link

# Or run directly
node bin/datasearch.js --help
```

## Setup

Set your API key (get one at [cabinet.global-search.at](https://cabinet.global-search.at)):

```bash
export DATASEARCH_API_KEY="gs_live_..."
```

Or pass it per-command:

```bash
datasearch me --key "gs_live_..."
```

## Commands

| Command | Description | Cost |
|---------|-------------|------|
| `search <type> <query>` | Raw record search | $0.30 |
| `dossier <type> <query>` | Person-grouped search | $0.30 |
| `report <type> <query>` | Full dossier pipeline (recommended) | $0.30 |
| `messages <query>` | Search forum posts / PMs / chats | $0.30 |
| `thread` | Fetch a message thread | Free |
| `me` | Show API key info & balance | Free |
| `health` | API health check | Free |

### Search Types

| Type | Description | Example |
|------|-------------|---------|
| `name` | Full name | `"John Smith"` |
| `phone` | Phone number (E.164 preferred) | `"+12025551234"` |
| `email` | Email address | `"john@example.com"` |
| `id` | National ID / passport / SSN / CPF | `"12345678901"` |
| `username` | Social handle or username | `"@john_smith"` |
| `dob` | Date of birth | `"15.03.1985"` |
| `address` | Street address / postal code | `"123 Main St"` |
| `global` | Auto-detect query type | anything |

### Command Shortcuts

| Full | Short |
|------|-------|
| `search` | `s` |
| `dossier` | `d` |
| `report` | `r` |
| `messages` | `m` |
| `thread` | `t` |

## Examples

```bash
# Check your balance
datasearch me

# Auto-detect search type (recommended starting point)
datasearch search global "John Smith"
datasearch search global "+12025551234"
datasearch search global "john@example.com"

# Specific search by type
datasearch search phone "+12025551234" --limit 20
datasearch search id "12345678901" --country bra
datasearch search name "João Silva"

# Person-grouped results (deduped by person)
datasearch dossier email "john@example.com"
datasearch dossier global "+12025551234"

# Full report — richest output, same engine as the web UI
datasearch report global "John Smith"
datasearch report phone "+12025551234" --limit 200
datasearch report id "123.456.789-09"

# Forum / PM / chat search
datasearch messages "password reset" --from "john_doe"
datasearch messages --source "forum.example [USA]" --type pm

# Get raw JSON (pipe to jq, save to file, etc.)
datasearch report global "John Smith" --json
datasearch report global "John Smith" --json | jq '.people[0]'
```

## Options

| Flag | Short | Description |
|------|-------|-------------|
| `--key` | `-k` | API key (or set `DATASEARCH_API_KEY`) |
| `--limit` | `-l` | Max results (search: 1-100, dossier/report: 1-200) |
| `--country` | `-c` | Country filter for ID search (ISO Alpha-3) |
| `--json` | `-j` | Output raw JSON |
| `--help` | `-h` | Show help |
| `--version` | `-v` | Show version |

### Message-Specific Options

| Flag | Description |
|------|-------------|
| `--source` | Source database filter |
| `--from` | Sender username filter |
| `--to` | Recipient username filter |
| `--type` | `pm`, `post`, or `chat` |
| `--date-from` | Start date (ISO or epoch) |
| `--date-to` | End date |
| `--page` | Page number (0-39) |
| `--thread-id` | Thread ID (for `thread` command) |

## API Reference

- **Base URL:** `https://api.global-search.at/v1`
- **Auth:** `Authorization: Bearer gs_live_<key>`
- **Rate limit:** 100 req/min per API key
- **Billing:** $0.30 per successful search request
- **Docs:** https://docs.global-search.at
- **Dashboard:** https://cabinet.global-search.at

## Output Modes

### `/search/*` — Raw Records
Flat array of matched records as-is from the database.

### `/dossier/*` — Person-Grouped
Records grouped by person (ASCII-normalized name). Deduped phones, emails, DOBs.

### `/report/*` — Full Pipeline ⭐
The same engine behind the web report UI. Returns person clusters with match scores, a rich profile, source-attributed contacts, key facts, and confidence scores. **Use this for the richest output.**

## License

MIT
