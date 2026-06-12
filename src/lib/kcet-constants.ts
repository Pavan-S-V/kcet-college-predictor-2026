export const CATEGORIES = [
  "GM","1G","1K","1R","2AG","2AK","2AR","2BG","2BK","2BR",
  "3AG","3AK","3AR","3BG","3BK","3BR","SCG","SCK","SCR","STG","STK","STR",
] as const;

export type Category = (typeof CATEGORIES)[number];

// Curated, popular KCET branches. The DB query uses ILIKE so partial matches catch variants.
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
  { id: "branch", label: "Dream Branch Priority", description: "Maximize chance of getting your preferred branch, even at lesser-known colleges." },
  { id: "college", label: "Dream College Priority", description: "Aim for top colleges; branch flexible." },
  { id: "balanced", label: "Balanced Recommendation", description: "A healthy mix of college reputation and branch fit." },
] as const;

export type PredictionMode = (typeof PREDICTION_MODES)[number]["id"];
