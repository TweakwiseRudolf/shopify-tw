import { authenticate } from "app/shopify.server";
import { generateTweakwiseAttributesXml } from "app/tweakwiseAttributes.server";
import pLimit from "p-limit";

export async function fetchAllProductsXml(request: Request, markets: any) {
  const { admin } = await authenticate.admin(request);

  // Limit concurrency to 3 (safe for Shopify Admin API)
  const limit = pLimit(3);

  const allItems: string[] = [];

  // Prepare all market/locale jobs
  const jobs: Promise<void>[] = [];
  for (const market of markets) {
    const marketId = market.marketId;
    for (const lang of market.locales) {
      const langId = lang.langId;

      jobs.push(limit(async () => {
        let hasNextPage = true;
        let cursor: string | null = null;

        while (hasNextPage) {
          const response = await admin.graphql(
            `#graphql
              query GetProducts($cursor: String, $locale: String!) {
                products(first: 100, after: $cursor) {
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
                      variants(first: 1) {
                        edges { node { price sku } }
                      }
                      collections(first: 100) {
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
            { variables: { cursor, locale: lang.locale } }
          );
          const responseJson: any = await response.json();
          const products = responseJson.data.products;
          hasNextPage = products.pageInfo.hasNextPage;
          cursor = products.edges.length > 0 ? products.edges[products.edges.length - 1].cursor : null;

          for (const edge of products.edges) {
            const product = edge.node;
            const translatedName = product.translations?.find((t: any) => t.key === "title")?.value || product.title;

            const itemId = `${langId}_${product.id.replace('gid://shopify/Product/', '')}`;
            const url = product.onlineStoreUrl ? product.onlineStoreUrl : `/products/${product.handle}`;
            const brand = product.vendor || "";
            const stock = typeof product.totalInventory === "number" ? product.totalInventory : "";
            const imageUrl = product.images.edges.length > 0 ? product.images.edges[0].node.url : "";
            const price = (product.variants.edges.length > 0 && product.variants.edges[0].node.price)
              ? product.variants.edges[0].node.price
              : "0";
            // Prefix categoryId with langId
            const categoryIds = product.collections.edges.map((edge: any) => {
              const collectionShortId = edge.node.id.split('/').pop();
              return `${langId}_${collectionShortId}`;
            });

            allItems.push([
              "    <item>",
              `      <id><![CDATA[${itemId}]]></id>`,
              `      <name><![CDATA[${translatedName}]]></name>`,
              `      <url><![CDATA[${url}]]></url>`,
              `      <image><![CDATA[${imageUrl}]]></image>`,
              `      <brand><![CDATA[${brand}]]></brand>`,
              `      <stock>${stock}</stock>`,
              `      <price>${price}</price>`,
              generateTweakwiseAttributesXml(product),
              "      <categories>",
              ...categoryIds.map((cid: string) => `        <categoryid>${cid}</categoryid>`),
              "      </categories>",
              "    </item>"
            ].join("\n"));
          }
        }
      }));
    }
  }

  // Await all jobs
  await Promise.all(jobs);

  return [
    "<items>",
    allItems.join("\n"),
    "</items>"
  ].join("\n");
}
