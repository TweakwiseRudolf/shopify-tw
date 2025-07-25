import { authenticate } from "app/shopify.server";
import { getShopBaseUrl, buildLocaleAwareUrl } from "./tweakwiseUrlBuilder.server";

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeGraphQLRequestWithRetry(admin: any, query: string, variables: any, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await admin.graphql(query, { variables });
      const responseJson = await response.json();
      
      if (responseJson.errors) {
        throw new Error(`GraphQL Error: ${JSON.stringify(responseJson.errors)}`);
      }
      
      return responseJson;
    } catch (error: any) {
      if (error.message?.includes('Throttled') && attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`Request throttled, waiting ${waitTime}ms before retry ${attempt}/${maxRetries}`);
        await sleep(waitTime);
        continue;
      }
      throw error;
    }
  }
}

export async function fetchCollectionsAndGenerateCategoriesXml(request: Request, markets: any) {
  const { admin } = await authenticate.admin(request);
  const baseUrl = await getShopBaseUrl(request);

  const categoriesXml: string[] = [];

  // Creates category XML with optional parent and URL
  function createCategoryXml(categoryId: string, name: string, rank: number, parentId?: string, url?: string): string {
    const category = [
      "    <category>",
      `      <categoryid>${categoryId}</categoryid>`,
      `      <name><![CDATA[${name}]]></name>`,
      url ? `      <url><![CDATA[${url}]]></url>` : null,
      `      <rank>${rank}</rank>`,
      parentId ? "      <parents>" : null,
      parentId ? `        <categoryid>${parentId}</categoryid>` : null,
      parentId ? "      </parents>" : null,
      "    </category>"
    ].filter(Boolean).join("\n");
    
    return category;
  }

  // Gets translated value from translations array or returns fallback
  function getTranslatedValue(translations: any[], key: string, fallback: string): string {
    return translations?.find((t: any) => t.key === key)?.value || fallback;
  }

  // Creates root category
  addRootCategory();
  
  // Process markets sequentially to avoid rate limits
  for (const market of markets) {
    await sleep(200);
    await processMarket(market);
  }

  return [
    "<categories>",
    ...categoriesXml,
    "</categories>"
  ].join("\n");

  // Creates the top-level root category
  function addRootCategory() {
    const rootCategoryId = "1";
    categoriesXml.push(createCategoryXml(rootCategoryId, "root", 0));
  }

  // Processes a market and its locales
  async function processMarket(market: any) {
    const marketId = market.marketId;
    const rootCategoryId = "1";
    
    categoriesXml.push(createCategoryXml(marketId, market.name, 1, rootCategoryId));

    for (const lang of market.locales) {
      await sleep(200);
      await processLocale(market, lang, marketId);
    }
  }

  // Processes a locale and fetches its collections
  async function processLocale(market: any, lang: any, marketId: string) {
    const langId = lang.langId;
    
    categoriesXml.push(createCategoryXml(langId, lang.name, 2, marketId));

    await fetchAndProcessCollections(market, lang, langId);
  }

  // Fetches collections for a locale with pagination
  async function fetchAndProcessCollections(market: any, lang: any, langId: string) {
    let hasNextPage = true;
    let cursor: string | null = null;

    while (hasNextPage) {
      await sleep(300);

      try {
        const responseJson = await makeGraphQLRequestWithRetry(
          admin,
          `#graphql
            query GetCollections($cursor: String, $locale: String!) {
              collections(first: 50, after: $cursor) {
                pageInfo {
                  hasNextPage
                }
                edges {
                  cursor
                  node {
                    id
                    title
                    handle
                    translations(locale: $locale) {
                      key
                      value
                    }
                  }
                }
              }
            }`,
          { cursor, locale: lang.locale }
        );

        const collections = responseJson.data.collections;
        hasNextPage = collections.pageInfo.hasNextPage;
        cursor = collections.edges.length > 0 ? collections.edges[collections.edges.length - 1].cursor : null;

        processCollections(collections.edges, market, lang, langId);
        
      } catch (error) {
        console.error(`Error fetching collections for market ${market.name}, locale ${lang.locale}:`, error);
        throw error;
      }
    }
  }

  // Processes collection data and creates category XML
  function processCollections(collectionEdges: any[], market: any, lang: any, langId: string) {
    collectionEdges.forEach(edge => {
      const col = edge.node;
      const collectionShortId = col.id.split('/').pop();
      const cleanId = `${langId}_${collectionShortId}`;
      
      const translatedTitle = getTranslatedValue(col.translations, "title", col.title);
      const translatedHandle = getTranslatedValue(col.translations, "handle", col.handle);

      const collectionUrl = buildLocaleAwareUrl(
        baseUrl,
        lang.locale,
        market.locales,
        `/collections/${translatedHandle}`
      );

      categoriesXml.push(createCategoryXml(cleanId, translatedTitle, 3, langId, collectionUrl));
    });
  }
}
