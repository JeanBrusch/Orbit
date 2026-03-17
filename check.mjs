const url = 'https://mdjjglffrgrsewehcqph.supabase.co/rest/v1/property_interactions?select=*&order=timestamp.desc&limit=10'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kampnbGZmcmdyc2V3ZWhjcXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NTE2ODYsImV4cCI6MjA4NTAyNzY4Nn0.NsIRE3U86AxbfySSDE1Y-V7iO9mmd0z2fpdy49bNMZA'

async function check() {
  const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  const json = await res.json()
  console.log(JSON.stringify(json, null, 2))
}
check()
