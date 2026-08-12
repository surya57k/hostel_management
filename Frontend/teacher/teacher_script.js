document.addEventListener("DOMContentLoaded", function () {
    const API_BASE_URL = 'http://localhost:5000/api';
    
    // Mock data for development when API endpoints are not available
    const MOCK_DATA = {
        profile: {
            name: "Teacher",
            email: "teacher@example.com",
            phone: "1234567890",
            department: "Computer Science"
        },
        students: [
            { id: 1, name: "Alice Smith", roll_no: "CS101", student_dept: "Computer Science", year: 3, section: "A", room_number: "101" },
            { id: 2, name: "Bob Johnson", roll_no: "CS102", student_dept: "Computer Science", year: 3, section: "A", room_number: "101" },
            { id: 3, name: "Carol Williams", roll_no: "CS103", student_dept: "Computer Science", year: 3, section: "B", room_number: "102" }
        ],
        rooms: [
            { room_id: 1, room_number: "101", block: "A", room_type: "Standard", capacity: 2, available_slots: 0 },
            { room_id: 2, room_number: "102", block: "A", room_type: "Standard", capacity: 2, available_slots: 1 },
            { room_id: 3, room_number: "103", block: "A", room_type: "Deluxe", capacity: 1, available_slots: 1 }
        ],
        complaints: [
            { complaint_id: 1, student_name: "Alice Smith", roll_no: "CS101", subject: "Water Issue", description: "No water in room", created_at: "2023-05-01", status: "pending" },
            { complaint_id: 2, student_name: "Bob Johnson", roll_no: "CS102", subject: "Electricity Issue", description: "Fan not working", created_at: "2023-05-02", status: "resolved" }
        ],
        gatePasses: [
            { pass_id: 1, student_name: "Alice Smith", roll_no: "CS101", reason: "Family function", from_date: "2023-05-10", to_date: "2023-05-12", status: "pending" },
            { pass_id: 2, student_name: "Bob Johnson", roll_no: "CS102", reason: "Medical checkup", from_date: "2023-05-15", to_date: "2023-05-15", status: "approved" }
        ],
        fees: [
            { assignment_id: 1, student_name: "Alice Smith", roll_no: "CS101", fee_name: "Hostel Fee", amount: 50000, due_date: "2023-05-30", status: "pending" },
            { assignment_id: 2, student_name: "Bob Johnson", roll_no: "CS102", fee_name: "Mess Fee", amount: 30000, due_date: "2023-05-30", status: "paid" }
        ]
    };
    
    // Flag to use mock data instead of API calls
    const USE_MOCK_DATA = false;
    
    // Helper function to make authenticated API calls
    async function fetchWithAuth(endpoint, options = {}) {
        // If using mock data, return mock data instead of making API calls
        if (USE_MOCK_DATA) {
            console.log(`Using mock data for: ${endpoint}`);
            
            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Return appropriate mock data based on endpoint
            if (endpoint === '/teacher/profile') {
                return MOCK_DATA.profile;
            } else if (endpoint === '/teacher/students') {
                return { students: MOCK_DATA.students };
            } else if (endpoint === '/rooms') {
                return MOCK_DATA.rooms;
            } else if (endpoint === '/teacher/complaints') {
                return { complaints: MOCK_DATA.complaints };
            } else if (endpoint === '/teacher/gate-passes') {
                return { gate_passes: MOCK_DATA.gatePasses };
            } else if (endpoint === '/teacher/fees') {
                return { fees: MOCK_DATA.fees };
            } else if (endpoint.startsWith('/teacher/student/')) {
                const studentId = parseInt(endpoint.split('/').pop());
                const student = MOCK_DATA.students.find(s => s.id === studentId);
                return { student };
            } else if (endpoint.startsWith('/teacher/room-allocations/')) {
                const roomId = parseInt(endpoint.split('/').pop());
                const room = MOCK_DATA.rooms.find(r => r.room_id === roomId);
                return { 
                    allocations: MOCK_DATA.students
                        .filter(s => s.room_number === room?.room_number)
                        .map(s => ({
                            student_name: s.name,
                            roll_no: s.roll_no,
                            student_dept: s.student_dept,
                            year: s.year,
                            allocated_date: "2023-01-01",
                            status: "active"
                        }))
                };
            } else if (endpoint === '/teacher/attendance-report' || endpoint === '/teacher/fee-report') {
                return { report_url: '#' };
            } else if (endpoint === '/teacher/update-room-status' || 
                      endpoint === '/teacher/update-gate-pass' || 
                      endpoint === '/teacher/update-complaint' || 
                      endpoint === '/teacher/verify-fee' || 
                      endpoint === '/teacher/attendance') {
                return { success: true, message: "Operation successful" };
            }
            
            // Default response for unknown endpoints
            return { error: 'Endpoint not found', status: 404 };
        }
        
        // Real API call logic
        const token = localStorage.getItem('token');
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    ...options.headers
                }
            });

            if (response.status === 401) {
                alert('Session expired. Redirecting to login page.');
                localStorage.removeItem('token');
                window.location.href = '../auth/login.html';
                return;
            }

            // Handle 404 errors gracefully
            if (response.status === 404) {
                console.warn(`Endpoint not found: ${endpoint}`);
                return { error: 'Endpoint not found', status: 404 };
            }

            // Handle 500 errors gracefully
            if (response.status === 500) {
                console.error(`Server error for endpoint: ${endpoint}`);
                return { error: 'Server error', status: 500 };
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.warn(`Invalid response format for endpoint: ${endpoint}`);
                return { error: 'Invalid response format', status: response.status };
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }

    // Loading indicator functions
    function showLoading() {
        const contentArea = document.querySelector('.content-area');
        if (contentArea) {
            contentArea.innerHTML = '<div class="loading"></div>';
        }
    }

    function hideLoading() {
        const loadingElement = document.querySelector('.loading');
        if (loadingElement) {
            loadingElement.remove();
        }
    }

    // Navigation function
    window.navigateTo = function(page) {
        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Add active class to clicked nav item
        const activeItem = document.querySelector(`.nav-item[onclick*="${page}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
        
        // Show loading indicator
        showLoading();
        
        // Call the appropriate function based on the page
        switch(page) {
            case 'profile':
    showTeacherProfile();
    break;
            case 'dashboard':
                showWelcomeMessage();
                break;
            case 'rooms':
                manageRooms();
                break;
            case 'gate-passes':
                manageGateRequests();
                break;
            case 'complaints':
                handleComplaints();
                break;
            case 'fees':
                verifyFees();
                break;
            case 'students':
                viewStudentInfo();
                break;
            case 'attendance':
                markAttendance();
                break;
            case 'reports':
                generateReports();
                break;
            default:
                showWelcomeMessage();
        }
    };

    // Fetch teacher profile data
    async function fetchTeacherProfile() {
        try {
            const response = await fetchWithAuth('/teacher/profile');
            return response;
        } catch (error) {
            console.error('Error fetching teacher profile:', error);
            return MOCK_DATA.profile;
        }
    }
// Display teacher profile
    async function showTeacherProfile() {
    const contentArea = document.querySelector('.content-area');

    if (!contentArea) return;

    contentArea.innerHTML = `
        <div class="page-header">
            <h2>
                <i class="fas fa-user"></i>
                My Profile
            </h2>
            <p>View your teacher information</p>
        </div>

        <div class="profile-card">
            <div class="profile-header">
                <div class="profile-avatar">
                    <i class="fas fa-user"></i>
                </div>

                <div>
                    <h3 id="profileName">Loading...</h3>
                    <p id="profilePost">Teacher</p>
                </div>
            </div>

            <div class="profile-details">

                <div class="profile-item">
                    <i class="fas fa-user"></i>
                    <div>
                        <span>Name</span>
                        <strong id="profileFullName">-</strong>
                    </div>
                </div>

                <div class="profile-item">
                    <i class="fas fa-envelope"></i>
                    <div>
                        <span>Email</span>
                        <strong id="profileEmail">-</strong>
                    </div>
                </div>

                <div class="profile-item">
                    <i class="fas fa-phone"></i>
                    <div>
                        <span>Phone</span>
                        <strong id="profilePhone">-</strong>
                    </div>
                </div>

                <div class="profile-item">
                    <i class="fas fa-id-card"></i>
                    <div>
                        <span>Teacher ID</span>
                        <strong id="profileTeacherId">-</strong>
                    </div>
                </div>

                <div class="profile-item">
                    <i class="fas fa-building"></i>
                    <div>
                        <span>Department</span>
                        <strong id="profileDepartment">-</strong>
                    </div>
                </div>

                <div class="profile-item">
                    <i class="fas fa-briefcase"></i>
                    <div>
                        <span>Post</span>
                        <strong id="profileTeacherPost">-</strong>
                    </div>
                </div>

            </div>
        </div>
    `;

    try {
        const profile =
            await fetchWithAuth('/teacher/profile');

        document.getElementById('profileName').textContent =
            profile?.name || 'Teacher';

        document.getElementById('profilePost').textContent =
            profile?.post || 'Teacher';

        document.getElementById('profileFullName').textContent =
            profile?.name || '-';

        document.getElementById('profileEmail').textContent =
            profile?.email || '-';

        document.getElementById('profilePhone').textContent =
            profile?.phone || '-';

        document.getElementById('profileTeacherId').textContent =
            profile?.teacher_id || '-';

        document.getElementById('profileDepartment').textContent =
            profile?.teacher_dept || '-';

        document.getElementById('profileTeacherPost').textContent =
            profile?.post || '-';

    } catch (error) {
        console.error(
            'Error loading teacher profile:',
            error
        );

        contentArea.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Unable to Load Profile</h3>
                <p>Please try again later.</p>
            </div>
        `;
    }
}

    // Initialize dashboard data
    async function initializeDashboard() {
    try {

        // Fetch teacher profile and dashboard statistics
        const [profile, dashboardData] = await Promise.all([
            fetchWithAuth('/teacher/profile'),
            fetchWithAuth('/teacher/dashboard')
        ]);

        // --------------------------------------------------------
        // Teacher name
        // --------------------------------------------------------

        const teacherNameElement =
            document.getElementById("teacherName");

        if (teacherNameElement) {
            teacherNameElement.innerText =
                profile?.name || "Teacher";
        }

        // --------------------------------------------------------
        // Total Students
        // --------------------------------------------------------

        const totalStudentsElement =
            document.getElementById("totalStudents");

        if (totalStudentsElement) {
            totalStudentsElement.innerText =
                dashboardData?.students?.total_students || 0;
        }

        // --------------------------------------------------------
        // Available Rooms
        // --------------------------------------------------------

        const vacantRoomsElement =
            document.getElementById("vacantRooms");

        if (vacantRoomsElement) {
            vacantRoomsElement.innerText =
                dashboardData?.rooms?.available_rooms || 0;
        }

        // --------------------------------------------------------
        // Pending Complaints
        // --------------------------------------------------------

        const pendingComplaintsElement =
            document.getElementById("pendingComplaints");

        if (pendingComplaintsElement) {
            pendingComplaintsElement.innerText =
                dashboardData?.complaints?.pending_complaints || 0;
        }

        console.log(
            "Teacher dashboard data:",
            dashboardData
        );

    } catch (error) {

        console.error(
            "Error initializing dashboard:",
            error
        );

        showError(
            "Failed to load dashboard data. Please refresh the page."
        );
    }
}

    // Show welcome message
    function showWelcomeMessage() {
        const contentArea = document.querySelector('.content-area');
        if (!contentArea) return;
        
        const profile = JSON.parse(localStorage.getItem('userData') || '{}');
        
        contentArea.innerHTML = `
            <div class="welcome-message">
                <h3>Welcome back, ${profile.name || 'Teacher'}!</h3>
                <p>Here's an overview of your hostel management dashboard.</p>
            </div>
            <div class="quick-stats">
                <div class="stat-card">
                    <i class="fas fa-user-graduate"></i>
                    <div class="stat-info">
                        <h3>Total Students</h3>
                        <p id="totalStudents">0</p>
                    </div>
                </div>
                <div class="stat-card">
                    <i class="fas fa-door-open"></i>
                    <div class="stat-info">
                        <h3>Vacant Rooms</h3>
                        <p id="vacantRooms">0</p>
                    </div>
                </div>
                <div class="stat-card">
                    <i class="fas fa-exclamation-circle"></i>
                    <div class="stat-info">
                        <h3>Pending Complaints</h3>
                        <p id="pendingComplaints">0</p>
                    </div>
                </div>
            </div>
        `;
        
        // Initialize dashboard stats
        initializeDashboard();
    }

    // Show error message
    function showError(message) {
        const contentArea = document.querySelector('.content-area');
        if (!contentArea) return;
        
        contentArea.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error</h3>
                <p>${message}</p>
            </div>
        `;
    }

    // Show success message
    function showSuccess(message) {
        const contentArea = document.querySelector('.content-area');
        if (!contentArea) return;
        
        contentArea.innerHTML = `
            <div class="success-message">
                <i class="fas fa-check-circle"></i>
                <p>${message}</p>
            </div>
        `;
    }

    // Room Management
    window.manageRooms = async function() {
        try {
            const rooms = await fetchWithAuth('/rooms');
            
            const contentArea = document.querySelector('.content-area');
            if (!contentArea) return;
            
            contentArea.innerHTML = `
                <div class="rooms-section">
                    <h2>Room Management</h2>
                    <div class="rooms-grid">
                        ${Array.isArray(rooms) ? rooms.map(room => `
                            <div class="room-card">
                                <h3>Room ${room.room_number}</h3>
                                <p><strong>Block:</strong> ${room.block}</p>
                                <p><strong>Type:</strong> ${room.room_type}</p>
                                <p><strong>Capacity:</strong> ${room.capacity} students</p>
                                <p><strong>Available Slots:</strong> ${room.available_slots}</p>
                                <div class="room-actions">
                                    <button onclick="updateRoomStatus(
    ${room.id},
    ${room.available_slots},
    ${room.capacity},
    '${room.status}'
)" class="update-btn">
                                        <i class="fas fa-edit"></i> Update Status
                                    </button>
                                    <button
    onclick="viewRoomAllocations(${room.id})"
    class="view-btn"
>
    <i class="fas fa-users"></i> View Allocations
</button>
                                </div>
                            </div>
                        `).join('') : '<p>No rooms available</p>'}
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error fetching rooms:', error);
            showError('Failed to load room data. Please try again.');
        }
    };

    // Update room status
window.updateRoomStatus = async function(roomId, currentSlots, currentCapacity, currentStatus) {
    try {
        const newCapacity = prompt(
            `Enter new room capacity (current: ${currentCapacity}):`,
            currentCapacity
        );

        if (newCapacity === null) return;

        const capacity = parseInt(newCapacity);

        if (isNaN(capacity) || capacity <= 0) {
            showError('Please enter a valid capacity.');
            return;
        }

        const newStatus = prompt(
            `Enter room status (available/full/maintenance):`,
            currentStatus || 'available'
        );

        if (newStatus === null) return;

        const status = newStatus.trim().toLowerCase();

        if (!['available', 'full', 'maintenance'].includes(status)) {
            showError(
                'Status must be available, full, or maintenance.'
            );
            return;
        }

        const response = await fetchWithAuth(
            '/rooms/update',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    roomId: roomId,
                    capacity: capacity,
                    status: status
                })
            }
        );

        if (response) {
            showSuccess(
                response.message ||
                'Room updated successfully'
            );

            await manageRooms();
        }

    } catch (error) {
        console.error(
            'Error updating room status:',
            error
        );

        showError(
            'Failed to update room status. Please try again.'
        );
    }
};

    // View room allocations
    window.viewRoomAllocations = async function(roomId) {
    try {

        const response = await fetchWithAuth(
            `/rooms/${roomId}/students`
        );

        const allocations = Array.isArray(response)
            ? response
            : [];

        const contentArea =
            document.querySelector('.content-area');

        if (!contentArea) return;

        contentArea.innerHTML = `
            <div class="allocations-section">

                <h2>Room Allocations</h2>

                ${
                    allocations.length > 0
                    ? `
                    <div class="allocations-table-container">

                        <table class="allocations-table">

                            <thead>
                                <tr>
                                    <th>Student Name</th>
                                    <th>Roll No</th>
                                    <th>Department</th>
                                    <th>Year</th>
                                    <th>Allocated Date</th>
                                    <th>Status</th>
                                </tr>
                            </thead>

                            <tbody>

                                ${allocations.map(allocation => `
                                    <tr>

                                        <td>
                                            ${allocation.name || '-'}
                                        </td>

                                        <td>
                                            ${allocation.roll_no || '-'}
                                        </td>

                                        <td>
                                            ${allocation.student_dept || '-'}
                                        </td>

                                        <td>
                                            ${allocation.year || '-'}
                                        </td>

                                        <td>
                                            ${
                                                allocation.allocated_date
                                                ? new Date(
                                                    allocation.allocated_date
                                                ).toLocaleDateString()
                                                : '-'
                                            }
                                        </td>

                                        <td>
                                            <span class="status ${
                                                allocation.status || ''
                                            }">
                                                ${allocation.status || '-'}
                                            </span>
                                        </td>

                                    </tr>
                                `).join('')}

                            </tbody>

                        </table>

                    </div>
                    `
                    : `
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <h3>No Students Allocated</h3>
                        <p>
                            No students are currently allocated
                            to this room.
                        </p>
                    </div>
                    `
                }

                <button
                    onclick="manageRooms()"
                    class="back-btn"
                >
                    <i class="fas fa-arrow-left"></i>
                    Back to Rooms
                </button>

            </div>
        `;

    } catch (error) {

        console.error(
            'Error fetching room allocations:',
            error
        );

        showError(
            'Failed to load room allocations. Please try again.'
        );
    }
};

    // Gate Pass Management
    window.manageGateRequests = async function() {
        try {
            const response = await fetchWithAuth('/teacher/gate-passes');
            const gatePasses = Array.isArray(response) ? response : [];
            
            const contentArea = document.querySelector('.content-area');
            if (!contentArea) return;
            
            contentArea.innerHTML = `
                <div class="gate-pass-section">
                    <h2>Gate Pass Requests</h2>
                    <div class="gate-pass-table-container">
                        <table class="gate-pass-table">
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>Roll No</th>
                                    <th>Reason</th>
                                    <th>From</th>
                                    <th>To</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Array.isArray(gatePasses) ? gatePasses.map(pass => `
                                    <tr>
                                        <td>${pass.student_name}</td>
                                        <td>${pass.roll_no}</td>
                                        <td>${pass.reason}</td>
                                        <td>${new Date(pass.leave_date).toLocaleString()}</td>
                                        <td>${new Date(pass.return_date).toLocaleString()}</td>
                                        <td>
                                            <span class="status ${pass.status.toLowerCase()}">
                                                ${pass.status}
                                            </span>
                                        </td>
                                        <td>
                                            ${pass.status === 'pending' ? `
                                                <button onclick="updateGatePassStatus(${pass.id}, 'approved')" class="approve-btn">
                                                    <i class="fas fa-check"></i> Approve
                                                </button>
                                                <button onclick="updateGatePassStatus(${pass.id}, 'rejected')" class="reject-btn">
                                                    <i class="fas fa-times"></i> Reject
                                                </button>
                                            ` : '-'}
                                        </td>
                                    </tr>
                                `).join('') : '<tr><td colspan="7">No gate pass requests found</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error fetching gate passes:', error);
            showError('Failed to load gate pass requests. Please try again.');
        }
    };

    // Update gate pass status
    // ============================================================
// UPDATE GATE PASS STATUS
// ============================================================

window.updateGatePassStatus = async function(passId, status) {

    try {

        console.log("================================");
        console.log("UPDATING GATE PASS");
        console.log("Pass ID:", passId);
        console.log("Status:", status);
        console.log("================================");


        // Confirm action

        const actionText =
            status === "approved"
                ? "approve"
                : "reject";


        const confirmed = confirm(
            `Are you sure you want to ${actionText} this gate pass?`
        );


        if (!confirmed) {
            return;
        }


        // Disable buttons while processing

        const buttons =
            document.querySelectorAll(
                ".approve-btn, .reject-btn"
            );


        buttons.forEach(button => {
            button.disabled = true;
        });


        // --------------------------------------------------------
        // Actual backend request
        // --------------------------------------------------------

        const response =
            await fetchWithAuth(
                `/teacher/gate-passes/${passId}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        status: status
                    })
                }
            );


        console.log(
            "Gate pass update response:",
            response
        );


        // --------------------------------------------------------
        // Check response
        // --------------------------------------------------------

        if (
            response &&
            !response.error
        ) {

            alert(
                `Gate pass ${status} successfully.`
            );


            // Reload requests

            await manageGateRequests();

        } else {

            throw new Error(
                response?.error ||
                response?.message ||
                `Failed to ${status} gate pass`
            );

        }


    } catch (error) {

        console.error(
            "Gate pass update error:",
            error
        );


        alert(
            error.message ||
            `Failed to ${status} gate pass`
        );


        // Re-enable buttons

        const buttons =
            document.querySelectorAll(
                ".approve-btn, .reject-btn"
            );


        buttons.forEach(button => {
            button.disabled = false;
        });

    }

};
    // Complaints Management
    window.handleComplaints = async function() {
    try {
        const response = await fetchWithAuth('/teacher/complaints');

        const complaints = Array.isArray(response)
            ? response
            : (response?.complaints || []);
            
            const contentArea = document.querySelector('.content-area');
            if (!contentArea) return;
            
            contentArea.innerHTML = `
                <div class="complaints-section">
                    <h2>Student Complaints</h2>
                    <div class="complaints-table-container">
                        <table class="complaints-table">
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>Roll No</th>
                                    <th>Subject</th>
                                    <th>Description</th>
                                    <th>Date</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Array.isArray(complaints) ? complaints.map(complaint => `
                                    <tr>
                                        <td>${complaint.student_name}</td>
                                        <td>${complaint.roll_no}</td>
                                        <td>${complaint.subject}</td>
                                        <td>${complaint.description}</td>
                                        <td>${new Date(complaint.created_at).toLocaleDateString()}</td>
                                        <td>
                                            <span class="status ${complaint.status.toLowerCase()}">
                                                ${complaint.status}
                                            </span>
                                        </td>
                                        <td>
                                            ${complaint.status === 'pending' ? `
                                                <button onclick="updateComplaintStatus(${complaint.id}, 'resolved')" class="resolve-btn">
                                                    <i class="fas fa-check"></i> Resolve
                                                </button>
                                            ` : '-'}
                                        </td>
                                    </tr>
                                `).join('') : '<tr><td colspan="7">No complaints found</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error fetching complaints:', error);
            showError('Failed to load complaints. Please try again.');
        }
    };

    // Update complaint status
    window.updateComplaintStatus = async function(complaintId, status) {
    try {

        const response = await fetchWithAuth(
            `/teacher/complaints/${complaintId}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: status
                })
            }
        );

        console.log('Complaint update response:', response);

        if (response && !response.error) {

            showSuccess(
                'Complaint status updated successfully'
            );

            await handleComplaints();

        } else {

            showError(
                response?.error ||
                response?.message ||
                'Failed to update complaint status'
            );
        }

    } catch (error) {

        console.error(
            'Error updating complaint status:',
            error
        );

        showError(
            'Failed to update complaint status. Please try again.'
        );
    }
};

    // Fee Verification
    window.verifyFees = async function() {
        try {
            const response = await fetchWithAuth('/teacher/fees');
            const fees = response?.fees || [];
            
            const contentArea = document.querySelector('.content-area');
            if (!contentArea) return;
            
            contentArea.innerHTML = `
                <div class="fees-section">
                    <h2>Fee Verification</h2>
                    <div class="fees-table-container">
                        <table class="fees-table">
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>Roll No</th>
                                    <th>Fee Type</th>
                                    <th>Amount</th>
                                    <th>Due Date</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Array.isArray(fees) ? fees.map(fee => `
                                    <tr>
                                        <td>${fee.student_name}</td>
                                        <td>${fee.roll_no}</td>
                                        <td>${fee.fee_name}</td>
                                        <td>₹${fee.amount.toLocaleString()}</td>
                                        <td>${new Date(fee.due_date).toLocaleDateString()}</td>
                                        <td>
                                            <span class="status ${fee.status.toLowerCase()}">
                                                ${fee.status}
                                            </span>
                                        </td>
                                        <td>
                                            ${fee.status === 'pending' ? `
                                                <button onclick="verifyFeePayment(${fee.assignment_id})" class="verify-btn">
                                                    <i class="fas fa-check"></i> Verify
                                                </button>
                                            ` : '-'}
                                        </td>
                                    </tr>
                                `).join('') : '<tr><td colspan="7">No fees found</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error fetching fees:', error);
            showError('Failed to load fee data. Please try again.');
        }
    };

    // Verify fee payment
    window.verifyFeePayment = async function(assignmentId) {
        try {
            const response = await fetchWithAuth('/teacher/verify-fee', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    assignment_id: assignmentId
                })
            });

            if (response?.success) {
                showSuccess('Fee payment verified successfully');
                verifyFees(); // Refresh the view
            } else {
                showError(response?.message || 'Failed to verify fee payment');
            }
        } catch (error) {
            console.error('Error verifying fee payment:', error);
            showError('Failed to verify fee payment. Please try again.');
        }
    };

    // Student Information
    window.viewStudentInfo = async function() {
        try {
            const response = await fetchWithAuth('/teacher/students');
            const students = response?.students || [];
            
            const contentArea = document.querySelector('.content-area');
            if (!contentArea) return;
            
            contentArea.innerHTML = `
                <div class="students-section">
                    <h2>Student Information</h2>
                    <div class="search-container">
                        <input type="text" id="studentSearch" placeholder="Search by name or roll no..." onkeyup="filterStudents()">
                    </div>
                    <div class="students-table-container">
                        <table class="students-table" id="studentsTable">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Roll No</th>
                                    <th>Department</th>
                                    <th>Year</th>
                                    <th>Section</th>
                                    <th>Room</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Array.isArray(students) ? students.map(student => `
                                    <tr>
                                        <td>${student.name}</td>
                                        <td>${student.roll_no}</td>
                                        <td>${student.student_dept}</td>
                                        <td>${student.year}</td>
                                        <td>${student.section}</td>
                                        <td>${student.room_number || 'Not Allocated'}</td>
                                        <td>
                                            <button onclick="viewStudentDetails(${student.id})" class="view-btn">
                                                <i class="fas fa-eye"></i> View Details
                                            </button>
                                        </td>
                                    </tr>
                                `).join('') : '<tr><td colspan="7">No students found</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error fetching students:', error);
            showError('Failed to load student data. Please try again.');
        }
    };

    // Filter students
    window.filterStudents = function() {
        const input = document.getElementById("studentSearch");
        if (!input) return;
        
        const filter = input.value.toLowerCase();
        const table = document.getElementById("studentsTable");
        if (!table) return;
        
        const rows = table.getElementsByTagName("tr");

        for (let i = 1; i < rows.length; i++) {
            const nameCell = rows[i].getElementsByTagName("td")[0];
            const rollCell = rows[i].getElementsByTagName("td")[1];
            
            if (nameCell && rollCell) {
                const name = nameCell.textContent || nameCell.innerText;
                const roll = rollCell.textContent || rollCell.innerText;
                
                if (name.toLowerCase().indexOf(filter) > -1 || roll.toLowerCase().indexOf(filter) > -1) {
                    rows[i].style.display = "";
                } else {
                    rows[i].style.display = "none";
                }
            }
        }
    };

    // View student details
    window.viewStudentDetails = async function(studentId) {
        try {
            const response = await fetchWithAuth(`/teacher/student/${studentId}`);
            const student = response?.student;
            
            const contentArea = document.querySelector('.content-area');
            if (!contentArea) return;
            
            contentArea.innerHTML = `
                <div class="student-details-section">
                    <h2>Student Details</h2>
                    <div class="student-profile">
                        <div class="profile-header">
                            <div class="profile-image">
                                <i class="fas fa-user"></i>
                            </div>
                            <div class="profile-info">
                                <h3>${student?.name || 'Student'}</h3>
                                <p>${student?.student_dept || 'Department'} - ${student?.year || 'Year'} Year</p>
                                <p>Roll No: ${student?.roll_no || 'N/A'}</p>
                            </div>
                        </div>
                        <div class="profile-details">
                            <div class="detail-row">
                                <span>Email</span>
                                <span>${student?.email || 'N/A'}</span>
                            </div>
                            <div class="detail-row">
                                <span>Phone</span>
                                <span>${student?.phone || 'N/A'}</span>
                            </div>
                            <div class="detail-row">
                                <span>Department</span>
                                <span>${student?.student_dept || 'N/A'}</span>
                            </div>
                            <div class="detail-row">
                                <span>Year</span>
                                <span>${student?.year || 'N/A'}</span>
                            </div>
                            <div class="detail-row">
                                <span>Section</span>
                                <span>${student?.section || 'N/A'}</span>
                            </div>
                            <div class="detail-row">
                                <span>Roll Number</span>
                                <span>${student?.roll_no || 'N/A'}</span>
                            </div>
                            <div class="detail-row">
                                <span>Room</span>
                                <span>${student?.room_number || 'Not Allocated'}</span>
                            </div>
                        </div>
                    </div>
                    <button onclick="viewStudentInfo()" class="back-btn">
                        <i class="fas fa-arrow-left"></i> Back to Students
                    </button>
                </div>
            `;
        } catch (error) {
            console.error('Error fetching student details:', error);
            showError('Failed to load student details. Please try again.');
        }
    };

    // Reports Generation
    window.generateReports = async function() {
        try {
            const contentArea = document.querySelector('.content-area');
            if (!contentArea) return;
            
            contentArea.innerHTML = `
                <div class="reports-section">
                    <h2>Generate Reports</h2>
                    <div class="reports-grid">
                        <div class="report-card">
                            <h3>Attendance Report</h3>
                            <p>Generate attendance report for a specific date range</p>
                            <form id="attendanceReportForm" class="report-form">
                                <div class="form-group">
                                    <label for="fromDate">From Date</label>
                                    <input type="date" id="fromDate" name="fromDate" required>
                                </div>
                                <div class="form-group">
                                    <label for="toDate">To Date</label>
                                    <input type="date" id="toDate" name="toDate" required>
                                </div>
                                <button type="submit">
                                    <i class="fas fa-file-download"></i> Generate Report
                                </button>
                            </form>
                        </div>
                        <div class="report-card">
                            <h3>Fee Collection Report</h3>
                            <p>Generate fee collection report for a specific month</p>
                            <form id="feeReportForm" class="report-form">
                                <div class="form-group">
                                    <label for="month">Month</label>
                                    <input type="month" id="month" name="month" required>
                                </div>
                                <button type="submit">
                                    <i class="fas fa-file-download"></i> Generate Report
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            `;

            // Attendance report form submission
            const attendanceForm = document.getElementById("attendanceReportForm");
            if (attendanceForm) {
                attendanceForm.addEventListener("submit", async function(event) {
                    event.preventDefault();
                    const fromDate = document.getElementById("fromDate").value;
                    const toDate = document.getElementById("toDate").value;
                    
                    try {
                        const response = await fetchWithAuth('/teacher/attendance-report', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                from_date: fromDate,
                                to_date: toDate
                            })
                        });

                        if (response?.report_url) {
                            window.open(response.report_url, '_blank');
                        } else {
                            showError('Failed to generate attendance report');
                        }
                    } catch (error) {
                        console.error('Error generating attendance report:', error);
                        showError('Failed to generate attendance report. Please try again.');
                    }
                });
            }

            // Fee report form submission
            const feeForm = document.getElementById("feeReportForm");
            if (feeForm) {
                feeForm.addEventListener("submit", async function(event) {
                    event.preventDefault();
                    const month = document.getElementById("month").value;
                    
                    try {
                        const response = await fetchWithAuth('/teacher/fee-report', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                month: month
                            })
                        });

                        if (response?.report_url) {
                            window.open(response.report_url, '_blank');
                        } else {
                            showError('Failed to generate fee report');
                        }
                    } catch (error) {
                        console.error('Error generating fee report:', error);
                        showError('Failed to generate fee report. Please try again.');
                    }
                });
            }
        } catch (error) {
            console.error('Error loading reports page:', error);
            showError('Failed to load reports page. Please try again.');
        }
    };

    // Mark Attendance
    window.markAttendance = async function() {
    try {

        const response =
            await fetchWithAuth('/teacher/students');

        // Backend returns students directly as an array
        const students =
            Array.isArray(response)
                ? response
                : (response?.students || []);

        console.log("Attendance students:", students);

            const today = new Date().toISOString().split('T')[0];
            
            const contentArea = document.querySelector('.content-area');
            if (!contentArea) return;
            
            contentArea.innerHTML = `
                <div class="attendance-section">
                    <h2>Mark Attendance</h2>
                    <div class="date-selector">
                        <label for="attendanceDate">Date:</label>
                        <input type="date" id="attendanceDate" value="${today}">
                    </div>
                    <div class="attendance-table-container">
                        <table class="attendance-table">
                            <thead>
                                <tr>
                                    <th>Roll No</th>
                                    <th>Name</th>
                                    <th>Department</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Array.isArray(students) ? students.map(student => `
                                    <tr>
                                        <td>${student.roll_no}</td>
                                        <td>${student.name}</td>
                                        <td>${student.student_dept}</td>
                                        <td>
                                            <select id="status_${student.student_id}" class="status-select">
                                                <option value="present">Present</option>
                                                <option value="absent">Absent</option>
                                                <option value="leave">Leave</option>
                                            </select>
                                        </td>
                                    </tr>
                                `).join('') : '<tr><td colspan="4">No students found</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                    <button onclick="saveAttendance()" class="save-btn">
                        <i class="fas fa-save"></i> Save Attendance
                    </button>
                </div>
            `;
        } catch (error) {
            console.error('Error loading attendance page:', error);
            showError('Failed to load attendance page. Please try again.');
        }
    };

    // Save Attendance
   window.saveAttendance = async function () {

    try {

        const dateElement =
            document.getElementById("attendanceDate");

        if (!dateElement) {
            alert("Attendance date field not found.");
            return;
        }

        const dateValue = dateElement.value;

        if (!dateValue) {
            alert("Please select a date.");
            return;
        }


        // Find every attendance select directly
        const selects =
            document.querySelectorAll(
                '.attendance-table tbody select.status-select'
            );


        console.log(
            "Attendance select count:",
            selects.length
        );


        if (selects.length === 0) {

            alert(
                "No students found in the attendance table."
            );

            return;
        }


        let successCount = 0;
        let failedCount = 0;


        for (const select of selects) {

            // id is status_1, status_2, etc.
            const idParts =
                select.id.split("_");

            const studentId =
                Number(idParts[1]);

            const status =
                select.value;


            console.log(
                "Marking attendance:",
                {
                    student_id: studentId,
                    date: dateValue,
                    status: status
                }
            );


            if (!studentId) {

                console.error(
                    "Invalid student ID:",
                    select.id
                );

                failedCount++;

                continue;
            }


            try {

                const response =
                    await fetchWithAuth(
                        "/teacher/attendance",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({
                                student_id:
                                    studentId,

                                date:
                                    dateValue,

                                status:
                                    status
                            })
                        }
                    );


                console.log(
                    "Attendance API response:",
                    response
                );


                if (
                    response &&
                    !response.error
                ) {

                    successCount++;

                } else {

                    failedCount++;

                    console.error(
                        "Attendance failed:",
                        response
                    );

                }

            } catch (error) {

                failedCount++;

                console.error(
                    "Attendance request failed:",
                    {
                        student_id: studentId,
                        date: dateValue,
                        status: status,
                        error: error
                    }
                );

            }

        }


        // --------------------------------------------------
        // Final message
        // --------------------------------------------------

        if (successCount > 0 && failedCount === 0) {

            showSuccess(
                `Attendance saved successfully for ${successCount} students.`
            );

        } else if (successCount > 0) {

            showError(
                `Attendance saved for ${successCount} students. ${failedCount} failed.`
            );

        } else {

            showError(
                "Attendance could not be saved. Check the browser console."
            );

        }


    } catch (error) {

        console.error(
            "Save attendance error:",
            error
        );

        showError(
            "Failed to save attendance."
        );

    }

};

    // Logout function
    window.logout = function() {
        localStorage.removeItem('token');
        window.location.href = '../auth/login.html';
    };

    // Room management functions
    async function loadRooms() {
        try {
            const response = await fetchWithAuth('/api/rooms/manage');
            const rooms = await response.json();
            
            const content = document.getElementById('content');
            content.innerHTML = `
                <h2>Room Management</h2>
                <div class="room-grid">
                    ${rooms.map(room => `
                        <div class="room-card">
                            <h3>Room ${room.room_number}</h3>
                            <p>Block: ${room.block}</p>
                            <p>Capacity: ${room.capacity}</p>
                            <p>Occupied: ${room.occupied_slots || 0}</p>
                            <p>Status: ${room.status}</p>
                            <div class="student-list">
                                ${room.student_names ? 
                                    `<p>Students: ${room.student_names.split(',').join(', ')}</p>` : 
                                    '<p>No students assigned</p>'
                                }
                            </div>
                            <button onclick="editRoom(${room.id})">Edit Room</button>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (error) {
            showNotification('Failed to load rooms', 'error');
        }
    }

    async function editRoom(roomId) {
        // Add room editing functionality
        // ...existing code...
    }

    // Initialize the dashboard when the page loads
    showWelcomeMessage();
});