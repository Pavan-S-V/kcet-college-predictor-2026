import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Called by the signed-in user on login / after a prediction. Syncs only their own row.
export const syncMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ login: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { upsertUsers, logLogin } = await import("./ext-sync.server");
    const { data: u } = await context.supabase.auth.getUser();
    const user = u.user;
    if (!user) throw new Error("Unauthorized");
    const { data: preds, count } = await context.supabase
      .from("predictions").select("created_at", { count: "exact" })
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(1);
    const provider = (user.app_metadata?.provider as string) ?? "email";
    try {
      await upsertUsers([{
        external_user_id: user.id,
        name: (user.user_metadata?.full_name || user.user_metadata?.name || null) as string | null,
        email: user.email ?? null,
        login_provider: provider,
        registered_at: user.created_at,
        last_login_at: user.last_sign_in_at ?? new Date().toISOString(),
        prediction_count: count ?? 0,
        last_prediction_at: preds?.[0]?.created_at ?? null,
      }]);
      if (data.login) await logLogin(user.id, user.email ?? null, provider);
      return { ok: true };
    } catch (e) {
      console.error(e);
      return { ok: false };
    }
  });

// Admin only: push every existing user.
export const syncAllUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { upsertUsers, insertLogins } = await import("./ext-sync.server");
    const users: any[] = [];
    for (let page = 1; page < 50; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error("Could not load users");
      users.push(...data.users);
      if (data.users.length < 1000) break;
    }
    const { data: preds } = await supabaseAdmin.from("predictions").select("user_id, created_at").limit(100000);
    const pc = new Map<string, { count: number; last: string }>();
    for (const p of preds ?? []) {
      const e = pc.get(p.user_id) ?? { count: 0, last: "" };
      e.count++; if (p.created_at > e.last) e.last = p.created_at;
      pc.set(p.user_id, e);
    }
    await upsertUsers(users.map((u) => ({
      external_user_id: u.id,
      name: (u.user_metadata?.full_name || u.user_metadata?.name || null) as string | null,
      email: u.email ?? null,
      login_provider: (u.app_metadata?.provider as string) ?? "email",
      registered_at: u.created_at,
      last_login_at: u.last_sign_in_at ?? null,
      prediction_count: pc.get(u.id)?.count ?? 0,
      last_prediction_at: pc.get(u.id)?.last || null,
    })));
    // Login history: only send rows newer than what the external table already has is not known,
    // so send logins from the last 24h to avoid large duplicates on repeated clicks.
    const since = new Date(Date.now() - 86400000).toISOString();
    const { data: logins } = await supabaseAdmin.from("login_activity")
      .select("user_id, provider, logged_in_at").gte("logged_in_at", since).limit(5000);
    const emails = new Map(users.map((u) => [u.id, u.email ?? null]));
    let loginCount = 0;
    if (logins?.length) {
      await insertLogins(logins.map((l) => ({
        external_user_id: l.user_id, email: emails.get(l.user_id) ?? null,
        login_provider: l.provider ?? "email", logged_in_at: l.logged_in_at,
      })));
      loginCount = logins.length;
    }
    return { synced: users.length, logins: loginCount };
  });

// Admin only: compare app data with the external tables.
export const verifyExternalSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchAll } = await import("./ext-sync.server");
    const users: any[] = [];
    for (let page = 1; page < 50; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error("Could not load users");
      users.push(...data.users);
      if (data.users.length < 1000) break;
    }
    const { data: preds } = await supabaseAdmin.from("predictions").select("user_id").limit(100000);
    const appPred = new Map<string, number>();
    for (const p of preds ?? []) appPred.set(p.user_id, (appPred.get(p.user_id) ?? 0) + 1);
    const { data: appLogins } = await supabaseAdmin.from("login_activity").select("user_id").limit(100000);
    const appLogin = new Map<string, number>();
    for (const l of appLogins ?? []) appLogin.set(l.user_id, (appLogin.get(l.user_id) ?? 0) + 1);

    const ext = await fetchAll<{ external_user_id: string; email: string | null; prediction_count: number }>(
      "user_analytics?select=external_user_id,email,prediction_count");
    const extLogins = await fetchAll<{ external_user_id: string; logged_in_at: string }>(
      "login_activity?select=external_user_id,logged_in_at");

    const extById = new Map<string, typeof ext>();
    for (const r of ext) extById.set(r.external_user_id, [...(extById.get(r.external_user_id) ?? []), r]);
    const appIds = new Set(users.map((u) => u.id));
    const emailOf = new Map(users.map((u) => [u.id, u.email ?? ""]));

    const missingUsers = users.filter((u) => !extById.has(u.id)).map((u) => ({ id: u.id, email: u.email ?? "" }));
    const duplicateUsers = [...extById].filter(([, rs]) => rs.length > 1).map(([id, rs]) => ({ id, email: rs[0].email ?? "", count: rs.length }));
    const orphanUsers = [...extById.keys()].filter((id) => !appIds.has(id)).map((id) => ({ id, email: extById.get(id)![0].email ?? "" }));
    const predictionMismatches = users.flatMap((u) => {
      const e = extById.get(u.id)?.[0];
      const a = appPred.get(u.id) ?? 0;
      return e && e.prediction_count !== a ? [{ id: u.id, email: u.email ?? "", app: a, external: e.prediction_count }] : [];
    });

    const extLoginCount = new Map<string, number>();
    const seen = new Map<string, number>();
    for (const l of extLogins) {
      extLoginCount.set(l.external_user_id, (extLoginCount.get(l.external_user_id) ?? 0) + 1);
      const k = `${l.external_user_id}|${l.logged_in_at}`;
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    const duplicateLogins = [...seen].filter(([, c]) => c > 1).map(([k, c]) => {
      const [id, at] = k.split("|");
      return { id, email: emailOf.get(id) ?? "", at, count: c };
    });
    const loginMismatches = [...new Set([...appLogin.keys(), ...extLoginCount.keys()])].flatMap((id) => {
      const a = appLogin.get(id) ?? 0, e = extLoginCount.get(id) ?? 0;
      return a !== e ? [{ id, email: emailOf.get(id) ?? "", app: a, external: e }] : [];
    });

    return {
      checkedAt: new Date().toISOString(),
      totals: {
        appUsers: users.length, extUsers: ext.length,
        appLogins: appLogins?.length ?? 0, extLogins: extLogins.length,
        appPredictions: preds?.length ?? 0,
        extPredictions: ext.reduce((s, r) => s + (r.prediction_count ?? 0), 0),
      },
      missingUsers, duplicateUsers, orphanUsers, predictionMismatches, duplicateLogins, loginMismatches,
    };
  });
