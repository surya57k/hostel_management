const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
    // Create a connection without specifying a database
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Surya@1234'
    });

    try {
        console.log('Connected to MySQL server');
        
        // Read the schema.sql file
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        
        // Split the SQL file into individual statements
        const statements = schemaSQL.split(';').filter(statement => statement.trim());
        
        // Execute each statement
        for (let statement of statements) {
            if (statement.trim()) {
                try {
                    await connection.query(statement);
                    console.log('Executed SQL statement successfully');
                } catch (err) {
                    console.error('Error executing statement:', err.message);
                    console.error('Statement:', statement);
                }
            }
        }
        
        console.log('Database initialization completed');
    } catch (error) {
        console.error('Error initializing database:', error);
    } finally {
        await connection.end();
    }
}

// Run the initialization
initializeDatabase(); 