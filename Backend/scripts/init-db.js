const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

async function initializeDatabase() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Surya@1234',
        multipleStatements: true
    });

    try {
        // First create and use the database
        await connection.query('DROP DATABASE IF EXISTS hostel_management');
        await connection.query('CREATE DATABASE hostel_management');
        await connection.query('USE hostel_management');

        // Read and execute the schema file
        const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
        const schema = await fs.readFile(schemaPath, 'utf8');

        // Execute the entire schema
        await connection.query(schema);

        // Verify all tables were created
        const tables = [
            'users',
            'students',
            'teachers',
            'rooms',
            'room_allocations',
            'fee_types',
            'student_fee_assignments',
            'hostel_fees',
            'gate_passes',
            'complaints',
            'attendance',
            'notifications',
            'maintenance_requests',
            'visitors'
        ];

        // Check each table
        for (const table of tables) {
            const [rows] = await connection.query(`
                SELECT COUNT(*) as count 
                FROM information_schema.tables 
                WHERE table_schema = 'hostel_management' 
                AND table_name = ?`, 
                [table]
            );

            if (rows[0].count === 0) {
                throw new Error(`Table ${table} was not created properly`);
            } else {
                console.log(`Table ${table} verified successfully`);
            }
        }

        console.log('Database initialized successfully! All tables created and verified.');

    } catch (error) {
        console.error('Error during database initialization:', error);
        throw error; // Re-throw to ensure the script fails if there's an error
    } finally {
        await connection.end();
    }
}

// Run the initialization
initializeDatabase()
    .then(() => {
        console.log('Database setup completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Failed to setup database:', error);
        process.exit(1);
    }); 