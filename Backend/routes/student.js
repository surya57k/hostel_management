const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

// Get student profile
router.get('/profile', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // First verify the user exists
        const [users] = await db.execute(
            "SELECT id, name, email, phone, role FROM users WHERE id = ?",
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                error: 'Profile not found',
                message: 'User not found'
            });
        }

        // Get student specific details
        const [students] = await db.execute(
            "SELECT student_dept, roll_no, year, section FROM students WHERE user_id = ?",
            [userId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Profile not found',
                message: 'Student details not found'
            });
        }

        // Combine user and student data
        const profile = {
            ...users[0],
            ...students[0]
        };

        res.json(profile);
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch profile',
            message: 'An error occurred while fetching profile data'
        });
    }
});

// Get room details
router.get('/rooms', auth, async (req, res) => {
    try {
        const [rooms] = await db.execute('SELECT * FROM rooms WHERE available_slots > 0');
        res.json(rooms);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch rooms' });
    }
});

// Handle room selection
router.post('/select-room', auth, async (req, res) => {
    const { room_id } = req.body;
    try {
        // Check if the room has available slots
        const [room] = await db.execute('SELECT available_slots FROM rooms WHERE room_id = ?', [room_id]);
        if (room.length === 0 || room[0].available_slots <= 0) {
            return res.status(400).json({ error: 'Room is not available' });
        }

        // Allocate room to the student
        await db.execute('INSERT INTO room_allocations (student_id, room_id) VALUES (?, ?)', [req.user.id, room_id]);
        await db.execute('UPDATE rooms SET available_slots = available_slots - 1 WHERE room_id = ?', [room_id]);

        res.json({ message: 'Room selected successfully' });
    } catch (error) {
        console.error('Error selecting room:', error);
        res.status(500).json({ error: 'Failed to select room' });
    }
});

// Get fee details
router.get('/fees', auth, async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        // First get the student ID for the logged-in user
        const [studentRows] = await db.execute(
            'SELECT id FROM students WHERE user_id = ?',
            [req.user.id]
        );

        if (studentRows.length === 0) {
            return res.status(404).json({ error: 'Student record not found' });
        }

        // Get fee details with proper table joins
        const [fees] = await db.execute(`
            SELECT hf.* 
            FROM hostel_fees hf
            JOIN student_fee_assignments sfa ON hf.assignment_id = sfa.assignment_id
            JOIN students s ON sfa.student_id = s.id
            WHERE s.user_id = ?`,
            [req.user.id]
        );

        // Get total assigned fees
        const [totalFees] = await db.execute(`
            SELECT SUM(amount) as total_assigned
            FROM student_fee_assignments sfa
            JOIN students s ON sfa.student_id = s.id
            WHERE s.user_id = ?`,
            [req.user.id]
        );

        // Calculate total paid amount
        const totalPaid = fees.reduce((sum, fee) => sum + fee.amount_paid, 0);
        const totalAssigned = totalFees[0].total_assigned || 0;

        // Return structured fee data
        res.json({
            total_fee: totalAssigned,
            paid: totalPaid,
            remaining: totalAssigned - totalPaid,
            history: fees.map(fee => ({
                receipt_id: fee.receipt_id,
                date: fee.payment_date,
                amount: fee.amount_paid,
                method: fee.payment_method,
                transaction_id: fee.transaction_id,
                status: fee.status
            })),
            due_date: fees.length > 0 ? fees[0].due_date : null
        });
    } catch (error) {
        console.error('Error fetching fees:', error);
        res.status(500).json({ error: 'Failed to fetch fee details' });
    }
});

// Submit gate pass request
router.post('/gate-pass', auth, async (req, res) => {
    const { reason, leave_date, return_date } = req.body;
    try {
        await db.execute(
            'INSERT INTO gate_passes (user_id, reason, leave_date, return_date) VALUES (?, ?, ?, ?)',
            [req.user.id, reason, leave_date, return_date]
        );
        res.json({ message: 'Gate pass request submitted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to submit gate pass request' });
    }
});

// Gate pass endpoints
router.get('/gate-passes', auth, async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const [passes] = await db.execute(
            'SELECT * FROM gate_passes WHERE user_id = ?', 
            [req.user.id]
        );
        res.json(passes);
    } catch (error) {
        console.error('Error fetching gate passes:', error);
        res.status(500).json({ error: 'Failed to fetch gate passes' });
    }
});

// Submit complaint
router.post('/complaints', auth, async (req, res) => {
    const { complaint, category } = req.body;
    try {
        await db.execute(
            'INSERT INTO complaints (user_id, complaint, category) VALUES (?, ?, ?)',
            [req.user.id, complaint, category]
        );
        res.json({ message: 'Complaint submitted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to submit complaint' });
    }
});

// Complaints endpoints
router.get('/complaints', auth, async (req, res) => {
    try {
        const [complaints] = await db.execute(
            'SELECT * FROM complaints WHERE user_id = ?',
            [req.user.id]
        );
        res.json(complaints);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch complaints' });
    }
});

// Add endpoint to fetch allocated room details
router.get('/allocated-room', auth, async (req, res) => {
    try {
        // First get the student ID
        const [studentRows] = await db.execute(
            'SELECT id FROM students WHERE user_id = ?',
            [req.user.id]
        );

        if (studentRows.length === 0) {
            return res.status(404).json({ error: 'Student record not found' });
        }

        const studentId = studentRows[0].id;

        // Get room details with all necessary information
        const [rooms] = await db.execute(`
            SELECT r.room_number, r.block, r.floor, r.room_type, r.capacity,
                   ra.allocated_date, ra.status as allocation_status,
                   GROUP_CONCAT(DISTINCT u.name) as roommates
            FROM room_allocations ra
            JOIN rooms r ON ra.room_id = r.room_id
            LEFT JOIN room_allocations ra2 ON r.room_id = ra2.room_id 
                AND ra2.status = 'active' 
                AND ra2.student_id != ?
            LEFT JOIN students s ON ra2.student_id = s.id
            LEFT JOIN users u ON s.user_id = u.id
            WHERE ra.student_id = ? AND ra.status = 'active'
            GROUP BY r.room_id`,
            [studentId, studentId]
        );

        if (rooms.length === 0) {
            return res.status(404).json({ error: 'No room allocated' });
        }

        res.json(rooms[0]);
    } catch (error) {
        console.error('Error fetching allocated room:', error);
        res.status(500).json({ error: 'Failed to fetch allocated room details' });
    }
});

// Update the attendance endpoint with better error handling
router.get('/attendance', auth, async (req, res) => {
    try {
        // First check if the user exists
        const [studentRows] = await db.execute(
            'SELECT id FROM students WHERE user_id = ?',
            [req.user.id]
        );

        if (studentRows.length === 0) {
            return res.status(404).json({ 
                error: 'Student not found',
                message: 'Student record not found in the database'
            });
        }

        const studentId = studentRows[0].id;

        // Check if attendance table exists
        const [tableCheck] = await db.execute(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = 'hostel_management' 
            AND table_name = 'attendance'
        `);

        if (tableCheck[0].count === 0) {
            // Create attendance table if it doesn't exist
            await db.execute(`
                CREATE TABLE IF NOT EXISTS attendance (
                    attendance_id INT AUTO_INCREMENT PRIMARY KEY,
                    student_id INT NOT NULL,
                    date DATE NOT NULL,
                    status ENUM('present', 'absent', 'leave') NOT NULL,
                    marked_by INT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (student_id) REFERENCES students(id),
                    FOREIGN KEY (marked_by) REFERENCES teachers(id),
                    INDEX idx_date (date),
                    INDEX idx_status (status),
                    UNIQUE KEY unique_student_date (student_id, date)
                )
            `);
        }

        // Get attendance records
        const [attendance] = await db.execute(`
            SELECT a.*, 
                   u.name as marked_by_name
            FROM attendance a
            LEFT JOIN teachers t ON a.marked_by = t.id
            LEFT JOIN users u ON t.user_id = u.id
            WHERE a.student_id = ?
            AND a.date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
            ORDER BY a.date DESC`,
            [studentId]
        );

        // Return empty array if no records
        if (attendance.length === 0) {
            return res.json({
                attendance_records: [],
                statistics: {
                    total_days: 0,
                    present_days: 0,
                    absent_days: 0,
                    leave_days: 0,
                    attendance_percentage: 0
                }
            });
        }

        // Calculate statistics
        const totalDays = attendance.length;
        const presentDays = attendance.filter(a => a.status === 'present').length;
        const absentDays = attendance.filter(a => a.status === 'absent').length;
        const leaveDays = attendance.filter(a => a.status === 'leave').length;

        res.json({
            attendance_records: attendance,
            statistics: {
                total_days: totalDays,
                present_days: presentDays,
                absent_days: absentDays,
                leave_days: leaveDays,
                attendance_percentage: totalDays ? (presentDays / totalDays * 100).toFixed(2) : 0
            }
        });

    } catch (error) {
        console.error('Error fetching attendance:', error);
        res.status(500).json({ 
            error: 'Failed to fetch attendance records',
            message: error.message
        });
    }
});

// Add announcements endpoint
router.get('/announcements', auth, async (req, res) => {
    try {
        // Get announcements for the last 30 days
        const [announcements] = await db.execute(`
            SELECT n.*, 
                   u.name as posted_by_name
            FROM notifications n
            JOIN users u ON n.user_id = u.id
            WHERE n.type = 'info'
            AND n.created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
            ORDER BY n.created_at DESC
            LIMIT 50`
        );

        res.json(announcements);
    } catch (error) {
        console.error('Error fetching announcements:', error);
        res.status(500).json({ error: 'Failed to fetch announcements' });
    }
});

// Add endpoint to mark announcement as read
router.post('/announcements/:id/read', auth, async (req, res) => {
    try {
        await db.execute(
            'UPDATE notifications SET is_read = TRUE WHERE notification_id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        res.json({ message: 'Announcement marked as read' });
    } catch (error) {
        console.error('Error marking announcement as read:', error);
        res.status(500).json({ error: 'Failed to mark announcement as read' });
    }
});

// Add endpoint to get fee status (more detailed than the existing /fees endpoint)
router.get('/fee-status', auth, async (req, res) => {
    try {
        // Get student ID
        const [studentRows] = await db.execute(
            'SELECT id FROM students WHERE user_id = ?',
            [req.user.id]
        );

        if (studentRows.length === 0) {
            return res.status(404).json({ error: 'Student record not found' });
        }

        const studentId = studentRows[0].id;

        // Get all fee assignments and payments
        const [assignments] = await db.execute(`
            SELECT sfa.*, 
                   ft.name as fee_type_name,
                   ft.description as fee_type_description,
                   (
                       SELECT COALESCE(SUM(amount_paid), 0)
                       FROM hostel_fees
                       WHERE assignment_id = sfa.assignment_id
                       AND status = 'completed'
                   ) as total_paid
            FROM student_fee_assignments sfa
            JOIN fee_types ft ON sfa.fee_type_id = ft.fee_type_id
            WHERE sfa.student_id = ?
            ORDER BY sfa.due_date ASC`,
            [studentId]
        );

        // Calculate totals and format response
        const totalAssigned = assignments.reduce((sum, a) => sum + Number(a.amount), 0);
        const totalPaid = assignments.reduce((sum, a) => sum + Number(a.total_paid), 0);

        res.json({
            summary: {
                total_assigned: totalAssigned,
                total_paid: totalPaid,
                total_pending: totalAssigned - totalPaid
            },
            current_semester: assignments.filter(a => new Date(a.due_date) >= new Date()),
            payment_history: assignments.map(a => ({
                fee_type: a.fee_type_name,
                description: a.fee_type_description,
                amount: a.amount,
                paid: a.total_paid,
                pending: a.amount - a.total_paid,
                due_date: a.due_date,
                status: a.status
            }))
        });
    } catch (error) {
        console.error('Error fetching fee status:', error);
        res.status(500).json({ error: 'Failed to fetch fee status' });
    }
});

module.exports = router;
