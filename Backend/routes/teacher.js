const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

// ============================================================
// TEACHER PROFILE
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
                t.id AS teacher_record_id,
                t.teacher_id,
                t.teacher_dept,
                t.post,
                t.created_at
            FROM users u
            LEFT JOIN teachers t
                ON u.id = t.user_id
            WHERE u.id = ?
        `, [req.user.id]);

        if (rows.length === 0) {
            return res.status(404).json({
                error: 'Teacher profile not found'
            });
        }

        res.json(rows[0]);

    } catch (error) {

        console.error('Teacher profile error:', error);

        res.status(500).json({
            error: 'Failed to fetch teacher profile'
        });
    }
});


// ============================================================
// DASHBOARD
// ============================================================

router.get('/dashboard', auth, async (req, res) => {

    try {

        const [students] = await db.execute(`
            SELECT COUNT(*) AS total_students
            FROM students
        `);


        const [rooms] = await db.execute(`
            SELECT

                COUNT(*) AS total_rooms,

                COALESCE(
                    SUM(
                        CASE
                            WHEN available_slots > 0
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS available_rooms

            FROM rooms
        `);


        const [complaints] = await db.execute(`
            SELECT

                COUNT(*) AS total_complaints,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'pending'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS pending_complaints

            FROM complaints
        `);


        const [gatePasses] = await db.execute(`
            SELECT

                COUNT(*) AS total_requests,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'pending'
                            THEN 1
                            ELSE 0
                        END
                    ),
                    0
                ) AS pending_requests

            FROM gate_passes
        `);


        res.json({

            students: students[0],

            rooms: rooms[0],

            complaints: complaints[0],

            gate_passes: gatePasses[0]

        });

    } catch (error) {

        console.error(
            'Teacher dashboard error:',
            error
        );

        res.status(500).json({
            error:
                'Failed to fetch dashboard data'
        });
    }
});


// ============================================================
// GET ALL STUDENTS
// ============================================================

router.get('/students', auth, async (req, res) => {

    try {

        const [students] = await db.execute(`

            SELECT

                s.id AS student_id,

                s.roll_no,
                s.student_dept,
                s.year,
                s.section,

                u.id AS user_id,
                u.name,
                u.email,
                u.phone,


                r.room_number,
                r.block,
                r.floor,
                r.room_type,


                ra.status AS room_status


            FROM students s


            JOIN users u
                ON s.user_id = u.id


            LEFT JOIN room_allocations ra
                ON s.id = ra.student_id
               AND ra.status = 'active'


            LEFT JOIN rooms r
                ON ra.room_id = r.id


            ORDER BY
                s.roll_no

        `);


        res.json(students);

    } catch (error) {

        console.error(
            'Error fetching students:',
            error
        );

        res.status(500).json({
            error:
                'Failed to fetch students'
        });
    }
});


// ============================================================
// GET STUDENT BY ID
// ============================================================

router.get('/students/:id', auth, async (req, res) => {

    try {

        const [students] = await db.execute(`

            SELECT

                s.id AS student_id,

                s.roll_no,
                s.student_dept,
                s.year,
                s.section,

                u.id AS user_id,
                u.name,
                u.email,
                u.phone,

                r.id AS room_id,
                r.room_number,
                r.block,
                r.floor,
                r.room_type,

                ra.allocated_date,
                ra.status AS room_status


            FROM students s


            JOIN users u
                ON s.user_id = u.id


            LEFT JOIN room_allocations ra
                ON s.id = ra.student_id
               AND ra.status = 'active'


            LEFT JOIN rooms r
                ON ra.room_id = r.id


            WHERE s.id = ?

            LIMIT 1

        `, [req.params.id]);


        if (students.length === 0) {

            return res.status(404).json({
                error:
                    'Student not found'
            });
        }


        res.json(students[0]);

    } catch (error) {

        console.error(
            'Error fetching student:',
            error
        );

        res.status(500).json({
            error:
                'Failed to fetch student'
        });
    }
});


// ============================================================
// ATTENDANCE - GET
// ============================================================

router.get('/attendance', auth, async (req, res) => {

    try {

        const {
            start_date,
            end_date
        } = req.query;


        let query = `

            SELECT

                a.id,

                a.student_id,

                a.date,

                a.status,

                a.marked_at,

                s.roll_no,

                s.student_dept,
                s.year,
                s.section,

                u.name AS student_name,


                teacher_user.name
                    AS marked_by_name


            FROM attendance a


            JOIN students s
                ON a.student_id = s.id


            JOIN users u
                ON s.user_id = u.id


            LEFT JOIN teachers t
                ON a.marked_by = t.id


            LEFT JOIN users teacher_user
                ON t.user_id = teacher_user.id

        `;


        const params = [];


        if (start_date && end_date) {

            query += `
                WHERE a.date
                BETWEEN ? AND ?
            `;

            params.push(
                start_date,
                end_date
            );
        }


        query += `

            ORDER BY
                a.date DESC,
                s.roll_no

        `;


        const [attendance] =
            await db.execute(
                query,
                params
            );


        res.json(attendance);

    } catch (error) {

        console.error(
            'Error fetching attendance:',
            error
        );

        res.status(500).json({
            error:
                'Failed to fetch attendance'
        });
    }
});


// ============================================================
// MARK ATTENDANCE
// ============================================================

router.post('/attendance', auth, async (req, res) => {

    const {
        student_id,
        date,
        status
    } = req.body;


    if (
        !student_id ||
        !date ||
        !status
    ) {

        return res.status(400).json({
            error:
                'student_id, date and status are required'
        });
    }


    const validStatuses = [
        'present',
        'absent',
        'leave'
    ];


    if (!validStatuses.includes(status)) {

        return res.status(400).json({
            error:
                'Invalid attendance status'
        });
    }


    try {

        // Get teacher ID
        const [teacherRows] =
            await db.execute(`

                SELECT id
                FROM teachers
                WHERE user_id = ?

            `, [req.user.id]);


        if (teacherRows.length === 0) {

            return res.status(403).json({
                error:
                    'Teacher record not found'
            });
        }


        const teacherId =
            teacherRows[0].id;


        // Check student
        const [studentRows] =
            await db.execute(`

                SELECT id
                FROM students
                WHERE id = ?

            `, [student_id]);


        if (studentRows.length === 0) {

            return res.status(404).json({
                error:
                    'Student not found'
            });
        }


        /*
            If attendance already exists
            for this student and date,
            update it.
        */

        const [existing] =
            await db.execute(`

                SELECT id
                FROM attendance

                WHERE student_id = ?
                  AND date = ?

                LIMIT 1

            `, [
                student_id,
                date
            ]);


        if (existing.length > 0) {

            await db.execute(`

                UPDATE attendance

                SET
                    status = ?,
                    marked_by = ?,
                    marked_at = CURRENT_TIMESTAMP

                WHERE id = ?

            `, [
                status,
                teacherId,
                existing[0].id
            ]);


            return res.json({
                message:
                    'Attendance updated successfully'
            });
        }


        await db.execute(`

            INSERT INTO attendance
                (
                    student_id,
                    date,
                    status,
                    marked_by
                )

            VALUES (?, ?, ?, ?)

        `, [
            student_id,
            date,
            status,
            teacherId
        ]);


        res.json({
            message:
                'Attendance marked successfully'
        });

    } catch (error) {

        console.error(
            'Error marking attendance:',
            error
        );

        res.status(500).json({
            error:
                'Failed to mark attendance'
        });
    }
});


// ============================================================
// COMPLAINTS
// ============================================================

router.get('/complaints', auth, async (req, res) => {

    try {

        const [complaints] = await db.execute(`

            SELECT

                c.id,

                c.student_id,

                c.subject,

                c.description,

                c.status,

                c.created_at,

                c.resolved_at,


                s.roll_no,

                s.student_dept,
                s.year,
                s.section,


                u.name AS student_name,
                u.email AS student_email,


                resolved_user.name
                    AS resolved_by_name,


                r.room_number,
                r.block


            FROM complaints c


            JOIN students s
                ON c.student_id = s.id


            JOIN users u
                ON s.user_id = u.id


            LEFT JOIN teachers rt
                ON c.resolved_by = rt.id


            LEFT JOIN users resolved_user
                ON rt.user_id = resolved_user.id


            LEFT JOIN room_allocations ra
                ON s.id = ra.student_id
               AND ra.status = 'active'


            LEFT JOIN rooms r
                ON ra.room_id = r.id


            ORDER BY
                c.created_at DESC

        `);


        res.json(complaints);

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
// UPDATE COMPLAINT STATUS
// ============================================================

router.put(
    '/complaints/:id',
    auth,
    async (req, res) => {

        const {
            status
        } = req.body;


        const validStatuses = [
            'pending',
            'in_progress',
            'resolved',
            'rejected'
        ];


        if (!validStatuses.includes(status)) {

            return res.status(400).json({
                error:
                    'Invalid complaint status'
            });
        }


        try {

            const [teacherRows] =
                await db.execute(`

                    SELECT id
                    FROM teachers
                    WHERE user_id = ?

                `, [req.user.id]);


            if (teacherRows.length === 0) {

                return res.status(403).json({
                    error:
                        'Teacher record not found'
                });
            }


            const teacherId =
                teacherRows[0].id;


            let query;
            let params;


            if (status === 'resolved') {

                query = `

                    UPDATE complaints

                    SET
                        status = ?,
                        resolved_by = ?,
                        resolved_at =
                            CURRENT_TIMESTAMP

                    WHERE id = ?

                `;

                params = [
                    status,
                    teacherId,
                    req.params.id
                ];

            } else {

                query = `

                    UPDATE complaints

                    SET
                        status = ?

                    WHERE id = ?

                `;

                params = [
                    status,
                    req.params.id
                ];
            }


            const [result] =
                await db.execute(
                    query,
                    params
                );


            if (result.affectedRows === 0) {

                return res.status(404).json({
                    error:
                        'Complaint not found'
                });
            }


            res.json({
                message:
                    'Complaint status updated successfully'
            });

        } catch (error) {

            console.error(
                'Error updating complaint:',
                error
            );

            res.status(500).json({
                error:
                    'Failed to update complaint'
            });
        }
    }
);


// ============================================================
// GATE PASSES
// ============================================================

router.get('/gate-passes', auth, async (req, res) => {

    try {

        const [passes] = await db.execute(`

            SELECT

                g.id,

                g.user_id,

                g.reason,

                g.leave_date,

                g.return_date,

                g.status,

                g.approved_by,

                g.approved_at,

                g.created_at,


                u.name AS student_name,

                u.email AS student_email,

                s.roll_no,


                approver.name
                    AS approved_by_name


            FROM gate_passes g


            JOIN users u
                ON g.user_id = u.id


            JOIN students s
                ON g.user_id = s.user_id


            LEFT JOIN teachers t
                ON g.approved_by = t.id


            LEFT JOIN users approver
                ON t.user_id = approver.id


            ORDER BY
                g.created_at DESC

        `);


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
// UPDATE GATE PASS
// ============================================================

router.put(
    '/gate-passes/:id',
    auth,
    async (req, res) => {

        const {
            status
        } = req.body;


        const validStatuses = [
            'pending',
            'approved',
            'rejected'
        ];


        if (!validStatuses.includes(status)) {

            return res.status(400).json({
                error:
                    'Invalid gate pass status'
            });
        }


        try {

            const [teacherRows] =
                await db.execute(`

                    SELECT id
                    FROM teachers
                    WHERE user_id = ?

                `, [req.user.id]);


            if (teacherRows.length === 0) {

                return res.status(403).json({
                    error:
                        'Teacher record not found'
                });
            }


            const teacherId =
                teacherRows[0].id;


            let query;
            let params;


            if (status === 'approved') {

                query = `

                    UPDATE gate_passes

                    SET

                        status = ?,

                        approved_by = ?,

                        approved_at =
                            CURRENT_TIMESTAMP

                    WHERE id = ?

                `;

                params = [
                    status,
                    teacherId,
                    req.params.id
                ];

            } else {

                query = `

                    UPDATE gate_passes

                    SET
                        status = ?

                    WHERE id = ?

                `;

                params = [
                    status,
                    req.params.id
                ];
            }


            const [result] =
                await db.execute(
                    query,
                    params
                );


            if (result.affectedRows === 0) {

                return res.status(404).json({
                    error:
                        'Gate pass not found'
                });
            }


            res.json({
                message:
                    'Gate pass status updated successfully'
            });

        } catch (error) {

            console.error(
                'Error updating gate pass:',
                error
            );

            res.status(500).json({
                error:
                    'Failed to update gate pass'
            });
        }
    }
);


// ============================================================
// ROOM ALLOCATIONS
// ============================================================

router.get(
    '/room-allocations/:roomId',
    auth,
    async (req, res) => {

        try {

            const [rows] =
                await db.execute(`

                    SELECT

                        ra.id AS allocation_id,

                        ra.student_id,

                        ra.room_id,

                        ra.allocated_date,

                        ra.status,


                        s.roll_no,

                        s.student_dept,

                        s.year,

                        s.section,


                        u.name,
                        u.email,
                        u.phone

                    FROM room_allocations ra


                    JOIN students s
                        ON ra.student_id = s.id


                    JOIN users u
                        ON s.user_id = u.id


                    WHERE ra.room_id = ?

                      AND ra.status = 'active'


                    ORDER BY
                        u.name

                `, [
                    req.params.roomId
                ]);


            res.json(rows);

        } catch (error) {

            console.error(
                'Error fetching room allocations:',
                error
            );

            res.status(500).json({
                error:
                    'Failed to fetch room allocations'
            });
        }
    }
);


// ============================================================
// FEE REPORT
// ============================================================

router.get('/fee-report', auth, async (req, res) => {

    try {

        const [fees] =
            await db.execute(`

                SELECT

                    s.id AS student_id,

                    s.roll_no,

                    u.name AS student_name,

                    u.email,


                    ft.name AS fee_type,

                    sfa.amount AS assigned_amount,

                    sfa.due_date,

                    sfa.status AS assignment_status,


                    COALESCE(

                        (
                            SELECT
                                SUM(
                                    hf.amount_paid
                                )

                            FROM hostel_fees hf

                            WHERE
                                hf.assignment_id =
                                sfa.id

                              AND hf.status =
                                'completed'

                        ),

                        0

                    ) AS total_paid


                FROM student_fee_assignments sfa


                JOIN students s
                    ON sfa.student_id = s.id


                JOIN users u
                    ON s.user_id = u.id


                JOIN fee_types ft
                    ON sfa.fee_type_id = ft.id


                ORDER BY
                    s.roll_no,
                    sfa.due_date

            `);


        const formatted =
            fees.map(fee => ({

                ...fee,

                assigned_amount:
                    Number(
                        fee.assigned_amount
                    ),

                total_paid:
                    Number(
                        fee.total_paid
                    ),

                pending:
                    Math.max(

                        0,

                        Number(
                            fee.assigned_amount
                        )
                        -
                        Number(
                            fee.total_paid
                        )

                    )

            }));


        res.json(formatted);

    } catch (error) {

        console.error(
            'Error fetching fee report:',
            error
        );

        res.status(500).json({
            error:
                'Failed to fetch fee report'
        });
    }
});


// ============================================================
// CREATE NOTIFICATION
// ============================================================

router.post('/notifications', auth, async (req, res) => {

    const {
        title,
        content,
        type
    } = req.body;


    if (!title || !content || !type) {

        return res.status(400).json({
            error:
                'title, content and type are required'
        });
    }


    const validTypes = [
        'info',
        'warning',
        'important'
    ];


    if (!validTypes.includes(type)) {

        return res.status(400).json({
            error:
                'Invalid notification type'
        });
    }


    try {

        await db.execute(`

            INSERT INTO notifications
                (
                    title,
                    content,
                    type,
                    created_by
                )

            VALUES (?, ?, ?, ?)

        `, [
            title,
            content,
            type,
            req.user.id
        ]);


        res.json({
            message:
                'Notification created successfully'
        });

    } catch (error) {

        console.error(
            'Error creating notification:',
            error
        );

        res.status(500).json({
            error:
                'Failed to create notification'
        });
    }
});


module.exports = router;