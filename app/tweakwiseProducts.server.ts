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

export async function fetchAllProductsXml(request: Request, markets: any) {
  const { admin } = await authenticate.admin(request);
  const baseUrl = await getShopBaseUrl(request);
  const allItems: string[] = [];

  // Process markets and locales sequentially to avoid rate limits
  for (const market of markets) {
    for (const lang of market.locales) {
      console.log(`Processing market: ${market.name}, locale: ${lang.locale}`);
      await processMarketLocale(market, lang, admin, baseUrl, allItems);
    }
  }

  return [
    "<items>",
    allItems.join("\n"),
    "</items>"
  ].join("\n");

  // Handles pagination and fetches products for a specific market/locale
  async function processMarketLocale(market: any, lang: any, admin: any, baseUrl: string, allItems: string[]) {
    const langId = lang.langId;
    let hasNextPage = true;
    let cursor: string | null = null;

    while (hasNextPage) {
      await sleep(500);

      try {
        const responseJson = await fetchProducts(admin, cursor, lang.locale);
        const products = responseJson.data.products;
        
        hasNextPage = products.pageInfo.hasNextPage;
        cursor = products.edges.length > 0 ? products.edges[products.edges.length - 1].cursor : null;

        processProducts(products.edges, market, lang, langId, baseUrl, allItems);
        
      } catch (error) {
        console.error(`Error processing market ${market.name}, locale ${lang.locale}:`, error);
        throw error;
      }
    }
  }

  // Executes GraphQL query to fetch products with translations and variants
  async function fetchProducts(admin: any, cursor: string | null, locale: string) {
    return await makeGraphQLRequestWithRetry(
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
      { cursor, locale }
    );
  }

  // Processes each product and determines if it has variants
  function processProducts(productEdges: any[], market: any, lang: any, langId: string, baseUrl: string, allItems: string[]) {
    productEdges.forEach(edge => {
      const product = edge.node;
      const productData = extractProductData(product, lang, langId);
      
      if (product.variants.edges.length > 0) {
        processProductVariants(product, productData, market, lang, langId, baseUrl, allItems);
      } else {
        processProductWithoutVariants(product, productData, market, lang, langId, baseUrl, allItems);
      }
    });
  }

  // Extracts common product information used by both variants and non-variant products
  function extractProductData(product: any, lang: any, langId: string) {
    const translatedName = getTranslatedValue(product.translations, "title", product.title);
    const translatedHandle = getTranslatedValue(product.translations, "handle", product.handle);
    const productShortId = product.id.replace('gid://shopify/Product/', '');
    const groupCode = `${langId}_${productShortId}`;
    const brand = product.vendor || "";
    const productImageUrl = product.images.edges.length > 0 ? product.images.edges[0].node.url : "";
    const categoryIds = extractCategoryIds(product.collections.edges, langId);

    return {
      translatedName,
      translatedHandle,
      productShortId,
      groupCode,
      brand,
      productImageUrl,
      categoryIds
    };
  }

  // Creates category IDs by prefixing with language ID
  function extractCategoryIds(collectionEdges: any[], langId: string): string[] {
    return collectionEdges.map((edge: any) => {
      const collectionShortId = edge.node.id.split('/').pop();
      return `${langId}_${collectionShortId}`;
    });
  }

  // Gets translated value from translations array or returns fallback
  function getTranslatedValue(translations: any[], key: string, fallback: string): string {
    return translations?.find((t: any) => t.key === key)?.value || fallback;
  }

  // Creates XML items for each product variant
  function processProductVariants(product: any, productData: any, market: any, lang: any, langId: string, baseUrl: string, allItems: string[]) {
    product.variants.edges.forEach((variantEdge: any) => {
      const variant = variantEdge.node;
      const variantData = extractVariantData(variant, productData, langId);
      const variantUrl = buildVariantUrl(baseUrl, lang, market, productData.translatedHandle, variantData.variantShortId);
      
      allItems.push(createItemXml(variantData, variantUrl, productData, product, lang.locale, variant));
    });
  }

  // Creates XML item for products without variants
  function processProductWithoutVariants(product: any, productData: any, market: any, lang: any, langId: string, baseUrl: string, allItems: string[]) {
    const productUrl = buildProductUrl(baseUrl, lang, market, productData.translatedHandle);
    const itemData = {
      itemId: productData.groupCode,
      name: productData.translatedName,
      stock: typeof product.totalInventory === "number" ? product.totalInventory : "",
      price: "0",
      imageUrl: productData.productImageUrl
    };
    
    allItems.push(createItemXml(itemData, productUrl, productData, product, lang.locale));
  }

  // Extracts variant-specific data including price, stock, and images
  function extractVariantData(variant: any, productData: any, langId: string) {
    const variantShortId = variant.id.replace('gid://shopify/ProductVariant/', '');
    const itemId = `${langId}_${variantShortId}`;
    const variantName = variant.title && variant.title !== "Default Title" 
      ? `${productData.translatedName} - ${variant.title}` 
      : productData.translatedName;
    const stock = typeof variant.inventoryQuantity === "number" ? variant.inventoryQuantity : "";
    const price = variant.price || "0";
    const imageUrl = variant.image?.url || productData.productImageUrl;

    return {
      variantShortId,
      itemId,
      name: variantName,
      stock,
      price,
      imageUrl
    };
  }

  // Builds URL for variant with variant parameter
  function buildVariantUrl(baseUrl: string, lang: any, market: any, handle: string, variantShortId: string): string {
    return buildLocaleAwareUrl(
      baseUrl,
      lang.locale,
      market.locales,
      `/products/${handle}?variant=${variantShortId}`
    );
  }

  // Builds standard product URL
  function buildProductUrl(baseUrl: string, lang: any, market: any, handle: string): string {
    return buildLocaleAwareUrl(
      baseUrl,
      lang.locale,
      market.locales,
      `/products/${handle}`
    );
  }

  // Creates XML structure for a single item
  function createItemXml(itemData: any, url: string, productData: any, product: any, locale: string, variant?: any): string {
    return [
      "    <item>",
      `      <id><![CDATA[${itemData.itemId}]]></id>`,
      `      <groupcode><![CDATA[${productData.groupCode}]]></groupcode>`,
      `      <name><![CDATA[${itemData.name}]]></name>`,
      `      <url><![CDATA[${url}]]></url>`,
      `      <image><![CDATA[${itemData.imageUrl}]]></image>`,
      `      <brand><![CDATA[${productData.brand}]]></brand>`,
      `      <stock>${itemData.stock}</stock>`,
      `      <price>${itemData.price}</price>`,
      generateTweakwiseAttributesXml(product, locale, variant),
      "      <categories>",
      ...productData.categoryIds.map((cid: string) => `        <categoryid>${cid}</categoryid>`),
      "      </categories>",
      "    </item>"
    ].join("\n");
  }
}
