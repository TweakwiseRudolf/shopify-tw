// tweakwiseAttributes.server.ts
// Generates the <attributes> XML block for a Tweakwise item, given a product object from Shopify

export function generateTweakwiseAttributesXml(product: any, locale?: string, variant?: any): string {
  const attributes: string[] = [];

  // Adds an attribute to the attributes array
  function addAttribute(name: string, value: string) {
    attributes.push(
      "        <attribute>",
      `          <name>${name}</name>`,
      `          <value><![CDATA[${value}]]></value>`,
      "        </attribute>"
    );
  }

  // Gets translated value from product translations or returns fallback
  function getTranslatedValue(key: string, fallback: string): string {
    if (locale && product.translations) {
      const translation = product.translations.find((t: any) => t.key === key);
      return translation?.value || fallback;
    }
    return fallback;
  }

  // Safely adds variant attribute if value exists
  function addVariantAttribute(variant: any, field: string, attributeName?: string) {
    const name = attributeName || field;
    if (variant[field] !== undefined && variant[field] !== null && variant[field] !== '') {
      addAttribute(name, variant[field]);
    }
  }

  addAttribute("item_type", "product");

  addSeoAttributes();
  
  if (variant) {
    addVariantSpecificAttributes();
  } else {
    addAllVariantAttributes();
  }

  addMetafields();
  addProductOptions();
  addTags();
  addDateFields();

  return [
    "      <attributes>",
    ...attributes,
    "      </attributes>"
  ].join("\n");

  // Adds SEO title and description attributes
  function addSeoAttributes() {
    if (product.seo?.title) {
      const translatedSeoTitle = getTranslatedValue('seo_title', product.seo.title);
      addAttribute("seo_title", translatedSeoTitle);
    }
    if (product.seo?.description) {
      const translatedSeoDescription = getTranslatedValue('seo_description', product.seo.description);
      addAttribute("seo_description", translatedSeoDescription);
    }
  }

  // Adds attributes for a specific variant
  function addVariantSpecificAttributes() {
    const variantFields = ['sku', 'barcode', 'displayName', 'availableForSale', 'compareAtPrice'];
    
    variantFields.forEach(field => {
      addVariantAttribute(variant, field);
    });

    if (variant.selectedOptions?.length > 0) {
      variant.selectedOptions.forEach((option: any) => {
        addAttribute("selected_options", `${option.name}: ${option.value}`);
        addAttribute(option.name.toLowerCase(), option.value);
      });
    }
  }

  // Adds attributes from all variants when no specific variant is provided
  function addAllVariantAttributes() {
    if (product.variants?.edges?.length > 0) {
      const variantFields = ['sku', 'barcode', 'availableForSale', 'compareAtPrice'];
      
      product.variants.edges.forEach((edge: any) => {
        const v = edge.node;
        variantFields.forEach(field => {
          addVariantAttribute(v, field);
        });
      });
    }
  }

  // Adds product metafields as attributes
  function addMetafields() {
    if (product.metafields?.edges?.length > 0) {
      product.metafields.edges.forEach((edge: any) => {
        const mf = edge.node;
        const translatedValue = getTranslatedValue(`metafield_${mf.namespace}_${mf.key}`, mf.value);
        addAttribute(`metafield_${mf.namespace}_${mf.key}`, translatedValue);
      });
    }
  }

  // Adds product options when no specific variant is provided
  function addProductOptions() {
    if (!variant && product.options?.length > 0) {
      product.options.forEach((option: any) => {
        if (option.values?.length > 0) {
          option.values.forEach((value: string) => {
            const translatedValue = getTranslatedValue(`option_${option.name}`, value);
            addAttribute(`option_${option.name}`, translatedValue);
          });
        }
      });
    }
  }

  // Adds product tags as attributes
  function addTags() {
    if (product.tags?.length > 0) {
      product.tags.forEach((tag: string) => {
        const translatedTag = getTranslatedValue(`tag_${tag}`, tag);
        addAttribute("tags", translatedTag);
      });
    }
  }

  // Adds date fields as attributes
  function addDateFields() {
    const dateFields = ['createdAt', 'updatedAt', 'publishedAt'];
    dateFields.forEach(field => {
      if (product[field]) {
        addAttribute(field, product[field]);
      }
    });
  }
}
