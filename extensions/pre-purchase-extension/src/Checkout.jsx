import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

export default function () {
  render(<Extension />, document.body);
}

function Extension() {
  const { applyCartLinesChange, query, i18n, lines } = shopify;
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    fetchProductByHandle("shipping-protection-2");
  }, []);

  useEffect(() => {
    if (showError) {
      const timer = setTimeout(() => setShowError(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showError]);

  // ✅ Only fetch the product you actually need
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
              nodes {
                url
              }
            }
            variants(first: 1) {
              nodes {
                id
                price {
                  amount
                }
              }
            }
          }
        }
      `);

      if (data?.product) {
        setProduct(data.product);
      } else {
        setProduct(null);
      }
    } catch (error) {
      console.error("Error fetching product:", error);
    } finally {
      setLoading(false);
    }
  }

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

  if (loading) return <LoadingSkeleton />;
  if (!product) return null;

  const variantId = product.variants.nodes[0].id;
  const isInCart = lines.value.some((line) => line.merchandise.id === variantId);

  // ✅ Auto-add logic if needed
  useEffect(() => {
    if (product && !isInCart && !processing) {
      handleAddToCart(variantId);
    }
  }, [product]);

  return (
    <ProductOffer
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

function ProductOffer({
  product,
  i18n,
  processing,
  showError,
  isInCart,
  onAdd,
  onRemove,
}) {
  if (!product) return null;

  const { images, title, description, variants } = product;
  const price = i18n.formatCurrency(variants.nodes[0].price.amount);
  const imageUrl =
    images?.nodes?.[0]?.url ??
    "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png?format=webp&v=1530129081";

  function handleToggle(e) {
    const checked = e.target.checked;
    if (checked) onAdd();
    else onRemove();
  }

  return (
    <s-stack gap="large-200" padding="base">
      <s-divider />
      <s-grid
        gap="base"
        gridTemplateColumns="1fr auto"
        alignItems="start"
      >
        <s-text type="strong">
          Add Insurance to your order? Just {price} extra!
        </s-text>
        <s-checkbox
          checked={isInCart}
          onChange={handleToggle}
          disabled={processing}
        />
      </s-grid>

      <s-grid
        gap="base"
        gridTemplateColumns="50px 1fr"
        alignItems="start"
      >
        <s-image
          src={imageUrl}
          aspectRatio="1"
          borderRadius="small-100"
          alt={title}
        />
        <s-stack gap="extra-tight">
          <s-text type="strong">{title}</s-text>
          <s-text size="small">{description}</s-text>
        </s-stack>
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
