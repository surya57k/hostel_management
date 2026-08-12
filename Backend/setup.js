const fs = require('fs');
const path = require('path');

// Create .env file if it doesn't exist
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

if (!fs.existsSync(envPath)) {
    const envContent = `# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_database_password
DB_NAME=hostel_management

# Server Configuration
PORT=5000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_refresh_secret_key_here

# API Configuration
API_BASE_URL=http://localhost:5000/api

# CORS Configuration
FRONTEND_URL=http://localhost:5500,http://127.0.0.1:5500
`;

    fs.writeFileSync(envPath, envContent);
    console.log('✅ Created .env file');
    console.log('⚠️  Please update the database password and JWT secrets in .env file');
} else {
    console.log('✅ .env file already exists');
}

console.log('\n📋 Setup Instructions:');
console.log('1. Update database password in .env file');
console.log('2. Update JWT secrets in .env file');
console.log('3. Run: npm install');
console.log('4. Run: node init_db.js (to setup database)');
console.log('5. Run: npm start (to start the server)');
