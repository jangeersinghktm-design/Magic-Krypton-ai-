import { createClient } from "@/lib/supabase/client";

export async function saveProject({
  title,
  prompt,
  html_code,
}: {
  title: string;
  prompt: string;
  html_code: string;
}) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      title,
      prompt,
      html_code,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
