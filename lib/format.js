// Terminal formatting — ANSI colors, tables, record display

const IS_TTY = process.stdout.isTTY;

// ── ANSI helpers ──────────────────────────────────────────────────────────

const esc = (code) => IS_TTY ? `\x1b[${code}m` : '';

export const c = {
  reset:   esc(0),
  bold:    esc(1),
  dim:     esc(2),
  italic:  esc(3),
  under:   esc(4),
  red:     esc(31),
  green:   esc(32),
  yellow:  esc(33),
  blue:    esc(34),
  magenta: esc(35),
  cyan:    esc(36),
  white:   esc(37),
  gray:    esc(90),
  bgRed:   esc(41),
  bgGreen: esc(42),
  bgBlue:  esc(44),
};

// ── Utility ───────────────────────────────────────────────────────────────

export function truncate(str, max = 50) {
  if (!str) return '';
  str = String(str);
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function pad(str, len) {
  str = String(str ?? '');
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function visLen(str) {
  return stripAnsi(String(str)).length;
}

// ── Dividers ──────────────────────────────────────────────────────────────

export function divider(label = '', width = 70) {
  if (!label) return c.dim + '─'.repeat(width) + c.reset;
  const line = '─'.repeat(Math.max(2, width - label.length - 4));
  return `${c.dim}── ${c.reset}${c.bold}${label}${c.reset}${c.dim} ${line}${c.reset}`;
}

// ── Key-value pairs ───────────────────────────────────────────────────────

export function kv(label, value, { color = c.white, labelWidth = 16 } = {}) {
  if (value === undefined || value === null || value === '') return '';
  return `  ${c.gray}${pad(label, labelWidth)}${c.reset} ${color}${value}${c.reset}`;
}

// ── Cost/meta footer ──────────────────────────────────────────────────────

export function metaFooter(meta) {
  const parts = [];
  if (meta?.total !== undefined)              parts.push(`${c.dim}Total:${c.reset} ${meta.total}`);
  if (meta?.returned !== undefined)           parts.push(`${c.dim}Returned:${c.reset} ${meta.returned}`);
  if (meta?.cost_usd !== undefined)           parts.push(`${c.yellow}Cost:${c.reset} $${meta.cost_usd.toFixed(2)}`);
  if (meta?.balance_remaining_usd !== undefined) parts.push(`${c.green}Balance:${c.reset} $${meta.balance_remaining_usd.toFixed(2)}`);
  if (meta?.request_id)                       parts.push(`${c.dim}ID: ${meta.request_id}${c.reset}`);
  return parts.length ? '\n  ' + parts.join('  │  ') : '';
}

export function dossierFooter(data) {
  const parts = [];
  if (data?.total_records !== undefined) parts.push(`${c.dim}Records:${c.reset} ${data.total_records}`);
  if (data?.total_people !== undefined)  parts.push(`${c.dim}People:${c.reset} ${data.total_people}`);
  if (data?.cost_usd !== undefined)      parts.push(`${c.yellow}Cost:${c.reset} $${data.cost_usd.toFixed(2)}`);
  if (data?.balance_usd !== undefined)   parts.push(`${c.green}Balance:${c.reset} $${data.balance_usd.toFixed(2)}`);
  if (data?.request_id)                  parts.push(`${c.dim}ID: ${data.request_id}${c.reset}`);
  return parts.length ? '\n  ' + parts.join('  │  ') : '';
}

// ── Search result display ─────────────────────────────────────────────────

export function formatSearchResults(resp) {
  const lines = [];
  const records = resp.data || [];

  if (records.length === 0) {
    lines.push(`\n  ${c.yellow}No results found.${c.reset}`);
    lines.push(metaFooter(resp.meta));
    return lines.join('\n');
  }

  lines.push('');

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const idx = `${c.dim}[${i + 1}]${c.reset}`;
    const name = r.full_name || r.full_name_lat || 'Unknown';
    lines.push(`${idx} ${c.bold}${c.cyan}${name}${c.reset}`);

    if (r.full_name_lat && r.full_name_lat !== r.full_name) {
      lines.push(kv('Latin', r.full_name_lat));
    }
    if (r.date_of_birth) lines.push(kv('DOB', r.date_of_birth));
    if (r.gender)        lines.push(kv('Gender', r.gender));
    if (r.phone)         lines.push(kv('Phone', r.phone, { color: c.green }));
    if (r.email)         lines.push(kv('Email', r.email, { color: c.green }));
    if (r.address)       lines.push(kv('Address', r.address));
    if (r.source)        lines.push(kv('Source', r.source, { color: c.dim }));
    if (r._from_enrich)  lines.push(kv('Enriched', '✓ cross-linked via shared ID', { color: c.magenta }));

    // Show any ID fields
    const skipKeys = new Set([
      'full_name', 'full_name_lat', 'date_of_birth', 'gender',
      'phone', 'email', 'address', 'source', '_from_enrich',
      'password_hash',
    ]);
    for (const [key, val] of Object.entries(r)) {
      if (!skipKeys.has(key) && val && typeof val !== 'object') {
        lines.push(kv(key, val, { color: c.blue }));
      }
    }

    if (i < records.length - 1) lines.push('');
  }

  lines.push(metaFooter(resp.meta));
  return lines.join('\n');
}

// ── Dossier person group display ──────────────────────────────────────────

function formatPersonGroup(person, idx) {
  const lines = [];
  const name = person.name || person.name_lat || 'Unknown';
  lines.push(`${c.dim}[${idx}]${c.reset} ${c.bold}${c.cyan}${name}${c.reset}  ${c.dim}(${person.records_count} records)${c.reset}`);

  if (person.name_lat && person.name_lat !== person.name) {
    lines.push(kv('Latin', person.name_lat));
  }
  if (person.dates_of_birth?.length) {
    lines.push(kv('DOB', person.dates_of_birth.join(', ')));
  }
  if (person.phones?.length) {
    lines.push(kv('Phones', person.phones.join(', '), { color: c.green }));
  }
  if (person.emails?.length) {
    lines.push(kv('Emails', person.emails.join(', '), { color: c.green }));
  }
  if (person.sources?.length) {
    lines.push(kv('Sources', person.sources.join(', '), { color: c.dim }));
  }

  // Documents
  if (person.documents && typeof person.documents === 'object') {
    const docs = Array.isArray(person.documents) ? person.documents : Object.entries(person.documents);
    if (Array.isArray(person.documents)) {
      for (const d of person.documents) {
        lines.push(kv(d.field || 'Doc', d.value, { color: c.blue }));
      }
    } else {
      for (const [field, value] of Object.entries(person.documents)) {
        lines.push(kv(field, value, { color: c.blue }));
      }
    }
  }

  // Extra fields
  if (person.fields) {
    for (const [key, val] of Object.entries(person.fields)) {
      if (val) lines.push(kv(key, val));
    }
  }

  return lines.join('\n');
}

export function formatDossierResults(resp) {
  const lines = [];
  const people = resp.people || [];

  lines.push('');
  lines.push(divider(`${resp.type || 'dossier'} → ${resp.query || '?'}`));

  if (people.length === 0) {
    lines.push(`\n  ${c.yellow}No results found.${c.reset}`);
    lines.push(dossierFooter(resp));
    return lines.join('\n');
  }

  lines.push('');

  for (let i = 0; i < people.length; i++) {
    lines.push(formatPersonGroup(people[i], i + 1));
    if (i < people.length - 1) lines.push('');
  }

  lines.push(dossierFooter(resp));
  return lines.join('\n');
}

// ── Report display ────────────────────────────────────────────────────────

export function formatReportResults(resp) {
  const lines = [];

  lines.push('');
  lines.push(divider(`REPORT: ${resp.type || '?'} → ${resp.query || '?'}`));

  // Profile summary
  const p = resp.profile;
  if (p) {
    lines.push('');
    lines.push(`  ${c.bold}${c.white}Profile${c.reset}`);
    if (p.full_name?.value)   lines.push(kv('Name', `${p.full_name.value}${p.full_name.sources ? ` ${c.dim}(${p.full_name.sources} sources)${c.reset}` : ''}`));
    if (p.full_name_lat?.value && p.full_name_lat.value !== p.full_name?.value)
      lines.push(kv('Latin', p.full_name_lat.value));
    if (p.date_of_birth?.value) lines.push(kv('DOB', p.date_of_birth.value));
    if (p.gender?.value)        lines.push(kv('Gender', p.gender.value));
    if (p.citizenship?.value)   lines.push(kv('Citizenship', p.citizenship.value));
  }

  // Documents
  if (resp.documents?.length) {
    lines.push('');
    lines.push(`  ${c.bold}${c.white}Documents${c.reset}`);
    for (const d of resp.documents) {
      const src = d.source_names?.length ? ` ${c.dim}(${d.source_names.join(', ')})${c.reset}` : '';
      lines.push(kv(d.field, `${c.blue}${d.value}${c.reset}${src}`));
    }
  }

  // Phones
  if (resp.phones?.length) {
    lines.push('');
    lines.push(`  ${c.bold}${c.white}Phones${c.reset}`);
    for (const ph of resp.phones) {
      lines.push(kv('☎', `${c.green}${ph.value}${c.reset}${ph.sources ? ` ${c.dim}(${ph.sources} src)${c.reset}` : ''}`));
    }
  }

  // Emails
  if (resp.emails?.length) {
    lines.push('');
    lines.push(`  ${c.bold}${c.white}Emails${c.reset}`);
    for (const em of resp.emails) {
      lines.push(kv('✉', `${c.green}${em.value}${c.reset}${em.sources ? ` ${c.dim}(${em.sources} src)${c.reset}` : ''}`));
    }
  }

  // Addresses
  if (resp.addresses?.length) {
    lines.push('');
    lines.push(`  ${c.bold}${c.white}Addresses${c.reset}`);
    for (const a of resp.addresses) {
      lines.push(kv('📍', `${a.value}${a.sources ? ` ${c.dim}(${a.sources} src)${c.reset}` : ''}`));
    }
  }

  // Employment
  if (resp.employment) {
    lines.push('');
    lines.push(`  ${c.bold}${c.white}Employment${c.reset}`);
    if (resp.employment.employer)   lines.push(kv('Employer', resp.employment.employer));
    if (resp.employment.occupation) lines.push(kv('Occupation', resp.employment.occupation));
  }

  // Usernames
  if (resp.usernames?.length) {
    lines.push('');
    lines.push(`  ${c.bold}${c.white}Usernames${c.reset}`);
    for (const u of resp.usernames) {
      const val = typeof u === 'string' ? u : (u.value || u.username || JSON.stringify(u));
      lines.push(kv('@', val, { color: c.magenta }));
    }
  }

  // Key facts
  if (resp.key_facts?.length) {
    lines.push('');
    lines.push(`  ${c.bold}${c.white}Key Facts${c.reset}`);
    for (const f of resp.key_facts) {
      const text = typeof f === 'string' ? f : (f.text || f.fact || JSON.stringify(f));
      lines.push(`  ${c.yellow}•${c.reset} ${text}`);
    }
  }

  // People clusters
  if (resp.people?.length) {
    lines.push('');
    lines.push(divider('People Clusters'));
    for (let i = 0; i < resp.people.length; i++) {
      const pe = resp.people[i];
      lines.push('');
      const subject = pe.is_subject ? ` ${c.bgGreen}${c.white} SUBJECT ${c.reset}` : '';
      const score = pe.match_score !== undefined ? ` ${c.yellow}score:${pe.match_score}${c.reset}` : '';
      lines.push(`  ${c.dim}[${i + 1}]${c.reset} ${c.bold}${c.cyan}${pe.name || 'Unknown'}${c.reset}${subject}${score}`);
      if (pe.match_reason) lines.push(`      ${c.dim}${pe.match_reason}${c.reset}`);
      if (pe.dob)          lines.push(kv('DOB', pe.dob));
      if (pe.gender)       lines.push(kv('Gender', pe.gender));
      if (pe.citizenship)  lines.push(kv('Citizenship', pe.citizenship));
      if (pe.phones?.length)  lines.push(kv('Phones', pe.phones.join(', '), { color: c.green }));
      if (pe.emails?.length)  lines.push(kv('Emails', pe.emails.join(', '), { color: c.green }));
      if (pe.documents?.length) {
        for (const d of pe.documents) {
          lines.push(kv(d.field, d.value, { color: c.blue }));
        }
      }
      lines.push(kv('Records', `${pe.record_count || 0} from ${pe.source_count || '?'} sources`));
    }
  }

  // Confidence
  if (resp.confidence) {
    lines.push('');
    lines.push(`  ${c.bold}${c.white}Confidence${c.reset}`);
    for (const [k, v] of Object.entries(resp.confidence)) {
      lines.push(kv(k, typeof v === 'number' ? `${v}%` : String(v)));
    }
  }

  // Footer
  const meta = {
    total: resp.total_records,
    returned: resp.record_count,
    cost_usd: resp.cost_usd,
    balance_remaining_usd: resp.balance_usd,
    request_id: resp.request_id,
  };
  lines.push(metaFooter(meta));

  return lines.join('\n');
}

// ── Message display ───────────────────────────────────────────────────────

export function formatMessages(resp) {
  const lines = [];
  const msgs = resp.data || [];

  if (msgs.length === 0) {
    lines.push(`\n  ${c.yellow}No messages found.${c.reset}`);
    lines.push(metaFooter(resp.meta));
    return lines.join('\n');
  }

  lines.push('');

  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    const typeTag = m.msg_type ? `${c.dim}[${m.msg_type}]${c.reset}` : '';
    const date = m.posted_at ? new Date(m.posted_at * 1000).toISOString().slice(0, 16).replace('T', ' ') : '';

    lines.push(`${c.dim}[${i + 1}]${c.reset} ${typeTag} ${c.cyan}${m.from_username || '?'}${c.reset} ${date ? `${c.dim}${date}${c.reset}` : ''}`);
    if (m.to_usernames?.length) lines.push(kv('To', m.to_usernames.join(', ')));
    if (m.subject)   lines.push(kv('Subject', m.subject, { color: c.bold }));
    if (m.source_file) lines.push(kv('Source', m.source_file, { color: c.dim }));

    // Show highlighted snippet or body preview
    if (m._hl?.length) {
      const snippet = m._hl[0].replace(/<em>/g, c.yellow + c.bold).replace(/<\/em>/g, c.reset);
      lines.push(kv('Match', truncate(snippet, 120)));
    } else if (m.body) {
      lines.push(kv('Body', truncate(m.body, 120)));
    }

    if (i < msgs.length - 1) lines.push('');
  }

  lines.push(metaFooter(resp.meta));
  return lines.join('\n');
}

// ── Account display ───────────────────────────────────────────────────────

export function formatAccount(data) {
  const lines = [];
  lines.push('');
  lines.push(divider('Account'));
  lines.push(kv('Key', data.key_prefix || '?'));
  lines.push(kv('User ID', data.user_id));
  lines.push(kv('Balance', `${c.green}$${(data.balance_usd ?? 0).toFixed(2)}${c.reset}`, { color: '' }));
  lines.push(kv('Rate limit', `${data.rate_limit || 100} req/min`));
  lines.push(kv('Cost/request', `$${(data.cost_per_request_usd ?? 0.30).toFixed(2)}`));
  if (data.allowed_ips?.length) {
    lines.push(kv('Allowed IPs', data.allowed_ips.join(', ')));
  }
  return lines.join('\n');
}
