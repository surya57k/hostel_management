const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const router = express.Router();

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

        // Generate JWT Token
        const token = jwt.sign({ userId: user.id, role: user.role }, "secret_key", { expiresIn: "1h" });

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

        res.json({ message: "Login successful!", token, user: userDetails });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error. Try again!" });
    }
});
