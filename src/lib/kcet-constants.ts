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

export const BRANCHES = [
  { label: "Computer Science & Engineering", pattern: "COMPUTER SCIENCE" },
  { label: "Information Science & Engineering", pattern: "INFORMATION SCIENCE" },
  { label: "Artificial Intelligence & Machine Learning", pattern: "ARTIFICIAL INTELLIGENCE AND MACHINE" },
  { label: "Artificial Intelligence & Data Science", pattern: "ARTIFICIAL INTELLIGENCE AND DATA" },
  { label: "Electronics & Communication", pattern: "ELECTRONICS AND COMMUNICATION" },
  { label: "Electrical & Electronics", pattern: "ELECTRICAL" },
  { label: "Mechanical Engineering", pattern: "MECHANICAL" },
  { label: "Civil Engineering", pattern: "CIVIL" },
  { label: "Aeronautical Engineering", pattern: "AERONAUTICAL" },
  { label: "Aerospace Engineering", pattern: "AERO SPACE" },
  { label: "Automobile Engineering", pattern: "AUTOMOBILE" },
  { label: "Biotechnology", pattern: "BIO" },
  { label: "Chemical Engineering", pattern: "CHEMICAL" },
  { label: "Industrial Engineering", pattern: "INDUSTRIAL" },
  { label: "Robotics & Automation", pattern: "ROBOTIC" },
  { label: "Cyber Security", pattern: "CYBER" },
] as const;

export const PREDICTION_MODES = [
  { id: "branch", label: "Dream Branch Priority", description: "Maximize chance of getting your preferred branch." },
  { id: "college", label: "Dream College Priority", description: "Aim for top colleges; branch flexible." },
  { id: "balanced", label: "Balanced Recommendation", description: "Mix of college reputation and branch fit." },
] as const;

export type PredictionMode = (typeof PREDICTION_MODES)[number]["id"];

export const DISTRICTS = [
  "Bagalkote", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban",
  "Bidar", "Chamarajanagar", "Chikkaballapur", "Chikkamagaluru", "Chitradurga",
  "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Hassan", "Haveri",
  "Kalaburagi", "Kodagu", "Kolar", "Koppal", "Mandya", "Mysuru", "Raichur",
  "Ramanagara", "Shivamogga", "Tumakuru", "Udupi", "Uttara Kannada",
  "Vijayapura", "Yadgir",
] as const;

export type District = (typeof DISTRICTS)[number];

// Map keywords (commonly in college name) → district.
// Falls back to "" when no keyword matches.
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
