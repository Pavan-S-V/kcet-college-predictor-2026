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

function cfg() {
  const url = process.env["EXT_SUPABASE_URL"];
  const key = process.env["EXT_SUPABASE_SECRET_KEY"];
  if (!url || !key) throw new Error("External project not configured");
  return { url: url.replace(/\/$/, ""), key };
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

export async function logLogin(external_user_id: string, email: string | null, provider: string | null) {
  await post("login_activity", [{ external_user_id, email, login_provider: provider }], "return=minimal");
}
