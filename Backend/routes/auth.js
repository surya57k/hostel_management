const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const qrcode = require('qrcode');
const crypto = require('crypto');

const router = express.Router();

// Add refresh token secret - use environment variables
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret_key';
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || 'secret_key';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied' });
    }

    jwt.verify(token, ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

// Token generation - Standardized to use 'id' instead of 'userId'
const generateTokens = (user) => ({
    accessToken: jwt.sign(
        { id: user.id, role: user.role },
        ACCESS_TOKEN_SECRET,
        { expiresIn: '1h' }
    ),
    refreshToken: jwt.sign(
        { id: user.id },
        REFRESH_TOKEN_SECRET,
        { expiresIn: '7d' }
    )
});

// User Registration (Student & Teacher)
router.post("/register", async (req, res) => {
    const { name, email, phone, password, role, student_dept, roll_no, year, section, teacher_dept, teacher_id, post } = req.body;

    try {
        // Hash Password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert User
        const [userResult] = await db.execute(
            "INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, ?)",
            [name, email, phone, hashedPassword, role]
        );

        const userId = userResult.insertId; // Get User ID

        // Insert Student Data (If Student)
        if (role === "student") {
            await db.execute(
                "INSERT INTO students (user_id, student_dept, roll_no, year, section) VALUES (?, ?, ?, ?, ?)",
                [userId, student_dept, roll_no, year, section]
            );
        }

        // Insert Teacher Data (If Teacher)
        if (role === "teacher") {
            await db.execute(
                "INSERT INTO teachers (user_id, teacher_dept, teacher_id, post) VALUES (?, ?, ?, ?)",
                [userId, teacher_dept, teacher_id, post]
            );
        }

        res.status(201).json({ message: "Registration successful!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error. Try again!" });
    }
});

// User Login
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const [users] = await db.execute("SELECT * FROM users WHERE email = ?", [email]);

        if (users.length === 0) {
            return res.status(400).json({ error: "User not found!" });
        }

        const user = users[0];

        // Validate Password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: "Invalid credentials!" });
        }

        const tokens = generateTokens(user);
        await db.execute(
            "UPDATE users SET refresh_token = ? WHERE id = ?",
            [tokens.refreshToken, user.id]
        );

        // Fetch Additional Details
        let userDetails = { id: user.id, name: user.name, email: user.email, role: user.role };

        if (user.role === "student") {
            const [students] = await db.execute("SELECT * FROM students WHERE user_id = ?", [user.id]);
            if (students.length > 0) {
                userDetails = { ...userDetails, ...students[0] };
            }
        }

        if (user.role === "teacher") {
            const [teachers] = await db.execute("SELECT * FROM teachers WHERE user_id = ?", [user.id]);
            if (teachers.length > 0) {
                userDetails = { ...userDetails, ...teachers[0] };
            }
        }

        res.json({
            success: true,
            message: "Login successful!",
            token: tokens.accessToken,
            user: userDetails
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: error.message || "Server error",
            error: error.code
        });
    }
});

// Add refresh token endpoint
router.post("/refresh-token", async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: "Refresh token required"
            });
        }

        const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
        const [users] = await db.execute(
            "SELECT * FROM users WHERE id = ? AND refresh_token = ?",
            [decoded.id, refreshToken]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid refresh token"
            });
        }

        const tokens = generateTokens(users[0]);
        await db.execute(
            "UPDATE users SET refresh_token = ? WHERE id = ?",
            [tokens.refreshToken, users[0].id]
        );

        res.json({
            success: true,
            data: tokens
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            message: "Invalid refresh token"
        });
    }
});

// Generate QR code for user - Add authenticateToken middleware
router.get("/generate-qr", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id; // Standardized to use 'id'
        const qrSecret = crypto.randomBytes(32).toString('hex');
        
        // Store QR secret in database
        await db.execute(
            "UPDATE users SET qr_secret = ?, qr_generated_at = NOW() WHERE id = ?",
            [qrSecret, userId]
        );

        // Generate QR code containing user ID and secret
        const qrData = JSON.stringify({
            userId,
            secret: qrSecret
        });
        
        const qrImage = await qrcode.toDataURL(qrData);
        res.json({ qrImage });
    } catch (error) {
        console.error('QR Generation error:', error);
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

// Login with QR code - Update to include all user details
router.post("/qr-login", async (req, res) => {
    try {
        const { qrData } = req.body;
        let data;
        
        try {
            data = JSON.parse(qrData);
        } catch (error) {
            return res.status(400).json({ error: "Invalid QR code format" });
        }

        const [users] = await db.execute(
            "SELECT * FROM users WHERE id = ? AND qr_secret = ?",
            [data.userId, data.secret]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: "Invalid QR code" });
        }

        const user = users[0];
        const token = jwt.sign(
            { id: user.id, role: user.role },
            "secret_key",
            { expiresIn: "1h" }
        );

        // Fetch Additional Details
        let userDetails = { id: user.id, name: user.name, email: user.email, role: user.role };

        if (user.role === "student") {
            const [students] = await db.execute("SELECT * FROM students WHERE user_id = ?", [user.id]);
            userDetails = { ...userDetails, ...students[0] };
        }

        if (user.role === "teacher") {
            const [teachers] = await db.execute("SELECT * FROM teachers WHERE user_id = ?", [user.id]);
            userDetails = { ...userDetails, ...teachers[0] };
        }

        res.json({
            message: "Login successful!",
            token,
            user: userDetails
        });
    } catch (error) {
        console.error('QR Login error:', error);
        res.status(500).json({ error: "QR login failed" });
    }
});

// Get user profile with QR code
router.get("/profile", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id; // Standardized to use 'id'
        
        // Get user details with QR code
        const [users] = await db.execute(
            "SELECT id, name, email, role, qr_secret FROM users WHERE id = ?",
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        const user = users[0];
        let userDetails = { 
            id: user.id, 
            name: user.name, 
            email: user.email, 
            role: user.role 
        };

        // Get role-specific details
        if (user.role === "student") {
            const [students] = await db.execute(
                "SELECT * FROM students WHERE user_id = ?", 
                [userId]
            );
            userDetails = { ...userDetails, ...students[0] };
        } else if (user.role === "teacher") {
            const [teachers] = await db.execute(
                "SELECT * FROM teachers WHERE user_id = ?", 
                [userId]
            );
            userDetails = { ...userDetails, ...teachers[0] };
        }

        // Generate QR code if exists
        if (user.qr_secret) {
            const qrData = JSON.stringify({
                userId,
                secret: user.qr_secret
            });
            userDetails.qrImage = await qrcode.toDataURL(qrData);
        }

        res.json({ user: userDetails });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: "Failed to fetch profile" });
    }
});

// Regenerate QR code
router.post("/profile/regenerate-qr", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id; // Standardized to use 'id'
        const qrSecret = crypto.randomBytes(32).toString('hex');
        
        await db.execute(
            "UPDATE users SET qr_secret = ?, qr_generated_at = NOW() WHERE id = ?",
            [qrSecret, userId]
        );

        const qrData = JSON.stringify({
            userId,
            secret: qrSecret
        });
        
        const qrImage = await qrcode.toDataURL(qrData);
        res.json({ qrImage });
    } catch (error) {
        console.error('QR regeneration error:', error);
        res.status(500).json({ error: 'Failed to regenerate QR code' });
    }
});

// ============================================================
// CHANGE PASSWORD
// ============================================================

router.post("/change-password", authenticateToken, async (req, res) => {
    try {
        const {
            currentPassword,
            newPassword,
            confirmPassword
        } = req.body;

        // Validate fields
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                error: "All password fields are required"
            });
        }

        // Check new password confirmation
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                error: "New passwords do not match"
            });
        }

        // Basic password length validation
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                error: "New password must be at least 6 characters long"
            });
        }

        // Get current user
        const [users] = await db.execute(
            "SELECT id, password FROM users WHERE id = ?",
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                error: "User not found"
            });
        }

        const user = users[0];

        // Verify current password
        const passwordMatch = await bcrypt.compare(
            currentPassword,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                error: "Current password is incorrect"
            });
        }

        // Prevent using the same password
        const samePassword = await bcrypt.compare(
            newPassword,
            user.password
        );

        if (samePassword) {
            return res.status(400).json({
                success: false,
                error: "New password must be different from current password"
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(
            newPassword,
            10
        );

        // Update password
        await db.execute(
            "UPDATE users SET password = ? WHERE id = ?",
            [hashedPassword, req.user.id]
        );

        res.json({
            success: true,
            message: "Password changed successfully"
        });

    } catch (error) {

        console.error(
            "Change password error:",
            error
        );

        res.status(500).json({
            success: false,
            error: "Failed to change password"
        });
    }
});

module.exports = router;
