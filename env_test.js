// env_test.js
require("dotenv").config({ path: ".env.local" });

function mask(v) {
  if (!v) return "(missing)";
  if (v.length <= 12) return "********";
  return v.slice(0, 6) + "..." + v.slice(-4);
}

console.log("SUPABASE_URL:", process.env.SUPABASE_URL || "(missing)");
console.log("SUPABASE_ANON_KEY:", mask(process.env.SUPABASE_ANON_KEY));
console.log("SUPABASE_SERVICE_ROLE_KEY:", mask(process.env.SUPABASE_SERVICE_ROLE_KEY));
console.log("GOOGLE_APPLICATION_CREDENTIALS:", process.env.GOOGLE_APPLICATION_CREDENTIALS || "(missing)");
