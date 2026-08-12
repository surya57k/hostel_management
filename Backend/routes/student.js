const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const crypto = require('crypto');
const qrcode = require('qrcode');


// ============================================================
// STUDENT PROFILE
// ============================================================

router.get('/profile', auth, async (req, res) => {
    try {

        const [rows] = await db.execute(`
            SELECT
                u.id,
                u.name,
                u.email,
                u.phone,
                u.role,
                s.id AS student_id,
                s.student_dept,
                s.roll_no,
                s.year,
                s.section
            FROM users u
            LEFT JOIN students s
                ON u.id = s.user_id
            WHERE u.id = ?
        `, [req.user.id]);


        if (rows.length === 0) {

            return res.status(404).json({
                error: 'Profile not found'
            });

        }


        res.json(rows[0]);


    } catch (error) {

        console.error(
            'Profile fetch error:',
            error
        );


        res.status(500).json({
            error: 'Failed to fetch profile'
        });

    }
});


// ============================================================
// AVAILABLE ROOMS
// ============================================================

router.get('/rooms', auth, async (req, res) => {

    try {

        const [rooms] = await db.execute(`
            SELECT
                r.*,
                (r.capacity - r.available_slots)
                    AS occupied_slots
            FROM rooms r
            WHERE r.available_slots > 0
              AND r.status = 'available'
            ORDER BY
                r.block,
                r.floor,
                r.room_number
        `);


        res.json(rooms);


    } catch (error) {

        console.error(
            'Error fetching rooms:',
            error
        );


        res.status(500).json({
            error: 'Failed to fetch rooms'
        });

    }
});


// ============================================================
// SELECT / ALLOCATE ROOM
// ============================================================

router.post('/select-room', auth, async (req, res) => {

    try {

        const { room_id } = req.body;


        // ----------------------------------------------------
        // Validate room ID
        // ----------------------------------------------------

        if (!room_id) {

            return res.status(400).json({
                error: 'room_id is required'
            });

        }


        // ----------------------------------------------------
        // Find student
        // ----------------------------------------------------

        const [studentRows] =
            await db.execute(`

                SELECT
                    id

                FROM students

                WHERE user_id = ?

                LIMIT 1

            `, [
                req.user.id
            ]);


        if (studentRows.length === 0) {

            return res.status(404).json({
                error: 'Student record not found'
            });

        }


        const studentId =
            studentRows[0].id;


        // ----------------------------------------------------
        // Check existing active allocation
        // ----------------------------------------------------

        const [existing] =
            await db.execute(`

                SELECT

                    ra.id,

                    ra.room_id,

                    r.room_number

                FROM room_allocations ra

                JOIN rooms r
                    ON ra.room_id = r.id

                WHERE ra.student_id = ?

                AND ra.status = 'active'

                LIMIT 1

            `, [
                studentId
            ]);


        if (existing.length > 0) {

            return res.status(400).json({

                error:
                    'You already have an active room allocation',

                room:
                    existing[0]

            });

        }


        // ----------------------------------------------------
        // Check selected room
        // ----------------------------------------------------

        const [roomRows] =
            await db.execute(`

                SELECT

                    id,

                    room_number,

                    available_slots,

                    status

                FROM rooms

                WHERE id = ?

                LIMIT 1

            `, [
                room_id
            ]);


        if (roomRows.length === 0) {

            return res.status(404).json({
                error: 'Room not found'
            });

        }


        const room =
            roomRows[0];


        // ----------------------------------------------------
        // Check room availability
        // ----------------------------------------------------

        if (
            Number(room.available_slots) <= 0 ||
            room.status !== 'available'
        ) {

            return res.status(400).json({
                error: 'Room is not available'
            });

        }


        // ----------------------------------------------------
        // Create room allocation
        // ----------------------------------------------------

        await db.execute(`

            INSERT INTO room_allocations
            (
                student_id,
                room_id,
                status
            )

            VALUES (?, ?, 'active')

        `, [

            studentId,

            room_id

        ]);


        // ----------------------------------------------------
        // Decrease available slots
        // ----------------------------------------------------

        const newAvailableSlots =
            Number(room.available_slots) - 1;


        const newStatus =
            newAvailableSlots <= 0
                ? 'full'
                : 'available';


        await db.execute(`

            UPDATE rooms

            SET

                available_slots = ?,

                status = ?,

                updated_at =
                    CURRENT_TIMESTAMP

            WHERE id = ?

        `, [

            newAvailableSlots,

            newStatus,

            room_id

        ]);


        // ----------------------------------------------------
        // Success
        // ----------------------------------------------------

        res.json({

            success: true,

            message:
                'Room selected successfully',

            room: {

                id:
                    room.id,

                room_number:
                    room.room_number,

                available_slots:
                    newAvailableSlots,

                status:
                    newStatus

            }

        });


    } catch (error) {

        console.error(
            'Error selecting room:',
            error
        );


        res.status(500).json({

            error:
                error.sqlMessage ||
                error.message ||
                'Failed to select room'

        });

    }

});



// ============================================================
// STUDENT FEES
// ============================================================

router.get('/fees', auth, async (req, res) => {

    try {

        const [studentRows] =
            await db.execute(

                `SELECT id
                 FROM students
                 WHERE user_id = ?`,

                [req.user.id]

            );


        if (studentRows.length === 0) {

            return res.status(404).json({
                error: 'Student record not found'
            });

        }


        const studentId =
            studentRows[0].id;


        // Payment history
        const [fees] =
            await db.execute(`

                SELECT

                    hf.id,

                    hf.receipt_id,

                    hf.payment_date,

                    hf.amount_paid,

                    hf.payment_method,

                    hf.transaction_id,

                    hf.status,

                    sfa.id AS assignment_id,

                    sfa.amount AS assigned_amount,

                    sfa.due_date,

                    ft.name AS fee_type_name

                FROM hostel_fees hf

                JOIN student_fee_assignments sfa
                    ON hf.assignment_id = sfa.id

                JOIN fee_types ft
                    ON sfa.fee_type_id = ft.id

                WHERE sfa.student_id = ?

                ORDER BY
                    hf.payment_date DESC,
                    hf.id DESC

            `, [
                studentId
            ]);


        // Total assigned fee
        const [assignments] =
            await db.execute(`

                SELECT
                    COALESCE(
                        SUM(amount),
                        0
                    ) AS total_assigned

                FROM student_fee_assignments

                WHERE student_id = ?

            `, [
                studentId
            ]);


        // Total paid fee
        const [paidRows] =
            await db.execute(`

                SELECT

                    COALESCE(
                        SUM(hf.amount_paid),
                        0
                    ) AS total_paid

                FROM hostel_fees hf

                JOIN student_fee_assignments sfa
                    ON hf.assignment_id = sfa.id

                WHERE sfa.student_id = ?

                AND hf.status = 'completed'

            `, [
                studentId
            ]);


        const totalAssigned =
            Number(
                assignments[0].total_assigned || 0
            );


        const totalPaid =
            Number(
                paidRows[0].total_paid || 0
            );


        res.json({

            total_fee:
                totalAssigned,

            paid:
                totalPaid,

            remaining:
                Math.max(
                    0,
                    totalAssigned -
                    totalPaid
                ),

            history:
                fees.map(fee => ({

                    receipt_id:
                        fee.receipt_id,

                    date:
                        fee.payment_date,

                    amount:
                        Number(
                            fee.amount_paid
                        ),

                    method:
                        fee.payment_method,

                    transaction_id:
                        fee.transaction_id,

                    status:
                        fee.status,

                    fee_type:
                        fee.fee_type_name,

                    due_date:
                        fee.due_date

                })),

            due_date:
                fees.length > 0
                    ? fees[0].due_date
                    : null

        });


    } catch (error) {

        console.error(
            'Error fetching fees:',
            error
        );


        res.status(500).json({
            error:
                'Failed to fetch fee details'
        });

    }

});


// ============================================================
// GATE PASS - CREATE
// ============================================================

router.post('/gate-pass', auth, async (req, res) => {

    const {
        reason,
        leave_date,
        return_date
    } = req.body;


    if (
        !reason ||
        !leave_date ||
        !return_date
    ) {

        return res.status(400).json({

            error:
                'reason, leave_date and return_date are required'

        });

    }


    try {

        await db.execute(

            `INSERT INTO gate_passes
                (
                    user_id,
                    reason,
                    leave_date,
                    return_date
                )

             VALUES (?, ?, ?, ?)`,

            [
                req.user.id,
                reason,
                leave_date,
                return_date
            ]

        );


        res.json({
            message:
                'Gate pass request submitted'
        });


    } catch (error) {

        console.error(
            'Error submitting gate pass:',
            error
        );


        res.status(500).json({
            error:
                'Failed to submit gate pass request'
        });

    }

});


// ============================================================
// GATE PASS - GET
// ============================================================

router.get('/gate-passes', auth, async (req, res) => {

    try {

        const [passes] =
            await db.execute(

                `SELECT *
                 FROM gate_passes
                 WHERE user_id = ?
                 ORDER BY created_at DESC`,

                [req.user.id]

            );


        res.json(passes);


    } catch (error) {

        console.error(
            'Error fetching gate passes:',
            error
        );


        res.status(500).json({
            error:
                'Failed to fetch gate passes'
        });

    }

});


// ============================================================
// SUBMIT COMPLAINT
// ============================================================

router.post('/complaints', auth, async (req, res) => {

    /*
        Supports both old frontend field names:

        complaint + category

        and new names:

        description + subject
    */

    const {
        complaint,
        category,
        subject,
        description
    } = req.body;


    const finalSubject =
        subject || category;


    const finalDescription =
        description || complaint;


    if (
        !finalSubject ||
        !finalDescription
    ) {

        return res.status(400).json({

            error:
                'Subject/category and complaint/description are required'

        });

    }


    try {

        const [studentRows] =
            await db.execute(

                `SELECT id
                 FROM students
                 WHERE user_id = ?`,

                [req.user.id]

            );


        if (studentRows.length === 0) {

            return res.status(404).json({

                error:
                    'Student record not found'

            });

        }


        const studentId =
            studentRows[0].id;


        /*
            complaints table contains:

            student_id
            subject
            description

            It does NOT contain:

            room_id
            user_id
            complaint
            category
        */


        await db.execute(

            `INSERT INTO complaints
                (
                    student_id,
                    subject,
                    description
                )

             VALUES (?, ?, ?)`,

            [
                studentId,
                finalSubject,
                finalDescription
            ]

        );


        res.json({

            message:
                'Complaint submitted successfully'

        });


    } catch (error) {

        console.error(
            'Error submitting complaint:',
            error
        );


        res.status(500).json({

            error:
                'Failed to submit complaint'

        });

    }

});


// ============================================================
// GET STUDENT COMPLAINTS
// ============================================================

router.get('/complaints', auth, async (req, res) => {

    try {

        const [complaints] =
            await db.execute(`

                SELECT

                    c.*,

                    r.room_number,

                    r.block,

                    u_teacher.name AS resolved_by_name

                FROM complaints c

                /*
                    complaints
                        ↓
                    students
                        ↓
                    room_allocations
                        ↓
                    rooms
                */

                LEFT JOIN room_allocations ra
                    ON ra.student_id = c.student_id
                   AND ra.status = 'active'

                LEFT JOIN rooms r
                    ON ra.room_id = r.id

                /*
                    resolved_by points to teachers.id
                */

                LEFT JOIN teachers t
                    ON c.resolved_by = t.id

                LEFT JOIN users u_teacher
                    ON t.user_id = u_teacher.id

                WHERE c.student_id = (

                    SELECT id

                    FROM students

                    WHERE user_id = ?

                )

                ORDER BY c.created_at DESC

            `, [
                req.user.id
            ]);


        res.json({
            complaints
        });


    } catch (error) {

        console.error(
            'Error fetching complaints:',
            error
        );


        res.status(500).json({

            error:
                'Failed to fetch complaints'

        });

    }

});


// ============================================================
// GET CURRENTLY ALLOCATED ROOM
// ============================================================

router.get('/allocated-room', auth, async (req, res) => {

    try {

        const [rows] =
            await db.execute(`

                SELECT

                    r.id,

                    r.room_number,

                    r.block,

                    r.floor,

                    r.room_type,

                    r.capacity,

                    r.available_slots,

                    ra.allocated_date,

                    ra.status AS allocation_status,

                    (

                        SELECT

                            GROUP_CONCAT(

                                DISTINCT u2.name

                                ORDER BY u2.name

                                SEPARATOR ', '

                            )

                        FROM room_allocations ra2

                        JOIN students s2
                            ON ra2.student_id = s2.id

                        JOIN users u2
                            ON s2.user_id = u2.id

                        WHERE ra2.room_id = r.id

                        AND ra2.status = 'active'

                        AND ra2.student_id <> s.id

                    ) AS roommates

                FROM students s

                JOIN room_allocations ra
                    ON s.id = ra.student_id

                JOIN rooms r
                    ON ra.room_id = r.id

                WHERE s.user_id = ?

                AND ra.status = 'active'

                LIMIT 1

            `, [
                req.user.id
            ]);


        if (rows.length === 0) {

            return res.status(404).json({

                error:
                    'No room allocated'

            });

        }


        const room =
            rows[0];


        room.roommates =
            room.roommates
                ? room.roommates.split(', ')
                : [];


        res.json(room);


    } catch (error) {

        console.error(
            'Error fetching allocated room:',
            error
        );


        res.status(500).json({

            error:
                'Failed to fetch room details'

        });

    }

});


// ============================================================
// ATTENDANCE
// ============================================================

router.get('/attendance', auth, async (req, res) => {

    try {

        const [attendance] =
            await db.execute(`

                SELECT

                    a.*,

                    u.name AS marked_by_name

                FROM attendance a

                LEFT JOIN teachers t
                    ON a.marked_by = t.id

                LEFT JOIN users u
                    ON t.user_id = u.id

                JOIN students s
                    ON a.student_id = s.id

                WHERE s.user_id = ?

                AND a.date >=
                    DATE_SUB(
                        CURRENT_DATE,
                        INTERVAL 30 DAY
                    )

                ORDER BY a.date DESC

            `, [
                req.user.id
            ]);


        const totalDays =
            attendance.length;


        const presentDays =
            attendance.filter(
                a =>
                    a.status === 'present'
            ).length;


        const absentDays =
            attendance.filter(
                a =>
                    a.status === 'absent'
            ).length;


        const leaveDays =
            attendance.filter(
                a =>
                    a.status === 'leave'
            ).length;


        const percentage =
            totalDays
                ? (
                    (
                        presentDays /
                        totalDays
                    ) * 100
                ).toFixed(2)
                : 0;


        res.json({

            attendance_records:
                attendance,

            statistics: {

                total_days:
                    totalDays,

                present_days:
                    presentDays,

                absent_days:
                    absentDays,

                leave_days:
                    leaveDays,

                attendance_percentage:
                    Number(percentage)

            }

        });


    } catch (error) {

        console.error(
            'Error fetching attendance:',
            error
        );


        res.status(500).json({

            error:
                'Failed to fetch attendance records'

        });

    }

});


// ============================================================
// ANNOUNCEMENTS
// ============================================================

router.get('/announcements', auth, async (req, res) => {

    try {

        const [announcements] =
            await db.execute(`

                SELECT

                    n.*,

                    u.name AS posted_by_name,

                    CASE

                        WHEN nr.id IS NULL
                        THEN FALSE

                        ELSE TRUE

                    END AS is_read

                FROM notifications n

                JOIN users u
                    ON n.created_by = u.id

                LEFT JOIN notification_reads nr
                    ON nr.notification_id = n.id

                   AND nr.user_id = ?

                WHERE n.type IN ('info', 'warning', 'important')

                AND n.created_at >=
                    DATE_SUB(
                        CURRENT_DATE,
                        INTERVAL 30 DAY
                    )

                ORDER BY
                    n.created_at DESC

                LIMIT 50

            `, [
                req.user.id
            ]);


        res.json({
            announcements
        });


    } catch (error) {

        console.error(
            'Error fetching announcements:',
            error
        );


        res.status(500).json({

            error:
                'Failed to fetch announcements'

        });

    }

});


// ============================================================
// MARK ANNOUNCEMENT AS READ
// ============================================================

router.post(
    '/announcements/:id/read',
    auth,
    async (req, res) => {

        try {

            await db.execute(`

                INSERT INTO notification_reads
                    (
                        notification_id,
                        user_id
                    )

                VALUES (?, ?)

                ON DUPLICATE KEY UPDATE
                    read_at =
                        CURRENT_TIMESTAMP

            `, [

                req.params.id,

                req.user.id

            ]);


            res.json({

                message:
                    'Announcement marked as read'

            });


        } catch (error) {

            console.error(
                'Error marking announcement as read:',
                error
            );


            res.status(500).json({

                error:
                    'Failed to mark announcement as read'

            });

        }

    }
);


// ============================================================
// FEE STATUS
// ============================================================

router.get('/fee-status', auth, async (req, res) => {

    try {

        const [assignments] =
            await db.execute(`

                SELECT

                    sfa.id AS assignment_id,

                    sfa.amount,

                    sfa.due_date,

                    sfa.status,

                    ft.name AS fee_type_name,

                    ft.description AS fee_type_description,

                    COALESCE(

                        (

                            SELECT
                                SUM(
                                    hf.amount_paid
                                )

                            FROM hostel_fees hf

                            WHERE hf.assignment_id =
                                sfa.id

                            AND hf.status =
                                'completed'

                        ),

                        0

                    ) AS total_paid

                FROM student_fee_assignments sfa

                JOIN students s
                    ON sfa.student_id = s.id

                JOIN fee_types ft
                    ON sfa.fee_type_id = ft.id

                WHERE s.user_id = ?

                ORDER BY
                    sfa.due_date ASC

            `, [
                req.user.id
            ]);


        const formatted =
            assignments.map(a => ({

                ...a,

                amount:
                    Number(a.amount),

                total_paid:
                    Number(a.total_paid),

                pending:
                    Math.max(
                        0,
                        Number(a.amount) -
                        Number(a.total_paid)
                    )

            }));


        const totalAssigned =
            formatted.reduce(

                (sum, a) =>
                    sum + a.amount,

                0

            );


        const totalPaid =
            formatted.reduce(

                (sum, a) =>
                    sum + a.total_paid,

                0

            );


        res.json({

            summary: {

                total_assigned:
                    totalAssigned,

                total_paid:
                    totalPaid,

                total_pending:
                    Math.max(
                        0,
                        totalAssigned -
                        totalPaid
                    )

            },

            current_semester:
                formatted,

            payment_history:
                formatted.map(a => ({

                    fee_type:
                        a.fee_type_name,

                    description:
                        a.fee_type_description,

                    amount:
                        a.amount,

                    paid:
                        a.total_paid,

                    pending:
                        a.pending,

                    due_date:
                        a.due_date,

                    status:
                        a.status

                }))

        });


    } catch (error) {

        console.error(
            'Error fetching fee status:',
            error
        );


        res.status(500).json({

            error:
                'Failed to fetch fee status'

        });

    }

});

// ============================================================
// FEE PAYMENT - DEMO PAYMENT
// ============================================================

router.post('/fee-payment/:assignmentId', auth, async (req, res) => {

    try {

        const assignmentId =
            Number(req.params.assignmentId);

        if (!assignmentId) {
            return res.status(400).json({
                error: 'Invalid fee assignment ID'
            });
        }


        // --------------------------------------------------------
        // Find logged-in student's student ID
        // --------------------------------------------------------

        const [studentRows] =
            await db.execute(`
                SELECT id
                FROM students
                WHERE user_id = ?
                LIMIT 1
            `, [
                req.user.id
            ]);


        if (studentRows.length === 0) {

            return res.status(404).json({
                error: 'Student record not found'
            });

        }


        const studentId =
            studentRows[0].id;


        // --------------------------------------------------------
        // Find the fee assignment
        // --------------------------------------------------------

        const [assignmentRows] =
            await db.execute(`
                SELECT
                    sfa.id,
                    sfa.student_id,
                    sfa.amount,
                    sfa.due_date,
                    sfa.status,
                    ft.name AS fee_type_name

                FROM student_fee_assignments sfa

                JOIN fee_types ft
                    ON sfa.fee_type_id = ft.id

                WHERE sfa.id = ?
                AND sfa.student_id = ?

                LIMIT 1
            `, [
                assignmentId,
                studentId
            ]);


        if (assignmentRows.length === 0) {

            return res.status(404).json({
                error: 'Fee assignment not found'
            });

        }


        const assignment =
            assignmentRows[0];


        // --------------------------------------------------------
        // Check whether already paid
        // --------------------------------------------------------

        if (assignment.status === 'paid') {

            return res.status(400).json({
                error: 'This fee has already been paid'
            });

        }


        // --------------------------------------------------------
        // Calculate amount already paid
        // --------------------------------------------------------

        const [paidRows] =
            await db.execute(`
                SELECT
                    COALESCE(
                        SUM(amount_paid),
                        0
                    ) AS total_paid

                FROM hostel_fees

                WHERE assignment_id = ?

                AND status = 'completed'
            `, [
                assignmentId
            ]);


        const totalPaid =
            Number(
                paidRows[0].total_paid || 0
            );


        const remainingAmount =
            Number(assignment.amount) -
            totalPaid;


        if (remainingAmount <= 0) {

            await db.execute(`
                UPDATE student_fee_assignments
                SET status = 'paid'
                WHERE id = ?
            `, [
                assignmentId
            ]);


            return res.status(400).json({
                error: 'This fee has already been fully paid'
            });

        }


        // --------------------------------------------------------
        // Generate demo transaction and receipt IDs
        // --------------------------------------------------------

        const transactionId =
            'TXN' +
            Date.now() +
            Math.floor(
                Math.random() * 1000
            );


        const receiptId =
            'REC' +
            Date.now() +
            Math.floor(
                Math.random() * 1000
            );


        // --------------------------------------------------------
        // Record payment
        //
        // This is a DEMO payment for the project.
        // No real money is processed.
        // --------------------------------------------------------

        await db.execute(`
            INSERT INTO hostel_fees
            (
                user_id,
                assignment_id,
                amount_paid,
                payment_date,
                payment_method,
                transaction_id,
                receipt_id,
                status
            )

            VALUES
            (
                ?,
                ?,
                ?,
                CURRENT_DATE,
                'online',
                ?,
                ?,
                'completed'
            )
        `, [
            req.user.id,
            assignmentId,
            remainingAmount,
            transactionId,
            receiptId
        ]);


        // --------------------------------------------------------
        // Update assignment status
        // --------------------------------------------------------

        await db.execute(`
            UPDATE student_fee_assignments
            SET status = 'paid'
            WHERE id = ?
        `, [
            assignmentId
        ]);


        // --------------------------------------------------------
        // Success response
        // --------------------------------------------------------

        res.json({

            success: true,

            message:
                'Payment completed successfully',

            payment: {

                assignment_id:
                    assignmentId,

                fee_type:
                    assignment.fee_type_name,

                amount:
                    remainingAmount,

                payment_method:
                    'online',

                transaction_id:
                    transactionId,

                receipt_id:
                    receiptId,

                status:
                    'completed'

            }

        });


    } catch (error) {

        console.error(
            'Fee payment error:',
            error
        );


        res.status(500).json({

            error:
                error.sqlMessage ||
                error.message ||
                'Failed to process fee payment'

        });

    }

});

// ============================================================
// ROOM DETAILS
// ============================================================

router.get('/room-details', auth, async (req, res) => {

    try {

        const [rows] =
            await db.execute(`

                SELECT

                    r.id,

                    r.block,

                    r.room_number,

                    r.floor,

                    r.room_type,

                    r.capacity,

                    r.available_slots,

                    ra.allocated_date,

                    (

                        SELECT

                            JSON_ARRAYAGG(

                                JSON_OBJECT(

                                    'name',
                                    u2.name,

                                    'roll_no',
                                    s2.roll_no,

                                    'department',
                                    s2.student_dept

                                )

                            )

                        FROM room_allocations ra2

                        JOIN students s2
                            ON ra2.student_id = s2.id

                        JOIN users u2
                            ON s2.user_id = u2.id

                        WHERE ra2.room_id = r.id

                        AND ra2.status = 'active'

                        AND s2.id <> s.id

                    ) AS roommates

                FROM students s

                JOIN room_allocations ra
                    ON s.id = ra.student_id

                JOIN rooms r
                    ON ra.room_id = r.id

                WHERE s.user_id = ?

                AND ra.status = 'active'

                LIMIT 1

            `, [
                req.user.id
            ]);


        if (rows.length === 0) {

            return res.status(404).json({

                error:
                    'No room allocated'

            });

        }


        const room =
            rows[0];


        if (
            typeof room.roommates === 'string'
        ) {

            try {

                room.roommates =
                    JSON.parse(
                        room.roommates
                    );

            } catch (_) {

                room.roommates = [];

            }

        }


        room.roommates =
            room.roommates || [];


        res.json(room);


    } catch (error) {

        console.error(
            'Error fetching room details:',
            error
        );


        res.status(500).json({

            error:
                'Failed to fetch room details'

        });

    }

});


// ============================================================
// GENERATE STUDENT QR CODE
// ============================================================

router.get('/generate-qr', auth, async (req, res) => {

    try {

        const userId =
            req.user.id;


        const qrSecret =
            crypto
                .randomBytes(32)
                .toString('hex');


        await db.execute(

            `UPDATE users

             SET

                qr_secret = ?,

                qr_generated_at =
                    CURRENT_TIMESTAMP

             WHERE id = ?`,

            [
                qrSecret,
                userId
            ]

        );


        const qrData =
            JSON.stringify({

                userId:
                    userId,

                secret:
                    qrSecret

            });


        const qrImage =
            await qrcode.toDataURL(
                qrData
            );


        res.json({
            qrImage
        });


    } catch (error) {

        console.error(
            'QR Generation error:',
            error
        );


        res.status(500).json({

            error:
                'Failed to generate QR code'

        });

    }

});


// ============================================================
// EXPORT ROUTER
// ============================================================

module.exports = router;