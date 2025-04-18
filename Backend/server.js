const express = require("express");
const mysql = require("mysql2/promise"); // Changed to mysql2 for better Promise support
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();

// Import routes
const studentRoutes = require('./routes/student');
const teacherRoutes = require('./routes/teacher');
const roomRoutes = require('./routes/rooms');

// Updated CORS configuration
app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'null'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Enable pre-flight requests for all routes
app.options('*', cors());

app.use(express.json());

// MySQL Connection Pool instead of single connection
const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "Surya@1234",
    database: "hostel_management",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test database connection
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log("Connected to MySQL Database");
        connection.release();
    } catch (err) {
        console.error("Database connection failed:", err);
        process.exit(1);
    }
}

testConnection();

const JWT_SECRET = "your_secret_key";

// JWT Middleware for protected routes
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: "Access denied" });
    
    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified;
        next();
    } catch (err) {
        res.status(403).json({ error: "Invalid token" });
    }
};

// Add email check endpoint
app.get("/check-email/:email", async (req, res) => {
    try {
        const [users] = await pool.execute(
            "SELECT COUNT(*) as count FROM users WHERE email = ?",
            [req.params.email]
        );
        res.json({ exists: users[0].count > 0 });
    } catch (error) {
        res.status(500).json({ error: "Failed to check email" });
    }
});

// Modify registration endpoint with better duplicate handling
app.post("/register", async (req, res) => {
    const { 
        name, 
        email, 
        phone, 
        password, 
        role, 
        student_dept, 
        roll_no, 
        year, 
        section, 
        teacher_dept, 
        teacher_id, 
        post 
    } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !password || !role) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        // Check if email exists first
        const [existingUsers] = await pool.execute(
            "SELECT COUNT(*) as count FROM users WHERE email = ?",
            [email]
        );
        
        if (existingUsers[0].count > 0) {
            return res.status(409).json({ 
                error: "Email already registered",
                field: "email"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Use Promise for better error handling
        const [userInsert] = await pool.execute(
            "INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)",
            [name, email, phone, hashedPassword, role]
        );

        const userId = userInsert.insertId;

        if (role === "student") {
            if (!student_dept || !roll_no || !year || !section) {
                return res.status(400).json({ error: "Missing student details" });
            }
            await pool.execute(
                "INSERT INTO students (user_id, student_dept, roll_no, year, section) VALUES (?, ?, ?, ?, ?)",
                [userId, student_dept, roll_no, year, section]
            );
        } else if (role === "teacher") {
            if (!teacher_dept || !teacher_id || !post) {
                return res.status(400).json({ error: "Missing teacher details" });
            }
            await pool.execute(
                "INSERT INTO teachers (user_id, teacher_dept, teacher_id, post) VALUES (?, ?, ?, ?)",
                [userId, teacher_dept, teacher_id, post]
            );
        }

        res.status(201).json({ 
            message: `${role.charAt(0).toUpperCase() + role.slice(1)} registered successfully!`,
            userId
        });

    } catch (error) {
        console.error("Registration error:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            if (error.sqlMessage.includes('email')) {
                return res.status(409).json({ 
                    error: "This email is already registered",
                    field: "email"
                });
            }
            if (error.sqlMessage.includes('roll_no')) {
                return res.status(409).json({ 
                    error: "This roll number is already registered",
                    field: "roll_no"
                });
            }
            if (error.sqlMessage.includes('teacher_id')) {
                return res.status(409).json({ 
                    error: "This teacher ID is already registered",
                    field: "teacher_id"
                });
            }
            return res.status(409).json({ 
                error: "A unique field value is already in use",
            });
        }
        res.status(500).json({ error: "Registration failed. Please try again." });
    }
});

// Modified Login endpoint with better error handling
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const [users] = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);
        
        if (users.length === 0) {
            return res.status(401).json({ error: "Invalid email or password" });
        }
        
        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        
        const token = jwt.sign(
            { id: user.id, role: user.role }, 
            JWT_SECRET, 
            { expiresIn: "24h" }
        );
        
        // Fetch additional user details based on role
        let additionalDetails = {};
        if (user.role === 'student') {
            const [studentDetails] = await pool.execute(
                "SELECT * FROM students WHERE user_id = ?", 
                [user.id]
            );
            if (studentDetails.length > 0) {
                additionalDetails = studentDetails[0];
            }
        } else if (user.role === 'teacher') {
            const [teacherDetails] = await pool.execute(
                "SELECT * FROM teachers WHERE user_id = ?", 
                [user.id]
            );
            if (teacherDetails.length > 0) {
                additionalDetails = teacherDetails[0];
            }
        }
        
        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                ...additionalDetails
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Server error. Please try again." });
    }
});

// Protected routes example
app.get("/rooms", authenticateToken, async (req, res) => {
    try {
        const [rooms] = await pool.execute("SELECT * FROM rooms WHERE available_slots > 0");
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch rooms" });
    }
});

// Update the assign-room endpoint to use Promise-based pool
app.post("/assign-room", authenticateToken, async (req, res) => {
    try {
        const { studentId, roomId } = req.body;
        
        // Check if user is a teacher
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ error: "Only teachers can assign rooms" });
        }
        
        await pool.execute(
            "UPDATE students SET room_id = ? WHERE user_id = ?", 
            [roomId, studentId]
        );
        
        await pool.execute(
            "UPDATE rooms SET available_slots = available_slots - 1 WHERE room_id = ?", 
            [roomId]
        );
        
        res.json({ message: "Room assigned successfully!" });
    } catch (error) {
        res.status(500).json({ error: "Failed to assign room" });
    }
});

// Update fee-status endpoint to use Promise-based pool
app.get("/fee-status/:userId", authenticateToken, async (req, res) => {
    try {
        // Ensure users can only access their own fee status
        if (req.user.role === 'student' && req.user.id !== parseInt(req.params.userId)) {
            return res.status(403).json({ error: "Access denied" });
        }
        
        const [fees] = await pool.execute(
            "SELECT * FROM hostel_fees WHERE user_id = ?", 
            [req.params.userId]
        );
        
        res.json(fees.length > 0 ? fees : { message: "No fee record found" });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch fee status" });
    }
});

// Add new endpoint for student profile
app.get("/profile", authenticateToken, async (req, res) => {
    try {
        const [user] = await pool.execute(
            "SELECT id, name, email, role, phone FROM users WHERE id = ?",
            [req.user.id]
        );
        
        if (!user[0]) {
            return res.status(404).json({ error: "User not found" });
        }

        let additionalDetails = {};
        if (req.user.role === 'student') {
            const [details] = await pool.execute(
                "SELECT student_dept, roll_no, year, section, room_id FROM students WHERE user_id = ?",
                [req.user.id]
            );
            additionalDetails = details[0] || {};
        }
        
        res.json({ ...user[0], ...additionalDetails });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch profile" });
    }
});

// Use routes
app.use('/api/rooms', roomRoutes);

// Mount routes
app.use('/api/student', studentRoutes);
app.use('/api/teacher', teacherRoutes);

// Start Server
app.listen(5000, () => {
    console.log("Server is running on port 5000");
});
