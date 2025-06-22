// === CONFIG ===
const tokenKey = "auth_token";
const API_BASE = "http://localhost:3000"; // Change if needed

// === JWT Decode helper ===
function parseJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function formatTimeLeft(seconds) {
  if (seconds < 0) return "expired";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// === SESSION HANDLING ===
let sessionInterval = null;
let jwtExp = 0;

function setSessionTimer(exp) {
  clearInterval(sessionInterval);
  function update() {
    const now = Math.floor(Date.now() / 1000);
    const left = exp - now;
    document.getElementById("expiryCountdown").textContent = formatTimeLeft(left);
    document.getElementById("sessionTimer").textContent = formatTimeLeft(left);
    if (left <= 0) {
      clearInterval(sessionInterval);
      showSessionExpired();
    }
  }
  update();
  sessionInterval = setInterval(update, 1000);
}

function showSessionExpired() {
  alert("Session expired. Please login again.");
  localStorage.removeItem(tokenKey);
  window.location.href = "index.html";
}

// === LOAD USER PROFILE & SESSION ===
function loadDashboard() {
  // Get JWT and decode
  const token = localStorage.getItem(tokenKey);
  if (!token) {
    window.location.href = "index.html";
    return;
  }
  const payload = parseJwt(token);
  // Required: username, exp, id (optional)
  const username = payload.username || payload.user || "User";
  const id = payload.id || payload.sub || "-";
  jwtExp = payload.exp || 0;

  // Sidebar
  document.getElementById("sidebarUsername").textContent = username;
  document.getElementById("sidebarExp").textContent = "Exp: " + (jwtExp ? new Date(jwtExp*1000).toLocaleString() : "-");
  document.getElementById("sidebarAvatar").src = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}`;

  // Welcome section
  document.getElementById("welcomeUser").textContent = username;
  document.getElementById("profileUser").textContent = username;
  document.getElementById("profileId").textContent = id;
  document.getElementById("profileExpiry").textContent = jwtExp ? new Date(jwtExp*1000).toLocaleString() : "-";

  setSessionTimer(jwtExp);
}

// === SIDEBAR NAV ===
document.addEventListener("DOMContentLoaded", function() {
  loadDashboard();

  // Sidebar navigation
  document.getElementById("menuDashboard").onclick = function(e) {
    e.preventDefault();
    document.getElementById("welcomeSection").classList.remove("d-none");
    document.getElementById("profileSection").classList.add("d-none");
    document.getElementById("dashboardTitle").textContent = "Dashboard";
    let sidebar = bootstrap.Offcanvas.getOrCreateInstance(document.getElementById('sidebarMenu'));
    sidebar.hide();
  };
  document.getElementById("menuProfile").onclick = function(e) {
    e.preventDefault();
    document.getElementById("welcomeSection").classList.add("d-none");
    document.getElementById("profileSection").classList.remove("d-none");
    document.getElementById("dashboardTitle").textContent = "Profile";
    let sidebar = bootstrap.Offcanvas.getOrCreateInstance(document.getElementById('sidebarMenu'));
    sidebar.hide();
  };

  // Logout
  document.getElementById("btnLogout").onclick = function() {
    localStorage.removeItem(tokenKey);
    window.location.href = "index.html";
  };
});