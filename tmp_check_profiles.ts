import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = "https://nwrontqapnhsjhewlwkc.supabase.co"
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "" // I might not have this locally

if (!supabaseServiceKey) {
  console.log("No service role key found. Cannot query DB safely from here.")
  Deno.exit(0)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, company_name, paytm_merchant_id, paytm_merchant_key')
    .not('paytm_merchant_id', 'is', null)
  
  if (error) {
    console.error("Error fetching profiles:", error)
    return
  }
  
  console.log("Profiles with Paytm credentials:", data)
}

checkProfiles()
