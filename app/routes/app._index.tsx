import {
  Box,
  Card,
  Layout,
  Link,
  List,
  Page,
  Text,
  BlockStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { fetchCollectionsAndGenerateCategoriesXml } from "app/tweakwiseCategories.server";
import { fetchAllProductsXml } from "app/tweakwiseProducts.server";
import { useFetcher } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { fetchMarketsWithLocales } from "app/tweakwiseMarketsLocales.server";
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const markets = await fetchMarketsWithLocales(request);
  const categoriesXml = await fetchCollectionsAndGenerateCategoriesXml(request, markets);

  // Pass markets to fetchAllProductsXml
  const productsXml = await fetchAllProductsXml(request, markets);

  const xmlContent = `<?xml version="1.0" encoding="utf-8"?>\n<tweakwise>\n${categoriesXml}\n${productsXml}\n</tweakwise>`;

  // Save XML to public directory
  const fs = await import("fs");
  const path = await import("path");
  const publicDir = path.resolve(process.cwd(), "public");
  const xmlFileName = "shopify-tweakwise-feed.xml";
  const xmlFilePath = path.join(publicDir, xmlFileName);
  fs.writeFileSync(xmlFilePath, xmlContent, "utf8");

  return {
    xmlUrl: '/' + xmlFileName,
  };
}


export default function GenerateFeed() {
  const fetcher = useFetcher<typeof action>();
  const generateFeed = () => fetcher.submit({}, { method: "POST" });
  const xmlUrl = fetcher.data?.xmlUrl;
  return (
    <Page>
      <TitleBar title="Tweakwise Export" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd">
                Let's create a feed configuration for your store.
              </Text>
              <button variant="primary" onClick={generateFeed}>
                Generate the feed
              </button>
              {xmlUrl && (
                <Text as="p" variant="bodyMd">
                  XML Feed URL: <a href={xmlUrl} target="_blank" rel="noopener noreferrer">{xmlUrl}</a>
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}