
// async function createDefaultAdmin() {
//   const email = 'TheCrunch@gmail.com' 
//   const password = 'TheCrunchBS@123'
//   const fullname = "The Crunch Bagong Silang"
//   const role = 'Admin' 

//   try {
//     const check = await pool.query('SELECT * FROM users WHERE email = $1', [email])
//     if (check.rows.length > 0) {
//       console.log('❌ Admin already exists.')
//       process.exit(0)
//     }

//     const hash = await argon2.hash(password, 12)

//     const result = await pool.query(
//       `INSERT INTO users (email, password, fullname, role)
//        VALUES ($1, $2, $3, 'Admin')
//        RETURNING email, fullname, created_at;`,
//       [email, hash, fullname]
//     )

//     console.log('✅ Default admin account created:')
//     console.table(result.rows)
//     console.log('\n👉 Login with:')
//     console.log(`   Email: ${email}`)
//     console.log(`   Password: ${password}`)
//   } catch (err) {
//     console.error('⚠️ Error inserting admin:', err.message)
//   } finally {
//     await pool.end()
//   }
// }

// createDefaultAdmin()