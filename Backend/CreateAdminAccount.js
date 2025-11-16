import { pool } from "./db/pool.js";
import argon2 from 'argon2';

async function createDefaultAdmin() {
    const email = 'TheCrunch@gmail.com' 
    const password = 'TheCrunchBS@123'
    const fullname = "The Crunch Bagong Silang"

    try {
        const check = await pool.query('SELECT * FROM users WHERE email = $1', [email])
        if (check.rows.length > 0) {
            console.log('⚠️ Admin exists. Updating password...')
            // Update existing admin password
            const hash = await argon2.hash(password, { type: argon2.argon2id })
            await pool.query(
                'UPDATE users SET password = $1 WHERE email = $2',
                [hash, email]
            )
            console.log('✅ Admin password updated!')
        } else {
            // Create new admin
            const hash = await argon2.hash(password, { type: argon2.argon2id })

            const result = await pool.query(
                `INSERT INTO users (email, password, fullname, role)
                VALUES ($1, $2, $3, 'Admin')
                RETURNING email, fullname, created_at;`,
                [email, hash, fullname]
            )

            console.log('✅ Default admin account created:')
            console.table(result.rows)
        }
        
        console.log('\n👉 Login with:')
        console.log(`   Email: ${email}`)
        console.log(`   Password: ${password}`)
    } catch (err) {
        console.error('⚠️ Error:', err.message)
    } finally {
        await pool.end()
    }
}

createDefaultAdmin()