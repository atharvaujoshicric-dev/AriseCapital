// =====================================================================
// TRUSTON (Arise Capital) — Project Configuration
// Fill in your Supabase credentials below (Settings → API in Supabase).
// =====================================================================

const SUPABASE_URL = "YOUR_SUPABASE_URL_HERE";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY_HERE";

const PROJECT_NAME = "TRUSTON";
const PROJECT_SUBTITLE = "Arise Capital";
const PROJECT_ADDRESS = "Sr. No. 130, Wakad, Pune";
const PROJECT_RERA_NUMBER = "PC1260002600906";
const PROJECT_LOGO_PATH = "assets/logo.png"; // put your logo file here (optional)

// Bank account details for payment (from the cost sheet) — shown in T&Cs / footer.
const PROJECT_PAYEE_NAME = "Vonode Wakadkar Buildcon LLP";
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
// STANDARD TERMS & CONDITIONS — printed on page 2 of every cost sheet.
// Derived from the cost sheet you shared; edit as needed.
// ---------------------------------------------------------------------
const STANDARD_TERMS = [
  "Prices mentioned herein are indicative and subject to change without prior notice at the sole discretion of the developer.",
  "Booking shall be confirmed only upon realization of the booking amount and issuance of a booking confirmation by the developer.",
  "Registration shall be completed within 7 days from the date of booking/allotment.",
  "GST, Stamp Duty, Registration Charges, Maintenance Deposit, Monthly Maintenance Charges @ ₹8/- per sq. ft., One-time Corpus Fund @ ₹150/- per sq. ft. + applicable GST, Legal/Advocate Fees of ₹10,000/- and all applicable statutory charges shall be borne by the purchaser.",
  "The unit forms part of a commercially sanctioned development and applicable taxes shall be levied accordingly.",
  "Payments shall be made as per the agreed payment schedule. Delayed payments shall attract interest as applicable under the Agreement for Sale and prevailing regulations.",
  "All Cheques/DD shall be drawn in favour of Vonode Wakadkar Buildcon LLP. RTGS/NEFT payments shall be made only to the designated account maintained with NKGSB Bank, Wakad Branch. Account No.: 071111190212000 | IFSC Code: NKGS0000071.",
  "Carpet area, specifications, layouts, amenities and plans are subject to permissible variations and approvals from competent authorities.",
  "Any references to rental potential, leasing opportunities, demand generation, commercial growth, future appreciation or investment returns are indicative in nature and shall not be construed as a guarantee by the developer.",
  "Any proposed association with third-party rental management, co-living, hospitality or leasing operators shall be subject to separate agreements and approvals.",
  "In case of any discrepancy, the terms and conditions contained in the registered Agreement for Sale shall prevail over this cost sheet and all marketing communications.",
];

// Category display order / colors for the inventory grid
const CATEGORY_META = {
  Studio:   { label: "Studio Apartments", color: "#c9922f" },
  Office:   { label: "Office Spaces",     color: "#2f5f6b" },
  Showroom: { label: "Showrooms",         color: "#7a3b8a" },
  Shop:     { label: "Shops",             color: "#3b7a4e" },
};
