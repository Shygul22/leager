import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://mtxmbjuqttztdsadkigl.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eG1ianVxdHR6dGRzYWRraWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTEyODUsImV4cCI6MjEwMzU4NzI4NX0.I96pM3HTQgsWyZ8be7315t9hh3mE6qNNijMDWinzrh8";

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateLeadCodes() {
    console.log("Fetching all leads to reformat ID codes to ZJ-LEAD-2026-XXXX format...");
    const { data: leads, error } = await supabase
        .from("lead_tracking")
        .select("id, created_at")
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Error fetching leads:", error);
        return;
    }

    console.log(`Found ${leads.length} leads to format.`);
    let idx = 1;
    for (const lead of leads) {
        const year = lead.created_at ? lead.created_at.slice(0, 4) : "2026";
        const code = `ZJ-LEAD-${year}-${String(idx).padStart(4, '0')}`;
        
        const { error: updErr } = await supabase
            .from("lead_tracking")
            .update({ lead_id_code: code })
            .eq("id", lead.id);

        if (updErr) {
            console.error(`Error updating lead ${lead.id}:`, updErr);
        } else {
            console.log(`Updated lead ${lead.id} -> ${code}`);
        }
        idx++;
    }

    console.log("Fetching all client tracking records to reformat ID codes to ZJ-CLI-2026-XXXX format...");
    const { data: clients, error: cliErr } = await supabase
        .from("client_tracking")
        .select("id, created_at")
        .order("created_at", { ascending: true });

    if (cliErr) {
        console.error("Error fetching client tracking records:", cliErr);
        return;
    }

    let cIdx = 1;
    for (const cli of clients) {
        const year = cli.created_at ? cli.created_at.slice(0, 4) : "2026";
        const code = `ZJ-CLI-${year}-${String(cIdx).padStart(4, '0')}`;
        
        const { error: updErr } = await supabase
            .from("client_tracking")
            .update({ client_id_code: code })
            .eq("id", cli.id);

        if (updErr) {
            console.error(`Error updating client tracking ${cli.id}:`, updErr);
        } else {
            console.log(`Updated client tracking ${cli.id} -> ${code}`);
        }
        cIdx++;
    }

    console.log("Done updating ID codes!");
}

updateLeadCodes();
