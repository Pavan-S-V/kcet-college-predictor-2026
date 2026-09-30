import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { isAdmin: !!data };
  });

export const getAdminAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const users: any[] = [];
    for (let page = 1; page < 50; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error("Could not load users");
      users.push(...data.users);
      if (data.users.length < 1000) break;
    }
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: active } = await supabaseAdmin
      .from("login_activity").select("user_id").gte("logged_in_at", since);
    const { data: logins } = await supabaseAdmin
      .from("login_activity").select("user_id, provider, logged_in_at")
      .order("logged_in_at", { ascending: false }).limit(200);
    const { data: preds } = await supabaseAdmin
      .from("predictions").select("user_id, created_at").limit(100000);
    const pc = new Map<string, { count: number; last: string }>();
    for (const p of preds ?? []) {
      const e = pc.get(p.user_id) ?? { count: 0, last: "" };
      e.count++; if (p.created_at > e.last) e.last = p.created_at;
      pc.set(p.user_id, e);
    }
    const mapped = users.map((u) => ({
      id: u.id,
      name: (u.user_metadata?.full_name || u.user_metadata?.name || "") as string,
      email: u.email ?? "",
      provider: (u.app_metadata?.provider || "email") as string,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      prediction_count: pc.get(u.id)?.count ?? 0,
      last_prediction_at: pc.get(u.id)?.last || null,
    }));
    const byId = new Map(mapped.map((u) => [u.id, u]));
    return {
      activeUsers: new Set((active ?? []).map((r) => r.user_id)).size,
      totalPredictions: preds?.length ?? 0,
      logins: (logins ?? []).map((l) => ({
        user_id: l.user_id,
        name: byId.get(l.user_id)?.name ?? "",
        email: byId.get(l.user_id)?.email ?? "",
        provider: l.provider ?? "email",
        at: l.logged_in_at,
      })),
      users: mapped,
    };
  });
