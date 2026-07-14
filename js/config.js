// =====================================================================
// ARISE CAPITAL — TRUSTON — Project Configuration
// Fill in your Supabase credentials below (Settings → API in Supabase).
// =====================================================================

const SUPABASE_URL = "YOUR_SUPABASE_URL_HERE";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY_HERE";

const PROJECT_NAME = "ARISE CAPITAL";            // top-of-form company brand/logo
const PROJECT_TRUSTON_NAME = "TRUSTON";          // project name shown in the footer lockup
const PROJECT_TAGLINE = "Beyond Perfection";     // Truston's tagline in the footer
const PROJECT_ADDRESS = "Sr. No. 130, Wakad, Pune";
const PROJECT_RERA_NUMBER = "PC1260002600906";
const RERA_WEBSITE = "www.maharera.maharashtra.gov.in";
const PROJECT_LOGO_PATH = "assets/logo.png"; // put your logo file here (optional)

// Sales Office / bank details — shown in the footer and Terms & Conditions.
const SALES_OFFICE_NAME = "Vinode Wakadkar Buildcon LLP";
const SALES_OFFICE_ADDRESS = "Shop No. 1, Ground Floor, Swapna Shilpa, Wakad Road, Wakad, Pune, Maharashtra - 411057";
const PROJECT_PAYEE_NAME = "Vinode Wakadkar Buildcon LLP";
const PROJECT_BANK_NAME = "NKGSB Bank, Wakad Branch";
const PROJECT_BANK_ACCOUNT = "071111190212000";
const PROJECT_BANK_IFSC = "NKGS0000071";

// ---------------------------------------------------------------------
// PAYMENT SCHEDULE — PLACEHOLDER. Replace stage names/percentages with
// the real Stage-of-Payment slabs once finalized; this prints on every
// booking cost sheet under "Payment Schedule".
// ---------------------------------------------------------------------
const PAYMENT_SCHEDULE = [
  { stage: "On Booking", percent: 10 },
  { stage: "On Agreement for Sale", percent: 20 },
  { stage: "On Completion of Plinth", percent: 15 },
  { stage: "On Completion of 1st Slab", percent: 10 },
  { stage: "On Completion of 5th Slab", percent: 10 },
  { stage: "On Completion of 10th Slab", percent: 10 },
  { stage: "On Completion of Terrace Slab", percent: 10 },
  { stage: "On Completion of Internal Plaster / Flooring", percent: 10 },
  { stage: "On Possession", percent: 5 },
];
// NOTE: percentages above are a PLACEHOLDER and currently total 100% —
// edit freely, the app does not enforce that they sum to 100.

// ---------------------------------------------------------------------
// STANDARD TERMS & CONDITIONS — verbatim from the official Booking /
// Allotment Application form artwork. Printed on the last page of
// every booking form PDF.
// ---------------------------------------------------------------------
const STANDARD_TERMS = [
  "Prices mentioned herein are indicative and subject to change without prior notice at the sole discretion of the developer.",
  "Booking shall be confirmed only upon realization of the booking amount and issuance of a booking confirmation by the developer.",
  "Registration shall be completed within 7 days from the date of booking/allotment.",
  "GST, Stamp Duty, Registration Charges, Maintenance Deposit, Corpus Fund and all applicable statutory charges shall be borne by the purchaser. Legal/Advocate Fees of ₹10,000 shall be payable before execution of the Agreement for Sale.",
  "Government taxes, duties, premiums, cess and statutory levies are subject to change and shall be applicable at actuals.",
  "The unit forms part of a commercially sanctioned development and applicable taxes shall be levied accordingly.",
  "Payments shall be made as per the agreed payment schedule. Delayed payments shall attract interest as applicable under the Agreement for Sale and prevailing regulations.",
  "All Cheques/DD shall be drawn in favour of Vinode Wakadkar Buildcon LLP. RTGS/NEFT payments shall be made only to the designated account maintained with NKGSB Bank, Wakad Branch. Account No.: 071111190212000 | IFSC Code: NKGS0000071.",
  "Carpet area, specifications, layouts, amenities and plans are subject to permissible variations and approvals from competent authorities.",
  "Any references to rental potential, leasing opportunities, demand generation, commercial growth, future appreciation or investment returns are indicative in nature and shall not be construed as a guarantee by the developer.",
  "Any proposed association with third-party rental management, co-living, hospitality or leasing operators shall be subject to separate agreements and approvals.",
  "This cost sheet is indicative, confidential and valid for a limited period only.",
  "In case of any discrepancy, the terms and conditions contained in the registered Agreement for Sale shall prevail over this cost sheet and all marketing communications.",
];

// Category display order / colors for the inventory grid
const CATEGORY_META = {
  Studio:   { label: "Studio Apartments", color: "#c9922f" },
  Office:   { label: "Office Spaces",     color: "#2f5f6b" },
  Showroom: { label: "Showrooms",         color: "#7a3b8a" },
  Shop:     { label: "Shops",             color: "#3b7a4e" },
};

// PDF theme — matches the official Booking / Allotment Application form
const PDF_THEME = {
  brown: [156, 118, 79],     // banner fills ("OFFICIAL APPLICATION...", "Terms & Condition")
  brownLight: [246, 240, 231],
  dark: [30, 27, 24],        // logo text / headings
  gold: [201, 150, 47],      // accent underline
  gray: [110, 110, 110],
};
