import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://mdjjglffrgrsewehcqph.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kampnbGZmcmdyc2V3ZWhjcXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NTE2ODYsImV4cCI6MjA4NTAyNzY4Nn0.NsIRE3U86AxbfySSDE1Y-V7iO9mmd0z2fpdy49bNMZA"
);

async function test() {
  const leadId = "44271e24-b51f-4b74-8409-e7d909547858"; // Use a lead ID seen in logs testing

  const { data, error } = await supabase.from('ai_insights').insert({
    lead_id: leadId,
    type: "suggestion",
    content: "Test insight",
    urgency: 50
  }).select();

  if (error) {
    console.error("ai_insights constraint error:", JSON.stringify(error, null, 2));
  } else {
    console.log("ai_insights inserted successfully:", data);
  }

  // Also test memory_items
  const { data: memData, error: memError } = await supabase.from('memory_items').insert({
    lead_id: leadId,
    type: "ai",
    content: "Test memory",
    confidence: 100
  }).select();

  if (memError) {
    console.error("memory_items constraint error:", JSON.stringify(memError, null, 2));
  } else {
    console.log("memory_items inserted successfully:", memData);
  }

  // Also test semantic vector update (22000)
  const vec = new Array(1536).fill(0.1);
  const { data: vecData, error: vecError } = await supabase.from('leads').update({
    semantic_vector: vec
  }).eq('id', leadId).select('id');

  if (vecError) {
    console.error("semantic_vector update error:", JSON.stringify(vecError, null, 2));
  } else {
    console.log("semantic_vector updated successfully");
  }
}

test();
