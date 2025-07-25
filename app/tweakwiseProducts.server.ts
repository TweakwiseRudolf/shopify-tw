import { authenticate } from "app/shopify.server";
import { generateTweakwiseAttributesXml } from "app/tweakwiseAttributes.server";
import { getShopBaseUrl, buildLocaleAwareUrl } from "./tweakwiseUrlBuilder.server";

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeGraphQLRequestWithRetry(admin: any, query: string, variables: any, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await admin.graphql(query, { variables });
      const responseJson = await response.json();
      
      // Check for GraphQL errors
      if (responseJson.errors) {
        throw new Error(`GraphQL Error: ${JSON.stringify(responseJson.errors)}`);
      }
      
      return responseJson;
    } catch (error: any) {
      if (error.message?.includes('Throttled') && attempt < maxRetries) {
        // Exponential backoff: 2^attempt seconds
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`Request throttled, waiting ${waitTime}ms before retry ${attempt}/${maxRetries}`);
        await sleep(waitTime);
        continue;
      }
      throw error;
    }
  }
}

export async function fetchAllProductsXml(request: Request, markets: any) {
  const { admin } = await authenticate.admin(request);
  
  // Get base URL once
  const baseUrl = await getShopBaseUrl(request);

  const allItems: string[] = [];

  // Process markets/locales sequentially to avoid rate limits
  for (const market of markets) {
    const marketId = market.marketId;
    for (const lang of market.locales) {
      const langId = lang.langId;
      console.log(`Processing market: ${market.name}, locale: ${lang.locale}`);

      let hasNextPage = true;
      let cursor: string | null = null;

      while (hasNextPage) {
        // Add delay between each request
        await sleep(500);

        try {
          const responseJson = await makeGraphQLRequestWithRetry(
            admin,
            `#graphql
              query GetProducts($cursor: String, $locale: String!) {
                products(first: 25, after: $cursor) {
                  pageInfo {
                    hasNextPage
                  }
                  edges {
                    cursor
                    node {
                      id
                      title
                      handle
                      vendor
                      totalInventory
                      images(first: 1) {
                        edges { node { url } }
                      }
                      variants(first: 50) {
                        edges { 
                          node { 
                            id
                            price 
                            sku
                            inventoryQuantity
                            availableForSale
                            compareAtPrice
                            title
                            selectedOptions {
                              name
                              value
                            }
                            displayName
                            barcode
                            image {
                              url
                            }
                          } 
                        }
                      }
                      collections(first: 50) {
                        edges { node { id title handle } }
                      }
                      onlineStoreUrl
                      tags
                      createdAt
                      updatedAt
                      publishedAt
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

          const products = responseJson.data.products;
          hasNextPage = products.pageInfo.hasNextPage;
          cursor = products.edges.length > 0 ? products.edges[products.edges.length - 1].cursor : null;

          for (const edge of products.edges) {
            const product = edge.node;
            const translatedName = product.translations?.find((t: any) => t.key === "title")?.value || product.title;
            const translatedHandle = product.translations?.find((t: any) => t.key === "handle")?.value || product.handle;

            const productShortId = product.id.replace('gid://shopify/Product/', '');
            const groupCode = `${langId}_${productShortId}`;
            
            const brand = product.vendor || "";
            // Product fallback image
            const productImageUrl = product.images.edges.length > 0 ? product.images.edges[0].node.url : "";
            
            // Prefix categoryId with langId
            const categoryIds = product.collections.edges.map((edge: any) => {
              const collectionShortId = edge.node.id.split('/').pop();
              return `${langId}_${collectionShortId}`;
            });

            // If product has variants, create an item for each variant
            if (product.variants.edges.length > 0) {
              for (const variantEdge of product.variants.edges) {
                const variant = variantEdge.node;
                const variantShortId = variant.id.replace('gid://shopify/ProductVariant/', '');
                const itemId = `${langId}_${variantShortId}`;
                
                // Use variant-specific data
                const variantName = variant.title && variant.title !== "Default Title" 
                  ? `${translatedName} - ${variant.title}` 
                  : translatedName;
                const stock = typeof variant.inventoryQuantity === "number" ? variant.inventoryQuantity : "";
                const price = variant.price || "0";

                // Use variant image if available, fallback to product image
                const imageUrl = variant.image?.url || productImageUrl;

                // Build variant-specific URL
                const variantUrl = buildLocaleAwareUrl(
                  baseUrl,
                  lang.locale,
                  market.locales,
                  `/products/${translatedHandle}?variant=${variantShortId}`
                );

                allItems.push([
                  "    <item>",
                  `      <id><![CDATA[${itemId}]]></id>`,
                  `      <groupcode><![CDATA[${groupCode}]]></groupcode>`,
                  `      <name><![CDATA[${variantName}]]></name>`,
                  `      <url><![CDATA[${variantUrl}]]></url>`,
                  `      <image><![CDATA[${imageUrl}]]></image>`,
                  `      <brand><![CDATA[${brand}]]></brand>`,
                  `      <stock>${stock}</stock>`,
                  `      <price>${price}</price>`,
                  generateTweakwiseAttributesXml(product, lang.locale, variant),
                  "      <categories>",
                  ...categoryIds.map((cid: string) => `        <categoryid>${cid}</categoryid>`),
                  "      </categories>",
                  "    </item>"
                ].join("\n"));
              }
            } else {
              // No variants, use product image
              const productUrl = buildLocaleAwareUrl(
                baseUrl,
                lang.locale,
                market.locales,
                `/products/${translatedHandle}`
              );

              const itemId = groupCode;
              const stock = typeof product.totalInventory === "number" ? product.totalInventory : "";
              const price = "0"; // No variant price available

              allItems.push([
                "    <item>",
                `      <id><![CDATA[${itemId}]]></id>`,
                `      <groupcode><![CDATA[${groupCode}]]></groupcode>`,
                `      <name><![CDATA[${translatedName}]]></name>`,
                `      <url><![CDATA[${productUrl}]]></url>`,
                `      <image><![CDATA[${productImageUrl}]]></image>`,
                `      <brand><![CDATA[${brand}]]></brand>`,
                `      <stock>${stock}</stock>`,
                `      <price>${price}</price>`,
                generateTweakwiseAttributesXml(product, lang.locale),
                "      <categories>",
                ...categoryIds.map((cid: string) => `        <categoryid>${cid}</categoryid>`),
                "      </categories>",
                "    </item>"
              ].join("\n"));
            }
          }
        } catch (error) {
          console.error(`Error processing market ${market.name}, locale ${lang.locale}:`, error);
          throw error;
        }
      }
    }
  }

  return [
    "<items>",
    allItems.join("\n"),
    "</items>"
  ].join("\n");
}
