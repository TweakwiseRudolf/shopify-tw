import { authenticate } from "app/shopify.server";
import { getShopBaseUrl, buildLocaleAwareUrl } from "./tweakwiseUrlBuilder.server";

export async function fetchCollectionsAndGenerateCategoriesXml(request: Request, markets: any) {
  const { admin } = await authenticate.admin(request);
  
  // Get base URL once
  const baseUrl = await getShopBaseUrl(request);

  // Generate <categories> XML block
  const rootCategoryId = "1";
  const categoriesXml = [
    [
      "    <category>",
      `      <categoryid>${rootCategoryId}</categoryid>`,
      "      <name><![CDATA[root]]></name>",
      "      <rank>0</rank>",
      "    </category>"
    ].join("\n")
  ];

  for (const market of markets) {
    const marketId = market.marketId;
    categoriesXml.push([
      "    <category>",
      `      <categoryid>${marketId}</categoryid>`,
      `      <name><![CDATA[${market.name}]]></name>`,
      "      <rank>1</rank>",
      "      <parents>",
      `        <categoryid>${rootCategoryId}</categoryid>`,
      "      </parents>",
      "    </category>"
    ].join("\n"));

    for (const lang of market.locales) {
      const langId = lang.langId;
      categoriesXml.push([
        "    <category>",
        `      <categoryid>${langId}</categoryid>`,
        `      <name><![CDATA[${lang.name}]]></name>`,
        "      <rank>2</rank>",
        "      <parents>",
        `        <categoryid>${marketId}</categoryid>`,
        "      </parents>",
        "    </category>"
      ].join("\n"));

      // Fetch collections in the correct language for this market/locale
      let hasNextPage = true;
      let cursor: string | null = null;
      while (hasNextPage) {
        const collectionsResponse = await admin.graphql(
          `#graphql
            query GetCollections($cursor: String, $locale: String!) {
              collections(first: 100, after: $cursor) {
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
          { variables: { cursor, locale: lang.locale } }
        );
        const collectionsJson: any = await collectionsResponse.json();
        const collections = collectionsJson.data.collections;
        hasNextPage = collections.pageInfo.hasNextPage;
        cursor = collections.edges.length > 0 ? collections.edges[collections.edges.length - 1].cursor : null;

        for (const edge of collections.edges) {
          const col = edge.node;
          const collectionShortId = col.id.split('/').pop();
          const cleanId = `${langId}_${collectionShortId}`;
          const translatedTitle = col.translations?.find((t: any) => t.key === "title")?.value || col.title;
          const translatedHandle = col.translations?.find((t: any) => t.key === "handle")?.value || col.handle;

          // Use centralized URL builder
          const collectionUrl = buildLocaleAwareUrl(
            baseUrl,
            lang.locale,
            market.locales,
            `/collections/${translatedHandle}`
          );

          categoriesXml.push([
            "    <category>",
            `      <categoryid>${cleanId}</categoryid>`,
            `      <name><![CDATA[${translatedTitle}]]></name>`,
            `      <url><![CDATA[${collectionUrl}]]></url>`,
            `      <rank>3</rank>`,
            "      <parents>",
            `        <categoryid>${langId}</categoryid>`,
            "      </parents>",
            "    </category>"
          ].join("\n"));
        }
      }
    }
  }

  return [
    "<categories>",
    ...categoriesXml,
    "</categories>"
  ].join("\n");
}
