import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://mtxmbjuqttztdsadkigl.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eG1ianVxdHR6dGRzYWRraWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMTEyODUsImV4cCI6MjEwMzU4NzI4NX0.I96pM3HTQgsWyZ8be7315t9hh3mE6qNNijMDWinzrh8";

const supabase = createClient(supabaseUrl, supabaseKey);

const sheet2Leads = [
    {
        lead_name: "Simhachalam Kottu",
        phone: "+917702316777",
        gmail: "chalam.vizag@gmail.com",
        service_interested: "Mobile Application Development (Android) - Visakhapatnam",
        notes: "Timeline: Urgent (< 3 months) | Fee: Negotiable | Meta Campaign: Leads Sep TN (Poster Leads Ad, Platform: Instagram)",
        lead_status: "new",
        probability: 60,
        value: 0,
        outstanding_value: 0,
        first_contact_date: "2026-08-31",
    },
    {
        lead_name: "janarthanam",
        phone: "+919790573290",
        gmail: "mjanarthanammjanarthanam@gmail.com",
        service_interested: "Mobile Application Development (Android) - Chengalpattu",
        notes: "Timeline: Urgent (< 3 months) | Fee: 4,999 to 6,999 monthly | Meta Campaign: Leads Sep TN (Poster Leads Ad, Platform: Instagram)",
        lead_status: "new",
        probability: 60,
        value: 0,
        outstanding_value: 0,
        first_contact_date: "2026-08-31",
    },
    {
        lead_name: "Mohan",
        phone: "+917200993330",
        gmail: "millanmohan@gmail.com",
        service_interested: "E-commerce & Enterprise Custom Software - Chennai",
        notes: "Timeline: Flexible | Fee: 4,999 to 6,999 monthly / Negotiable | Meta Campaign: Leads Sep TN (Poster Leads Ad, Platform: Facebook)",
        lead_status: "new",
        probability: 60,
        value: 0,
        outstanding_value: 0,
        first_contact_date: "2026-08-31",
    },
    {
        lead_name: "Pavi_kutty_143238",
        phone: "+919080818032",
        gmail: "pavi02032007@gmail.com",
        service_interested: "Both Mobile App and Website - Dharmapuri",
        notes: "Timeline: Urgent (< 3 months) | Fee: 6,999 to 14,999 monthly | Meta Campaign: Leads Sep TN (Poster Leads Ad, Platform: Instagram)",
        lead_status: "new",
        probability: 60,
        value: 0,
        outstanding_value: 0,
        first_contact_date: "2026-08-31",
    },
    {
        lead_name: "Hari",
        phone: "+919551205059",
        gmail: "arind.mba@gmail.com",
        service_interested: "Mobile Application Development (Android) - Bangalore",
        notes: "Timeline: 3 - 6 months | Fee: 4,999 to 6,999 monthly | Meta Campaign: Leads Sep TN (Poster Leads Ad, Platform: Instagram)",
        lead_status: "new",
        probability: 60,
        value: 0,
        outstanding_value: 0,
        first_contact_date: "2026-07-26",
    },
    {
        lead_name: "Mehanathan S",
        phone: "+919094792689",
        gmail: "meharajan5533@gmail.com",
        service_interested: "Both Mobile App and Website - Chennai",
        notes: "Timeline: Urgent (< 3 months) | Fee: Negotiable | Meta Campaign: Leads Sep TN (Poster Leads Ad Copy, Platform: Instagram)",
        lead_status: "new",
        probability: 60,
        value: 0,
        outstanding_value: 0,
        first_contact_date: "2026-07-26",
    }
];

async function insertAllLeads() {
    console.log(`Inserting ${sheet2Leads.length} leads from Sheet2 into Supabase...`);
    const { data, error } = await supabase
        .from("lead_tracking")
        .insert(sheet2Leads)
        .select();

    if (error) {
        console.error("Error inserting leads:", error);
    } else {
        console.log(`Successfully inserted ${data.length} leads from Sheet2!`);
    }
}

insertAllLeads();
