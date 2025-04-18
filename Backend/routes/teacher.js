const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

// Get all students
router.get('/students', auth, async (req, res) => {
    try {
        const [students] = await db.execute('SELECT * FROM students');
        res.json(students);
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ error: 'Failed to fetch students' });
    }
});

// Get student by ID
router.get('/student/:id', auth, async (req, res) => {
    try {
        const [student] = await db.execute('SELECT * FROM students WHERE id = ?', [req.params.id]);
        if (student.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }
        res.json(student[0]);
    } catch (error) {
        console.error('Error fetching student:', error);
        res.status(500).json({ error: 'Failed to fetch student' });
    }
});

// Add room allocation
router.post('/add-room-allocation', auth, async (req, res) => {
    const { student_id, room_id } = req.body;
    try {
        await db.query('INSERT INTO room_allocations (student_id, room_id, status) VALUES (?, ?, "active")', [student_id, room_id]);
        await db.query('UPDATE rooms SET available_slots = available_slots - 1 WHERE room_id = ?', [room_id]);
        res.json({ message: 'Room allocated successfully' });
    } catch (error) {
        console.error('Error allocating room:', error);
        res.status(500).json({ message: 'Error allocating room' });
    }
});

// Mark attendance
router.post('/attendance', auth, async (req, res) => {
    try {
        const { attendance } = req.body;
        const teacherId = req.user.teacher_id;
        
        // Start a transaction
        await db.beginTransaction();
        
        try {
            for (const record of attendance) {
                const { student_id, date, status } = record;
                
                await db.execute(
                    'INSERT INTO attendance (student_id, date, status, marked_by) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = ?, marked_by = ?',
                    [student_id, date, status, teacherId, status, teacherId]
                );
            }
            
            // Commit the transaction
            await db.commit();
            res.json({ message: 'Attendance marked successfully' });
        } catch (error) {
            // Rollback in case of error
            await db.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Error marking attendance:', error);
        res.status(500).json({ error: 'Failed to mark attendance' });
    }
});

// Get attendance report
router.get('/attendance-report', auth, async (req, res) => {
    try {
        const { from_date, to_date } = req.query;
        const [attendance] = await db.execute(`
            SELECT a.*, s.name, s.roll_no 
            FROM attendance a 
            JOIN students s ON a.student_id = s.id 
            WHERE a.date BETWEEN ? AND ?
            ORDER BY a.date DESC, s.roll_no
        `, [from_date, to_date]);
        res.json(attendance);
    } catch (error) {
        console.error('Error fetching attendance report:', error);
        res.status(500).json({ error: 'Failed to fetch attendance report' });
    }
});

// Verify fee payment
router.post('/verify-fee', auth, async (req, res) => {
    try {
        const { receipt_id, status } = req.body;
        await db.execute('UPDATE hostel_fees SET status = ? WHERE receipt_id = ?', [status, receipt_id]);
        res.json({ message: 'Fee payment verified successfully' });
    } catch (error) {
        console.error('Error verifying fee payment:', error);
        res.status(500).json({ error: 'Failed to verify fee payment' });
    }
});

// Get all fees
router.get('/fees', auth, async (req, res) => {
    try {
        const [fees] = await db.execute(`
            SELECT f.*, s.name, s.roll_no 
            FROM hostel_fees f 
            JOIN students s ON f.user_id = s.id
        `);
        res.json(fees);
    } catch (error) {
        console.error('Error fetching fees:', error);
        res.status(500).json({ error: 'Failed to fetch fees' });
    }
});

// Update room status
router.put('/update-room-status', auth, async (req, res) => {
    try {
        const { room_id, available_slots } = req.body;
        await db.execute('UPDATE rooms SET available_slots = ? WHERE room_id = ?', [available_slots, room_id]);
        res.json({ message: 'Room status updated successfully' });
    } catch (error) {
        console.error('Error updating room status:', error);
        res.status(500).json({ error: 'Failed to update room status' });
    }
});

// Get all rooms
router.get('/rooms', auth, async (req, res) => {
    try {
        const [rooms] = await db.query('SELECT * FROM rooms ORDER BY block, room_number');
        res.json(rooms);
    } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).json({ message: 'Error fetching rooms' });
    }
});

// Get all complaints
router.get('/complaints', auth, async (req, res) => {
    try {
        const [complaints] = await db.execute(`
            SELECT c.*, s.name as student_name, s.roll_no 
            FROM complaints c 
            JOIN students s ON c.user_id = s.id
        `);
        res.json(complaints);
    } catch (error) {
        console.error('Error fetching complaints:', error);
        res.status(500).json({ error: 'Failed to fetch complaints' });
    }
});

// Update complaint status
router.put('/update-complaint', auth, async (req, res) => {
    try {
        const { complaint_id, status } = req.body;
        await db.execute('UPDATE complaints SET status = ? WHERE id = ?', [status, complaint_id]);
        res.json({ message: 'Complaint status updated successfully' });
    } catch (error) {
        console.error('Error updating complaint status:', error);
        res.status(500).json({ error: 'Failed to update complaint status' });
    }
});

// Get all gate passes
router.get('/gate-passes', auth, async (req, res) => {
    try {
        const [gatePasses] = await db.execute(`
            SELECT g.*, s.name as student_name, s.roll_no 
            FROM gate_passes g 
            JOIN students s ON g.user_id = s.id
        `);
        res.json(gatePasses);
    } catch (error) {
        console.error('Error fetching gate passes:', error);
        res.status(500).json({ error: 'Failed to fetch gate passes' });
    }
});

// Update gate pass status
router.put('/update-gate-pass', auth, async (req, res) => {
    try {
        const { pass_id, status } = req.body;
        await db.execute('UPDATE gate_passes SET status = ? WHERE id = ?', [status, pass_id]);
        res.json({ message: 'Gate pass status updated successfully' });
    } catch (error) {
        console.error('Error updating gate pass status:', error);
        res.status(500).json({ error: 'Failed to update gate pass status' });
    }
});

module.exports = router;
