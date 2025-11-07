// utils/syncToSupabase.js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

/**
 * Upsert a row into any table by primary key
 * @param {string} table Supabase table name
 * @param {object} row Row data, must include primary key
 * @param {string} primaryKey Name of the primary key column
 */
export async function syncRow(table, row, primaryKey = 'id') {
    try {
        console.log(`📤 Syncing ${table}:`, { [primaryKey]: row[primaryKey], status: row.status });

        if (table === 'employee_fingerprints') {
            // For fingerprints, use the fingerprint_id as conflict target
            const { error } = await supabase
                .from(table)
                .upsert(row, { onConflict: primaryKey });
            
            if (error) {
                // If it's a duplicate slot error for a deleted record, that's OK
                if (error.code === '23505' && row.status === 'Deleted') {
                    console.log(`✅ Fingerprint slot already handled (status: ${row.status})`);
                    return;
                }
                console.error(`❌ Supabase sync error [${table}]:`, error.message);
                console.error(`   Details:`, error.details);
                return;
            }
            
            console.log(`✅ ${table} synced successfully (${row.status})`);
        } else {
            // For other tables, use standard upsert
            const { error } = await supabase
                .from(table)
                .upsert(row, { onConflict: primaryKey });
            
            if (error) {
                console.error(`❌ Supabase sync error [${table}]:`, error.message);
                return;
            }
            
            console.log(`✅ ${table} synced successfully`);
        }
    } catch (err) {
        console.error(`❌ Supabase sync failed [${table}]:`, err.message);
    }
}

/**
 * Delete a row from any table
 */
export async function deleteRow(table, primaryKey, value) {
    try {
        const { error } = await supabase
            .from(table)
            .delete()
            .eq(primaryKey, value);
        if (error) console.error(`Supabase delete error [${table}]:`, error.message);
    } catch (err) {
        console.error(`Supabase delete failed [${table}]:`, err.message);
    }
}

export async function restoreRow(table, primaryKey = 'id', value) {
    try {
        const { error } = await supabase
            .from(table)
            .delete()
            .eq(primaryKey, value);
        if (error) console.error(`Supabase restore error [${table}]:`, error.message);
    } catch (err) {
        console.error(`Supabase restore failed [${table}]:`, err.message);
    }
}