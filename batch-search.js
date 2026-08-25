#!/usr/bin/env node

// Batch email search — reads emails from the input file, searches each via
// the DataSearch API (/report/email), and writes results to a JSONL file
// plus a human-readable summary CSV.
//
// Usage:
//   node batch-search.js <input-file> [--key <api-key>] [--limit N] [--start N]
//
// Rate limit: 100 req/min → we pace at ~80/min to stay safe (750ms between requests).

import { readFileSync, appendFileSync, existsSync, writeFileSync } from 'fs';
import { DataSearchClient, ApiError } from './lib/api.js';

// ── Config ────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);

function opt(name) {
  const idx = argv.indexOf(`--${name}`);
  if (idx !== -1 && argv[idx + 1]) {
    const val = argv[idx + 1];
    argv.splice(idx, 2);
    return val;
  }
  return undefined;
}

const apiKey = opt('key') || process.env.DATASEARCH_API_KEY;
const maxSearches = parseInt(opt('limit') || '0') || Infinity;
const startAt = parseInt(opt('start') || '1');
const inputFile = argv[0];

if (!inputFile) {
  console.error('Usage: node batch-search.js <input-file> [--key <key>] [--limit N] [--start N]');
  process.exit(1);
}

const DELAY_MS = 750; // ~80 req/min, stays under 100/min rate limit
const RESULTS_JSONL = 'results.jsonl';
const RESULTS_CSV = 'results.csv';

// ── Parse input file ──────────────────────────────────────────────────────

function parseInputFile(path) {
  const lines = readFileSync(path, 'utf-8').split('\n').filter(l => l.trim());
  return lines.map((line, i) => {
    const email = line.split('|')[0].trim();
    const balanceMatch = line.match(/Balance\s*=\s*\$?([\d,]+(?:\.\d+)?)/i);
    const balance = balanceMatch ? balanceMatch[1].replace(/,/g, '') : '';
    return { lineNum: i + 1, email, purchaseAmount: balance, rawLine: line.trim() };
  });
}

// ── Sleep helper ──────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const client = new DataSearchClient(apiKey);

  // Check balance first
  const account = await client.me();
  const balance = account.balance_usd;
  const maxAffordable = Math.floor(balance / 0.30);
  console.log(`\n  💰 Balance: $${balance.toFixed(2)} (enough for ${maxAffordable} searches)`);

  const entries = parseInputFile(inputFile);
  const total = entries.length;
  const toProcess = entries.slice(startAt - 1);
  const searchCount = Math.min(toProcess.length, maxSearches, maxAffordable);

  console.log(`  📋 Emails in file: ${total}`);
  console.log(`  🔍 Will search: ${searchCount} (starting at #${startAt})`);
  console.log(`  💵 Estimated cost: $${(searchCount * 0.30).toFixed(2)}`);
  console.log(`  📁 Output: ${RESULTS_JSONL} + ${RESULTS_CSV}\n`);

  // Write CSV header if file doesn't exist
  if (!existsSync(RESULTS_CSV)) {
    writeFileSync(RESULTS_CSV, 'line_num,email,purchase_amount,found,names,phones,dobs,sources_count,records_count,request_id\n');
  }

  let searched = 0;
  let found = 0;
  let errors = 0;

  for (let i = 0; i < searchCount; i++) {
    const entry = toProcess[i];
    const num = entry.lineNum;
    const pct = ((i + 1) / searchCount * 100).toFixed(1);

    process.stdout.write(`  [${i + 1}/${searchCount}] (${pct}%) #${num} ${entry.email} ... `);

    try {
      const result = await client.reportEmail(entry.email, { limit: 50 });
      searched++;

      const hasPeople = result.people && result.people.length > 0;
      if (hasPeople) found++;

      // Extract summary fields from the report
      const summary = {
        lineNum: num,
        email: entry.email,
        purchaseAmount: entry.purchaseAmount,
        found: hasPeople,
        query: result.query,
        type: result.type,
        people: (result.people || []).map(p => ({
          name: p.name,
          dob: p.dob,
          gender: p.gender,
          citizenship: p.citizenship,
          match_score: p.match_score,
          is_subject: p.is_subject,
          phones: p.phones,
          emails: p.emails,
          documents: p.documents,
          record_count: p.record_count,
          source_count: p.source_count,
        })),
        profile: result.profile || null,
        documents: result.documents || [],
        phones: (result.phones || []).map(p => p.value),
        emails: (result.emails || []).map(e => e.value),
        addresses: (result.addresses || []).map(a => a.value),
        employment: result.employment || null,
        usernames: result.usernames || [],
        key_facts: result.key_facts || [],
        record_count: result.record_count || 0,
        source_count: result.source_count || 0,
        total_records: result.total_records || 0,
        cost_usd: result.cost_usd,
        balance_usd: result.balance_usd,
        request_id: result.request_id,
      };

      // Append JSONL
      appendFileSync(RESULTS_JSONL, JSON.stringify(summary) + '\n');

      // Append CSV row
      const names = (result.people || []).map(p => p.name).filter(Boolean).join('; ');
      const phones = summary.phones.join('; ');
      const dobs = (result.people || []).map(p => p.dob).filter(Boolean).join('; ');
      const csvRow = [
        num,
        `"${entry.email}"`,
        entry.purchaseAmount,
        hasPeople ? 'YES' : 'NO',
        `"${names}"`,
        `"${phones}"`,
        `"${dobs}"`,
        summary.source_count,
        summary.record_count,
        result.request_id || '',
      ].join(',');
      appendFileSync(RESULTS_CSV, csvRow + '\n');

      if (hasPeople) {
        const subj = result.people.find(p => p.is_subject);
        const name = subj?.name || result.people[0]?.name || '?';
        console.log(`✅ ${name} (${result.people.length} people, ${summary.total_records} records) $${result.balance_usd?.toFixed(2) || '?'}`);
      } else {
        console.log(`⚪ no results  $${result.balance_usd?.toFixed(2) || '?'}`);
      }

    } catch (err) {
      errors++;
      if (err instanceof ApiError) {
        console.log(`❌ ${err.code} — ${err.message}`);

        // Stop on balance or auth errors
        if (err.status === 402) {
          console.error('\n  💸 Balance exhausted. Stopping.');
          break;
        }
        if (err.status === 401) {
          console.error('\n  🔑 Auth error. Stopping.');
          break;
        }
        if (err.status === 429) {
          console.log('  ⏱️  Rate limited — waiting 60s...');
          await sleep(60000);
          i--; // retry this one
          continue;
        }
      } else {
        console.log(`❌ ${err.message}`);
      }

      // Log the error to JSONL too
      appendFileSync(RESULTS_JSONL, JSON.stringify({
        lineNum: num, email: entry.email, error: err.message, code: err.code || 'UNKNOWN',
      }) + '\n');
    }

    // Rate limiting delay
    if (i < searchCount - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n  ── Done ──────────────────────────────────────`);
  console.log(`  Searched: ${searched}`);
  console.log(`  Found:    ${found}`);
  console.log(`  Empty:    ${searched - found}`);
  console.log(`  Errors:   ${errors}`);
  console.log(`  Output:   ${RESULTS_JSONL}, ${RESULTS_CSV}\n`);
}

main().catch(err => {
  console.error(`\n  Fatal: ${err.message}\n`);
  process.exit(1);
});
