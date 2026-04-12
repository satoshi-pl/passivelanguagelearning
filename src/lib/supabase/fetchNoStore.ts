/**
 * Next.js deduplicates identical `fetch` inputs within one RSC render. Two `from("decks").select(...)`
 * calls after provisioning can therefore both see the first (empty) response. `cache: "no-store"`
 * opts out so each Supabase REST request hits the network.
 */
export function fetchNoStore(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    cache: "no-store",
  });
}
