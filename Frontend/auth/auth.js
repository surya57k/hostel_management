document.addEventListener("DOMContentLoaded", function () {
    // Toggle role-specific fields
    const roleSelect = document.getElementById("role");
    const studentFields = document.getElementById("studentFields");
    const teacherFields = document.getElementById("teacherFields");

    if (roleSelect && studentFields && teacherFields) {
        roleSelect.addEventListener("change", function () {
            const isStudent = roleSelect.value === "student";
            studentFields.style.display = isStudent ? "block" : "none";
            teacherFields.style.display = isStudent ? "none" : "block";
            
            // Toggle required attributes based on role
            const studentInputs = studentFields.querySelectorAll('input[data-required="true"]');
            const teacherInputs = teacherFields.querySelectorAll('input[data-required="true"]');
            
            studentInputs.forEach(input => {
                input.required = isStudent;
            });
            
            teacherInputs.forEach(input => {
                input.required = !isStudent;
            });
        });
    }

    // Registration Form Submission
    const registerForm = document.getElementById("registerForm");
    if (registerForm) {
        registerForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            
            const roleSelect = document.getElementById("role");
            if (!roleSelect || !roleSelect.value) {
                showNotification("Please select a role", "error");
                return;
            }
            
            const role = roleSelect.value;
            const studentFields = document.getElementById("studentFields");
            const teacherFields = document.getElementById("teacherFields");
            
            if (!studentFields || !teacherFields) {
                showNotification("Form elements not found", "error");
                return;
            }
            
            const relevantFields = role === "student" ? studentFields : teacherFields;
            const requiredFields = relevantFields.querySelectorAll('input[data-required="true"]');
            
            // Validate required fields
            let isValid = true;
            requiredFields.forEach(field => {
                if (!field.value.trim()) {
                    isValid = false;
                    field.classList.add('error');
                } else {
                    field.classList.remove('error');
                }
            });

            if (!isValid) {
                showNotification("Please fill in all required fields.", "error");
                return;
            }

            // Show loading state
            const submitButton = registerForm.querySelector("button[type='submit']");
            const originalButtonText = submitButton.textContent;
            submitButton.textContent = "Processing...";
            submitButton.disabled = true;

            const formData = new FormData(registerForm);
            const userData = Object.fromEntries(formData.entries());

            try {
                const response = await fetch("http://localhost:5000/api/auth/register", {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify(userData),
                });

                const data = await response.json();

                if (response.ok) {
                    showNotification(data.message, "success");
                    setTimeout(() => {
                        window.location.href = "login.html";
                    }, 1500);
                } else {
                    showNotification(data.error || "Registration failed", "error");
                }
            } catch (error) {
                console.error("Registration error:", error);
                showNotification("Network error. Please try again.", "error");
            } finally {
                // Restore button state
                submitButton.textContent = originalButtonText;
                submitButton.disabled = false;
            }
        });
    }

    // Add API base URL configuration
    const API_BASE_URL = 'http://localhost:5000/api/auth';

    // Add authentication header helper
    const getAuthHeader = () => {
        const token = localStorage.getItem('token');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    };

    // Add error handling and retry logic for API calls
    const fetchWithRetry = async (url, options, retries = 3) => {
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, {
                    ...options,
                    headers: {
                        ...options.headers,
                        ...getAuthHeader()
                    }
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Request failed');
                }
                
                return await response.json();
            } catch (error) {
                if (i === retries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    };

    // Add function to check authentication status
    function checkAuth() {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('userData');
        
        if (!token || !userData) {
            logout();
            return false;
        }
        
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (Date.now() >= payload.exp * 1000) {
                logout();
                return false;
            }
            return true;
        } catch (error) {
            logout();
            return false;
        }
    }

    // Add function to handle API errors
    function handleApiError(error) {
        console.error('API Error:', error);
        if (error.message.includes('401') || error.message.includes('403')) {
            showNotification("Session expired. Please login again.", "error");
            setTimeout(logout, 2000);
        } else {
            showNotification(error.message || "An error occurred", "error");
        }
    }

    // Update the path resolution for redirects
    function getBasePath() {
        // Get the base path from current URL
        const currentPath = window.location.pathname;
        return currentPath.substring(0, currentPath.indexOf('/Frontend') + '/Frontend'.length);
    }

    // Login Form Submission
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            const submitButton = this.querySelector("button[type='submit']");
            submitButton.disabled = true;
            submitButton.textContent = "Logging in...";

            try {
                const response = await fetch(`${API_BASE_URL}/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: document.getElementById("email").value.trim(),
                        password: document.getElementById("password").value.trim()
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Login failed");
                }

                // Validate response structure
                if (!data.token || !data.user || !data.user.role) {
                    throw new Error("Invalid response format from server");
                }

                localStorage.setItem("token", data.token);
                localStorage.setItem("userData", JSON.stringify(data.user));
                
                showNotification("Login successful! Redirecting...", "success");
                
                // Update redirect paths to use relative paths
                const basePath = getBasePath();
                const redirectPath = data.user.role === "student" 
                    ? `${basePath}/student/student_dashboard.html`
                    : `${basePath}/teacher/teacher_dashboard.html`;
                
                setTimeout(() => window.location.href = redirectPath, 1500);
            } catch (error) {
                console.error("Login error:", error);
                showNotification(error.message || "Login failed. Please try again.", "error");
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = "Login";
            }
        });
    }

    // Add auto-logout on token expiration
    function setupTokenExpirationCheck() {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                const expirationTime = payload.exp * 1000;
                const timeUntilExpiration = expirationTime - Date.now();
                
                if (timeUntilExpiration <= 0) {
                    logout();
                } else {
                    setTimeout(logout, timeUntilExpiration);
                }
            } catch (error) {
                console.error("Token validation error:", error);
                logout();
            }
        }
    }

    function logout() {
        localStorage.clear();
        const basePath = getBasePath();
        window.location.href = `${basePath}/auth/login.html`;
    }

    // Make showNotification globally accessible
    window.showNotification = function(message, type) {
        let notificationContainer = document.querySelector(".notification-container");
        
        if (!notificationContainer) {
            notificationContainer = document.createElement("div");
            notificationContainer.className = "notification-container";
            notificationContainer.style.position = "fixed";
            notificationContainer.style.top = "20px";
            notificationContainer.style.right = "20px";
            notificationContainer.style.zIndex = "1000";
            document.body.appendChild(notificationContainer);
        }
        
        const notification = document.createElement("div");
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.padding = "12px 20px";
        notification.style.marginBottom = "10px";
        notification.style.borderRadius = "4px";
        notification.style.backgroundColor = type === "success" ? "#28a745" : "#dc3545";
        notification.style.color = "white";
        
        notificationContainer.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    };

    // QR scanner initialization
    let html5QrcodeScanner = null;

    async function initQRScanner() {
        try {
            const qrReader = document.getElementById('qr-reader');
            if (!qrReader) return;

            // Clean up existing scanner
            if (html5QrcodeScanner) {
                await html5QrcodeScanner.stop();
                await html5QrcodeScanner.clear();
            }

            // Initialize new scanner
            html5QrcodeScanner = new Html5QrcodeScanner(
                "qr-reader",
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    rememberLastUsedCamera: true,
                    aspectRatio: 1.0,
                    showTorchButtonIfSupported: true
                },
                /* verbose= */ false
            );

            await html5QrcodeScanner.render(onQRCodeSuccess, onQRCodeError);
        } catch (error) {
            console.error('QR Scanner Error:', error);
            showNotification('Failed to initialize camera', 'error');
        }
    }

    function onQRCodeSuccess(decodedText) {
        try {
            fetch(`${API_BASE_URL}/auth/qr-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ qrData: decodedText })
            })
            .then(response => response.json())
            .then(data => {
                if (data.token) {
                    if (html5QrcodeScanner) {
                        html5QrcodeScanner.clear();
                    }
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('userData', JSON.stringify(data.user));
                    showNotification('Login successful!', 'success');
                    
                    setTimeout(() => {
                        window.location.href = data.user.role === 'student' 
                            ? '../student/student_dashboard.html'
                            : '../teacher/teacher_dashboard.html';
                    }, 1500);
                }
            })
                    .catch(error => {
                        console.error('QR login error:', error);
                        showNotification('Failed to process QR code', 'error');
                    });
                } catch (error) {
                    console.error('QR login error:', error);
                    showNotification('Failed to process QR code', 'error');
                }
            }
        
        });
       