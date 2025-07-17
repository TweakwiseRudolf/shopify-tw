import { authenticate } from "app/shopify.server";
import { generateTweakwiseAttributesXml } from "app/tweakwiseAttributes.server";

export async function fetchAllProductsXml(request: Request) {
  const { admin } = await authenticate.admin(request);
  let hasNextPage = true;
  let cursor: string | null = null;
  const allProducts: any[] = [];
  while (hasNextPage) {
    const response = await admin.graphql(
      `#graphql
        query GetProducts($cursor: String) {
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
                  edges {
                    node {
                      url
                    }
                  }
                }
                variants(first: 1) {
                  edges {
                    node {
                      price
                      sku
                    }
                  }
                }
                collections(first: 100) {
                  edges {
                    node {
                      id
                      title
                      handle
                    }
                  }
                }
                seo {
                  title
                  description
                }
                onlineStoreUrl
                metafields(first: 10) {
                  edges {
                    node {
                      namespace
                      key
                      value
                    }
                  }
                }
                options {
                  name
                  values
                }
                tags
                createdAt
                updatedAt
                publishedAt
              }
            }
          }
        }`,
      { variables: { cursor } },
    );
    const responseJson: any = await response.json();
    console.log('Shopify GraphQL response:', JSON.stringify(responseJson, null, 2));
    const products = responseJson.data!.products;
    allProducts.push(...products.edges.map((edge: any) => edge.node));
    hasNextPage = products.pageInfo.hasNextPage;
    cursor = products.edges[products.edges.length - 1].cursor;
  }

  // Generate Tweakwise-compliant <products> XML
  // See: https://docs.tweakwise.com/docs/create-an-xml-feed-to-import-product-data-in-tweakwise
  const itemsXml = allProducts.map((product: any) => {
    const itemId = product.id.replace('gid://shopify/Product/', '');
    const name = product.title;
    const url = product.onlineStoreUrl ? product.onlineStoreUrl : `/products/${product.handle}`;
    const brand = product.vendor || "";
    const stock = typeof product.totalInventory === "number" ? product.totalInventory : "";
    const imageUrl = product.images.edges.length > 0 ? product.images.edges[0].node.url : "";
    const price = (product.variants.edges.length > 0 && product.variants.edges[0].node.price)
      ? product.variants.edges[0].node.price
      : "0";
    const categoryIds = product.collections.edges.map((edge: any) => edge.node.id.replace('gid://shopify/Collection/', ''));
    return [
      "    <item>",
      `      <id><![CDATA[${itemId}]]></id>`,
      `      <name><![CDATA[${name}]]></name>`,
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
    ].join("\n");
  }).join("\n");

  return [
    "<items>",
    itemsXml,
    "</items>"
  ].join("\n");
// Removed stray closing brace
}
