// =====================================================================
// BOOKING FORM TEMPLATE — builds the exact HTML/CSS "Official Application
// for Booking / Allotment" form (as supplied), populated with live data.
// Rendered on-screen in an iframe preview; printed only when the user
// explicitly clicks Print (browser's native "Save as PDF" handles export).
// =====================================================================

const FORM_CSS = `
  :root{
    --brown: #A98466;
    --brown-dark: #8C6A4F;
    --gold: #B08D57;
    --text: #1A1A1A;
    --muted: #555555;
    --line: #1A1A1A;
  }
  * { box-sizing: border-box; }
  html, body{ margin:0; padding:0; font-family:'Poppins','Segoe UI',Arial,sans-serif; color:var(--text); background:#e9e9e9; }
  .page{ width:210mm; min-height:297mm; background:#fff; margin:10mm auto; position:relative; padding:14mm 14mm 0 14mm; display:flex; flex-direction:column; box-shadow:0 0 6px rgba(0,0,0,0.25); overflow:hidden; }
  @media print{ body{ background:#fff; } .page{ margin:0; box-shadow:none; page-break-after:always; width:auto; min-height:100vh; } }
  .watermark{ position:absolute; top:38%; left:50%; transform:translate(-50%,-50%); width:70%; text-align:center; z-index:0; pointer-events:none; }
  .watermark img{ width:60%; opacity:0.07; filter:grayscale(100%); }
  .header{ display:flex; justify-content:space-between; align-items:flex-start; position:relative; z-index:1; }
  .logo img{ height:74px; }
  .rera{ text-align:right; font-size:9px; color:var(--muted); display:flex; align-items:center; gap:10px; }
  .rera .rera-text{ text-align:right; }
  .rera .rera-text b{ display:block; font-size:13px; color:var(--text); letter-spacing:0.5px; margin:2px 0; }
  .rera img{ height:56px; width:56px; }
  .header-rule{ height:4px; background:linear-gradient(90deg, var(--gold), var(--brown-dark)); margin:16px 0 28px 0; position:relative; z-index:1; }
  .title-bar{ background:var(--brown); color:#fff; display:inline-block; padding:11px 24px; font-size:15px; font-weight:600; letter-spacing:0.5px; margin-bottom:34px; position:relative; z-index:1; }
  .meta-row{ display:flex; justify-content:space-between; gap:30px; font-size:14px; margin-bottom:10px; position:relative; z-index:1; }
  .field-line{ border-bottom:1px solid var(--line); flex:1; display:inline-block; min-height:24px; margin-left:6px; font-weight:600; padding-bottom:2px; }
  .row-line{ display:flex; align-items:flex-end; font-size:14px; margin-bottom:24px; position:relative; z-index:1; }
  .row-line .lbl{ white-space:nowrap; }
  .date-slashes{ display:flex; align-items:flex-end; gap:8px; min-width:130px; }
  .date-slashes .box{ border-bottom:1px solid var(--line); width:32px; height:22px; text-align:center; font-weight:600; }
  .section-heading{ font-size:14.5px; font-weight:700; margin:10px 0 14px 0; position:relative; z-index:1; }
  .section-sub{ font-size:11.5px; color:var(--muted); margin:-6px 0 12px 0; position:relative; z-index:1; }
  .box-panel{ border:1px solid var(--gold); border-radius:4px; padding:28px 30px; margin-bottom:36px; position:relative; z-index:1; }
  .box-panel .row-line:last-child{ margin-bottom:0; }
  .two-col{ display:flex; gap:30px; }
  .two-col .row-line{ flex:1; }
  .check-row{ display:flex; flex-wrap:wrap; align-items:center; gap:34px; font-size:14px; margin-bottom:26px; }
  .check-item{ display:flex; align-items:center; gap:10px; }
  .checkbox{ width:17px; height:17px; border:1.5px solid var(--line); display:inline-block; position:relative; }
  .checkbox.checked::after{ content:""; position:absolute; left:-5px; top:-5px; right:-5px; bottom:-5px; background-image:url('CHECKMARK_DATA_URI'); background-repeat:no-repeat; background-position:center; background-size:contain; }
  .sign-row{ display:flex; justify-content:space-between; gap:80px; margin:70px 0 16px 0; position:relative; z-index:1; }
  .sign-block{ flex:1; text-align:center; }
  .sign-block .sign-line{ border-bottom:1px solid var(--line); height:54px; }
  .sign-block .sign-caption{ font-size:13px; margin-top:8px; }
  .declaration-text{ font-size:12.5px; line-height:2; color:var(--text); text-align:justify; margin-bottom:10px; position:relative; z-index:1; }
  .office-use{ border-top:1px dashed var(--muted); margin-top:40px; padding-top:26px; position:relative; z-index:1; }
  .office-use .tag{ background:var(--brown); color:#fff; display:inline-block; padding:7px 18px; font-size:12.5px; font-weight:600; letter-spacing:0.5px; margin-bottom:22px; }
  .footer{ margin-top:auto; border-top:2px solid var(--brown); padding:16px 0 18px 0; display:flex; justify-content:space-between; align-items:center; font-size:10.5px; color:var(--text); position:relative; z-index:1; }
  .footer .sales-office{ flex:1 1 auto; min-width:0; padding-right:18px; }
  .footer .sales-office b{ display:block; font-size:10.5px; }
  .footer .partner-logos{ display:flex; align-items:center; gap:16px; flex:0 0 auto; }
  .footer .partner-logos img{ height:30px; display:block; }
  .tc-title-bar{ background:var(--brown); color:#fff; text-align:center; padding:8px 0; font-size:14px; font-weight:600; letter-spacing:1px; margin:0 0 18px 0; position:relative; z-index:1; }
  .tc-list{ font-size:11.5px; line-height:1.85; text-align:justify; padding-left:18px; margin:0; position:relative; z-index:1; }
  .tc-list li{ margin-bottom:11px; }
  .payment-table{ width:100%; border-collapse:collapse; font-size:11.5px; margin-bottom:8px; position:relative; z-index:1; }
  .payment-table th{ background:var(--brown); color:#fff; padding:8px; border:1px solid #ccc; text-align:left; }
  .payment-table td{ padding:7px 8px; border:1px solid #ddd; }
`;

function checkmarkDataURI() {
  // Short stroke from inside the box down to a low point, then a longer
  // stroke up past the box's top-right corner — mimics a natural
  // handwritten tick rather than a centered, symmetric checkmark glyph.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 27 27">
    <path d="M6 14 L11 19 L22 4" stroke="#1A1A1A" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function ariseLogoDataURI() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="255" viewBox="0 0 220 255">
    <polygon points="110,0 22,187 198,187" fill="#c3ac65"/>
    <polygon points="110,78 50,187 170,187" fill="#85683a"/>
    <text x="2" y="222" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="50" letter-spacing="9" fill="#1a1a1a">ARISE</text>
    <line x1="2" y1="233" x2="218" y2="233" stroke="#A98466" stroke-width="3"/>
    <text x="10" y="248" font-family="Arial, Helvetica, sans-serif" font-size="17" letter-spacing="6" fill="#8c6a4f">CAPITAL</text>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function qrCodeDataURI(text, size) {
  try {
    const qr = window.qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size);
    const cell = size / count;
    ctx.fillStyle = "#000";
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) ctx.fillRect(c * cell, r * cell, cell, cell);
      }
    }
    return canvas.toDataURL("image/png");
  } catch (e) {
    return "";
  }
}

function checkboxClass(condition) {
  return "checkbox" + (condition ? " checked" : "");
}

function formFooterHTML() {
  return `
    <div class="footer">
      <div class="sales-office">
        <b>Sales Office:</b>
        ${SALES_OFFICE_NAME}, ${SALES_OFFICE_ADDRESS}
      </div>
      <div class="partner-logos">
        <img src="assets/truston.png" alt="Truston" onerror="this.style.display='none'">
        <img src="assets/beyondwalls.png" alt="BeyondWalls" onerror="this.style.display='none'">
      </div>
    </div>`;
}

function formHeaderHTML(logoUri, qrUri) {
  return `
    <div class="header">
      <div class="logo"><img src="assets/logo.png" onerror="this.onerror=null;this.src='${logoUri}'" alt="Arise Capital"></div>
      <div class="rera">
        <div class="rera-text">
          MAHA-RERA Registration No.<br>
          <b>${PROJECT_RERA_NUMBER}</b>
          ${RERA_WEBSITE}
        </div>
        <img src="${qrUri}" alt="RERA QR">
      </div>
    </div>
    <div class="header-rule"></div>`;
}

// ---------------------------------------------------------------------
// MAIN BUILDER
// ---------------------------------------------------------------------
function buildBookingFormHTML(unit, customerName, costs, extras, bookingId) {
  const logoUri = ariseLogoDataURI();
  const qrUri = qrCodeDataURI("https://maharera.maharashtra.gov.in/", 160);
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  const formNo = bookingId ? ("AC-" + String(bookingId).slice(0, 8).toUpperCase()) : "DRAFT — PREVIEW ONLY";

  const segments = [
    ["Studio Apartment", "Studio"], ["Office Space", "Office"],
    ["Shop Space", "Shop"], ["Showroom Space", "Showroom"]
  ];

  const bookingAmountWords = extras.bookingAmountPaid ? numberToWordsIndian(extras.bookingAmountPaid) + " Rupees Only" : "";
  const paymentModeText = extras.paymentMode ? `${extras.paymentMode}${extras.paymentRefNo ? " — " + extras.paymentRefNo : ""}` : "";

  const paymentRows = PAYMENT_SCHEDULE.map((s, i) => `
    <tr style="background:${i % 2 === 0 ? "#fff" : "#faf7f2"};">
      <td>${i + 1}</td>
      <td>${s.stage}</td>
      <td style="text-align:center;">${s.percent}%</td>
      <td style="text-align:right;">Rs. ${fmtNum(Math.round(costs.package * s.percent / 100))}</td>
    </tr>`).join("");

  const tcItems = STANDARD_TERMS.map(t => `<li>${t}</li>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${PROJECT_NAME} - Booking / Allotment Form</title>
<style>${FORM_CSS.replace('CHECKMARK_DATA_URI', checkmarkDataURI())}</style>
</head>
<body>

  <!-- PAGE 1 -->
  <div class="page">
    <div class="watermark"><img src="assets/logo.png" onerror="this.onerror=null;this.src='${logoUri}'" alt=""></div>
    ${formHeaderHTML(logoUri, qrUri)}
    <div class="title-bar">OFFICIAL APPLICATION FOR BOOKING / ALLOTMENT</div>

    <div class="row-line" style="justify-content:space-between;">
      <span class="lbl">Application Form No:</span>
      <span class="field-line" style="margin-right:20px;">${formNo}</span>
      <span class="lbl">Date:</span>
      <span class="date-slashes"><span class="box">${dd}</span> / <span class="box">${mm}</span> / <span class="box">${yyyy}</span></span>
    </div>

    <div class="row-line">
      <span class="lbl">Sourcing Executive / Agent Name:</span>
      <span class="field-line">${extras.sourcingExec || ""}</span>
    </div>

    <div class="section-heading">1. APPLICANT DETAILS</div>
    <div class="box-panel">
      <div class="row-line"><span class="lbl">Sole / First Applicant Name:</span><span class="field-line">${customerName || ""}</span></div>
      <div class="row-line"><span class="lbl">Co-Applicant Name (if any):</span><span class="field-line">${extras.coApplicant || ""}</span></div>
      <div class="row-line"><span class="lbl">Father's / Spouse's Name:</span><span class="field-line">${extras.fatherSpouse || ""}</span></div>
      <div class="row-line"><span class="lbl">Permanent Address:</span><span class="field-line">${extras.permAddress || ""}</span></div>
      <div class="row-line"><span class="lbl">Correspondence Address:</span><span class="field-line">${extras.corrAddress || ""}</span></div>
      <div class="two-col">
        <div class="row-line"><span class="lbl">Mobile No:</span><span class="field-line">${extras.phone || ""}</span></div>
        <div class="row-line"><span class="lbl">Email ID:</span><span class="field-line">${extras.email || ""}</span></div>
      </div>
    </div>

    <div class="section-heading">2. PROPERTY PREFERENCE &amp; SELECTION</div>
    <div class="section-sub">Please select the property segment you are opting to book</div>
    <div class="box-panel">
      <div class="check-row">
        ${segments.map(([label, cat]) => `<div class="check-item"><span class="lbl">${label}</span><span class="${checkboxClass(unit.category === cat)}"></span></div>`).join("")}
      </div>
      <div class="two-col">
        <div class="row-line"><span class="lbl">Specific Unit / Number:</span><span class="field-line">${unit.unit_label} (${unit.id})</span></div>
        <div class="row-line"><span class="lbl">Carpet Area (Sq.Ft):</span><span class="field-line">${unit.carpet}</span></div>
      </div>
      <div class="check-row" style="margin-bottom:0;">
        <span class="lbl">Car Parking Requirement:</span>
        <div class="check-item"><span class="lbl">Covered</span><span class="${checkboxClass(extras.parkingRequirement === "covered")}"></span></div>
        <span class="lbl">( Nos <span class="field-line" style="display:inline-block;width:80px;">${extras.parkingRequirement === "covered" && extras.parkingCount ? extras.parkingCount : ""}</span> )</span>
        <div class="check-item"><span class="lbl">None</span><span class="${checkboxClass(extras.parkingRequirement !== "covered")}"></span></div>
      </div>
    </div>

    ${formFooterHTML()}
  </div>

  <!-- PAGE 2 -->
  <div class="page">
    <div class="watermark"><img src="assets/logo.png" onerror="this.onerror=null;this.src='${logoUri}'" alt=""></div>
    ${formHeaderHTML(logoUri, qrUri)}
    <div class="title-bar">OFFICIAL APPLICATION FOR BOOKING / ALLOTMENT</div>

    <div class="section-heading">3. FINANCIALS &amp; PAYMENT DETAILS</div>
    <div class="box-panel">
      <div class="row-line"><span class="lbl">Basic Sale Price (BSP): Rs :</span><span class="field-line">${fmtNum(costs.agreement_value)}</span></div>
      <div class="two-col">
        <div class="row-line" style="flex:1.3;"><span class="lbl">Booking Amount Paid: Rs :</span><span class="field-line">${extras.bookingAmountPaid ? fmtNum(extras.bookingAmountPaid) : ""}</span></div>
        <div class="row-line" style="flex:1.7;"><span class="lbl">( In Words ):</span><span class="field-line" style="font-size:11px;">${bookingAmountWords}</span></div>
      </div>
      <div class="row-line"><span class="lbl">Payment Mode: Cheque / DD / NEFT / RTGS Ref No:</span><span class="field-line">${paymentModeText}</span></div>
      <div class="check-row" style="margin-bottom:0;">
        <span class="lbl">Preferred Payment Plan:</span>
        <div class="check-item"><span class="lbl">Down Payment Plan</span><span class="${checkboxClass(extras.paymentPlan === "down_payment")}"></span></div>
        <div class="check-item"><span class="lbl">Construction Linked Plan</span><span class="${checkboxClass(extras.paymentPlan === "construction_linked")}"></span></div>
        <div class="check-item"><span class="lbl">Flexi Plan</span><span class="${checkboxClass(extras.paymentPlan === "flexi")}"></span></div>
      </div>
    </div>

    <div class="section-heading">4. DECLARATION &amp; ACKNOWLEDGEMENT</div>
    <div class="declaration-text">
      I/We hereby declare that the particulars given above are true and correct to the best of my/our knowledge.
      I/We have read, understood, and accept the standard terms and conditions of allotment, payment schedules,
      and statutory guidelines associated with this project. I/We agree to pay the subsequent installments as per
      the chosen payment plan failing which the company reserves the right to take action as per the standard terms.
    </div>

    <div class="sign-row">
      <div class="sign-block"><div class="sign-line"></div><div class="sign-caption">Primary Applicant Signature</div></div>
      <div class="sign-block"><div class="sign-line"></div><div class="sign-caption">Co-Applicant Signature</div></div>
    </div>

    <div class="row-line" style="justify-content:space-between; margin-top:10px;">
      <span class="lbl">Date:</span>
      <span class="date-slashes"><span class="box">${dd}</span> / <span class="box">${mm}</span> / <span class="box">${yyyy}</span></span>
      <span class="lbl" style="margin-left:20px;">Place:</span>
      <span class="field-line">Pune</span>
    </div>

    <div class="office-use">
      <div class="tag">FOR OFFICE USE ONLY</div>
      <div class="row-line" style="justify-content:space-between; margin-bottom:28px;">
        <span class="check-item"><span class="lbl">Application Status:&nbsp; Accepted</span><span class="checkbox"></span></span>
        <span class="check-item"><span class="lbl">Rejected</span><span class="checkbox"></span></span>
        <span class="lbl">Allotted Unit No:</span>
        <span class="field-line">${unit.id}</span>
      </div>
      <div class="row-line" style="justify-content:space-between;">
        <span class="lbl">Verified By (Name &amp; Sign):</span>
        <span class="field-line" style="margin-right:20px;"></span>
        <span class="lbl">Authorized Signatory:</span>
        <span class="field-line"></span>
      </div>
    </div>

    ${formFooterHTML()}
  </div>

  <!-- PAGE 3 - PAYMENT SCHEDULE + TERMS & CONDITIONS -->
  <div class="page">
    ${formHeaderHTML(logoUri, qrUri)}

    <div class="section-heading">PAYMENT SCHEDULE</div>
    <table class="payment-table">
      <thead>
        <tr><th>Sr. No.</th><th>Payment Stage</th><th style="text-align:center;">% of Package</th><th style="text-align:right;">Amount (Rs)</th></tr>
      </thead>
      <tbody>${paymentRows}</tbody>
    </table>

    <div class="tc-title-bar">Terms &amp; Condition</div>
    <ul class="tc-list">${tcItems}</ul>

    ${formFooterHTML()}
  </div>

</body>
</html>`;
}
