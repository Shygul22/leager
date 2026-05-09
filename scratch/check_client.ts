import { createClient } from '@supabase/supabase-client'

const supabaseUrl = 'https://nwrontqapnhsjhewlwkc.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '' // Need service role to bypass RLS or just check public

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkClient() {
    console.log('Checking client: ZENCI013 / anandwebengineering@gmail.com')
    
    const { data, error } = await supabase
        .from('clients')
        .select('*')
        .ilike('email', 'anandwebengineering@gmail.com')
        
    if (error) {
        console.error('Error:', error)
        return
    }
    
    console.log('Results:', JSON.stringify(data, null, 2))
}

checkClient()
