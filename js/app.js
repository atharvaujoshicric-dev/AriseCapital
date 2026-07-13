// =====================================================================
// TRUSTON — Application Logic
// NOTE: the Supabase CDN script exposes a global named `supabase`
// (the library namespace, with .createClient on it). We deliberately
// name our own client variable `sb` everywhere below so we never
// shadow/collide with that global.
// =====================================================================

let sb = null;
let currentUser = null;
let currentProfile = null; // { id, email, full_name, role }
let allUnits = [];
let selectedCategory = "Studio";
let selectedUnit = null;

document.getElementById("reraNoTop").textContent = PROJECT_RERA_NUMBER;

function roleLabel(role) {
  if (role === "admin") return "Admin";
  if (role === "site_head") return "Site Head";
  return "Sales";
}

// ---------------------------------------------------------------------
// INIT SUPABASE
// ---------------------------------------------------------------------
function initSupabase() {
  if (SUPABASE_URL.includes("YOUR_SUPABASE") || SUPABASE_ANON_KEY.includes("YOUR_SUPABASE")) {
    showLoginError("Supabase is not configured yet. Edit js/config.js with your project URL and anon key.");
    return false;
  }
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return true;
}

function showLoginError(msg) {
  const el = document.getElementById("loginError");
  el.textContent = msg;
  el.style.display = "block";
}
function showSignUpError(msg) {
  const el = document.getElementById("signUpError");
  el.textContent = msg;
  el.style.display = "block";
}

// ---------------------------------------------------------------------
// BOOTSTRAP CHECK — show "Sign Up" only if no accounts exist yet
// ---------------------------------------------------------------------
async function checkBootstrap() {
  try {
    const { data, error } = await sb.rpc("needs_bootstrap");
    if (!error && data === true) {
      document.getElementById("bootstrapHint").style.display = "block";
    }
  } catch (e) { /* non-fatal */ }
}

document.getElementById("showSignUpLink").addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("signInView").style.display = "none";
  document.getElementById("signUpView").style.display = "block";
});
document.getElementById("backToSignInLink").addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("signUpView").style.display = "none";
  document.getElementById("signInView").style.display = "block";
});

document.getElementById("signUpBtn").addEventListener("click", async () => {
  if (!sb && !initSupabase()) return;
  const name = document.getElementById("signUpName").value.trim();
  const email = document.getElementById("signUpEmail").value.trim();
  const password = document.getElementById("signUpPassword").value;
  if (!name || !email || !password) { showSignUpError("Fill in all fields."); return; }
  if (password.length < 6) { showSignUpError("Password must be at least 6 characters."); return; }

  const { data, error } = await sb.auth.signUp({
    email, password, options: { data: { full_name: name } }
  });
  if (error) { showSignUpError(error.message); return; }

  if (data.session) {
    // Some Supabase projects auto-confirm; if so we're logged in immediately.
    currentUser = data.user;
    await loadProfileAndEnter();
  } else {
    showSignUpError("Account created. If email confirmation is enabled on your Supabase project, confirm the email, then sign in.");
  }
});

// ---------------------------------------------------------------------
// AUTH — Sign in
// ---------------------------------------------------------------------
document.getElementById("loginBtn").addEventListener("click", async () => {
  if (!sb && !initSupabase()) return;
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  if (!email || !password) { showLoginError("Enter email and password."); return; }

  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { showLoginError(error.message); return; }
  currentUser = data.user;
  await loadProfileAndEnter();
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await sb.auth.signOut();
  location.reload();
});

async function loadProfileAndEnter() {
  const { data: profile, error } = await sb
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", currentUser.id)
    .single();

  if (error) { showLoginError("Could not load your profile: " + error.message); return; }
  currentProfile = profile;

  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("appShell").style.display = "flex";
  document.getElementById("userBadge").textContent =
    `${profile.full_name || profile.email} · ${roleLabel(profile.role)}`;

  if (profile.role === "admin" || profile.role === "site_head") {
    document.getElementById("viewBookingsBtn").style.display = "inline-block";
  }
  if (profile.role === "admin") {
    document.getElementById("exportExcelBtn").style.display = "inline-block";
    document.getElementById("manageUsersBtn").style.display = "inline-block";
    document.getElementById("auditLogBtn").style.display = "inline-block";
    document.getElementById("resetSystemBtn").style.display = "inline-block";
  }

  await loadUnits();
  renderCategoryTabs();
  renderFloorFilter();
  renderGrid();
}

// Try to resume session on load
(async function boot() {
  if (!initSupabase()) return;
  await checkBootstrap();
  const { data } = await sb.auth.getSession();
  if (data.session) {
    currentUser = data.session.user;
    await loadProfileAndEnter();
  }
})();

// ---------------------------------------------------------------------
// DATA
// ---------------------------------------------------------------------
async function loadUnits() {
  const { data, error } = await sb.from("units").select("*").order("id");
  if (error) { alert("Failed to load inventory: " + error.message); return; }
  allUnits = data;
}

function renderCategoryTabs() {
  const cats = ["Studio", "Office", "Showroom", "Shop"];
  const wrap = document.getElementById("categoryTabs");
  wrap.innerHTML = "";
  cats.forEach(cat => {
    const meta = CATEGORY_META[cat];
    const count = allUnits.filter(u => u.category === cat).length;
    const div = document.createElement("div");
    div.className = "category-tab" + (cat === selectedCategory ? " active" : "");
    div.textContent = `${meta.label} (${count})`;
    div.onclick = () => {
      selectedCategory = cat;
      renderCategoryTabs();
      renderFloorFilter();
      renderGrid();
    };
    wrap.appendChild(div);
  });
}

function renderFloorFilter() {
  const sel = document.getElementById("floorFilter");
  const floors = [...new Set(allUnits.filter(u => u.category === selectedCategory).map(u => u.floor))].sort((a,b) => a-b);
  sel.innerHTML = '<option value="">All Floors</option>' +
    floors.map(f => `<option value="${f}">${f === 0 ? "Ground Floor" : "Floor " + f}</option>`).join("");
}

document.getElementById("floorFilter").addEventListener("change", renderGrid);
document.getElementById("statusFilter").addEventListener("change", renderGrid);

function getFilteredUnits() {
  const floor = document.getElementById("floorFilter").value;
  const status = document.getElementById("statusFilter").value;
  return allUnits.filter(u => {
    if (u.category !== selectedCategory) return false;
    if (floor !== "" && u.floor !== Number(floor)) return false;
    if (status !== "" && u.status !== status) return false;
    return true;
  });
}

function renderGrid() {
  const grid = document.getElementById("unitGrid");
  const units = getFilteredUnits();
  grid.innerHTML = "";
  units.forEach(u => {
    const tile = document.createElement("div");
    tile.className = `unit-tile status-${u.status}` + (selectedUnit && selectedUnit.id === u.id ? " selected" : "");
    tile.innerHTML = `
      <div class="u-id"><span class="status-dot dot-${u.status}"></span>${u.unit_label}</div>
      <div class="u-carpet">${u.carpet} sq.ft</div>
    `;
    tile.onclick = () => { selectedUnit = u; renderGrid(); renderDetail(); };
    grid.appendChild(tile);
  });
  renderStats();
}

function renderStats() {
  const units = getFilteredUnits();
  const counts = { available: 0, on_hold: 0, sold: 0, blocked: 0 };
  units.forEach(u => counts[u.status]++);
  document.getElementById("statsContent").innerHTML = `
    Total: <b>${units.length}</b><br/>
    Available: <b>${counts.available}</b><br/>
    On Hold: <b>${counts.on_hold}</b><br/>
    Sold: <b>${counts.sold}</b><br/>
    Blocked: <b>${counts.blocked}</b>
  `;
}

// ---------------------------------------------------------------------
// DETAIL PANEL
// ---------------------------------------------------------------------
function renderDetail() {
  const u = selectedUnit;
  document.getElementById("detailEmpty").style.display = "none";
  const box = document.getElementById("detailContent");
  box.style.display = "block";

  let html = `
    <div class="detail-content">
      <h3>${u.unit_label}</h3>
      <div style="font-size:12px;color:#999;margin-bottom:10px;">${u.id} · ${CATEGORY_META[u.category].label} · ${u.floor === 0 ? "Ground Floor" : "Floor " + u.floor}</div>
      <div class="detail-row"><span>Status</span><b><span class="status-dot dot-${u.status}"></span>${u.status.replace("_"," ")}</b></div>
      <div class="detail-row"><span>Carpet Area</span><b>${u.carpet} sq.ft</b></div>
      <div class="detail-row"><span>Saleable Area</span><b>${u.saleable} sq.ft</b></div>
      <div class="detail-row"><span>Agreement Value</span><b>₹${fmtNum(u.agreement_value)}</b></div>
      <div class="detail-row"><span>Stamp Duty</span><b>₹${fmtNum(u.stamp_duty)}</b></div>
      <div class="detail-row"><span>Registration</span><b>₹${fmtNum(u.registration)}</b></div>
      <div class="detail-row"><span>GST</span><b>₹${fmtNum(u.gst)}</b></div>
      <div class="detail-row"><span>Total Package</span><b>₹${fmtNum(u.package)}</b></div>
      ${u.note ? `<div style="font-size:11px;color:#a97b1f;margin-top:8px;">⚠ ${u.note}</div>` : ""}
    </div>
    <div class="detail-actions">
  `;

  if (u.status === "available") {
    html += `<button class="btn btn-outline" onclick="toggleHold(true)">Place Hold</button>`;
    html += `<button class="btn btn-primary" onclick="openBookingModal()">Create Booking</button>`;
  } else if (u.status === "on_hold") {
    html += `<button class="btn btn-outline" onclick="toggleHold(false)">Release Hold</button>`;
    html += `<button class="btn btn-primary" onclick="openBookingModal()">Create Booking</button>`;
  } else if (u.status === "sold") {
    html += `<div style="font-size:12px;color:#999;">This unit is sold. See Bookings (admin) to manage.</div>`;
  }

  html += `<button class="btn btn-ghost" onclick="openBookingModal(true)">Preview Cost Sheet (no booking)</button>`;
  html += `</div>`;

  if (currentProfile.role === "admin") {
    html += `
      <div class="admin-section">
        <div class="sidebar-label">Admin Controls</div>
        <select id="adminStatusSelect" style="margin-bottom:8px;">
          <option value="available" ${u.status==="available"?"selected":""}>Available</option>
          <option value="on_hold" ${u.status==="on_hold"?"selected":""}>On Hold</option>
          <option value="sold" ${u.status==="sold"?"selected":""}>Sold</option>
          <option value="blocked" ${u.status==="blocked"?"selected":""}>Blocked</option>
        </select>
        <button class="btn btn-outline btn-sm btn-block" onclick="adminForceStatus()">Set Status</button>
      </div>
    `;
  }

  box.innerHTML = html;
}

async function toggleHold(hold) {
  const { error } = await sb.rpc("sales_set_hold", { p_unit_id: selectedUnit.id, p_hold: hold });
  if (error) { alert("Error: " + error.message); return; }
  await refreshAfterAction();
}

async function adminForceStatus() {
  const status = document.getElementById("adminStatusSelect").value;
  const { error } = await sb.rpc("admin_set_unit_status", { p_unit_id: selectedUnit.id, p_status: status });
  if (error) { alert("Error: " + error.message); return; }
  await refreshAfterAction();
}

async function refreshAfterAction() {
  await loadUnits();
  if (selectedUnit) {
    selectedUnit = allUnits.find(u => u.id === selectedUnit.id);
  }
  renderCategoryTabs();
  renderGrid();
  if (selectedUnit) renderDetail();
}

// ---------------------------------------------------------------------
// BOOKING MODAL
// ---------------------------------------------------------------------
let previewOnlyMode = false;

function openBookingModal(previewOnly) {
  previewOnlyMode = !!previewOnly;
  const u = selectedUnit;
  document.getElementById("bookingUnitSummary").innerHTML =
    `<b>${u.unit_label}</b> (${u.id}) — ${u.carpet} sq.ft carpet · Package ₹${fmtNum(u.package)}`;
  document.getElementById("custName").value = "";
  document.getElementById("custPhone").value = "";
  document.getElementById("custEmail").value = "";
  document.getElementById("overrideAgreement").value = "";
  document.getElementById("bookingError").style.display = "none";
  document.getElementById("adminPriceOverride").style.display =
    (currentProfile.role === "admin" && !previewOnlyMode) ? "block" : "none";
  document.getElementById("confirmBookingBtn").style.display = previewOnlyMode ? "none" : "inline-block";
  document.getElementById("bookingModal").style.display = "flex";
}

document.getElementById("closeBookingModal").onclick = () => document.getElementById("bookingModal").style.display = "none";
document.getElementById("cancelBookingBtn").onclick = () => document.getElementById("bookingModal").style.display = "none";

document.getElementById("previewPdfBtn").onclick = () => {
  const name = document.getElementById("custName").value.trim() || "Prospective Customer";
  generateCostSheetPDF(selectedUnit, name, {
    agreement_value: selectedUnit.agreement_value, stamp_duty: selectedUnit.stamp_duty,
    registration: selectedUnit.registration, gst: selectedUnit.gst, package: selectedUnit.package
  });
};

document.getElementById("confirmBookingBtn").onclick = async () => {
  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  const email = document.getElementById("custEmail").value.trim();
  const errBox = document.getElementById("bookingError");

  if (!name) {
    errBox.textContent = "Customer name is required.";
    errBox.style.display = "block";
    return;
  }

  const u = selectedUnit;
  let agreement = u.agreement_value, stamp = u.stamp_duty, reg = u.registration, gst = u.gst, pkg = u.package;

  if (currentProfile.role === "admin") {
    const overrideVal = document.getElementById("overrideAgreement").value;
    if (overrideVal) {
      agreement = Number(overrideVal);
      const ratio = agreement / u.agreement_value;
      stamp = Math.round(stamp * ratio);
      gst = Math.round(gst * ratio);
      pkg = agreement + stamp + reg + gst;
    }
  }

  const { data, error } = await sb.rpc("create_booking", {
    p_unit_id: u.id, p_customer_name: name, p_customer_phone: phone || null, p_customer_email: email || null,
    p_agreement_value: agreement, p_stamp_duty: stamp, p_registration: reg, p_gst: gst, p_package: pkg,
    p_apr_override: null
  });

  if (error) {
    errBox.textContent = "Error: " + error.message;
    errBox.style.display = "block";
    return;
  }

  document.getElementById("bookingModal").style.display = "none";
  generateCostSheetPDF(u, name, { agreement_value: agreement, stamp_duty: stamp, registration: reg, gst, package: pkg });
  await refreshAfterAction();
};

// ---------------------------------------------------------------------
// MANAGE USERS (admin only)
// ---------------------------------------------------------------------
document.getElementById("manageUsersBtn").addEventListener("click", async () => {
  await renderUsersList();
  document.getElementById("usersModal").style.display = "flex";
});
document.getElementById("closeUsersModal").onclick = () => document.getElementById("usersModal").style.display = "none";

async function renderUsersList() {
  const { data, error } = await sb.from("profiles").select("id, email, full_name, role").order("created_at");
  const listEl = document.getElementById("usersList");
  if (error) { listEl.innerHTML = `<div class="error-msg">Failed to load users: ${error.message}</div>`; return; }

  listEl.innerHTML = data.map(u => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
      <div>
        <div style="font-weight:600;">${u.full_name || "(no name)"}</div>
        <div style="font-size:12px;color:#888;">${u.email}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <select data-uid="${u.id}" class="role-select" ${u.id === currentUser.id ? "disabled title='You cannot change your own role'" : ""}>
          <option value="sales" ${u.role==="sales"?"selected":""}>Sales</option>
          <option value="site_head" ${u.role==="site_head"?"selected":""}>Site Head</option>
          <option value="admin" ${u.role==="admin"?"selected":""}>Admin</option>
        </select>
      </div>
    </div>
  `).join("");

  listEl.querySelectorAll(".role-select").forEach(sel => {
    sel.addEventListener("change", async (e) => {
      const uid = e.target.getAttribute("data-uid");
      const role = e.target.value;
      const { error } = await sb.rpc("admin_set_user_role", { p_user_id: uid, p_role: role });
      if (error) { alert("Error: " + error.message); await renderUsersList(); return; }
      await renderUsersList();
    });
  });
}

// ---- Add User (admin only) — uses a throwaway, non-persisted Supabase
// client so signing up the new user never touches the admin's own
// logged-in session. No Edge Function or service-role key involved.
document.getElementById("openAddUserBtn").addEventListener("click", () => {
  document.getElementById("newUserName").value = "";
  document.getElementById("newUserEmail").value = "";
  document.getElementById("newUserPassword").value = "";
  document.getElementById("newUserRole").value = "sales";
  document.getElementById("addUserError").style.display = "none";
  document.getElementById("addUserModal").style.display = "flex";
});
document.getElementById("closeAddUserModal").onclick = () => document.getElementById("addUserModal").style.display = "none";
document.getElementById("cancelAddUserBtn").onclick = () => document.getElementById("addUserModal").style.display = "none";

document.getElementById("confirmAddUserBtn").addEventListener("click", async () => {
  const name = document.getElementById("newUserName").value.trim();
  const email = document.getElementById("newUserEmail").value.trim();
  const password = document.getElementById("newUserPassword").value;
  const role = document.getElementById("newUserRole").value;
  const errBox = document.getElementById("addUserError");

  if (!name || !email || !password) { errBox.textContent = "Fill in all fields."; errBox.style.display = "block"; return; }
  if (password.length < 6) { errBox.textContent = "Password must be at least 6 characters."; errBox.style.display = "block"; return; }

  // Isolated client: persistSession false + a distinct storageKey means
  // this sign-up never overwrites the admin's real session in this tab.
  const tempClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  const { data, error } = await tempClient.auth.signUp({
    email, password, options: { data: { full_name: name } }
  });

  if (error) { errBox.textContent = "Error: " + error.message; errBox.style.display = "block"; return; }

  // New user defaults to 'sales' via the DB trigger. If admin picked
  // "Admin" in the form, promote them right away using our own session.
  if (role === "admin" && data.user) {
    await sb.rpc("admin_set_user_role", { p_user_id: data.user.id, p_role: "admin" });
  }

  document.getElementById("addUserModal").style.display = "none";
  await renderUsersList();
  alert(`User created. Share these credentials with them:\n\nEmail: ${email}\nPassword: ${password}`);
});

// ---------------------------------------------------------------------
// CHANGE PASSWORD (any logged-in user)
// ---------------------------------------------------------------------
document.getElementById("changePasswordBtn").addEventListener("click", () => {
  document.getElementById("newPassword").value = "";
  document.getElementById("changePasswordError").style.display = "none";
  document.getElementById("changePasswordModal").style.display = "flex";
});
document.getElementById("closeChangePasswordModal").onclick = () => document.getElementById("changePasswordModal").style.display = "none";
document.getElementById("cancelChangePasswordBtn").onclick = () => document.getElementById("changePasswordModal").style.display = "none";

document.getElementById("confirmChangePasswordBtn").addEventListener("click", async () => {
  const pw = document.getElementById("newPassword").value;
  const errBox = document.getElementById("changePasswordError");
  if (!pw || pw.length < 6) { errBox.textContent = "Password must be at least 6 characters."; errBox.style.display = "block"; return; }

  const { error } = await sb.auth.updateUser({ password: pw });
  if (error) { errBox.textContent = "Error: " + error.message; errBox.style.display = "block"; return; }

  document.getElementById("changePasswordModal").style.display = "none";
  alert("Password updated.");
});

// ---------------------------------------------------------------------
// BOOKINGS LIST (Admin + Site Head) — view, edit, cancel (admin only)
// ---------------------------------------------------------------------
let editingBookingId = null;

document.getElementById("viewBookingsBtn").addEventListener("click", async () => {
  await renderBookingsList();
  document.getElementById("bookingsListModal").style.display = "flex";
});
document.getElementById("closeBookingsListModal").onclick = () => document.getElementById("bookingsListModal").style.display = "none";

async function renderBookingsList() {
  const { data, error } = await sb
    .from("bookings")
    .select("*, units(unit_label, category, floor)")
    .order("created_at", { ascending: false });

  const listEl = document.getElementById("bookingsList");
  if (error) { listEl.innerHTML = `<div class="error-msg">Failed to load bookings: ${error.message}</div>`; return; }

  if (data.length === 0) { listEl.innerHTML = `<div style="color:#999;font-size:13px;">No bookings yet.</div>`; return; }

  listEl.innerHTML = data.map(b => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
      <div>
        <div style="font-weight:600;">${b.customer_name} ${b.status === "cancelled" ? '<span style="color:#b23b3b;font-size:11px;">(CANCELLED)</span>' : ''}</div>
        <div style="font-size:12px;color:#888;">
          ${b.units ? b.units.unit_label + " · " + b.units.category : b.unit_id} · ₹${fmtNum(b.package)} · ${b.booking_date}
        </div>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-outline btn-sm" onclick="openEditBookingModal('${b.id}')">Edit</button>
        ${(currentProfile.role === "admin" && b.status === "active") ? `<button class="btn btn-ghost btn-sm" style="color:#b23b3b;" onclick="cancelBookingFromList('${b.id}')">Cancel</button>` : ""}
      </div>
    </div>
  `).join("");
}

async function openEditBookingModal(bookingId) {
  const { data, error } = await sb.from("bookings").select("*").eq("id", bookingId).single();
  if (error) { alert("Error loading booking: " + error.message); return; }

  editingBookingId = bookingId;
  document.getElementById("editCustName").value = data.customer_name || "";
  document.getElementById("editCustPhone").value = data.customer_phone || "";
  document.getElementById("editCustEmail").value = data.customer_email || "";
  document.getElementById("editAgreement").value = data.agreement_value;
  document.getElementById("editStampDuty").value = data.stamp_duty;
  document.getElementById("editRegistration").value = data.registration;
  document.getElementById("editGst").value = data.gst;
  document.getElementById("editPackage").value = data.package;
  document.getElementById("editBookingError").style.display = "none";
  document.getElementById("editBookingModal").style.display = "flex";
}
window.openEditBookingModal = openEditBookingModal;

document.getElementById("closeEditBookingModal").onclick = () => document.getElementById("editBookingModal").style.display = "none";
document.getElementById("cancelEditBookingBtn").onclick = () => document.getElementById("editBookingModal").style.display = "none";

document.getElementById("confirmEditBookingBtn").addEventListener("click", async () => {
  const errBox = document.getElementById("editBookingError");
  const name = document.getElementById("editCustName").value.trim();
  if (!name) { errBox.textContent = "Customer name is required."; errBox.style.display = "block"; return; }

  const { error } = await sb.rpc("edit_booking", {
    p_booking_id: editingBookingId,
    p_customer_name: name,
    p_customer_phone: document.getElementById("editCustPhone").value.trim() || null,
    p_customer_email: document.getElementById("editCustEmail").value.trim() || null,
    p_agreement_value: Number(document.getElementById("editAgreement").value),
    p_stamp_duty: Number(document.getElementById("editStampDuty").value),
    p_registration: Number(document.getElementById("editRegistration").value),
    p_gst: Number(document.getElementById("editGst").value),
    p_package: Number(document.getElementById("editPackage").value),
  });

  if (error) { errBox.textContent = "Error: " + error.message; errBox.style.display = "block"; return; }

  document.getElementById("editBookingModal").style.display = "none";
  await renderBookingsList();
});

async function cancelBookingFromList(bookingId) {
  if (!confirm("Cancel this booking and release the unit back to Available?")) return;
  const { error } = await sb.rpc("admin_cancel_booking", { p_booking_id: bookingId });
  if (error) { alert("Error: " + error.message); return; }
  await renderBookingsList();
  await refreshAfterAction().catch(() => {}); // no-op if no unit selected
}
window.cancelBookingFromList = cancelBookingFromList;

// ---------------------------------------------------------------------
// AUDIT LOG (Admin only)
// ---------------------------------------------------------------------
document.getElementById("auditLogBtn").addEventListener("click", async () => {
  await renderAuditLog();
  document.getElementById("auditLogModal").style.display = "flex";
});
document.getElementById("closeAuditLogModal").onclick = () => document.getElementById("auditLogModal").style.display = "none";

async function renderAuditLog() {
  const { data, error } = await sb
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const listEl = document.getElementById("auditLogList");
  if (error) { listEl.innerHTML = `<div class="error-msg">Failed to load audit log: ${error.message}</div>`; return; }
  if (data.length === 0) { listEl.innerHTML = `<div style="color:#999;font-size:13px;">No audit entries yet.</div>`; return; }

  listEl.innerHTML = data.map(a => `
    <div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:12.5px;">
      <div style="display:flex;justify-content:space-between;">
        <b>${a.action.replace(/_/g," ")}</b>
        <span style="color:#999;">${new Date(a.created_at).toLocaleString("en-IN")}</span>
      </div>
      <div style="color:#555;margin-top:2px;">${a.description || ""}</div>
      <div style="color:#999;margin-top:2px;">By: ${a.actor_name} (${roleLabel(a.actor_role)}) · ${a.table_name}${a.record_id ? " #" + a.record_id : ""}</div>
      ${a.old_data || a.new_data ? `
        <details style="margin-top:4px;">
          <summary style="cursor:pointer;color:var(--teal);">View changes</summary>
          <div style="display:flex;gap:14px;margin-top:6px;">
            <div style="flex:1;"><b>Before:</b><pre style="white-space:pre-wrap;font-size:11px;background:var(--cream);padding:6px;border-radius:4px;">${a.old_data ? JSON.stringify(a.old_data, null, 2) : "—"}</pre></div>
            <div style="flex:1;"><b>After:</b><pre style="white-space:pre-wrap;font-size:11px;background:var(--cream);padding:6px;border-radius:4px;">${a.new_data ? JSON.stringify(a.new_data, null, 2) : "—"}</pre></div>
          </div>
        </details>
      ` : ""}
    </div>
  `).join("");
}

// ---------------------------------------------------------------------
// RESET SYSTEM (Admin only)
// ---------------------------------------------------------------------
document.getElementById("resetSystemBtn").addEventListener("click", () => {
  document.getElementById("resetConfirmText").value = "";
  document.getElementById("resetSystemError").style.display = "none";
  document.getElementById("resetSystemModal").style.display = "flex";
});
document.getElementById("closeResetSystemModal").onclick = () => document.getElementById("resetSystemModal").style.display = "none";
document.getElementById("cancelResetSystemBtn").onclick = () => document.getElementById("resetSystemModal").style.display = "none";

document.getElementById("confirmResetSystemBtn").addEventListener("click", async () => {
  const errBox = document.getElementById("resetSystemError");
  if (document.getElementById("resetConfirmText").value.trim() !== "RESET") {
    errBox.textContent = 'Type RESET exactly (all caps) to confirm.';
    errBox.style.display = "block";
    return;
  }
  const { error } = await sb.rpc("admin_reset_all_units");
  if (error) { errBox.textContent = "Error: " + error.message; errBox.style.display = "block"; return; }

  document.getElementById("resetSystemModal").style.display = "none";
  selectedUnit = null;
  document.getElementById("detailEmpty").style.display = "block";
  document.getElementById("detailContent").style.display = "none";
  await loadUnits();
  renderCategoryTabs();
  renderGrid();
  alert("System reset complete. All units are now Available and all active bookings were cancelled.");
});

// ---------------------------------------------------------------------
// PDF GENERATION (2-page cost sheet)
// ---------------------------------------------------------------------
function fmtNum(n) {
  return Number(n).toLocaleString("en-IN");
}

function numberToWordsIndian(num) {
  num = Math.round(Number(num));
  if (num === 0) return "Zero";
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten",
    "Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];

  function twoDigit(n) {
    if (n < 20) return ones[n];
    return tens[Math.floor(n/10)] + (n%10 ? " " + ones[n%10] : "");
  }
  function threeDigit(n) {
    if (n < 100) return twoDigit(n);
    return ones[Math.floor(n/100)] + " Hundred" + (n%100 ? " " + twoDigit(n%100) : "");
  }

  let crore = Math.floor(num / 10000000); num %= 10000000;
  let lakh = Math.floor(num / 100000); num %= 100000;
  let thousand = Math.floor(num / 1000); num %= 1000;
  let hundred = num;

  let parts = [];
  if (crore) parts.push(threeDigit(crore) + " Crore");
  if (lakh) parts.push(threeDigit(lakh) + " Lakh");
  if (thousand) parts.push(threeDigit(thousand) + " Thousand");
  if (hundred) parts.push(threeDigit(hundred));
  return parts.join(" ");
}

function generateCostSheetPDF(unit, customerName, costs) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  let y = 20;

  doc.setFillColor(44, 74, 86);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255,255,255);
  doc.setFontSize(20);
  doc.setFont("helvetica","bold");
  doc.text(PROJECT_NAME, 14, 14);
  doc.setFontSize(11);
  doc.setFont("helvetica","normal");
  doc.text(PROJECT_SUBTITLE + " — " + PROJECT_ADDRESS, 14, 21);
  doc.setFontSize(9);
  doc.text("RERA: " + PROJECT_RERA_NUMBER, 14, 26);

  doc.setTextColor(0,0,0);
  y = 38;
  doc.setFontSize(14);
  doc.setFont("helvetica","bold");
  doc.text("Cost Sheet", 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica","normal");
  doc.text(`Customer Name: ${customerName}`, 14, y); y += 6;
  doc.text(`Date: ${new Date().toLocaleDateString("en-IN")}`, 14, y); y += 6;
  doc.text(`Unit: ${unit.unit_label}  (${unit.id})  —  ${CATEGORY_META[unit.category].label}`, 14, y); y += 6;
  doc.text(`Floor: ${unit.floor === 0 ? "Ground Floor" : unit.floor}`, 14, y); y += 6;
  doc.text(`Carpet Area: ${unit.carpet} sq.ft   |   Saleable Area: ${unit.saleable} sq.ft`, 14, y); y += 10;

  const rows = [
    ["Agreement Value", "Rs. " + fmtNum(costs.agreement_value)],
    ["Stamp Duty", "Rs. " + fmtNum(costs.stamp_duty)],
    ["Registration Charges", "Rs. " + fmtNum(costs.registration)],
    ["GST", "Rs. " + fmtNum(costs.gst)],
  ];

  doc.setFillColor(201,150,47);
  doc.rect(14, y, 182, 8, "F");
  doc.setTextColor(255,255,255);
  doc.setFont("helvetica","bold");
  doc.setFontSize(10);
  doc.text("Particulars", 18, y + 5.5);
  doc.text("Amount", 160, y + 5.5);
  y += 8;

  doc.setTextColor(0,0,0);
  doc.setFont("helvetica","normal");
  rows.forEach((r, i) => {
    doc.setFillColor(i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 247, i % 2 === 0 ? 255 : 240);
    doc.rect(14, y, 182, 8, "F");
    doc.text(r[0], 18, y + 5.5);
    doc.text(r[1], 160, y + 5.5);
    y += 8;
  });

  doc.setFillColor(44,74,86);
  doc.setTextColor(255,255,255);
  doc.setFont("helvetica","bold");
  doc.rect(14, y, 182, 9, "F");
  doc.text("Total Package", 18, y + 6);
  doc.text("Rs. " + fmtNum(costs.package), 160, y + 6);
  y += 15;

  doc.setTextColor(0,0,0);
  doc.setFont("helvetica","italic");
  doc.setFontSize(9);
  const words = numberToWordsIndian(costs.package) + " Rupees Only";
  doc.text("Amount in Words: " + words, 14, y, { maxWidth: 182 });
  y += 14;

  doc.setFont("helvetica","normal");
  doc.setFontSize(9);
  doc.text("Customer Signature: ____________________________", 14, y + 20);
  doc.text("For " + PROJECT_PAYEE_NAME + ": ____________________________", 14, y + 30);

  doc.addPage();
  y = 20;
  doc.setFont("helvetica","bold");
  doc.setFontSize(13);
  doc.text("Payment Schedule", 14, y);
  y += 8;

  doc.setFillColor(201,150,47);
  doc.setTextColor(255,255,255);
  doc.rect(14, y, 182, 7, "F");
  doc.setFontSize(9);
  doc.text("Stage", 18, y + 5);
  doc.text("% of Package", 150, y + 5);
  y += 7;

  doc.setTextColor(0,0,0);
  doc.setFont("helvetica","normal");
  PAYMENT_SCHEDULE.forEach((s, i) => {
    doc.setFillColor(i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 247, i % 2 === 0 ? 255 : 240);
    doc.rect(14, y, 182, 7, "F");
    doc.text(s.stage, 18, y + 5, { maxWidth: 120 });
    doc.text(s.percent + "%", 150, y + 5);
    y += 7;
  });

  y += 10;
  doc.setFont("helvetica","bold");
  doc.setFontSize(12);
  doc.text("Terms & Conditions", 14, y);
  y += 7;

  doc.setFont("helvetica","normal");
  doc.setFontSize(8.5);
  STANDARD_TERMS.forEach((t, i) => {
    const lines = doc.splitTextToSize(`${i+1}. ${t}`, 182);
    if (y + lines.length * 4.2 > 285) { doc.addPage(); y = 20; }
    doc.text(lines, 14, y);
    y += lines.length * 4.2 + 2;
  });

  doc.setFontSize(8);
  doc.setTextColor(120,120,120);
  doc.text(`Bank Details: ${PROJECT_BANK_NAME} | A/c: ${PROJECT_BANK_ACCOUNT} | IFSC: ${PROJECT_BANK_IFSC}`, 14, 292);

  const fname = `CostSheet_${unit.id}_${customerName.replace(/\s+/g,"_")}.pdf`;
  doc.save(fname);
}

// ---------------------------------------------------------------------
// ADMIN: EXPORT TO EXCEL
// ---------------------------------------------------------------------
document.getElementById("exportExcelBtn").addEventListener("click", async () => {
  await loadUnits();
  const wsData = allUnits.map(u => ({
    "Unit ID": u.id, "Category": u.category, "Type": u.type, "Floor": u.floor,
    "Unit Label": u.unit_label, "Carpet (sq.ft)": u.carpet, "Saleable (sq.ft)": u.saleable,
    "Agreement Value": u.agreement_value, "Stamp Duty": u.stamp_duty, "Registration": u.registration,
    "GST": u.gst, "Total Package": u.package, "Status": u.status, "Note": u.note || ""
  }));
  const ws = XLSX.utils.json_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventory");
  XLSX.writeFile(wb, `TRUSTON_Inventory_${new Date().toISOString().slice(0,10)}.xlsx`);
});
