# mfa_auth
sample auth with mfa mechanism
=======
- mkdir mfa_auth
- cd mfa_auth
- npm init -y
- node index.js, backend api will run at on port 30000
- python -m http.server to run frontend
- open the browser http://localhost:8000


## Code Review
1. JavaScript Backend (index.js)

    Uses Express and MySQL for server and data.
    Properly uses bcrypt for password hashing.
    JWT-based authentication with secret from environment variables.
    Implements rate limiting, CORS, and error handling.
    MFA with TOTP (otplib) and QR code (qrcode) generation.
    Registration and login workflows include all expected checks (missing fields, user existence, MFA validation, etc.).
    Uses parameterized queries – good for SQL injection prevention.
    Error handling returns appropriate HTTP status codes and messages.

2. JavaScript Frontend (loginflow.js, dashboard.js)

    Validates input fields for username, password, and TOTP.
    Handles UI state changes for MFA registration/login steps.
    Shows alerts for errors and warnings.
    Stores JWT in localStorage and manages session expiry.
    Dashboard JS decodes JWT safely, manages session timers, and handles logout.
    Communicates with backend using fetch API.

3. HTML (index.html, dashboard.html)

    Well-structured forms and modals.
    UI guides users through login and MFA registration steps.
    Uses Bootstrap for responsive design.