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
  // All variant SKUs, prices, weights, weightUnits, availableForSale, compareAtPrice, requiresShipping
  if (product.variants && product.variants.edges.length > 0) {
    for (const edge of product.variants.edges) {
      const v = edge.node;
      if (v.sku) {
        attributes.push(
          "        <attribute>",
          "          <name>sku</name>",
          `          <value><![CDATA[${v.sku}]]></value>`,
          "        </attribute>"
        );
      }
      if (v.price) {
        attributes.push(
          "        <attribute>",
          "          <name>price</name>",
          `          <value><![CDATA[${v.price}]]></value>`,
          "        </attribute>"
        );
      }
      if (v.weight) {
        attributes.push(
          "        <attribute>",
          "          <name>weight</name>",
          `          <value><![CDATA[${v.weight}]]></value>`,
          "        </attribute>"
        );
      }
      if (v.weightUnit) {
        attributes.push(
          "        <attribute>",
          "          <name>weightUnit</name>",
          `          <value><![CDATA[${v.weightUnit}]]></value>`,
          "        </attribute>"
        );
      }
      if (typeof v.availableForSale !== 'undefined') {
        attributes.push(
          "        <attribute>",
          "          <name>availableForSale</name>",
          `          <value><![CDATA[${v.availableForSale}]]></value>`,
          "        </attribute>"
        );
      }
      if (typeof v.compareAtPrice !== 'undefined' && v.compareAtPrice !== null) {
        attributes.push(
          "        <attribute>",
          "          <name>compareAtPrice</name>",
          `          <value><![CDATA[${v.compareAtPrice}]]></value>`,
          "        </attribute>"
        );
      }
      if (typeof v.requiresShipping !== 'undefined') {
        attributes.push(
          "        <attribute>",
          "          <name>requiresShipping</name>",
          `          <value><![CDATA[${v.requiresShipping}]]></value>`,
          "        </attribute>"
        );
      }
    }
  }
  // Price range info
  if (product.priceRange) {
    if (product.priceRange.minVariantPrice) {
      attributes.push(
        "        <attribute>",
        "          <name>minVariantPrice</name>",
        `          <value><![CDATA[${product.priceRange.minVariantPrice.amount} ${product.priceRange.minVariantPrice.currencyCode}]]></value>`,
        "        </attribute>"
      );
    }
    if (product.priceRange.maxVariantPrice) {
      attributes.push(
        "        <attribute>",
        "          <name>maxVariantPrice</name>",
        `          <value><![CDATA[${product.priceRange.maxVariantPrice.amount} ${product.priceRange.maxVariantPrice.currencyCode}]]></value>`,
        "        </attribute>"
      );
    }
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

  // Options: each option value as its own attribute with name 'option_{option.name}'
  if (product.options && product.options.length > 0) {
    for (const option of product.options) {
      if (option.values && option.values.length > 0) {
        for (const value of option.values) {
          attributes.push(
            "        <attribute>",
            `          <name>option_${option.name}</name>`,
            `          <value><![CDATA[${value}]]></value>`,
            "        </attribute>"
          );
        }
      }
    }
  }

  // Tags: each tag as its own attribute with name 'tags'
  if (product.tags && product.tags.length > 0) {
    for (const tag of product.tags) {
      attributes.push(
        "        <attribute>",
        "          <name>tags</name>",
        `          <value><![CDATA[${tag}]]></value>`,
        "        </attribute>"
      );
    }
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
