// tweakwiseAttributes.server.ts
// Generates the <attributes> XML block for a Tweakwise item, given a product object from Shopify

export function generateTweakwiseAttributesXml(product: any, locale?: string, variant?: any): string {
  // Example: always include item_type, but you can add more logic here
  const attributes: string[] = [];
  // item_type
  attributes.push(
    "        <attribute>",
    "          <name>item_type</name>",
    "          <value>product</value>",
    "        </attribute>"
  );

  // Helper function to get translated value
  function getTranslatedValue(key: string, fallback: string): string {
    if (locale && product.translations) {
      const translation = product.translations.find((t: any) => t.key === key);
      return translation?.value || fallback;
    }
    return fallback;
  }

  // SEO title (translated)
  if (product.seo && product.seo.title) {
    const translatedSeoTitle = getTranslatedValue('seo_title', product.seo.title);
    attributes.push(
      "        <attribute>",
      "          <name>seo_title</name>",
      `          <value><![CDATA[${translatedSeoTitle}]]></value>`,
      "        </attribute>"
    );
  }

  // SEO description (translated)
  if (product.seo && product.seo.description) {
    const translatedSeoDescription = getTranslatedValue('seo_description', product.seo.description);
    attributes.push(
      "        <attribute>",
      "          <name>seo_description</name>",
      `          <value><![CDATA[${translatedSeoDescription}]]></value>`,
      "        </attribute>"
    );
  }

  // If variant is provided, use variant-specific data; otherwise use all variants
  if (variant) {
    // Single variant attributes
    if (variant.sku) {
      attributes.push(
        "        <attribute>",
        "          <name>sku</name>",
        `          <value><![CDATA[${variant.sku}]]></value>`,
        "        </attribute>"
      );
    }
    if (variant.barcode) {
      attributes.push(
        "        <attribute>",
        "          <name>barcode</name>",
        `          <value><![CDATA[${variant.barcode}]]></value>`,
        "        </attribute>"
      );
    }
    if (variant.displayName) {
      attributes.push(
        "        <attribute>",
        "          <name>displayName</name>",
        `          <value><![CDATA[${variant.displayName}]]></value>`,
        "        </attribute>"
      );
    }
    if (typeof variant.availableForSale !== 'undefined') {
      attributes.push(
        "        <attribute>",
        "          <name>availableForSale</name>",
        `          <value><![CDATA[${variant.availableForSale}]]></value>`,
        "        </attribute>"
      );
    }
    if (typeof variant.compareAtPrice !== 'undefined' && variant.compareAtPrice !== null) {
      attributes.push(
        "        <attribute>",
        "          <name>compareAtPrice</name>",
        `          <value><![CDATA[${variant.compareAtPrice}]]></value>`,
        "        </attribute>"
      );
    }
    
    // Variant selected options - these make the variant unique
    if (variant.selectedOptions && variant.selectedOptions.length > 0) {
      for (const option of variant.selectedOptions) {
        // Add combined format: selected_options with "option_name: option_value"
        attributes.push(
          "        <attribute>",
          "          <name>selected_options</name>",
          `          <value><![CDATA[${option.name}: ${option.value}]]></value>`,
          "        </attribute>"
        );
        
        // Add individual option as separate attribute
        attributes.push(
          "        <attribute>",
          `          <name>${option.name.toLowerCase()}</name>`,
          `          <value><![CDATA[${option.value}]]></value>`,
          "        </attribute>"
        );
      }
    }
  } else {
    // All variant attributes (fallback for products without specific variant)
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
        if (v.barcode) {
          attributes.push(
            "        <attribute>",
            "          <name>barcode</name>",
            `          <value><![CDATA[${v.barcode}]]></value>`,
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
      }
    }
  }

  // Metafields (translated)
  if (product.metafields && product.metafields.edges.length > 0) {
    for (const edge of product.metafields.edges) {
      const mf = edge.node;
      const translatedMetafieldValue = getTranslatedValue(`metafield_${mf.namespace}_${mf.key}`, mf.value);
      attributes.push(
        "        <attribute>",
        `          <name>metafield_${mf.namespace}_${mf.key}</name>`,
        `          <value><![CDATA[${translatedMetafieldValue}]]></value>`,
        "        </attribute>"
      );
    }
  }

  // Product options (if no specific variant provided)
  if (!variant && product.options && product.options.length > 0) {
    for (const option of product.options) {
      if (option.values && option.values.length > 0) {
        for (const value of option.values) {
          const translatedOptionValue = getTranslatedValue(`option_${option.name}`, value);
          attributes.push(
            "        <attribute>",
            `          <name>option_${option.name}</name>`,
            `          <value><![CDATA[${translatedOptionValue}]]></value>`,
            "        </attribute>"
          );
        }
      }
    }
  }

  // Tags: each tag as its own attribute with name 'tags' (translated)
  if (product.tags && product.tags.length > 0) {
    for (const tag of product.tags) {
      const translatedTag = getTranslatedValue(`tag_${tag}`, tag);
      attributes.push(
        "        <attribute>",
        "          <name>tags</name>",
        `          <value><![CDATA[${translatedTag}]]></value>`,
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
