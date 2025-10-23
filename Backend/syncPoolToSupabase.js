import { supabase } from './utils/supabaseClient.js';
import { pool } from './db/pool.js';

const tables = [
  // Parent tables first, children later
  'employee_registry',
  'employees',
  'employee_account',
  'employee_dependents',
  'employee_documents',
  'employee_contracts',
  'employees_archive',
  'employee_account_archive',
  'employee_dependents_archive',
  'employee_documents_archive',
  'employee_contracts_archive',
  'admin_account',
  'employee_work_logs',
  'incident_reports',
  'audit_logs',
  'employee_attendance',
];

function getKeyColumn(table) {
  if (table === 'employees' || table === 'employees_archive') return 'employee_id';
  if (table === 'employee_contracts' || table === 'employee_contracts_archive') return 'contract_id';
  if (table === 'employee_dependents' || table === 'employee_dependents_archive') return 'id';
  if (table === 'employee_documents' || table === 'employee_documents_archive') return 'document_id';
  if (table === 'employee_account' || table === 'employee_account_archive') return 'account_id';
  if (table === 'admin_account') return 'admin_id';
  if (table === 'audit_logs' || table === 'employee_work_logs') return 'log_id';
  if (table === 'incident_reports') return 'incident_id';
  if (table === 'employee_attendance') return 'attendance_id';
  return 'id';
}

async function syncTable(tableName) {
  const keyColumn = getKeyColumn(tableName);

  try {
    const { rows: pgRows } = await pool.query(`SELECT * FROM ${tableName}`);
    const pgKeys = pgRows.map(r => r[keyColumn]);

    // 1️⃣ Fetch existing Supabase rows
    const { data: sbRows, error: sbError } = await supabase.from(tableName).select(keyColumn);
    if (sbError) throw sbError;

    const sbKeys = sbRows.map(r => r[keyColumn]);

    // 2️⃣ Delete Supabase rows that no longer exist in Postgres (children first)
    const toDelete = sbKeys.filter(k => !pgKeys.includes(k));
    if (toDelete.length > 0) {
      const { error: delError } = await supabase.from(tableName).delete().in(keyColumn, toDelete);
      if (delError) console.error(`${tableName} delete error:`, delError);
    }

    // 3️⃣ Upsert current Postgres rows
    // Use chunked upsert to avoid Supabase rate-limit issues for large tables
    const chunkSize = 100;
    for (let i = 0; i < pgRows.length; i += chunkSize) {
      const chunk = pgRows.slice(i, i + chunkSize);
      const { error } = await supabase.from(tableName).upsert(chunk, { onConflict: keyColumn });
      if (error) console.error(`${tableName} upsert error:`, error);
    }

    console.log(`✅ ${tableName} synced successfully`);
  } catch (err) {
    console.error(`${tableName} sync error:`, err.message);
  }
}

async function syncAllTables() {
  for (const table of tables) {
    await syncTable(table);
  }
  await pool.end();
  console.log('✅ All tables fully synced to Supabase!');
}

syncAllTables();
