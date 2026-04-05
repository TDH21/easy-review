/**
 * Returns stored reviews for the dashboard.
 * TODO: replace the stub data below with a real data source
 * (e.g. Netlify Blobs, Airtable, Supabase, etc.)
 */

exports.handler = async () => {
  // Stub — replace with real persistence layer
  const reviews = [];

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviews })
  };
};
