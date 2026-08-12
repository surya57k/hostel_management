const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD, // Use environment variable
    database: process.env.DB_NAME || 'hostel_management',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Add connection monitoring
pool.on('connection', (connection) => {
    console.log('New database connection established');
});

pool.on('error', (err) => {
    console.error('Database pool error:', err);
});

// Add transaction helper
const withTransaction = async (callback) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const result = await callback(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

// Transaction methods for individual operations
const beginTransaction = async () => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    return connection;
};

const commit = async (connection) => {
    await connection.commit();
    connection.release();
};

const rollback = async (connection) => {
    await connection.rollback();
    connection.release();
};

// Test the connection
pool.getConnection()
    .then(connection => {
        console.log('Database connected successfully');
        connection.release();
    })
    .catch(error => {
        console.error('Error connecting to the database:', error);
    });

module.exports = {
    pool,
    withTransaction,
    beginTransaction,
    commit,
    rollback,
    execute: (...args) => pool.execute(...args),
    query: (...args) => pool.execute(...args) // Add query alias for compatibility
};
