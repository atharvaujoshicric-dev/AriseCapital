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
    .select("id, email, full_name, role, is_disabled")
    .eq("id", currentUser.id)
    .single();

  if (error) { showLoginError("Could not load your profile: " + error.message); return; }

  if (profile.is_disabled) {
    await sb.auth.signOut();
    showLoginError("This account has been disabled by an admin. Contact your admin if this is unexpected.");
    return;
  }

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

  const isAdmin = currentProfile.role === "admin";

  let html = `
    <div class="detail-content">
      <h3>${u.unit_label}</h3>
      <div style="font-size:12px;color:#999;margin-bottom:10px;">${u.id} · ${CATEGORY_META[u.category].label} · ${u.floor === 0 ? "Ground Floor" : "Floor " + u.floor}</div>
      <div class="detail-row"><span>Status</span><b><span class="status-dot dot-${u.status}"></span>${u.status.replace("_"," ")}</b></div>
      <div class="detail-row"><span>Carpet Area</span><b>${u.carpet} sq.ft</b></div>
      <div class="detail-row"><span>Saleable Area</span><b>${u.saleable} sq.ft</b></div>
  `;

  if (isAdmin) {
    const impliedRate = u.agreement_value > 0 ? Math.round((u.stamp_duty / u.agreement_value) * 100) : 7;
    const rateIsSix = impliedRate === 6;
    html += `
      <div class="detail-edit-row"><span>Agreement Value</span><input type="number" id="detAgreementValue" value="${u.agreement_value}"></div>
      <div class="detail-edit-row"><span>Stamp Duty Rate</span>
        <select id="detStampDutyRate">
          <option value="7" ${!rateIsSix ? "selected" : ""}>7% (Male / Others)</option>
          <option value="6" ${rateIsSix ? "selected" : ""}>6% (Female Sole Owner)</option>
        </select>
      </div>
      <div class="detail-row"><span>Stamp Duty</span><b id="detStampDutyDisplay">₹${fmtNum(u.stamp_duty)}</b></div>
      <div class="detail-row"><span>Registration <span class="field-note">(fixed)</span></span><b>₹${fmtNum(REGISTRATION_FEE)}</b></div>
      <div class="detail-row"><span>GST <span class="field-note">(12%)</span></span><b id="detGstDisplay">₹${fmtNum(u.gst)}</b></div>
      <div class="detail-row"><span>Total Package</span><b id="detPackageDisplay">₹${fmtNum(u.package)}</b></div>
      <button class="btn btn-outline btn-sm btn-block" style="margin-top:8px;" onclick="saveUnitPrice()">💾 Save Price Changes</button>
    `;
  } else {
    html += `
      <div class="detail-row"><span>Agreement Value</span><b>₹${fmtNum(u.agreement_value)}</b></div>
      <div class="detail-row"><span>Stamp Duty</span><b>₹${fmtNum(u.stamp_duty)}</b></div>
      <div class="detail-row"><span>Registration</span><b>₹${fmtNum(u.registration)}</b></div>
      <div class="detail-row"><span>GST</span><b>₹${fmtNum(u.gst)}</b></div>
      <div class="detail-row"><span>Total Package</span><b>₹${fmtNum(u.package)}</b></div>
    `;
  }

  html += `
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

  if (isAdmin) {
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

  if (isAdmin) {
    wireUnitPriceRecalc();
  }
}

// Only Agreement Value and Stamp Duty Rate are true inputs here — Stamp
// Duty, GST, and the Package total are always derived from them, and
// Registration is a fixed statutory fee. This is one-directional on
// purpose: it must not be possible to back into an arbitrary stamp duty
// by typing a package total, the way the booking-time calculator allows.
function wireUnitPriceRecalc() {
  const agreementEl = document.getElementById("detAgreementValue");
  const rateEl = document.getElementById("detStampDutyRate");
  const stampDisplay = document.getElementById("detStampDutyDisplay");
  const gstDisplay = document.getElementById("detGstDisplay");
  const pkgDisplay = document.getElementById("detPackageDisplay");

  function recalc() {
    const av = Number(agreementEl.value || 0);
    const rate = Number(rateEl.value || 7);
    const stamp = Math.round(av * rate / 100);
    const gst = Math.round(av * GST_RATE);
    const pkg = av + stamp + REGISTRATION_FEE + gst;
    stampDisplay.textContent = "₹" + fmtNum(stamp);
    gstDisplay.textContent = "₹" + fmtNum(gst);
    pkgDisplay.textContent = "₹" + fmtNum(pkg);
  }

  agreementEl.oninput = recalc;
  rateEl.onchange = recalc;
}

async function saveUnitPrice() {
  const agreement = Number(document.getElementById("detAgreementValue").value || 0);
  const rate = Number(document.getElementById("detStampDutyRate").value || 7);
  const stamp = Math.round(agreement * rate / 100);
  const gst = Math.round(agreement * GST_RATE);
  const pkg = agreement + stamp + REGISTRATION_FEE + gst;

  const { error } = await sb.rpc("admin_update_unit_price", {
    p_unit_id: selectedUnit.id, p_agreement_value: agreement, p_stamp_duty: stamp,
    p_registration: REGISTRATION_FEE, p_gst: gst, p_package: pkg
  });

  if (error) { alert("Error: " + error.message); return; }
  await refreshAfterAction();
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
const REGISTRATION_FEE = 30000; // fixed statutory registration fee, not editable anywhere

// One-directional financial recalculation: Agreement Value + Stamp Duty
// Rate are the only real inputs anywhere in this app. Stamp Duty, GST, and
// Package are always derived from them, and Registration is always the
// fixed fee — never editable, never something to back-calculate into.
// `stampEl`/`gstEl`/`pkgEl` may be <input readonly> (booking-time display,
// value written directly) so this works for both that case and detail-row
// <b> elements (handled separately via wireUnitPriceRecalc).
function wireFinancialsRecalc(ids) {
  const agreementEl = document.getElementById(ids.agreement);
  const rateEl = document.getElementById(ids.rate);
  const stampEl = document.getElementById(ids.stamp);
  const regEl = document.getElementById(ids.registration);
  const gstEl = document.getElementById(ids.gst);
  const pkgEl = document.getElementById(ids.package);

  function recalc() {
    const av = Number(agreementEl.value || 0);
    const rate = Number(rateEl.value || 7);
    const stamp = Math.round(av * rate / 100);
    const gst = Math.round(av * GST_RATE);
    stampEl.value = stamp;
    regEl.value = REGISTRATION_FEE;
    gstEl.value = gst;
    pkgEl.value = av + stamp + REGISTRATION_FEE + gst;
  }

  agreementEl.oninput = recalc;
  rateEl.onchange = recalc;
}

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

  // Financials are fixed to the unit's current standing price — read-only here.
  const impliedRate = u.agreement_value > 0 ? Math.round((u.stamp_duty / u.agreement_value) * 100) : 7;
  document.getElementById("bkAgreementValue").value = u.agreement_value;
  document.getElementById("bkStampDutyRate").value = impliedRate === 6 ? "6" : "7";
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

// ---------------------------------------------------------------------
// ON-SCREEN FORM PREVIEW (replaces auto-download — user prints manually)
// ---------------------------------------------------------------------
function showFormPreview(html, title) {
  document.getElementById("formPreviewTitle").textContent = title || "Booking Form Preview";
  document.getElementById("formPreviewFrame").srcdoc = html;
  document.getElementById("formPreviewModal").style.display = "flex";
}

document.getElementById("closeFormPreviewModal").onclick = () => {
  document.getElementById("formPreviewModal").style.display = "none";
};

document.getElementById("printFormBtn").onclick = () => {
  const frame = document.getElementById("formPreviewFrame");
  frame.contentWindow.focus();
  frame.contentWindow.print();
};

document.getElementById("previewPdfBtn").onclick = () => {
  const name = document.getElementById("custName").value.trim() || "Prospective Customer";
  const html = buildBookingFormHTML(selectedUnit, name, currentBookingCosts(), collectFormExtras(), null);
  showFormPreview(html, "Preview — Not Yet Booked");
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
  const html = buildBookingFormHTML(u, name, costs, collectFormExtras(), data);
  showFormPreview(html, "Booking Confirmed — " + name);
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
  const { data, error } = await sb.from("profiles").select("id, email, full_name, role, is_disabled").order("created_at");
  const listEl = document.getElementById("usersList");
  if (error) { listEl.innerHTML = `<div class="error-msg">Failed to load users: ${error.message}</div>`; return; }

  listEl.innerHTML = data.map(u => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);${u.is_disabled ? "opacity:0.5;" : ""}">
      <div>
        <div style="font-weight:600;">${u.full_name || "(no name)"} ${u.is_disabled ? '<span style="color:#b23b3b;font-size:11px;">(REMOVED)</span>' : ""}</div>
        <div style="font-size:12px;color:#888;">${u.email}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <select data-uid="${u.id}" class="role-select" ${u.id === currentUser.id || u.is_disabled ? "disabled title='Cannot change'" : ""}>
          <option value="sales" ${u.role==="sales"?"selected":""}>Sales</option>
          <option value="site_head" ${u.role==="site_head"?"selected":""}>Site Head</option>
          <option value="admin" ${u.role==="admin"?"selected":""}>Admin</option>
        </select>
        ${u.id === currentUser.id ? "" : (
          u.is_disabled
            ? `<button class="btn btn-outline btn-sm" data-uid="${u.id}" data-action="enable">Re-enable</button>`
            : `<button class="btn btn-ghost btn-sm" style="color:#b23b3b;" data-uid="${u.id}" data-action="disable">Remove</button>`
        )}
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

  listEl.querySelectorAll("button[data-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const uid = btn.getAttribute("data-uid");
      const disable = btn.getAttribute("data-action") === "disable";
      if (disable && !confirm("Remove this user? They will immediately lose access. Their account can be re-enabled later from this same screen.")) return;
      const { error } = await sb.rpc("admin_set_user_disabled", { p_user_id: uid, p_disabled: disable });
      if (error) { alert("Error: " + error.message); return; }
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
        <button class="btn btn-outline btn-sm" onclick="reprintBooking('${b.id}')">📄 View Form</button>
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

  showFormPreview(
    buildBookingFormHTML(
      b.units,
      b.customer_name,
      { agreement_value: b.agreement_value, stamp_duty: b.stamp_duty, registration: b.registration, gst: b.gst, package: b.package },
      extras,
      b.id
    ),
    "Booking Form — " + b.customer_name
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
