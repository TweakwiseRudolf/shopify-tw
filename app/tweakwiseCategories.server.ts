import { authenticate } from "app/shopify.server";

export async function fetchCollectionsAndGenerateCategoriesXml(request: Request) {
  const { admin } = await authenticate.admin(request);
  // Fetch custom collections
  let hasNextPage = true;
  let cursor: string | null = null;
  const allCollections: any[] = [];
  while (hasNextPage) {
    const response = await admin.graphql(
      `#graphql
        query GetCollections($cursor: String) {
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
              }
            }
          }
        }`,
      { variables: { cursor } },
    );
    const responseJson: any = await response.json();
    const collections = responseJson.data!.collections;
    allCollections.push(...collections.edges.map((edge: any) => edge.node));
    hasNextPage = collections.pageInfo.hasNextPage;
    cursor = collections.edges[collections.edges.length - 1].cursor;
  }

  // Generate <categories> XML block
  const rootCategoryId = "1";
  let rank = 1;
  const categoriesXml = [
    [
      "    <category>",
      `      <categoryid>${rootCategoryId}</categoryid>`,
      "      <name><![CDATA[root]]></name>",
      "      <rank>0</rank>",
      "    </category>"
    ].join("\n")
  ];
  for (const col of allCollections) {
    const cleanId = col.id.replace('gid://shopify/Collection/', '');
    categoriesXml.push([
      "    <category>",
      `      <categoryid>${cleanId}</categoryid>`,
      `      <name><![CDATA[${col.title}]]></name>`,
      `      <url><![CDATA[/collections/${col.handle}]]></url>`,
      `      <rank>${rank}</rank>`,
      "      <parents>",
      `        <categoryid>${rootCategoryId}</categoryid>`,
      "      </parents>",
      "    </category>"
    ].join("\n"));
    rank++;
  }
  return [
    "<categories>",
    ...categoriesXml,
    "</categories>"
  ].join("\n");
}
