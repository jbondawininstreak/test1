#!/usr/bin/env node

// datasearch — CLI for the DataSearch API (https://docs.global-search.at)
// Zero external dependencies. Requires Node.js >= 18.

import { DataSearchClient, ApiError } from '../lib/api.js';
import {
  c, formatSearchResults, formatDossierResults, formatReportResults,
  formatMessages, formatAccount, divider,
} from '../lib/format.js';

// ── Arg parsing ───────────────────────────────────────────────────────────

const argv = process.argv.slice(2);

function flag(name, alias) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === `--${name}` || (alias && argv[i] === `-${alias}`)) {
      argv.splice(i, 1);
      return true;
    }
  }
  return false;
}

function opt(name, alias) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === `--${name}` || (alias && argv[i] === `-${alias}`)) {
      const val = argv[i + 1];
      argv.splice(i, 2);
      return val;
    }
    if (argv[i].startsWith(`--${name}=`)) {
      const val = argv[i].slice(`--${name}=`.length);
      argv.splice(i, 1);
      return val;
    }
  }
  return undefined;
}

// Global flags (parsed before commands)
const showHelp = flag('help', 'h');
const showVersion = flag('version', 'v');
const jsonOutput = flag('json', 'j');
const apiKey = opt('key', 'k') || process.env.DATASEARCH_API_KEY;
const limit = opt('limit', 'l');
const country = opt('country', 'c');

// Message-specific flags
const msgFrom = opt('from');
const msgTo = opt('to');
const msgType = opt('type');
const msgDateFrom = opt('date-from');
const msgDateTo = opt('date-to');
const msgPage = opt('page');
const msgSource = opt('source');
const msgThreadId = opt('thread-id');

// ── Help text ─────────────────────────────────────────────────────────────

const HELP = `
${c.bold}${c.cyan}datasearch${c.reset} — search billions of records via the DataSearch API

${c.bold}USAGE${c.reset}
  datasearch <command> [type] <query> [options]

${c.bold}COMMANDS${c.reset}
  ${c.green}search${c.reset} <type> <query>     Raw record search
  ${c.green}dossier${c.reset} <type> <query>    Person-grouped search
  ${c.green}report${c.reset} <type> <query>     Full dossier pipeline (recommended)
  ${c.green}messages${c.reset} <query>          Search forum posts / PMs / chats
  ${c.green}thread${c.reset}                    Fetch a message thread (free)
  ${c.green}me${c.reset}                        Show API key info & balance
  ${c.green}health${c.reset}                    API health check

${c.bold}SEARCH TYPES${c.reset}
  ${c.yellow}name${c.reset}      Full name (first + last)
  ${c.yellow}phone${c.reset}     Phone number (E.164 preferred)
  ${c.yellow}email${c.reset}     Email address (exact or partial)
  ${c.yellow}id${c.reset}        National ID / passport / SSN / CPF / etc.
  ${c.yellow}username${c.reset}  Username or social handle (@)
  ${c.yellow}dob${c.reset}       Date of birth (dd.mm.yyyy or yyyy)
  ${c.yellow}address${c.reset}   Street address / postal code
  ${c.yellow}global${c.reset}    Auto-detect query type

${c.bold}OPTIONS${c.reset}
  --key, -k <key>       API key (or set DATASEARCH_API_KEY)
  --limit, -l <n>       Max results (search: 1-100, dossier/report: 1-200)
  --country, -c <code>  Country filter for ID search (ISO Alpha-3, e.g. usa, bra)
  --json, -j            Output raw JSON
  --help, -h            Show this help
  --version, -v         Show version

${c.bold}MESSAGE OPTIONS${c.reset}
  --source <name>       Source database filter
  --from <user>         Sender username filter
  --to <user>           Recipient username filter
  --type <pm|post|chat> Message type filter
  --date-from <date>    Start date (ISO or epoch)
  --date-to <date>      End date
  --page <n>            Page number (0-39)
  --thread-id <id>      Thread ID (for 'thread' command)

${c.bold}EXAMPLES${c.reset}
  ${c.dim}# Check balance${c.reset}
  datasearch me

  ${c.dim}# Quick search (auto-detect type)${c.reset}
  datasearch search global "John Smith"
  datasearch search global "+12025551234"
  datasearch search global "john@example.com"

  ${c.dim}# Specific search types${c.reset}
  datasearch search phone "+12025551234" --limit 20
  datasearch search id "12345678901" --country bra
  datasearch search name "João Silva" --limit 50

  ${c.dim}# Person-grouped results${c.reset}
  datasearch dossier email "john@example.com"
  datasearch dossier global "+12025551234"

  ${c.dim}# Full report (recommended)${c.reset}
  datasearch report global "John Smith"
  datasearch report phone "+12025551234"
  datasearch report id "123.456.789-09"

  ${c.dim}# Message search${c.reset}
  datasearch messages "password reset" --source "inattack.ru 09.2014 [RUS]"
  datasearch messages --from "john_doe" --type pm

  ${c.dim}# Raw JSON output${c.reset}
  datasearch report global "John Smith" --json

${c.bold}ENVIRONMENT${c.reset}
  DATASEARCH_API_KEY    API key (alternative to --key)

${c.dim}API docs: https://docs.global-search.at
Dashboard: https://cabinet.global-search.at
Cost: $0.30 per search request${c.reset}
`;

// ── Command dispatch ──────────────────────────────────────────────────────

const SEARCH_TYPES = ['name', 'phone', 'email', 'id', 'username', 'dob', 'address', 'global'];

function methodName(prefix, type) {
  const map = {
    name: 'Name', phone: 'Phone', email: 'Email', id: 'Id',
    username: 'Username', dob: 'Dob', address: 'Address', global: 'Global',
  };
  return `${prefix}${map[type]}`;
}

async function main() {
  if (showVersion) {
    console.log('datasearch 1.0.0');
    process.exit(0);
  }

  if (showHelp || argv.length === 0) {
    console.log(HELP);
    process.exit(0);
  }

  const command = argv[0];

  // Commands that need the API client
  let client;
  try {
    if (command !== 'help') {
      client = new DataSearchClient(apiKey);
    }
  } catch (err) {
    console.error(`\n  ${c.red}${c.bold}Error:${c.reset} ${err.message}\n`);
    process.exit(1);
  }

  try {
    switch (command) {

      // ── me ──────────────────────────────────────────────────────────────
      case 'me':
      case 'account':
      case 'balance': {
        const data = await client.me();
        if (jsonOutput) { console.log(JSON.stringify(data, null, 2)); break; }
        console.log(formatAccount(data));
        break;
      }

      // ── health ──────────────────────────────────────────────────────────
      case 'health':
      case 'ping': {
        const data = await client.health();
        if (jsonOutput) { console.log(JSON.stringify(data, null, 2)); break; }
        console.log(`\n  ${c.green}✓${c.reset} API is ${c.bold}${c.green}${data.status || 'ok'}${c.reset}\n`);
        break;
      }

      // ── search ──────────────────────────────────────────────────────────
      case 'search':
      case 's': {
        const type = argv[1];
        const query = argv.slice(2).join(' ');

        if (!type || !SEARCH_TYPES.includes(type)) {
          console.error(`\n  ${c.red}Error:${c.reset} Search type required: ${SEARCH_TYPES.join(', ')}`);
          console.error(`  Usage: datasearch search <type> <query>\n`);
          process.exit(1);
        }
        if (!query) {
          console.error(`\n  ${c.red}Error:${c.reset} Query required.`);
          console.error(`  Usage: datasearch search ${type} "<query>"\n`);
          process.exit(1);
        }

        const method = methodName('search', type);
        const opts = { limit: limit ? parseInt(limit) : undefined };
        if (type === 'id' && country) opts.country = country;
        const data = await client[method](query, opts);

        if (jsonOutput) { console.log(JSON.stringify(data, null, 2)); break; }
        console.log(formatSearchResults(data));
        break;
      }

      // ── dossier ─────────────────────────────────────────────────────────
      case 'dossier':
      case 'd': {
        const type = argv[1];
        const query = argv.slice(2).join(' ');

        if (!type || !SEARCH_TYPES.includes(type)) {
          console.error(`\n  ${c.red}Error:${c.reset} Search type required: ${SEARCH_TYPES.join(', ')}`);
          console.error(`  Usage: datasearch dossier <type> <query>\n`);
          process.exit(1);
        }
        if (!query) {
          console.error(`\n  ${c.red}Error:${c.reset} Query required.`);
          console.error(`  Usage: datasearch dossier ${type} "<query>"\n`);
          process.exit(1);
        }

        const method = methodName('dossier', type);
        const opts = { limit: limit ? parseInt(limit) : undefined };
        if (type === 'id' && country) opts.country = country;
        const data = await client[method](query, opts);

        if (jsonOutput) { console.log(JSON.stringify(data, null, 2)); break; }
        console.log(formatDossierResults(data));
        break;
      }

      // ── report ──────────────────────────────────────────────────────────
      case 'report':
      case 'r': {
        const type = argv[1];
        const query = argv.slice(2).join(' ');

        if (!type || !SEARCH_TYPES.includes(type)) {
          console.error(`\n  ${c.red}Error:${c.reset} Search type required: ${SEARCH_TYPES.join(', ')}`);
          console.error(`  Usage: datasearch report <type> <query>\n`);
          process.exit(1);
        }
        if (!query) {
          console.error(`\n  ${c.red}Error:${c.reset} Query required.`);
          console.error(`  Usage: datasearch report ${type} "<query>"\n`);
          process.exit(1);
        }

        const method = methodName('report', type);
        const opts = { limit: limit ? parseInt(limit) : undefined };
        const data = await client[method](query, opts);

        if (jsonOutput) { console.log(JSON.stringify(data, null, 2)); break; }
        console.log(formatReportResults(data));
        break;
      }

      // ── messages ────────────────────────────────────────────────────────
      case 'messages':
      case 'msg':
      case 'm': {
        const query = argv.slice(1).join(' ') || undefined;

        if (!query && !msgFrom && !msgTo && !msgSource) {
          console.error(`\n  ${c.red}Error:${c.reset} At least one of: query, --from, --to, or --source required.`);
          console.error(`  Usage: datasearch messages "<query>" [--from user] [--to user] [--source name]\n`);
          process.exit(1);
        }

        const data = await client.searchMessages({
          q: query,
          source: msgSource,
          from: msgFrom,
          to: msgTo,
          type: msgType,
          date_from: msgDateFrom,
          date_to: msgDateTo,
          page: msgPage ? parseInt(msgPage) : undefined,
          limit: limit ? parseInt(limit) : undefined,
        });

        if (jsonOutput) { console.log(JSON.stringify(data, null, 2)); break; }
        console.log(formatMessages(data));
        break;
      }

      // ── thread ──────────────────────────────────────────────────────────
      case 'thread':
      case 't': {
        const source = msgSource || argv[1];
        const threadId = msgThreadId || argv[2];

        if (!source || !threadId) {
          console.error(`\n  ${c.red}Error:${c.reset} Source and thread ID required.`);
          console.error(`  Usage: datasearch thread --source "<name>" --thread-id <id>`);
          console.error(`     or: datasearch thread "<source>" <thread-id>\n`);
          process.exit(1);
        }

        const data = await client.getThread(source, threadId, {
          type: msgType,
          limit: limit ? parseInt(limit) : undefined,
        });

        if (jsonOutput) { console.log(JSON.stringify(data, null, 2)); break; }
        console.log(formatMessages(data));
        break;
      }

      // ── help ────────────────────────────────────────────────────────────
      case 'help': {
        console.log(HELP);
        break;
      }

      default:
        console.error(`\n  ${c.red}Unknown command:${c.reset} ${command}`);
        console.error(`  Run ${c.cyan}datasearch --help${c.reset} for usage.\n`);
        process.exit(1);
    }
  } catch (err) {
    if (err instanceof ApiError) {
      const icon = {
        401: '🔑', 402: '💰', 403: '🚫', 429: '⏱️', 503: '🔧',
      }[err.status] || '❌';

      if (jsonOutput) {
        console.error(JSON.stringify({ error: err.code, message: err.message, status: err.status, request_id: err.requestId }, null, 2));
      } else {
        console.error(`\n  ${icon} ${c.red}${c.bold}${err.code}${c.reset} ${c.dim}(HTTP ${err.status})${c.reset}`);
        console.error(`  ${err.message}`);
        if (err.requestId) console.error(`  ${c.dim}Request: ${err.requestId}${c.reset}`);
        if (err.status === 402) console.error(`\n  ${c.yellow}Top up at https://cabinet.global-search.at${c.reset}`);
        console.error('');
      }
      process.exit(1);
    }

    // Network / unknown errors
    if (jsonOutput) {
      console.error(JSON.stringify({ error: 'UNKNOWN', message: err.message }, null, 2));
    } else {
      console.error(`\n  ${c.red}${c.bold}Error:${c.reset} ${err.message}\n`);
    }
    process.exit(1);
  }
}

main();
