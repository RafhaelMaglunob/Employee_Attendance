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
        const { error } = await supabase
            .from(table)
            .upsert(row, { onConflict: primaryKey });
        if (error) console.error(`Supabase sync error [${table}]:`, error.message);
    } catch (err) {
        console.error(`Supabase sync failed [${table}]:`, err.message);
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
