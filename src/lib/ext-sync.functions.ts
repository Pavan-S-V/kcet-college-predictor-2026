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
    const { upsertUsers } = await import("./ext-sync.server");
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
    return { synced: users.length };
  });
