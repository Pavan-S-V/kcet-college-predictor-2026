export const BRAND = "KCET - College & Course Predictor";
export const BRAND_TAGLINE_LINE1 = "Get Your Dream College and Course";
export const BRAND_TAGLINE_LINE2 = "Powered by Round 1, Round 2 & Seat Matrix Analysis";

export const CATEGORIES = [
  "GM",
  "1G", "1K", "1R",
  "2AG", "2AK", "2AR",
  "2BG", "2BK", "2BR",
  "3AG", "3AK", "3AR",
  "3BG", "3BK", "3BR",
  "SCG", "SCK", "SCR",
  "STG", "STK", "STR",
] as const;

export type Category = (typeof CATEGORIES)[number];

// Patterns are UPPERCASE substrings used to identify a row's branch.
// Order matters for tie-breaking display priority; matching itself picks the
// LONGEST matching pattern so e.g. "ARTIFICIAL INTELLIGENCE AND MACHINE LEARNING"
// is never classified as plain "COMPUTER SCIENCE".
export const BRANCHES = [
  { label: "Artificial Intelligence & Machine Learning", pattern: "ARTIFICIAL INTELLIGENCE AND MACHINE" },
  { label: "Artificial Intelligence & Data Science",     pattern: "ARTIFICIAL INTELLIGENCE AND DATA" },
  { label: "Computer Science & Engineering",             pattern: "COMPUTER SCIENCE" },
  { label: "Information Science & Engineering",          pattern: "INFORMATION SCIENCE" },
  { label: "Electronics & Communication",                pattern: "ELECTRONICS AND COMMUNICATION" },
  { label: "Electrical & Electronics",                   pattern: "ELECTRICAL" },
  { label: "Mechanical Engineering",                     pattern: "MECHANICAL" },
  { label: "Civil Engineering",                          pattern: "CIVIL" },
  { label: "Aeronautical Engineering",                   pattern: "AERONAUTICAL" },
  { label: "Aerospace Engineering",                      pattern: "AERO SPACE" },
  { label: "Automobile Engineering",                     pattern: "AUTOMOBILE" },
  { label: "Biotechnology",                              pattern: "BIO" },
  { label: "Chemical Engineering",                       pattern: "CHEMICAL" },
  { label: "Industrial Engineering",                     pattern: "INDUSTRIAL" },
  { label: "Robotics & Automation",                      pattern: "ROBOTIC" },
  { label: "Cyber Security",                             pattern: "CYBER" },
] as const;

// Kept as a type alias for back-compat; the UI no longer surfaces a mode toggle.
export type PredictionMode = "branch" | "college" | "balanced";

export const DISTRICTS = [
  "Bagalkote", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban",
  "Bidar", "Chamarajanagar", "Chikkaballapur", "Chikkamagaluru", "Chitradurga",
  "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Hassan", "Haveri",
  "Kalaburagi", "Kodagu", "Kolar", "Koppal", "Mandya", "Mysuru", "Raichur",
  "Ramanagara", "Shivamogga", "Tumakuru", "Udupi", "Uttara Kannada",
  "Vijayapura", "Yadgir",
] as const;

export type District = (typeof DISTRICTS)[number];

const DISTRICT_KEYWORDS: Array<[string, District]> = [
  ["BAGALKOT", "Bagalkote"],
  ["BELLARY", "Ballari"], ["BALLARI", "Ballari"],
  ["BELGAUM", "Belagavi"], ["BELAGAVI", "Belagavi"],
  ["BENGALURU RURAL", "Bengaluru Rural"], ["BANGALORE RURAL", "Bengaluru Rural"],
  ["BENGALURU", "Bengaluru Urban"], ["BANGALORE", "Bengaluru Urban"],
  ["BIDAR", "Bidar"],
  ["CHAMARAJANAGAR", "Chamarajanagar"], ["CHAMARAJA", "Chamarajanagar"],
  ["CHIKKABALLAPUR", "Chikkaballapur"], ["CHIKBALLAPUR", "Chikkaballapur"],
  ["CHIKMAGALUR", "Chikkamagaluru"], ["CHIKKAMAGALURU", "Chikkamagaluru"],
  ["CHITRADURGA", "Chitradurga"],
  ["MANGALORE", "Dakshina Kannada"], ["MANGALURU", "Dakshina Kannada"], ["DAKSHINA KANNADA", "Dakshina Kannada"],
  ["DAVANGERE", "Davanagere"], ["DAVANAGERE", "Davanagere"],
  ["DHARWAD", "Dharwad"], ["HUBLI", "Dharwad"], ["HUBBALLI", "Dharwad"],
  ["GADAG", "Gadag"],
  ["HASSAN", "Hassan"],
  ["HAVERI", "Haveri"],
  ["GULBARGA", "Kalaburagi"], ["KALABURAGI", "Kalaburagi"],
  ["KODAGU", "Kodagu"], ["MADIKERI", "Kodagu"],
  ["KOLAR", "Kolar"],
  ["KOPPAL", "Koppal"],
  ["MANDYA", "Mandya"],
  ["MYSORE", "Mysuru"], ["MYSURU", "Mysuru"],
  ["RAICHUR", "Raichur"],
  ["RAMANAGARA", "Ramanagara"], ["RAMNAGAR", "Ramanagara"],
  ["SHIMOGA", "Shivamogga"], ["SHIVAMOGGA", "Shivamogga"],
  ["TUMKUR", "Tumakuru"], ["TUMAKURU", "Tumakuru"], ["GUBBI", "Tumakuru"],
  ["UDUPI", "Udupi"], ["MANIPAL", "Udupi"],
  ["KARWAR", "Uttara Kannada"], ["UTTARA KANNADA", "Uttara Kannada"], ["SIRSI", "Uttara Kannada"],
  ["BIJAPUR", "Vijayapura"], ["VIJAYAPURA", "Vijayapura"],
  ["YADGIR", "Yadgir"], ["YADGIRI", "Yadgir"],
];

export function districtFor(collegeName: string): District | "" {
  const up = collegeName.toUpperCase();
  for (const [kw, d] of DISTRICT_KEYWORDS) {
    if (up.includes(kw)) return d;
  }
  return "";
}

// Returns the canonical branch label for a raw KCET branch name, or null
// if no known pattern is contained. Uses the LONGEST matching pattern so
// specific branches (AIML, AIDS) are never collapsed into CSE.
export function canonicalBranchLabel(rawBranch: string): string | null {
  const up = rawBranch.toUpperCase();
  let bestLen = -1;
  let best: string | null = null;
  for (const b of BRANCHES) {
    if (up.includes(b.pattern) && b.pattern.length > bestLen) {
      bestLen = b.pattern.length;
      best = b.label;
    }
  }
  return best;
}
