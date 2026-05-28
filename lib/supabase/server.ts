import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabaseClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return (cookieStore as any).get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          try {
            (cookieStore as any).set({ name, value, ...options });
          } catch {}
        },
        remove(name: string, options: any) {
          try {
            (cookieStore as any).set({ name, value: "", ...options });
          } catch {}
        },
      },
    }
  );
}
