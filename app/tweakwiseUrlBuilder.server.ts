import { authenticate } from "app/shopify.server";


export async function getShopBaseUrl(request: Request): Promise<string> {


  const { admin } = await authenticate.admin(request);
  const shopResponse = await admin.graphql(`
    {
      shop {
        primaryDomain {
          url
        }
      }
    }
  `);
  const shopJson = await shopResponse.json();
  return shopJson.data.shop.primaryDomain.url;
}

export function buildLocaleAwareUrl(
  baseUrl: string,
  locale: string,
  marketLocales: any[],
  path: string
): string {
  // Include locale only if market has multiple locales
  if (marketLocales.length > 1) {
    return `${baseUrl}/${locale}${path}`;
  } else {
    return `${baseUrl}${path}`;
  }
}