import { supabase } from './utils/supabaseClient.js';
import { pool } from './db/pool.js';

const tables = [
  'employee_registry',
  'employee_schedule',
  'employees',
  'employee_requests',
  'employee_dependents',
  'employee_documents',
  'employee_contracts',
  'employees_archive',
  'users',
  'users_archive',
  'employee_dependents_archive',
  'employee_documents_archive',
  'employee_contracts_archive',
  'incident_reports',
  'incident_reports_archive',       // added archive
  'audit_logs',
  'employee_attendance',
  'employee_attendance_archive',    // added archive
];

function getKeyColumn(table) {
  switch (table) {
    case 'employees':
    case 'employees_archive':
      return 'employee_id';
    case 'employee_contracts':
    case 'employee_contracts_archive':
      return 'contract_id';
    case 'employee_dependents':
    case 'employee_dependents_archive':
      return 'id';
    case 'employee_documents':
    case 'employee_documents_archive':
      return 'document_id';
    case 'employee_requests':
      return 'request_id';
    case 'users':
    case 'users_archive':
      return 'account_id';
    case 'employee_schedule':       
      return 'schedule_id';
    case 'audit_logs':
      return 'log_id';
    case 'incident_reports':
    case 'incident_reports_archive':   // added archive
      return 'incident_id';
    case 'employee_attendance':
    case 'employee_attendance_archive': // added archive
      return 'attendance_id';
    default:
      return 'id';
  }
}

async function syncTable(tableName) {
  const keyColumn = getKeyColumn(tableName);

  try {
    const { rows: pgRows } = await pool.query(`SELECT * FROM ${tableName}`);
    const pgKeys = pgRows.map(r => r[keyColumn]);

    const { data: sbRows, error: sbError } = await supabase
      .from(tableName)
      .select(keyColumn);
    if (sbError) throw sbError;

    const sbKeys = sbRows.map(r => r[keyColumn]);

    // Delete Supabase rows that no longer exist in Postgres
    const toDelete = sbKeys.filter(k => !pgKeys.includes(k));
    if (toDelete.length > 0) {
      const { error: delError } = await supabase
        .from(tableName)
        .delete()
        .in(keyColumn, toDelete);
      if (delError) console.error(`❌ ${tableName} delete error:`, delError);
    }

    // Upsert Postgres rows into Supabase in chunks
    const chunkSize = 100;
    for (let i = 0; i < pgRows.length; i += chunkSize) {
      const chunk = pgRows.slice(i, i + chunkSize);
      const { error } = await supabase
        .from(tableName)
        .upsert(chunk, { onConflict: keyColumn });
      if (error) console.error(`❌ ${tableName} upsert error:`, error);
    }

    console.log(`✅ ${tableName} synced successfully`);
  } catch (err) {
    console.error(`❌ ${tableName} sync error:`, err.message);
  }
}

async function syncAllTables() {
  try {
    for (const table of tables) {
      await syncTable(table);
    }
    console.log('✅ All tables fully synced to Supabase!');
  } catch (err) {
    console.error('❌ Failed to sync all tables:', err.message);
  } finally {
    await pool.end();
  }
}

// Run the sync
syncAllTables();
