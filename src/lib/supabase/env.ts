export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** Server mutations / session lookup need the service role key. */
export function isSupabaseAdminConfigured(): boolean {
  return (
    isSupabaseConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}
