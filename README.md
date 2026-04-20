# svg-element-bbox

Small TypeScript utility for calculating axis-aligned bounding boxes for individual SVG geometry elements.

It builds on [`svg-path-bbox`](https://github.com/mondeja/svg-path-bbox) and extends the same idea beyond `path` data to other common SVG shapes.

## Installation

```bash
pnpm add svg-element-bbox
```

You can also use `npm install svg-element-bbox` or `yarn add svg-element-bbox`.

## Usage

```ts
import { svgElementBbox } from "svg-element-bbox"

const bbox = svgElementBbox("rect", {
  x: "10",
  y: "20",
  width: "100",
  height: "40",
  stroke: "black",
  "stroke-width": "2",
})

// [9, 19, 111, 61]
```

The return value is:

- `[minX, minY, maxX, maxY]` when the element can be measured
- `null` when the element is unsupported or required geometry attributes are missing/invalid

## Supported Elements

- `path`
- `rect`
- `image`
- `circle`
- `ellipse`
- `line`
- `polyline`
- `polygon`

## API

```ts
svgElementBbox(
  elementName: string,
  attributes: Record<string, string>,
  groupTreeAttributes?: readonly Record<string, string>[],
): [number, number, number, number] | null
```

- `elementName`: SVG element name such as `"path"` or `"rect"`
- `attributes`: element attributes as string values, for example `{ cx: "24", cy: "24", r: "12" }`
- `groupTreeAttributes`: optional attributes from ancestor `<svg>` / `<g>` containers, ordered from outermost to innermost

Example with inherited stroke from parent groups:

```ts
const bbox = svgElementBbox(
  "rect",
  { width: "10", height: "10" },
  [{ stroke: "black", "stroke-width": "4" }],
)

// [-2, -2, 12, 12]
```

## Notes

- The returned box includes visible stroke width.
- Stroke can come from element attributes, inline `style`, or inherited ancestor group attributes.
- `stroke-width` values can be plain numbers or pixel values such as `"2px"`.
- Bounds are axis-aligned and based on element geometry plus stroke inflation.
- Unsupported elements such as `svg`, `g`, and `text` return `null`.
- SVG transforms are not applied.

## License

MIT
