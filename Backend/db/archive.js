export async function createArchiveTable(client) {
    // Employees archive
    await client.query(`
        CREATE TABLE IF NOT EXISTS employees_archive (
            employee_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            fullname VARCHAR(100),
            nickname VARCHAR(50),
            email VARCHAR(100),
            position VARCHAR(100),
            employment_type VARCHAR(50),
            gender VARCHAR(10),
            contact VARCHAR(20),
            marital_status VARCHAR(20),
            birthday DATE,
            address VARCHAR(150),
            sss_number VARCHAR(20),
            pagibig VARCHAR(20),
            philhealth VARCHAR(20),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            current_status VARCHAR(20),
            status VARCHAR(20)
        );
    `);

    // Employees documents archive
    await client.query(`
        CREATE TABLE IF NOT EXISTS employees_documents_archive (
            document_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            employee_id UUID NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
            sss_id VARCHAR(255),
            resume_cv VARCHAR(255),
            pagibig VARCHAR(255),
            philhealth VARCHAR(255),
            barangay_clearance VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Employee dependents archive
    await client.query(`
        CREATE TABLE IF NOT EXISTS employees_dependents_archive (
            id SERIAL PRIMARY KEY,
            employee_id UUID REFERENCES employees(employee_id) ON DELETE CASCADE,
            fullname VARCHAR(100),
            relationship VARCHAR(50),
            address VARCHAR(150),
            contact VARCHAR(20),
            city VARCHAR(50),
            postalcode VARCHAR(10),
            gcash_number VARCHAR(20)
        );
    `);

    console.log("✅ Employees archive tables ready");
}
