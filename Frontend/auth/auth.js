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
                const response = await fetch("http://localhost:5000/register", {
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
    const API_BASE_URL = 'http://localhost:5000';

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
                const data = await fetchWithRetry(`${API_BASE_URL}/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: document.getElementById("email").value.trim(),
                        password: document.getElementById("password").value.trim()
                    })
                });

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
                handleApiError(error);
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

    setupTokenExpirationCheck();

    // Helper function to show notifications
    function showNotification(message, type) {
        // Check if notification container exists, if not create it
        let notificationContainer = document.querySelector(".notification-container");
        
        if (!notificationContainer) {
            notificationContainer = document.createElement("div");
            notificationContainer.className = "notification-container";
            document.body.appendChild(notificationContainer);
            
            // Add styles for the notification container
            notificationContainer.style.position = "fixed";
            notificationContainer.style.top = "20px";
            notificationContainer.style.right = "20px";
            notificationContainer.style.zIndex = "1000";
        }
        
        // Create notification element
        const notification = document.createElement("div");
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Style the notification
        notification.style.padding = "12px 20px";
        notification.style.marginBottom = "10px";
        notification.style.borderRadius = "4px";
        notification.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
        notification.style.transition = "opacity 0.3s ease";
        
        if (type === "success") {
            notification.style.backgroundColor = "#28a745";
            notification.style.color = "white";
        } else if (type === "error") {
            notification.style.backgroundColor = "#dc3545";
            notification.style.color = "white";
        }
        
        // Add notification to container
        notificationContainer.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.opacity = "0";
            setTimeout(() => {
                notificationContainer.removeChild(notification);
            }, 300);
        }, 3000);
    }

    // Add email validation function
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Add debounced email check
    let emailCheckTimeout;
    async function checkEmailAvailability(email) {
        try {
            const response = await fetch(`${API_BASE_URL}/check-email/${encodeURIComponent(email)}`);
            const data = await response.json();
            return !data.exists;
        } catch (error) {
            console.error('Email check failed:', error);
            return true; // Allow form submission on check failure
        }
    }

    // Add helper function to show field errors
    function showFieldError(field, message) {
        field.classList.add('error');
        
        // Remove existing error message if any
        const existingError = field.parentElement.querySelector('.error-message');
        if (existingError) existingError.remove();
        
        // Add new error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.color = '#dc3545';
        errorDiv.style.fontSize = '0.875rem';
        errorDiv.style.marginTop = '0.25rem';
        errorDiv.textContent = message;
        
        field.parentElement.appendChild(errorDiv);
    }
});