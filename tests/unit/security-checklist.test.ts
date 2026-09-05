import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('security checklist', () => {
  it('enables RLS for every table created by migrations', () => {
    const migrationDir = path.join(root, 'supabase', 'migrations');
    for (const file of fs.readdirSync(migrationDir).filter((name) => name.endsWith('.sql'))) {
      const sql = read(path.join('supabase', 'migrations', file));
      const tables = [...sql.matchAll(/create table public\.([a-z_]+)/gi)].map((match) => match[1]);
      for (const table of tables) {
        const lower = sql.toLowerCase();
        const hasStaticRls = lower.includes(`alter table public.${table} enable row level security`);
        const hasDynamicRls = lower.includes('execute format') && lower.includes('enable row level security');
        expect(hasStaticRls || hasDynamicRls, `${file}: ${table} RLS declaration`).toBe(true);
      }
    }
  });

  it('does not expose service role credentials to the client', () => {
    const source = fs.readdirSync(path.join(root, 'src'), { recursive: true }).filter((file) => String(file).endsWith('.ts') || String(file).endsWith('.tsx')).map((file) => read(path.join('src', String(file)))).join('\n');
    expect(source).not.toMatch(/NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE/i);
    expect(source).not.toMatch(/NEXT_PUBLIC_[A-Z0-9_]*SECRET/i);
  });

  it('keeps app routes behind AAL2 and exports behind a second server-side check', () => {
    const proxy = read('src/lib/supabase/proxy.ts');
    expect(proxy).toContain("'/analysis'");
    expect(proxy).toContain("currentLevel !== 'aal2'");
    expect(read('src/app/api/export/transactions/route.ts')).toContain("currentLevel !== 'aal2'");
    expect(read('src/app/api/export/all/route.ts')).toContain("currentLevel !== 'aal2'");
  });
});
