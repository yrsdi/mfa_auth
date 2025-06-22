const API_BASE = "http://localhost:3000";
const tokenKey = "auth_token";

// === Dynamic required: only visible inputs ===
function updateRequiredFields(step) {
  document.getElementById("loginUsername").required = (step === 1);
  document.getElementById("loginPassword").required = (step === 1);
  document.getElementById("loginTotp").required = (step === 2);
}
function showLoginStep(step) {
  document.getElementById("loginStep1").style.display = step === 1 ? "" : "none";
  document.getElementById("loginStep2").style.display = step === 2 ? "" : "none";
  document.getElementById("loginStepQr").style.display = step === 3 ? "" : "none";
  updateRequiredFields(step);
}

// === Alert Helper ===
function showAlert(container, type, msg) {
  document.getElementById(container).innerHTML =
    `<div class="alert alert-${type} fadein" role="alert">${msg}</div>`;
}
function clearAlert(container) {
  document.getElementById(container).innerHTML = "";
}

// === Register Modal Handler ===
const registerModal = new bootstrap.Modal(document.getElementById('registerModal'));

// === Register Step Handler ===
function showRegisterStep(step) {
  document.getElementById("btnRegisterStart").style.display = (step === 1) ? "" : "none";
  document.getElementById("registerStepQr").style.display = (step === 2) ? "" : "none";
  document.getElementById("registerStepTotp").style.display = (step === 3) ? "" : "none";
}

// === Register Flow State ===
let registerState = {
  username: "",
  password: "",
  secret: "",
  qrCode: ""
};

// === Register Multi-Step Flow ===
document.getElementById("btnRegisterStart").onclick = async function() {
  clearAlert("registerAlert");
  const username = document.getElementById("registerUsername").value.trim();
  const password = document.getElementById("registerPassword").value.trim();
  if (!username || !password) {
    showAlert("registerAlert", "warning", "Username dan password wajib diisi.");
    return;
  }
  registerState.username = username;
  registerState.password = password;
  // Call backend to generate MFA secret & QR (belum insert user)
  try {
    const res = await fetch(API_BASE + "/register/init", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({username, password})
    });
    const data = await res.json();
    if (res.ok && data.qrCode && data.secret) {
      registerState.qrCode = data.qrCode;
      registerState.secret = data.secret;
      document.getElementById("registerQrCode").src = data.qrCode;
      showRegisterStep(2);
    } else if (data.message && /exist/i.test(data.message)) {
      showAlert("registerAlert", "danger", "User sudah terdaftar, silakan login.");
    } else {
      showAlert("registerAlert", "danger", data.message || "Registrasi gagal.");
    }
  } catch {
    showAlert("registerAlert", "danger", "Gagal terhubung ke server.");
  }
};

document.getElementById("btnRegisterAfterQr").onclick = function() {
  showRegisterStep(3);
};

document.getElementById("btnRegisterTotpSubmit").onclick = async function() {
  clearAlert("registerAlert");
  const totp = document.getElementById("registerTotp").value.trim();
  if (!totp || !/^\d{6}$/.test(totp)) {
    showAlert("registerAlert", "warning", "TOTP harus 6 digit angka");
    return;
  }
  // Insert user + secret ke DB, verifikasi TOTP, login
  try {
    const res = await fetch(API_BASE + "/register/finish", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        username: registerState.username,
        password: registerState.password,
        secret: registerState.secret,
        totp
      })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      localStorage.setItem(tokenKey, data.token);
      registerModal.hide();
      window.location.href = "dashboard.html";
    } else {
      showAlert("registerAlert", "danger", data.message || "TOTP salah / aktivasi gagal.");
    }
  } catch {
    showAlert("registerAlert", "danger", "Gagal terhubung ke server.");
  }
};

// === Login State ===
let loginState = {
  username: "",
  password: "",
  tempToken: "",
  mfaQr: "",
};

showLoginStep(1); // Initial step

document.getElementById("loginForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  clearAlert("loginAlert");
  if (document.getElementById("loginStep1").style.display === "none") return;
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;
  if (!username || !password) {
    showAlert("loginAlert", "warning", "Username dan password wajib diisi.");
    return;
  }
  loginState.username = username;
  loginState.password = password;
  try {
    const res = await fetch(API_BASE + "/login", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok && data.token) {
      localStorage.setItem(tokenKey, data.token);
      window.location.href = "dashboard.html";
      return;
    }
    if (data.message === "TOTP required") {
      showLoginStep(2);
      setTimeout(() => document.getElementById("loginTotp").focus(), 150);
      return;
    }
    if (data.token) {
      loginState.tempToken = data.token;
      // Setup MFA (get QR)
      const mfaRes = await fetch(API_BASE + "/mfa/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + data.token
        }
      });
      const mfaData = await mfaRes.json();
      if (mfaData.qrCode) {
        loginState.mfaQr = mfaData.qrCode;
        document.getElementById("loginQrCode").src = mfaData.qrCode;
        showLoginStep(3);
      } else {
        showAlert("loginAlert", "danger", mfaData.message || "Gagal setup MFA");
      }
      return;
    }

    // === Redirect ke register jika user tidak ditemukan ===
    if (
      res.status === 404 ||
      (data.message && /(not\s*found|user tidak ditemukan|user not exist|tidak ditemukan)/i.test(data.message))
    ) {
      document.getElementById("registerUsername").value = username;
      document.getElementById("registerPassword").value = password;
      showRegisterStep(1);
      clearAlert("registerAlert");
      registerModal.show();
      showAlert("registerAlert", "warning", "User tidak ditemukan, silakan lanjutkan registrasi dan aktifkan MFA.");
      return;
    }
    // wrong password or other error
    showAlert("loginAlert", "danger", data.message || "Login gagal");
  } catch {
    showAlert("loginAlert", "danger", "Tidak dapat terhubung ke server");
  }
});

// === Login Step 2: TOTP ===
document.getElementById("btnTotpNext").onclick = async function() {
  clearAlert("loginAlert");
  const totp = document.getElementById("loginTotp").value.trim();
  if (!totp || !/^\d{6}$/.test(totp)) {
    showAlert("loginAlert", "warning", "TOTP harus 6 digit angka");
    return;
  }
  const username = loginState.username;
  const password = loginState.password;
  try {
    const res = await fetch(API_BASE + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, totp })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      localStorage.setItem(tokenKey, data.token);
      window.location.href = "dashboard.html";
    } else {
      showAlert("loginAlert", "danger", data.message || "TOTP salah");
    }
  } catch {
    showAlert("loginAlert", "danger", "Tidak dapat terhubung ke server");
  }
};

// === Login Step 3: MFA QR, lalu lanjut ke TOTP ===
document.getElementById("btnAfterQr").onclick = function() {
  showLoginStep(2);
  setTimeout(() => document.getElementById("loginTotp").focus(), 150);
};