// Pushes permitted user info to the owner's external project (user_analytics + login_activity).
type Row = {
  external_user_id: string;
  name: string | null;
  email: string | null;
  login_provider: string | null;
  registered_at: string | null;
  last_login_at: string | null;
  prediction_count?: number;
  last_prediction_at?: string | null;
};

// The project URL is public (not a secret). The real project ref is
// "ngyxppscabebkgerohzj"; the "...kgqrohzi" spelling does not exist (Cloudflare 1016).
const EXT_URL = "https://ngyxppscabebkgerohzj.supabase.co";

function cfg() {
  const key = process.env["EXT_SUPABASE_SECRET_KEY"];
  if (!key) throw new Error("External project key not configured");
  return { url: EXT_URL, key };
}

async function post(path: string, body: unknown, prefer: string) {
  const { url, key } = cfg();
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json", Prefer: prefer };
  if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(`${url}/rest/v1/${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`External sync failed [${res.status}]: ${await res.text()}`);
}

export async function upsertUsers(rows: Row[]) {
  for (let i = 0; i < rows.length; i += 500) {
    await post("user_analytics?on_conflict=external_user_id", rows.slice(i, i + 500), "resolution=merge-duplicates,return=minimal");
  }
}

export async function insertLogins(rows: { external_user_id: string; email: string | null; login_provider: string | null; logged_in_at: string }[]) {
  for (let i = 0; i < rows.length; i += 500) await post("login_activity", rows.slice(i, i + 500), "return=minimal");
}

export async function logLogin(external_user_id: string, email: string | null, provider: string | null) {
  await post("login_activity", [{ external_user_id, email, login_provider: provider }], "return=minimal");
}

export async function fetchAll<T>(path: string): Promise<T[]> {
  const { url, key } = cfg();
  const headers: Record<string, string> = { apikey: key };
  if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;
  const out: T[] = [];
  for (let from = 0; from < 200000; from += 1000) {
    const res = await fetch(`${url}/rest/v1/${path}`, { headers: { ...headers, Range: `${from}-${from + 999}` } });
    if (!res.ok) throw new Error(`External read failed [${res.status}]: ${await res.text()}`);
    const rows = (await res.json()) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}
