const LAYER_TYPES = new Set(["text", "image", "shape"]);

function validLayer(layer) {
  return (
    layer &&
    typeof layer === "object" &&
    !Array.isArray(layer) &&
    typeof layer.id === "string" &&
    layer.id.length > 0 &&
    LAYER_TYPES.has(layer.type) &&
    [layer.x, layer.y, layer.width, layer.height, layer.rotation, layer.opacity].every(
      Number.isFinite,
    ) &&
    layer.width > 0 &&
    layer.height > 0 &&
    typeof layer.visible === "boolean" &&
    typeof layer.locked === "boolean"
  );
}

export function normalizePostCanvasLayers(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, layers]) => Array.isArray(layers))
      .map(([slideId, layers]) => [
        slideId,
        layers.filter(validLayer).map((layer) => structuredClone(layer)),
      ]),
  );
}
