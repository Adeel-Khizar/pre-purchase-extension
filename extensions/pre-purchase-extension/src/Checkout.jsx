import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

export default function () {
  render(<Extension />, document.body);
}

function Extension() {
  const { applyCartLinesChange, query, i18n, lines } = shopify;

  const [product, setProduct] = useState(null);
  const [triggerProductIds, setTriggerProductIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showError, setShowError] = useState(false);

  const bannerTitle =
    shopify.settings.value.headline ?? "Priority & Insured Shipping";

  const productTitle =
    shopify.settings.value.product_headline ?? "Priority & Insured Shipping";

  const featuredHandle =
    shopify.settings.value.product_handle ?? "priority-insured-shipping";

  const triggerHandlesSetting =
    shopify?.settings?.value?.trigger_product_handles || "natures-roots-lymphatic-drops™";

  //console.log("Customizer handles raw:", triggerHandlesSetting);

  const triggerHandles = [
      featuredHandle,
      ...triggerHandlesSetting
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean),
  ];

  //console.log("Parsed trigger handles:", triggerHandles);

  /* ---------------- FETCH PRODUCTS ---------------- */

  useEffect(() => {
    fetchProductByHandle(featuredHandle);
    if (triggerHandles.length > 0) {
      fetchTriggerProducts(triggerHandles);
    }
  }, []);

  /* ---------------- ERROR TIMER ---------------- */

  useEffect(() => {
    if (showError) {
      const timer = setTimeout(() => setShowError(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showError]);

  /* ---------------- FETCH SHIPPING PRODUCT ---------------- */

  async function fetchProductByHandle(handle) {
    setLoading(true);

    try {
      const { data } = await query(`
        query {
          product(handle: "${handle}") {
            id
            title
            handle
            description
            images(first: 1) {
              nodes { url }
            }
            variants(first: 1) {
              nodes {
                id
                price { amount }
              }
            }
          }
        }
      `);

      //console.log("Shipping product:", data.product);

      if (data?.product) setProduct(data.product);
    } catch (error) {
      console.error("Error fetching product:", error);
    } finally {
      setLoading(false);
    }
  }

  /* ---------------- FETCH TRIGGER PRODUCTS ---------------- */

  async function fetchTriggerProducts(handles) {
    //console.log("Handles sent to fetch:", handles);

    if (!handles.length) return;

    try {
      const queries = handles
        .map(
          (handle, i) => `
          p${i}: product(handle: "${handle}") {
            id
          }
        `
        )
        .join("");

      //console.log("GraphQL query:", queries);

      const { data } = await query(`query { ${queries} }`);

      //console.log("GraphQL result:", data);

      const ids = Object.values(data)
        .filter(Boolean)
        .map((p) => p.id);

      //console.log("Trigger product IDs:", ids);

      setTriggerProductIds(ids);
    } catch (error) {
      console.error("Error fetching trigger products:", error);
    }
  }

  /* ---------------- CART FUNCTIONS ---------------- */

  async function handleAddToCart(variantId) {
    setProcessing(true);

    const result = await applyCartLinesChange({
      type: "addCartLine",
      merchandiseId: variantId,
      quantity: 1,
    });

    setProcessing(false);

    if (result.type === "error") {
      setShowError(true);
      console.error(result.message);
    }
  }

  async function handleRemoveFromCart(variantId) {
    const lineToRemove = lines.value.find(
      (item) => item.merchandise.id === variantId
    );

    if (!lineToRemove) return;

    setProcessing(true);

    const result = await applyCartLinesChange({
      type: "removeCartLine",
      id: lineToRemove.id,
      quantity: lineToRemove.quantity,
    });

    setProcessing(false);

    if (result.type === "error") {
      setShowError(true);
      console.error(result.message);
    }
  }

  /* ---------------- LOADING GUARDS ---------------- */

  if (loading) return <LoadingSkeleton />;
  if (!product) return null;

  const variantId = product.variants.nodes[0].id;

  const isInCart = lines.value.some(
    (line) => line.merchandise.id === variantId
  );

  //console.log("Cart lines:", lines.value);

  /* ---------------- SHOW OFFER CHECK ---------------- */

  const shouldShowOffer = lines.value.some((line) => {
    const cartProductId = line.merchandise.product.id;

    //console.log("Checking cart product:", cartProductId);

    const match = triggerProductIds.includes(cartProductId);

    //console.log("Match found:", match);

    return match;
  });

  //console.log("Should show offer:", shouldShowOffer);

  if (!shouldShowOffer) return null;

  /* ---------------- AUTO ADD SHIPPING ---------------- */

  useEffect(() => {
    console.log("Auto add check:", {
      productLoaded: !!product,
      isInCart,
      processing,
    });

    if (product && !isInCart && !processing) {
      //console.log("Adding shipping product to cart");
      handleAddToCart(variantId);
    }
  }, [product, isInCart]);

  /* ---------------- UI ---------------- */

  return (
    <ProductOffer
      bannerTitle={bannerTitle}
      productTitle={productTitle}
      product={product}
      i18n={i18n}
      processing={processing}
      showError={showError}
      isInCart={isInCart}
      onAdd={() => handleAddToCart(variantId)}
      onRemove={() => handleRemoveFromCart(variantId)}
    />
  );
}

/* ---------------- SKELETON ---------------- */

function LoadingSkeleton() {
  return (
    <s-stack gap="large-200">
      <s-divider />
      <s-heading>You might also like</s-heading>

      <s-stack gap="base">
        <s-grid
          gap="base"
          gridTemplateColumns="64px 1fr auto"
          alignItems="center"
        >
          <s-image loading="lazy" />

          <s-stack gap="none">
            <s-skeleton-paragraph />
            <s-skeleton-paragraph />
          </s-stack>

          <s-button variant="secondary" disabled>
            Add
          </s-button>
        </s-grid>
      </s-stack>
    </s-stack>
  );
}

/* ---------------- OFFER UI ---------------- */

function ProductOffer({
  bannerTitle,
  productTitle,
  product,
  i18n,
  processing,
  showError,
  isInCart,
  onAdd,
  onRemove,
}) {
  const { images, title, description } = product;

  const imageUrl =
    images?.nodes?.[0]?.url ??
    "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png";

  function handleToggle(e) {
    const checked = e.target.checked;

    if (checked) onAdd();
    else onRemove();
  }

  return (
    <s-stack gap="small-100" paddingBlockStart="small-100">
      <s-text type="strong">{bannerTitle}</s-text>

      <s-grid
        border="base"
        borderRadius="base"
        padding="base"
        gap="base"
        gridTemplateColumns="40px 1fr auto"
        alignItems="start"
      >
        <s-image
          src={imageUrl}
          aspectRatio="1"
          borderRadius="small-100"
          alt={title}
          inlineSize="fill"
        />

        <s-stack>
          <s-text type="strong">{productTitle}</s-text>
          <s-paragraph type="small" color="subdued">
            {description}
          </s-paragraph>
        </s-stack>

        <s-checkbox
          checked={isInCart}
          onChange={handleToggle}
          disabled={processing}
        />
      </s-grid>

      {showError && <ErrorBanner />}
    </s-stack>
  );
}

function ErrorBanner() {
  return (
    <s-banner tone="critical">
      There was an issue updating your cart. Please try again.
    </s-banner>
  );
}