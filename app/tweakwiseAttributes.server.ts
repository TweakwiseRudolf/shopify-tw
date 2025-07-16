// tweakwiseAttributes.server.ts
// Generates the <attributes> XML block for a Tweakwise item, given a product object from Shopify

export function generateTweakwiseAttributesXml(product: any): string {
  // Example: always include item_type, but you can add more logic here
  const attributes: string[] = [];
  // item_type
  attributes.push(
    "        <attribute>",
    "          <name>item_type</name>",
    "          <value>product</value>",
    "        </attribute>"
  );

  // SEO title
  if (product.seo && product.seo.title) {
    attributes.push(
      "        <attribute>",
      "          <name>seo_title</name>",
      `          <value><![CDATA[${product.seo.title}]]></value>`,
      "        </attribute>"
    );
  }
  // SEO description
  if (product.seo && product.seo.description) {
    attributes.push(
      "        <attribute>",
      "          <name>seo_description</name>",
      `          <value><![CDATA[${product.seo.description}]]></value>`,
      "        </attribute>"
    );
  }
  // SKU (from first variant)
  if (product.variants && product.variants.edges.length > 0 && product.variants.edges[0].node.sku) {
    attributes.push(
      "        <attribute>",
      "          <name>sku</name>",
      `          <value><![CDATA[${product.variants.edges[0].node.sku}]]></value>`,
      "        </attribute>"
    );
  }
  // Metafields
  if (product.metafields && product.metafields.edges.length > 0) {
    for (const edge of product.metafields.edges) {
      const mf = edge.node;
      attributes.push(
        "        <attribute>",
        `          <name>metafield_${mf.namespace}_${mf.key}</name>`,
        `          <value><![CDATA[${mf.value}]]></value>`,
        "        </attribute>"
      );
    }
  }

  // Options
  if (product.options && product.options.length > 0) {
    for (const option of product.options) {
      attributes.push(
        "        <attribute>",
        `          <name>option_${option.name}</name>`,
        `          <value><![CDATA[${option.values.join(", ")}]]></value>`,
        "        </attribute>"
      );
    }
  }

  // Tags
  if (product.tags && product.tags.length > 0) {
    attributes.push(
      "        <attribute>",
      "          <name>tags</name>",
      `          <value><![CDATA[${product.tags.join(", ")}]]></value>`,
      "        </attribute>"
    );
  }

  // Date fields
  if (product.createdAt) {
    attributes.push(
      "        <attribute>",
      "          <name>createdAt</name>",
      `          <value><![CDATA[${product.createdAt}]]></value>`,
      "        </attribute>"
    );
  }
  if (product.updatedAt) {
    attributes.push(
      "        <attribute>",
      "          <name>updatedAt</name>",
      `          <value><![CDATA[${product.updatedAt}]]></value>`,
      "        </attribute>"
    );
  }
  if (product.publishedAt) {
    attributes.push(
      "        <attribute>",
      "          <name>publishedAt</name>",
      `          <value><![CDATA[${product.publishedAt}]]></value>`,
      "        </attribute>"
    );
  }
  return [
    "      <attributes>",
    ...attributes,
    "      </attributes>"
  ].join("\n");
}
