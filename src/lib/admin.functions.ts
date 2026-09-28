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
    return {
      activeUsers: new Set((active ?? []).map((r) => r.user_id)).size,
      users: users.map((u) => ({
        id: u.id,
        name: (u.user_metadata?.full_name || u.user_metadata?.name || "") as string,
        email: u.email ?? "",
        provider: (u.app_metadata?.provider || "email") as string,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
      })),
    };
  });
