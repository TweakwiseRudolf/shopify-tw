import { authenticate } from "app/shopify.server";

// Helper: get shortest unique market identifier (use last 8 chars of GID)
function getMarketShortId(marketId: string) {
  return marketId.split('/').pop()?.slice(-8) || marketId;
}

export async function fetchMarketsWithLocales(request: Request) {
  const { admin } = await authenticate.admin(request);

  // Fetch all markets (without webPresences)
  const marketsResponse = await admin.graphql(`
    {
      markets(first: 100) {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  `);
  const marketsJson = await marketsResponse.json();
  const markets = marketsJson.data.markets.edges.map((edge: any) => edge.node);

  // For each market, fetch its webPresence (defaultLocale + alternateLocales) and generate IDs
  for (const market of markets) {
    const marketShortId = getMarketShortId(market.id);
    market.marketId = `${marketShortId}`;

    const webPresenceResponse = await admin.graphql(`
      query GetWebPresence($id: ID!) {
        market(id: $id) {
          webPresence {
            defaultLocale {
              name
              locale
            }
            alternateLocales {
              name
              locale
            }
          }
        }
      }
    `, { variables: { id: market.id } });
    const webPresenceJson = await webPresenceResponse.json();
    const webPresence = webPresenceJson.data.market.webPresence;

    // Attach locales with generated langId
    const locales: { name: string; locale: string; langId: string }[] = [];
    if (webPresence?.defaultLocale) {
      locales.push({
        ...webPresence.defaultLocale,
        langId: `${market.marketId}_${webPresence.defaultLocale.locale}`,
      });
    }
    if (Array.isArray(webPresence?.alternateLocales)) {
      for (const alt of webPresence.alternateLocales) {
        locales.push({
          ...alt,
          langId: `${market.marketId}_${alt.locale}`,
        });
      }
    }
    market.locales = locales;
  }

  return markets;
}