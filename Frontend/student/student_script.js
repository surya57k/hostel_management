document.addEventListener("DOMContentLoaded", function () {
    const API_BASE_URL = 'http://localhost:5000/api';
    
    // Helper function to make authenticated API calls
    async function fetchWithAuth(endpoint, options = {}) {
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

    // Fetch user data from backend
    async function fetchUserData() {
        try {
            const response = await fetchWithAuth('/student/profile');
            return response;
        } catch (error) {
            console.error('Error fetching user data:', error);
            return null;
        }
    }

    // Initialize dashboard data
    async function initializeDashboard() {
        try {
            // Fetch all necessary data for the dashboard
            const [profile, feeStatus, attendance, announcements, roomDetails] = await Promise.all([
                fetchWithAuth('/student/profile'),
                fetchWithAuth('/student/fee-status'),
                fetchWithAuth('/student/attendance'),
                fetchWithAuth('/student/announcements'),
                fetchWithAuth('/student/allocated-room')
            ]);

            // Update student name
            document.getElementById("studentName").innerText = profile?.name || "Student";

            // Update attendance percentage
            const attendancePercentage = attendance?.statistics?.attendance_percentage || 0;
            document.getElementById("attendancePercentage").innerText = `${attendancePercentage}%`;

            // Update fees due
            const pendingFees = feeStatus?.summary?.total_pending || 0;
            document.getElementById("feesDue").innerText = `₹${pendingFees.toLocaleString()}`;

            // Update active gate passes
            const activeGatePasses = await fetchWithAuth('/student/gate-passes');
            const activePasses = activeGatePasses.filter(pass => 
                pass.status === 'approved' && new Date(pass.expected_return_date) >= new Date()
            ).length;
            document.getElementById("activePasses").innerText = `${activePasses} Active`;

            // Update pending complaints
            const complaints = await fetchWithAuth('/student/complaints');
            const pendingComplaints = complaints.filter(c => c.status === 'pending').length;
            document.getElementById("pendingComplaints").innerText = pendingComplaints.toString();

        } catch (error) {
            console.error('Error initializing dashboard:', error);
            showError('Failed to load dashboard data. Please refresh the page.');
        }
    }

    // Calculate attendance percentage
    function calculateAttendancePercentage(attendance) {
        if (!attendance || !attendance.length) return 0;
        
        const total = attendance.length;
        const present = attendance.filter(record => record.status === 'present').length;
        return Math.round((present / total) * 100);
    }

    // Show error message
    function showError(message) {
        document.getElementById("content").innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>${message}</p>
            </div>
        `;
    }

    // Show success message
    function showSuccess(message) {
        document.getElementById("content").innerHTML = `
            <div class="success-message">
                <i class="fas fa-check-circle"></i>
                <p>${message}</p>
            </div>
        `;
    }

    // Profile Management
    window.updateProfile = async function() {
        try {
            const profile = await fetchWithAuth('/student/profile');
            document.getElementById("content").innerHTML = `
                <div class="profile-section">
                    <div class="profile-header">
                        <div class="profile-image">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="profile-info">
                            <h2>${profile?.name || 'Student'}</h2>
                            <p>${profile?.student_dept || 'Department'} - ${profile?.year || 'Year'} Year</p>
                            <p>Roll No: ${profile?.roll_no || 'N/A'}</p>
                        </div>
                    </div>
                    <div class="profile-details">
                        <div class="detail-row">
                            <span>Email</span>
                            <span>${profile?.email || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span>Phone</span>
                            <span>${profile?.phone || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span>Department</span>
                            <span>${profile?.student_dept || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span>Year</span>
                            <span>${profile?.year || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span>Section</span>
                            <span>${profile?.section || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <span>Roll Number</span>
                            <span>${profile?.roll_no || 'N/A'}</span>
                        </div>
                    </div>
                    <button onclick="editProfile()" class="edit-profile-btn">
                        <i class="fas fa-edit"></i> Edit Profile
                    </button>
                </div>
            `;
        } catch (error) {
            console.error('Error fetching profile:', error);
            showError('Failed to load profile data. Please try again.');
        }
    };

    // View room details
    window.viewRoomDetails = async function() {
        try {
            const response = await fetchWithAuth('/student/allocated-room');
            
            // If there's an error property, it means no room is allocated
            if (response.error) {
                document.getElementById("content").innerHTML = `
                    <div class="room-section">
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle"></i>
                            <p>${response.error}</p>
                            <p>Please contact the hostel administrator for room allocation.</p>
                        </div>
                    </div>
                `;
                return;
            }

            // Response is the room data directly
            document.getElementById("content").innerHTML = `
                <div class="room-section">
                    <h2>Room Details</h2>
                    <div class="room-info">
                        <div class="room-card">
                            <h3>Room ${response.room_number}</h3>
                            <p><strong>Block:</strong> ${response.block}</p>
                            <p><strong>Floor:</strong> ${response.floor}</p>
                            <p><strong>Type:</strong> ${response.room_type}</p>
                            <p><strong>Allocation Date:</strong> ${new Date(response.allocated_date).toLocaleDateString()}</p>
                            ${response.roommates ? `
                                <div class="roommates">
                                    <h4>Roommates:</h4>
                                    <p>${response.roommates || 'No roommates'}</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error fetching room details:', error);
            document.getElementById("content").innerHTML = `
                <div class="room-section">
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Failed to load room details. Please try again later.</p>
                        <p>If the problem persists, contact the administrator.</p>
                    </div>
                </div>
            `;
        }
    };

    // Request gate pass
    window.requestGatePass = async function() {
        document.getElementById("content").innerHTML = `
            <div class="form-container">
                <h2>Request Gate Pass</h2>
                <form id="gatePassForm">
                    <div class="form-group">
                        <label for="reason">Reason for Leave</label>
                        <textarea id="reason" required></textarea>
                    </div>
                    <div class="form-group">
                        <label for="leaveDate">Leave Date</label>
                        <input type="datetime-local" id="leaveDate" required>
                    </div>
                    <div class="form-group">
                        <label for="returnDate">Expected Return Date</label>
                        <input type="datetime-local" id="returnDate" required>
                    </div>
                    <button type="submit">Submit Request</button>
                </form>
            </div>
        `;

        document.getElementById("gatePassForm").addEventListener("submit", async (e) => {
            e.preventDefault();
            // Implementation for gate pass request
            // ... (add the gate pass submission logic)
        });
    };

    // Fee Details
    window.viewFeeDetails = async function() {
        try {
            const feeData = await fetchWithAuth('/student/fee-status');
            
            // Check if fees are assigned
            if (!feeData?.assignments || feeData.assignments.length === 0) {
                document.getElementById("content").innerHTML = `
                    <div class="fees-section">
                        <div class="no-fees-message">
                            <i class="fas fa-info-circle"></i>
                            <p>No fees have been assigned yet. Please check back later or contact your hostel administrator.</p>
                        </div>
                    </div>
                `;
                return;
            }

            // Calculate totals
            const totalAssigned = feeData.assignments.reduce((sum, fee) => sum + fee.amount, 0);
            const totalPaid = feeData.assignments.reduce((sum, fee) => {
                return sum + (fee.payments || []).reduce((pSum, payment) => pSum + payment.amount_paid, 0);
            }, 0);
            const totalDue = totalAssigned - totalPaid;

            document.getElementById("content").innerHTML = `
                <div class="fees-section">
                    <div class="fee-summary">
                        <div class="fee-card">
                            <h3>Total Fee</h3>
                            <span class="amount">₹${totalAssigned.toLocaleString()}</span>
                        </div>
                        <div class="fee-card">
                            <h3>Paid</h3>
                            <span class="amount">₹${totalPaid.toLocaleString()}</span>
                        </div>
                        <div class="fee-card due">
                            <h3>Due Amount</h3>
                            <span class="amount">₹${totalDue.toLocaleString()}</span>
                        </div>
                    </div>
                    <div class="fee-assignments">
                        <h3>Fee Details</h3>
                        <table class="fee-table">
                            <thead>
                                <tr>
                                    <th>Fee Type</th>
                                    <th>Academic Year</th>
                                    <th>Semester</th>
                                    <th>Amount</th>
                                    <th>Due Date</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${feeData.assignments.map(fee => `
                                    <tr>
                                        <td>${fee.name}</td>
                                        <td>${fee.academic_year}</td>
                                        <td>${fee.semester}</td>
                                        <td>₹${fee.amount.toLocaleString()}</td>
                                        <td>${new Date(fee.due_date).toLocaleDateString()}</td>
                                        <td>
                                            <span class="status ${fee.status.toLowerCase()}">
                                                ${fee.status}
                                            </span>
                                        </td>
                                        <td>
                                            ${fee.status !== 'paid' ? 
                                                `<button onclick="initiatePayment(${fee.assignment_id})" class="pay-button">
                                                    <i class="fas fa-money-bill"></i> Pay Now
                                                </button>` : 
                                                '<span class="paid-text">Paid</span>'
                                            }
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="payment-history">
                        <h3>Payment History</h3>
                        <table class="payment-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Fee Type</th>
                                    <th>Amount</th>
                                    <th>Method</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(feeData.payments || []).map(payment => `
                                    <tr>
                                        <td>${new Date(payment.payment_date).toLocaleDateString()}</td>
                                        <td>${payment.fee_name}</td>
                                        <td>₹${payment.amount_paid.toLocaleString()}</td>
                                        <td>${payment.payment_method}</td>
                                        <td>
                                            <span class="status ${payment.status.toLowerCase()}">
                                                ${payment.status}
                                            </span>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error fetching fee details:', error);
            showError('Failed to load fee details. Please try again.');
        }
    };

    // Initiate fee payment
    window.initiatePayment = async function(assignmentId) {
        try {
            const response = await fetchWithAuth(`/student/fee-payment/${assignmentId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response?.payment_url) {
                // Redirect to payment gateway
                window.location.href = response.payment_url;
            } else {
                showError('Failed to initiate payment. Please try again.');
            }
        } catch (error) {
            console.error('Error initiating payment:', error);
            showError('Failed to initiate payment. Please try again.');
        }
    };

    // Submit complaint
    window.submitComplaint = async function() {
        try {
            const response = await fetchWithAuth('/student/complaints');
            const complaints = response?.complaints || [];
            
            document.getElementById("content").innerHTML = `
                <div class="complaints-section">
                    <h2>Submit Complaint</h2>
                    <form id="complaintForm" class="complaint-form">
                        <div class="form-group">
                            <label for="subject">Subject</label>
                            <input type="text" id="subject" name="subject" required>
                        </div>
                        <div class="form-group">
                            <label for="description">Description</label>
                            <textarea id="description" name="description" required></textarea>
                        </div>
                        <button type="submit">
                            <i class="fas fa-paper-plane"></i> Submit Complaint
                        </button>
                    </form>
                    <div class="complaints-history">
                        <h3>Complaint History</h3>
                        <table class="complaints-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Subject</th>
                                    <th>Description</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${complaints.map(complaint => `
                                    <tr>
                                        <td>${new Date(complaint.created_at).toLocaleDateString()}</td>
                                        <td>${complaint.subject}</td>
                                        <td>${complaint.description}</td>
                                        <td>
                                            <span class="status ${complaint.status.toLowerCase()}">
                                                ${complaint.status}
                                            </span>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            document.getElementById("complaintForm").addEventListener("submit", async function(event) {
                event.preventDefault();
                const formData = new FormData(this);
                
                try {
                    const response = await fetchWithAuth('/student/complaints', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            subject: formData.get('subject'),
                            description: formData.get('description'),
                            status: 'pending'
                        })
                    });

                    if (response?.success) {
                        showSuccess('Complaint submitted successfully');
                        this.reset();
                        submitComplaint(); // Refresh the view
                    } else {
                        showError(response?.message || 'Failed to submit complaint');
                    }
                } catch (error) {
                    console.error('Error submitting complaint:', error);
                    showError('Failed to submit complaint. Please try again.');
                }
            });
        } catch (error) {
            console.error('Error fetching complaints:', error);
            showError('Failed to load complaints data. Please try again.');
        }
    };

    // Attendance View
    window.viewAttendance = async function() {
        try {
            const response = await fetchWithAuth('/student/attendance');
            
            // Check if the endpoint exists
            if (response?.status === 404) {
                document.getElementById("content").innerHTML = `
                    <div class="attendance-section">
                        <div class="no-attendance-message">
                            <i class="fas fa-info-circle"></i>
                            <p>The attendance feature is currently not available. Please check back later.</p>
                        </div>
                    </div>
                `;
                return;
            }
            
            const attendance = response?.attendance || [];
            
            document.getElementById("content").innerHTML = `
                <div class="attendance-section">
                    <h2>Attendance Record</h2>
                    <div class="attendance-summary">
                        <div class="attendance-card">
                            <h3>Overall Attendance</h3>
                            <span class="percentage">${calculateAttendancePercentage(attendance)}%</span>
                        </div>
                    </div>
                    <div class="attendance-history">
                        <h3>Attendance History</h3>
                        <table class="attendance-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Status</th>
                                    <th>Marked By</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${attendance.map(record => `
                                    <tr>
                                        <td>${new Date(record.date).toLocaleDateString()}</td>
                                        <td>
                                            <span class="status ${record.status.toLowerCase()}">
                                                ${record.status}
                                            </span>
                                        </td>
                                        <td>${record.marked_by_name}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error fetching attendance:', error);
            showError('Failed to load attendance data. Please try again.');
        }
    };

    // Announcements View
    window.viewAnnouncements = async function() {
        try {
            const response = await fetchWithAuth('/student/announcements');
            
            // Check if the endpoint exists
            if (response?.status === 404) {
                document.getElementById("content").innerHTML = `
                    <div class="announcements-section">
                        <div class="no-announcements-message">
                            <i class="fas fa-info-circle"></i>
                            <p>The announcements feature is currently not available. Please check back later.</p>
                        </div>
                    </div>
                `;
                return;
            }
            
            const announcements = response?.announcements || [];
            
            document.getElementById("content").innerHTML = `
                <div class="announcements-section">
                    <h2>Announcements</h2>
                    <div class="announcements-list">
                        ${announcements.map(announcement => `
                            <div class="announcement-card">
                                <div class="announcement-header">
                                    <h3>${announcement.title}</h3>
                                    <span class="date">${new Date(announcement.date).toLocaleDateString()}</span>
                                </div>
                                <div class="announcement-content">
                                    <p>${announcement.content}</p>
                                </div>
                                <div class="announcement-footer">
                                    <span class="author">Posted by: ${announcement.author}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error fetching announcements:', error);
            showError('Failed to load announcements. Please try again.');
        }
    };

    // Change Password
    window.changePassword = async function() {
        document.getElementById("content").innerHTML = `
            <div class="form-container">
                <h2>Change Password</h2>
                <form id="changePasswordForm">
                    <div class="form-group">
                        <label for="currentPassword">Current Password</label>
                        <input type="password" id="currentPassword" required>
                    </div>
                    <div class="form-group">
                        <label for="newPassword">New Password</label>
                        <input type="password" id="newPassword" required>
                    </div>
                    <div class="form-group">
                        <label for="confirmPassword">Confirm New Password</label>
                        <input type="password" id="confirmPassword" required>
                    </div>
                    <button type="submit">Change Password</button>
                </form>
            </div>
        `;

        document.getElementById("changePasswordForm").addEventListener("submit", async (e) => {
            e.preventDefault();
            // Implementation for password change
            // ... (add the password change logic)
        });
    };

    // Load complaints history
    async function loadComplaints() {
        try {
            const response = await fetchWithAuth('/student/complaints');
            const complaints = response?.complaints || [];
            
            const complaintsTable = document.querySelector('.complaints-table tbody');
            if (!complaintsTable) return;
            
            complaintsTable.innerHTML = complaints.map(complaint => `
                <tr>
                    <td>${new Date(complaint.created_at).toLocaleDateString()}</td>
                    <td>${complaint.subject}</td>
                    <td>${complaint.description}</td>
                    <td>
                        <span class="status ${complaint.status.toLowerCase()}">
                            ${complaint.status}
                        </span>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Error loading complaints:', error);
            showError('Failed to load complaints history');
        }
    }

    // Initialize complaints view
    function initializeComplaintsView() {
        const content = document.getElementById('content');
        content.innerHTML = `
            <div class="complaints-section">
                <h2>Submit Complaint</h2>
                <form id="complaintForm" class="complaint-form">
                    <div class="form-group">
                        <label for="subject">Subject</label>
                        <input type="text" id="subject" name="subject" required>
                    </div>
                    <div class="form-group">
                        <label for="description">Description</label>
                        <textarea id="description" name="description" required></textarea>
                    </div>
                    <button type="submit">
                        <i class="fas fa-paper-plane"></i> Submit Complaint
                    </button>
                </form>
                <div class="complaints-history">
                    <h3>Complaint History</h3>
                    <table class="complaints-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Subject</th>
                                <th>Description</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        `;

        const form = document.getElementById('complaintForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitComplaint();
        });

        loadComplaints();
    }

    // Add function to mark announcement as read
    async function markAnnouncementAsRead(announcementId) {
        try {
            await fetchWithAuth(`/student/announcements/${announcementId}/read`, {
                method: 'POST'
            });
            // Refresh announcements section
            const announcements = await fetchWithAuth('/student/announcements');
            updateAnnouncementsSection(announcements);
        } catch (error) {
            console.error('Error marking announcement as read:', error);
            showError('Failed to mark announcement as read');
        }
    }

    // Initialize the dashboard when the page loads
    initializeDashboard();
});
