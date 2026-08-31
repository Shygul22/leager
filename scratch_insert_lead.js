import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://mtxmbjuqttztdsadkigl.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eG1ianVxdHR6dGRzYWRraWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTEyODUsImV4cCI6MjEwMzU4NzI4NX0.I96pM3HTQgsWyZ8be7315t9hh3mE6qNNijMDWinzrh8";

const supabase = createClient(supabaseUrl, supabaseKey);

async function insertLead() {
    const payload = {
        lead_name: "Naraenkeerthan",
        phone: "+919487672856",
        gmail: "naraenkeerthan@yahoo.com",
        service_interested: "Leads (Poster Leads Ad)",
        notes: "Imported from Meta Lead Form ('lead form 4/23/26, 6:41 AM', Platform: FB, Meta Lead ID: l:2005066046791259)",
        lead_status: "new",
        probability: 60,
        value: 0,
        outstanding_value: 0,
        first_contact_date: "2026-04-24",
    };

    console.log("Inserting lead payload into Supabase...", payload);

    const { data, error } = await supabase
        .from("lead_tracking")
        .insert([payload])
        .select();

    if (error) {
        console.error("Error inserting lead:", error);
    } else {
        console.log("Successfully inserted lead record:", JSON.stringify(data, null, 2));
    }
}

insertLead();
