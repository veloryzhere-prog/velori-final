import assert from "node:assert/strict";
import test from "node:test";
import {
  BLEND_MODES,
  FILTER_PRESETS,
  SHAPE_LIBRARY,
  applyBlendMode,
  applyColorPreset,
  applyFilterPreset,
  createBackground,
  createIconLayer,
  createImageLayer,
  createShapeLayer,
  createTextLayer,
  getBlendModes,
  getEyedropperColor,
  getFilterPresetNames,
  getShapeLibrary,
  groupLayers,
  parseColor,
  searchIcons,
  ungroupLayers,
} from "./tools.mjs";

test("text tool creates a styled text layer", () => {
  const layer = createTextLayer({
    name: "Headline",
    x: 80,
    y: 96,
    text: {
      content: "Launch",
      fontFamily: "Inter",
      fontSize: 56,
      color: "#f472b6",
      align: "center",
      letterSpacing: 4,
      lineHeight: 1.1,
    },
  });

  assert.equal(layer.type, "text");
  assert.equal(layer.name, "Headline");
  assert.equal(layer.text.content, "Launch");
  assert.equal(layer.text.color, "#f472b6");
  assert.equal(layer.text.letterSpacing, 4);
});

test("image tool creates an image layer with adjustment values", () => {
  const layer = createImageLayer({
    name: "Cover image",
    x: 20,
    y: 32,
    image: {
      src: "/images/hero.png",
      fit: "cover",
      rotation: 12,
      brightness: 120,
      contrast: 90,
      saturation: 110,
      blur: 2,
      opacity: 0.85,
    },
  });

  assert.equal(layer.type, "image");
  assert.equal(layer.image.src, "/images/hero.png");
  assert.equal(layer.image.rotation, 12);
  assert.equal(layer.image.brightness, 120);
  assert.equal(layer.image.opacity, 0.85);
});

test("shape tool includes a large shape library and creates a valid shape layer", () => {
  const shapes = getShapeLibrary();
  const layer = createShapeLayer({
    name: "Badge",
    shape: { shapeType: "star", fill: "#4f46e5", stroke: "#0f172a", strokeWidth: 3, radius: 16 },
  });

  assert.ok(shapes.length >= 50);
  assert.ok(SHAPE_LIBRARY.includes("star"));
  assert.equal(layer.type, "shape");
  assert.equal(layer.shape.shapeType, "star");
  assert.equal(layer.shape.fill, "#4f46e5");
});

test("icon tool searches and creates recolorable icon layers", () => {
  const matches = searchIcons("star");
  const layer = createIconLayer({
    name: "Star icon",
    iconName: "star",
    x: 180,
    y: 220,
    tint: "#eab308",
  });

  assert.ok(matches.includes("star"));
  assert.equal(layer.kind, "icon");
  assert.equal(layer.iconName, "star");
  assert.equal(layer.tint, "#eab308");
});

test("color tools normalize and convert colors", () => {
  const parsed = parseColor("#ff8800");
  assert.equal(parsed.hex, "#ff8800");
  assert.deepEqual(parsed.rgb, { r: 255, g: 136, b: 0 });
  assert.equal(getEyedropperColor("#ff8800"), "#ff8800");

  const recolored = applyColorPreset(
    createTextLayer({ text: { content: "Hi", color: "#000000" } }),
    "#22c55e",
  );
  assert.equal(recolored.text.color, "#22c55e");
});

test("background tool supports solid, gradient, image, and pattern backgrounds", () => {
  const solid = createBackground({ type: "solid", color: "#fdf2f8" });
  const gradient = createBackground({
    type: "gradient",
    mode: "linear",
    angle: 45,
    stops: [
      { offset: 0, color: "#ffffff" },
      { offset: 1, color: "#dbeafe" },
    ],
  });
  const pattern = createBackground({ type: "pattern", pattern: "dots", size: 20 });

  assert.equal(solid.type, "solid");
  assert.equal(gradient.mode, "linear");
  assert.equal(gradient.stops.length, 2);
  assert.equal(pattern.pattern, "dots");
});

test("filter presets and blend modes are available and apply to layers", () => {
  const names = getFilterPresetNames();
  const preset = applyFilterPreset(createImageLayer({ name: "Filtered image" }), "cinematic");
  const blended = applyBlendMode(createTextLayer({ name: "Layer" }), "multiply");

  assert.ok(names.length >= 20);
  assert.ok(FILTER_PRESETS.cinematic);
  assert.equal(preset.filter.id, "cinematic");
  assert.equal(blended.blendMode, "multiply");
  assert.ok(getBlendModes().includes("screen"));
  assert.ok(BLEND_MODES.includes("overlay"));
});

test("grouping helpers create and return member ids", () => {
  const layers = [
    createTextLayer({ name: "A", x: 0, y: 0 }),
    createShapeLayer({ name: "B", x: 100, y: 50 }),
    createImageLayer({ name: "C", x: 60, y: 130 }),
  ];

  const group = groupLayers(layers);
  const ungroupped = ungroupLayers(group);

  assert.equal(group.type, "group");
  assert.equal(ungroupped.length, 3);
  assert.ok(group.members.includes(layers[0].id));
});
