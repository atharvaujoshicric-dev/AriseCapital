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

  html += `<button class="btn btn-ghost" onclick="openBookingModal(true)">Preview Booking Form (no booking)</button>`;
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

const GST_RATE = 0.12; // 12% GST on commercial real estate agreement value

// Wires up live recalculation for a given set of field IDs (used for both
// the booking modal and the edit modal, which have different id prefixes).
function wireFinancialsRecalc(ids) {
  const agreementEl = document.getElementById(ids.agreement);
  const rateEl = document.getElementById(ids.rate);
  const stampEl = document.getElementById(ids.stamp);
  const regEl = document.getElementById(ids.registration);
  const gstEl = document.getElementById(ids.gst);
  const pkgEl = document.getElementById(ids.package);

  function recalcFromAgreementValue() {
    const av = Number(agreementEl.value || 0);
    const rate = Number(rateEl.value || 7);
    stampEl.value = Math.round(av * rate / 100);
    gstEl.value = Math.round(av * GST_RATE);
    recalcPackageFromComponents();
  }
  function recalcPackageFromComponents() {
    const av = Number(agreementEl.value || 0);
    const stamp = Number(stampEl.value || 0);
    const reg = Number(regEl.value || 0);
    const gst = Number(gstEl.value || 0);
    pkgEl.value = av + stamp + reg + gst;
  }
  // Editing the Package directly solves backwards for what Agreement Value
  // (and therefore Stamp Duty + GST, at the currently selected rate) would
  // produce that package total: Package = AV*(1 + rate/100 + GST_RATE) + Registration.
  function recalcFromPackage() {
    const pkg = Number(pkgEl.value || 0);
    const rate = Number(rateEl.value || 7);
    const reg = Number(regEl.value || 0);
    const av = Math.round((pkg - reg) / (1 + rate / 100 + GST_RATE));
    agreementEl.value = av;
    stampEl.value = Math.round(av * rate / 100);
    gstEl.value = Math.round(av * GST_RATE);
    // Leave pkgEl exactly as typed — small rounding differences (a few
    // rupees) between components and the typed total are expected and fine.
  }

  agreementEl.oninput = recalcFromAgreementValue;
  rateEl.onchange = recalcFromAgreementValue;
  stampEl.oninput = recalcPackageFromComponents;
  regEl.oninput = recalcPackageFromComponents;
  gstEl.oninput = recalcPackageFromComponents;
  pkgEl.oninput = recalcFromPackage;
}

const bookingFieldIds = {
  agreement: "bkAgreementValue", rate: "bkStampDutyRate", stamp: "bkStampDuty",
  registration: "bkRegistration", gst: "bkGst", package: "bkPackage"
};
wireFinancialsRecalc(bookingFieldIds);

function openBookingModal(previewOnly) {
  previewOnlyMode = !!previewOnly;
  const u = selectedUnit;
  document.getElementById("bookingUnitSummary").innerHTML =
    `<b>${u.unit_label}</b> (${u.id}) — ${u.carpet} sq.ft carpet · Package ₹${fmtNum(u.package)}`;
  document.getElementById("bookingCategoryDisplay").textContent = CATEGORY_META[u.category].label;
  document.getElementById("custName").value = "";
  document.getElementById("custPhone").value = "";
  document.getElementById("custEmail").value = "";
  document.getElementById("custCoApplicant").value = "";
  document.getElementById("custFatherSpouse").value = "";
  document.getElementById("custPermAddress").value = "";
  document.getElementById("custCorrAddress").value = "";
  document.getElementById("custSourcingExec").value = currentProfile.full_name || "";
  document.getElementById("parkingRequirement").value = "none";
  document.getElementById("parkingCount").value = "";
  document.getElementById("bookingAmountPaid").value = "";
  document.getElementById("paymentMode").value = "";
  document.getElementById("paymentRefNo").value = "";
  document.getElementById("paymentPlan").value = "";

  // Seed financials from the unit's standard pricing; all editable from here.
  document.getElementById("bkAgreementValue").value = u.agreement_value;
  document.getElementById("bkStampDutyRate").value = "7";
  document.getElementById("bkStampDuty").value = u.stamp_duty;
  document.getElementById("bkRegistration").value = u.registration;
  document.getElementById("bkGst").value = u.gst;
  document.getElementById("bkPackage").value = u.package;

  document.getElementById("adminFurnitureCost").style.display = currentProfile.role === "admin" ? "block" : "none";
  document.getElementById("bkFurnitureCost").value = "";

  document.getElementById("bookingError").style.display = "none";
  document.getElementById("confirmBookingBtn").style.display = previewOnlyMode ? "none" : "inline-block";
  document.getElementById("bookingModal").style.display = "flex";
}

document.getElementById("closeBookingModal").onclick = () => document.getElementById("bookingModal").style.display = "none";
document.getElementById("cancelBookingBtn").onclick = () => document.getElementById("bookingModal").style.display = "none";

function collectFormExtras() {
  return {
    coApplicant: document.getElementById("custCoApplicant").value.trim(),
    fatherSpouse: document.getElementById("custFatherSpouse").value.trim(),
    permAddress: document.getElementById("custPermAddress").value.trim(),
    corrAddress: document.getElementById("custCorrAddress").value.trim(),
    sourcingExec: document.getElementById("custSourcingExec").value.trim() || (currentProfile.full_name || ""),
    phone: document.getElementById("custPhone").value.trim(),
    email: document.getElementById("custEmail").value.trim(),
    parkingRequirement: document.getElementById("parkingRequirement").value,
    parkingCount: document.getElementById("parkingCount").value ? Number(document.getElementById("parkingCount").value) : null,
    bookingAmountPaid: document.getElementById("bookingAmountPaid").value ? Number(document.getElementById("bookingAmountPaid").value) : null,
    paymentMode: document.getElementById("paymentMode").value,
    paymentRefNo: document.getElementById("paymentRefNo").value.trim(),
    paymentPlan: document.getElementById("paymentPlan").value,
  };
}

function currentBookingCosts() {
  return {
    agreement_value: Number(document.getElementById("bkAgreementValue").value || 0),
    stamp_duty_rate: Number(document.getElementById("bkStampDutyRate").value || 7),
    stamp_duty: Number(document.getElementById("bkStampDuty").value || 0),
    registration: Number(document.getElementById("bkRegistration").value || 0),
    gst: Number(document.getElementById("bkGst").value || 0),
    package: Number(document.getElementById("bkPackage").value || 0),
  };
}

document.getElementById("previewPdfBtn").onclick = () => {
  const name = document.getElementById("custName").value.trim() || "Prospective Customer";
  generateBookingFormPDF(selectedUnit, name, currentBookingCosts(), collectFormExtras(), null);
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
  const costs = currentBookingCosts();
  const furnitureCost = currentProfile.role === "admin" && document.getElementById("bkFurnitureCost").value
    ? Number(document.getElementById("bkFurnitureCost").value) : null;

  const { data, error } = await sb.rpc("create_booking", {
    p_unit_id: u.id, p_customer_name: name, p_customer_phone: phone || null, p_customer_email: email || null,
    p_agreement_value: costs.agreement_value, p_stamp_duty: costs.stamp_duty, p_registration: costs.registration,
    p_gst: costs.gst, p_package: costs.package,
    p_apr_override: null,
    p_co_applicant_name: document.getElementById("custCoApplicant").value.trim() || null,
    p_father_spouse_name: document.getElementById("custFatherSpouse").value.trim() || null,
    p_permanent_address: document.getElementById("custPermAddress").value.trim() || null,
    p_correspondence_address: document.getElementById("custCorrAddress").value.trim() || null,
    p_parking_requirement: document.getElementById("parkingRequirement").value || "none",
    p_parking_count: document.getElementById("parkingCount").value ? Number(document.getElementById("parkingCount").value) : null,
    p_booking_amount_paid: document.getElementById("bookingAmountPaid").value ? Number(document.getElementById("bookingAmountPaid").value) : null,
    p_payment_mode: document.getElementById("paymentMode").value || null,
    p_payment_ref_no: document.getElementById("paymentRefNo").value.trim() || null,
    p_payment_plan: document.getElementById("paymentPlan").value || null,
    p_stamp_duty_rate: costs.stamp_duty_rate,
    p_furniture_cost: furnitureCost,
  });

  if (error) {
    errBox.textContent = "Error: " + error.message;
    errBox.style.display = "block";
    return;
  }

  document.getElementById("bookingModal").style.display = "none";
  generateBookingFormPDF(u, name, costs, collectFormExtras(), data);
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
    .select("*, units(id, unit_label, category, floor, carpet, saleable)")
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
        <button class="btn btn-outline btn-sm" onclick="reprintBooking('${b.id}')">⬇ PDF</button>
        <button class="btn btn-outline btn-sm" onclick="openEditBookingModal('${b.id}')">Edit</button>
        ${(currentProfile.role === "admin" && b.status === "active") ? `<button class="btn btn-ghost btn-sm" style="color:#b23b3b;" onclick="cancelBookingFromList('${b.id}')">Cancel</button>` : ""}
      </div>
    </div>
  `).join("");
}

async function reprintBooking(bookingId) {
  const { data: b, error } = await sb
    .from("bookings")
    .select("*, units(id, unit_label, category, floor, carpet, saleable)")
    .eq("id", bookingId)
    .single();
  if (error) { alert("Error loading booking: " + error.message); return; }

  const extras = {
    coApplicant: b.co_applicant_name || "",
    fatherSpouse: b.father_spouse_name || "",
    permAddress: b.permanent_address || "",
    corrAddress: b.correspondence_address || "",
    sourcingExec: "",
    phone: b.customer_phone || "",
    email: b.customer_email || "",
    parkingRequirement: b.parking_requirement || "none",
    parkingCount: b.parking_count,
    bookingAmountPaid: b.booking_amount_paid,
    paymentMode: b.payment_mode || "",
    paymentRefNo: b.payment_ref_no || "",
    paymentPlan: b.payment_plan || "",
  };

  generateBookingFormPDF(
    b.units,
    b.customer_name,
    { agreement_value: b.agreement_value, stamp_duty: b.stamp_duty, registration: b.registration, gst: b.gst, package: b.package },
    extras,
    b.id
  );
}
window.reprintBooking = reprintBooking;

async function openEditBookingModal(bookingId) {
  const { data, error } = await sb.from("bookings").select("*").eq("id", bookingId).single();
  if (error) { alert("Error loading booking: " + error.message); return; }

  editingBookingId = bookingId;
  document.getElementById("editCustName").value = data.customer_name || "";
  document.getElementById("editCoApplicant").value = data.co_applicant_name || "";
  document.getElementById("editFatherSpouse").value = data.father_spouse_name || "";
  document.getElementById("editPermAddress").value = data.permanent_address || "";
  document.getElementById("editCorrAddress").value = data.correspondence_address || "";
  document.getElementById("editCustPhone").value = data.customer_phone || "";
  document.getElementById("editCustEmail").value = data.customer_email || "";
  document.getElementById("editParkingRequirement").value = data.parking_requirement || "none";
  document.getElementById("editParkingCount").value = data.parking_count || "";
  document.getElementById("editAgreement").value = data.agreement_value;
  document.getElementById("editStampDutyRate").value = data.stamp_duty_rate || 7;
  document.getElementById("editStampDuty").value = data.stamp_duty;
  document.getElementById("editRegistration").value = data.registration;
  document.getElementById("editGst").value = data.gst;
  document.getElementById("editPackage").value = data.package;
  document.getElementById("editBookingAmountPaid").value = data.booking_amount_paid || "";
  document.getElementById("editPaymentMode").value = data.payment_mode || "";
  document.getElementById("editPaymentRefNo").value = data.payment_ref_no || "";
  document.getElementById("editPaymentPlan").value = data.payment_plan || "";
  document.getElementById("editAdminFurnitureCost").style.display = currentProfile.role === "admin" ? "block" : "none";
  document.getElementById("editFurnitureCost").value = data.furniture_cost || "";
  document.getElementById("editBookingError").style.display = "none";
  document.getElementById("editBookingModal").style.display = "flex";
}
window.openEditBookingModal = openEditBookingModal;

wireFinancialsRecalc({
  agreement: "editAgreement", rate: "editStampDutyRate", stamp: "editStampDuty",
  registration: "editRegistration", gst: "editGst", package: "editPackage"
});

document.getElementById("closeEditBookingModal").onclick = () => document.getElementById("editBookingModal").style.display = "none";
document.getElementById("cancelEditBookingBtn").onclick = () => document.getElementById("editBookingModal").style.display = "none";

document.getElementById("confirmEditBookingBtn").addEventListener("click", async () => {
  const errBox = document.getElementById("editBookingError");
  const name = document.getElementById("editCustName").value.trim();
  if (!name) { errBox.textContent = "Customer name is required."; errBox.style.display = "block"; return; }

  const furnitureCost = currentProfile.role === "admin" && document.getElementById("editFurnitureCost").value !== ""
    ? Number(document.getElementById("editFurnitureCost").value) : null;

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
    p_co_applicant_name: document.getElementById("editCoApplicant").value.trim() || null,
    p_father_spouse_name: document.getElementById("editFatherSpouse").value.trim() || null,
    p_permanent_address: document.getElementById("editPermAddress").value.trim() || null,
    p_correspondence_address: document.getElementById("editCorrAddress").value.trim() || null,
    p_parking_requirement: document.getElementById("editParkingRequirement").value || "none",
    p_parking_count: document.getElementById("editParkingCount").value ? Number(document.getElementById("editParkingCount").value) : null,
    p_booking_amount_paid: document.getElementById("editBookingAmountPaid").value ? Number(document.getElementById("editBookingAmountPaid").value) : null,
    p_payment_mode: document.getElementById("editPaymentMode").value || null,
    p_payment_ref_no: document.getElementById("editPaymentRefNo").value.trim() || null,
    p_payment_plan: document.getElementById("editPaymentPlan").value || null,
    p_stamp_duty_rate: Number(document.getElementById("editStampDutyRate").value || 7),
    p_furniture_cost: furnitureCost,
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

// ---------------------------------------------------------------------
// LOGO + QR HELPERS
// ---------------------------------------------------------------------
function drawAriseLogo(doc, x, y, scale) {
  // Vector approximation of the ARISE CAPITAL triangle mark (no source
  // logo file was provided — colors sampled from the actual PDF artwork:
  // gold gradient triangle ~(130-195,100-178,50-100), dark wordmark ~(21,19,18).
  // Swap for doc.addImage(...) with the real logo asset for pixel-perfect match.
  scale = scale || 1;
  // Two-band fake gradient: lighter gold top-left, darker gold toward the base.
  doc.setFillColor(195, 178, 101);
  doc.triangle(x + 9*scale, y, x + 1*scale, y + 16*scale, x + 17*scale, y + 16*scale, "F");
  doc.setFillColor(133, 104, 54);
  doc.triangle(x + 9*scale, y + 7*scale, x + 4*scale, y + 16*scale, x + 14*scale, y + 16*scale, "F");
  doc.setFillColor(21, 19, 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15 * scale);
  doc.text("A R I S E", x - 2*scale, y + 23*scale);
  doc.setDrawColor(...FORM_BROWN);
  doc.setLineWidth(0.3);
  doc.line(x - 2*scale, y + 25*scale, x + 34*scale, y + 25*scale);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7 * scale);
  doc.setTextColor(140, 113, 63);
  doc.text("C A P I T A L", x + 1*scale, y + 29*scale);
  doc.setTextColor(0,0,0);
}

function drawQRCode(doc, text, x, y, size) {
  try {
    const qr = window.qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    const cell = size / count;
    doc.setFillColor(0,0,0);
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) {
          doc.rect(x + col * cell, y + row * cell, cell, cell, "F");
        }
      }
    }
  } catch (e) {
    // Fallback if the QR library didn't load — draw a labeled placeholder box.
    doc.setDrawColor(150,150,150);
    doc.rect(x, y, size, size);
    doc.setFontSize(6);
    doc.text("QR", x + size/2 - 3, y + size/2 + 1);
  }
}

// Exact brown/tan accent sampled from the source artwork (RGB 164,124,98).
const FORM_BROWN = [164, 124, 98];

function drawFormHeader(doc, pageW) {
  drawAriseLogo(doc, 14, 6, 1.0);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80,80,80);
  doc.text("MAHA-RERA Registration No.", pageW - 66, 13);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0,0,0);
  doc.text(PROJECT_RERA_NUMBER, pageW - 66, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(80,80,80);
  doc.text(RERA_WEBSITE, pageW - 66, 22);
  drawQRCode(doc, "https://maharera.maharashtra.gov.in/", pageW - 22, 8, 16);

  // Full-bleed gold line, edge to edge (measured y ≈ 43mm on the source PDF)
  doc.setDrawColor(...FORM_BROWN);
  doc.setLineWidth(0.6);
  doc.line(0, 43, pageW, 43);

  // "OFFICIAL APPLICATION..." banner: centered, ~118mm wide (measured)
  const bannerW = 118, bannerH = 6.5;
  const bannerX = (pageW - bannerW) / 2;
  doc.setFillColor(...FORM_BROWN);
  doc.rect(bannerX, 43.3, bannerW, bannerH, "F");
  doc.setTextColor(255,255,255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("OFFICIAL APPLICATION FOR BOOKING / ALLOTMENT", pageW / 2, 43.3 + bannerH/2 + 1.2, { align: "center" });
  doc.setTextColor(0,0,0);
}

function drawFormFooter(doc, pageW, pageH) {
  // Full-bleed gold line above the footer (measured y ≈ 275.7mm)
  doc.setDrawColor(...FORM_BROWN);
  doc.setLineWidth(0.5);
  doc.line(0, pageH - 21.2, pageW, pageH - 21.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(80,80,80);
  const lines = doc.splitTextToSize("Sales Office: " + SALES_OFFICE_NAME + ", " + SALES_OFFICE_ADDRESS, 130);
  doc.text(lines, 14, pageH - 15);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0,0,0);
  doc.text(PROJECT_TRUSTON_NAME, pageW - 55, pageH - 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(PROJECT_TAGLINE, pageW - 55, pageH - 12.5);
  doc.setTextColor(0,0,0);
}

function drawCheckbox(doc, x, y, checked) {
  doc.setDrawColor(0,0,0);
  doc.rect(x, y, 4, 4);
  if (checked) {
    doc.setFont("helvetica", "bold");
    doc.text("X", x + 0.8, y + 3.2);
  }
}

function labeledLine(doc, label, value, x, y, labelWidth, lineEndX) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(label, x, y);
  const lineStartX = x + labelWidth;
  doc.setDrawColor(120,120,120);
  doc.setLineWidth(0.2);
  doc.line(lineStartX, y + 0.8, lineEndX, y + 0.8);
  if (value) {
    doc.setFont("helvetica", "bold");
    doc.text(String(value), lineStartX + 2, y);
  }
}

// ---------------------------------------------------------------------
// MAIN GENERATOR — exact recreation of the official Booking/Allotment
// Application form, with the Payment Schedule inserted into the blank
// space above the Terms & Conditions on the final page.
// ---------------------------------------------------------------------
function generateBookingFormPDF(unit, customerName, costs, extras, bookingId) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210, pageH = 297;
  extras = extras || {};
  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2,"0")} / ${String(today.getMonth()+1).padStart(2,"0")} / ${today.getFullYear()}`;
  const formNo = "TRC-" + (bookingId ? bookingId.slice(0, 8).toUpperCase() : "PREVIEW");

  // ============ PAGE 1 ============
  drawFormHeader(doc, pageW);
  let y = 56;

  labeledLine(doc, "Application Form No:", formNo, 14, y, 42, 130);
  labeledLine(doc, "Date:", dateStr, 135, y, 12, 196);
  y += 8;
  labeledLine(doc, "Sourcing Executive / Agent Name:", extras.sourcingExec, 14, y, 58, 196);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("1. APPLICANT DETAILS", 14, y);
  y += 4;
  const box1Top = y;
  doc.setDrawColor(...FORM_BROWN);
  doc.setLineWidth(0.3);
  const box1Height = 46;
  doc.rect(14, box1Top, pageW - 28, box1Height);
  y += 7;
  labeledLine(doc, "Sole / First Applicant Name:", customerName, 18, y, 52, 192); y += 8;
  labeledLine(doc, "Co-Applicant Name (if any):", extras.coApplicant, 18, y, 52, 192); y += 8;
  labeledLine(doc, "Father's / Spouse's Name:", extras.fatherSpouse, 18, y, 50, 192); y += 8;
  labeledLine(doc, "Permanent Address:", extras.permAddress, 18, y, 38, 192); y += 8;
  labeledLine(doc, "Correspondence Address:", extras.corrAddress, 18, y, 46, 192); y += 8;
  labeledLine(doc, "Mobile No:", extras.phone, 18, y, 22, 100);
  labeledLine(doc, "Email ID:", extras.email, 108, y, 20, 192);
  y = box1Top + box1Height + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("2. PROPERTY PREFERENCE & SELECTION", 14, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Please select the property segment you are opting to book", 14, y);
  y += 3;
  const box2Top = y;
  const box2Height = 34;
  doc.setDrawColor(...FORM_BROWN);
  doc.setLineWidth(0.3);
  doc.rect(14, box2Top, pageW - 28, box2Height);
  y += 9;

  const segMap = { Studio: "Studio Apartment", Office: "Office Space", Shop: "Shop Space", Showroom: "Showroom Space" };
  const segments = ["Studio", "Office", "Shop", "Showroom"];
  let segX = 18;
  segments.forEach((seg) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(segMap[seg], segX, y + 3);
    drawCheckbox(doc, segX + doc.getTextWidth(segMap[seg]) + 3, y, unit.category === seg);
    segX += doc.getTextWidth(segMap[seg]) + 14;
  });
  y += 11;
  labeledLine(doc, "Specific Unit / Number:", unit.unit_label + " (" + unit.id + ")", 18, y, 46, 118);
  labeledLine(doc, "Carpet Area (Sq.Ft):", unit.carpet, 124, y, 40, 188);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text("Car Parking Requirement:", 18, y);
  doc.text("Covered", 70, y);
  drawCheckbox(doc, 85, y - 3.2, extras.parkingRequirement === "covered");
  doc.text("( Nos", 95, y);
  doc.setDrawColor(120,120,120);
  doc.line(107, y + 0.8, 130, y + 0.8);
  if (extras.parkingRequirement === "covered" && extras.parkingCount) {
    doc.setFont("helvetica", "bold");
    doc.text(String(extras.parkingCount), 110, y);
    doc.setFont("helvetica", "normal");
  }
  doc.text(")", 131, y);
  doc.text("None", 140, y);
  drawCheckbox(doc, 152, y - 3.2, extras.parkingRequirement !== "covered");

  drawFormFooter(doc, pageW, pageH);

  // ============ PAGE 2 ============
  doc.addPage();
  drawFormHeader(doc, pageW);
  y = 56;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("3. FINANCIALS & PAYMENT DETAILS", 14, y);
  y += 4;
  const box3Top = y;
  const box3Height = 40;
  doc.setDrawColor(...FORM_BROWN);
  doc.setLineWidth(0.3);
  doc.rect(14, box3Top, pageW - 28, box3Height);
  y += 8;
  labeledLine(doc, "Basic Sale Price (BSP): Rs :", fmtNum(costs.agreement_value), 18, y, 52, 192); y += 9;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(90,90,90);
  doc.text(`(All-in Total Package incl. Stamp Duty, Registration & GST: Rs. ${fmtNum(costs.package)})`, 18, y);
  doc.setTextColor(0,0,0);
  y += 7;
  labeledLine(doc, "Booking Amount Paid: Rs :", extras.bookingAmountPaid ? fmtNum(extras.bookingAmountPaid) : "", 18, y, 52, 110);
  labeledLine(doc, "( In Words ):", extras.bookingAmountPaid ? numberToWordsIndian(extras.bookingAmountPaid) + " Only" : "", 116, y, 22, 192);
  y += 10;
  const paymentModeText = extras.paymentMode ? `${extras.paymentMode}${extras.paymentRefNo ? " — " + extras.paymentRefNo : ""}` : "";
  labeledLine(doc, "Payment Mode: Cheque / DD / NEFT / RTGS Ref No:", paymentModeText, 18, y, 88, 192);
  y += 9;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text("Preferred Payment Plan:", 18, y);
  doc.text("Down Payment Plan", 65, y);
  drawCheckbox(doc, 100, y - 3.2, extras.paymentPlan === "down_payment");
  doc.text("Construction Linked Plan", 112, y);
  drawCheckbox(doc, 156, y - 3.2, extras.paymentPlan === "construction_linked");
  y += 7;
  doc.text("Flexi Plan", 65, y);
  drawCheckbox(doc, 100, y - 3.2, extras.paymentPlan === "flexi");

  y = box3Top + box3Height + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("4. DECLARATION & ACKNOWLEDGEMENT", 14, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const declaration = "I/We hereby declare that the particulars given above are true and correct to the best of my/our knowledge. I/We have read, understood, and accept the standard terms and conditions of allotment, payment schedules, and statutory guidelines associated with this project. I/We agree to pay the subsequent installments as per the chosen payment plan failing which the company reserves the right to take action as per the standard terms.";
  const declLines = doc.splitTextToSize(declaration, pageW - 28);
  doc.text(declLines, 14, y);
  y += declLines.length * 4.2 + 18;

  doc.setDrawColor(120,120,120);
  doc.line(14, y, 90, y);
  doc.line(115, y, 191, y);
  doc.setFontSize(8.5);
  doc.text("Primary Applicant Signature", 30, y + 5);
  doc.text("Co-Applicant Signature", 133, y + 5);
  y += 16;
  labeledLine(doc, "Date:", dateStr, 14, y, 12, 80);
  labeledLine(doc, "Place:", "", 115, y, 14, 191);
  y += 10;

  doc.setLineDashPattern([1, 1], 0);
  doc.setDrawColor(150,150,150);
  doc.line(14, y, pageW - 14, y);
  doc.setLineDashPattern([], 0);
  y += 8;

  doc.setFillColor(...FORM_BROWN);
  doc.rect(0, y, 48, 5.5, "F");
  doc.setTextColor(255,255,255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("FOR OFFICE USE ONLY", 4, y + 3.9);
  doc.setTextColor(0,0,0);
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Application Status:", 14, y);
  doc.text("Accepted", 55, y);
  drawCheckbox(doc, 73, y - 3.2, false);
  doc.text("Rejected", 84, y);
  drawCheckbox(doc, 101, y - 3.2, false);
  labeledLine(doc, "Allotted Unit No:", unit.id, 116, y, 32, 191);
  y += 9;
  labeledLine(doc, "Verified By (Name & Sign):", "", 14, y, 48, 100);
  labeledLine(doc, "Authorized Signatory:", "", 116, y, 38, 191);

  drawFormFooter(doc, pageW, pageH);

  // ============ PAGE 3 — Payment Schedule + Terms & Conditions ============
  doc.addPage();
  drawFormHeader(doc, pageW);
  y = 56;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Payment Schedule", 14, y);
  y += 7;

  doc.setFillColor(201,150,47);
  doc.setTextColor(255,255,255);
  doc.rect(14, y, pageW - 28, 7, "F");
  doc.setFontSize(9);
  doc.text("Stage", 18, y + 5);
  doc.text("% of Package", 130, y + 5);
  doc.text("Amount (Rs.)", 160, y + 5);
  y += 7;

  doc.setTextColor(0,0,0);
  doc.setFont("helvetica", "normal");
  PAYMENT_SCHEDULE.forEach((s, i) => {
    doc.setFillColor(i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 247, i % 2 === 0 ? 255 : 240);
    doc.rect(14, y, pageW - 28, 7, "F");
    doc.text(s.stage, 18, y + 5, { maxWidth: 108 });
    doc.text(s.percent + "%", 130, y + 5);
    doc.text(fmtNum(Math.round(costs.package * s.percent / 100)), 160, y + 5);
    y += 7;
  });

  y += 12;
  doc.setFillColor(...FORM_BROWN);
  doc.rect(0, y, pageW, 6.8, "F");
  doc.setTextColor(255,255,255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Terms & Condition", pageW / 2, y + 4.8, { align: "center" });
  doc.setTextColor(0,0,0);
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  STANDARD_TERMS.forEach((t) => {
    const lines = doc.splitTextToSize("•  " + t, pageW - 30);
    if (y + lines.length * 4 > pageH - 22) { doc.addPage(); drawFormHeader(doc, pageW); y = 56; }
    doc.text(lines, 16, y);
    y += lines.length * 4 + 2;
  });

  drawFormFooter(doc, pageW, pageH);

  const fname = `BookingForm_${unit.id}_${customerName.replace(/\s+/g,"_")}.pdf`;
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
  XLSX.writeFile(wb, `ARISE_CAPITAL_TRUSTON_Inventory_${new Date().toISOString().slice(0,10)}.xlsx`);
});
