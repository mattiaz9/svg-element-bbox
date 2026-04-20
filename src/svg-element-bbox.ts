import { svgPathBbox } from "svg-path-bbox"

interface SvgStrokeState {
  stroke: string
  strokeWidth: number
}

function initialSvgStrokeState(): SvgStrokeState {
  return { stroke: "none", strokeWidth: 1 }
}

function parseInlineStyleStroke(style: string): { stroke?: string; strokeWidth?: string } {
  const out: { stroke?: string; strokeWidth?: string } = {}
  for (const decl of style.split(";")) {
    const idx = decl.indexOf(":")
    if (idx === -1) continue
    const prop = decl.slice(0, idx).trim().toLowerCase()
    const val = decl.slice(idx + 1).trim()
    if (prop === "stroke") out.stroke = val
    if (prop === "stroke-width") out.strokeWidth = val
  }
  return out
}

function parseStrokeWidthValue(raw: string): number | null {
  const t = raw.trim()
  const n = Number(t)
  if (Number.isFinite(n)) return n
  const px = /^([\d.]+)px$/i.exec(t)
  if (px?.[1]) return Number(px[1])
  return null
}

function isStrokePaintingVisible(stroke: string): boolean {
  const s = stroke.trim().toLowerCase()
  if (s === "" || s === "none") return false
  if (s === "transparent") return false
  return true
}

function mergeSvgStrokeInherited(
  parent: SvgStrokeState,
  attributes: Record<string, string>,
): SvgStrokeState {
  let stroke =
    attributes.stroke !== undefined && attributes.stroke !== ""
      ? attributes.stroke
      : parent.stroke
  let strokeWidth =
    attributes["stroke-width"] !== undefined && attributes["stroke-width"] !== ""
      ? parseStrokeWidthValue(attributes["stroke-width"]) ?? parent.strokeWidth
      : parent.strokeWidth

  const style = attributes.style
  if (style) {
    const fromStyle = parseInlineStyleStroke(style)
    if (fromStyle.stroke !== undefined && fromStyle.stroke !== "") stroke = fromStyle.stroke
    if (fromStyle.strokeWidth !== undefined && fromStyle.strokeWidth !== "") {
      const parsed = parseStrokeWidthValue(fromStyle.strokeWidth)
      strokeWidth = parsed !== null ? parsed : strokeWidth
    }
  }

  return { stroke, strokeWidth }
}

function strokeFromGroupTreeAndElement(
  groupTreeAttributes: readonly Record<string, string>[] | undefined,
  elementAttributes: Record<string, string>,
): SvgStrokeState {
  let state = initialSvgStrokeState()
  if (groupTreeAttributes) {
    for (const layer of groupTreeAttributes) {
      state = mergeSvgStrokeInherited(state, layer)
    }
  }
  return mergeSvgStrokeInherited(state, elementAttributes)
}

function inflateBBoxForStroke(
  bbox: [number, number, number, number],
  state: SvgStrokeState,
): [number, number, number, number] {
  if (!isStrokePaintingVisible(state.stroke)) return bbox
  const pad = state.strokeWidth / 2
  if (!Number.isFinite(pad) || pad <= 0) return bbox
  const [x1, y1, x2, y2] = bbox
  return [x1 - pad, y1 - pad, x2 + pad, y2 + pad]
}

function geometryBbox(
  name: string,
  attributes: Record<string, string>,
): [number, number, number, number] | null {
  const num = (v: string | undefined, fallback: number) => {
    if (v == null || v === "") return fallback
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  }

  switch (name) {
    case "path": {
      const d = attributes.d
      if (!d) return null
      try {
        return svgPathBbox(d)
      } catch {
        return null
      }
    }
    case "rect":
    case "image": {
      const x = num(attributes.x, 0)
      const y = num(attributes.y, 0)
      const w = Number(attributes.width)
      const h = Number(attributes.height)
      if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null
      return [x, y, x + w, y + h]
    }
    case "circle": {
      const cx = num(attributes.cx, 0)
      const cy = num(attributes.cy, 0)
      const r = Number(attributes.r)
      if (!Number.isFinite(r) || r <= 0) return null
      return [cx - r, cy - r, cx + r, cy + r]
    }
    case "ellipse": {
      const cx = num(attributes.cx, 0)
      const cy = num(attributes.cy, 0)
      const rx = Number(attributes.rx)
      const ry = Number(attributes.ry)
      if (!Number.isFinite(rx) || !Number.isFinite(ry) || rx <= 0 || ry <= 0) return null
      return [cx - rx, cy - ry, cx + rx, cy + ry]
    }
    case "line": {
      const x1 = Number(attributes.x1)
      const y1 = Number(attributes.y1)
      const x2 = Number(attributes.x2)
      const y2 = Number(attributes.y2)
      if (![x1, y1, x2, y2].every(Number.isFinite)) return null
      return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)]
    }
    case "polyline":
    case "polygon": {
      const pts = attributes.points
      if (!pts) return null
      const coords: number[] = []
      for (const token of pts.trim().replace(/,/g, " ").split(/\s+/).filter(Boolean)) {
        const n = Number(token)
        if (Number.isFinite(n)) coords.push(n)
      }
      if (coords.length < 2) return null
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      const pairCount = Math.floor(coords.length / 2)
      for (let j = 0; j < pairCount; j++) {
        const px = coords[j * 2]
        const py = coords[j * 2 + 1]
        if (px === undefined || py === undefined) continue
        minX = Math.min(minX, px)
        minY = Math.min(minY, py)
        maxX = Math.max(maxX, px)
        maxY = Math.max(maxY, py)
      }
      return [minX, minY, maxX, maxY]
    }
    default:
      return null
  }
}

/**
 * Axis-aligned bounds for this element’s geometry, inflated by effective stroke after
 * merging SVG initial values → each ancestor container → this element.
 *
 * @param groupTreeAttributes — `<svg>` / `<g>` ancestors only, **outermost first** (document order).
 *   Omit when not walking a tree (same as no ancestors).
 */
export function svgElementBbox(
  elementName: string,
  attributes: Record<string, string>,
  groupTreeAttributes?: readonly Record<string, string>[],
): [number, number, number, number] | null {
  const stroke = strokeFromGroupTreeAndElement(groupTreeAttributes, attributes)
  const raw = geometryBbox(elementName, attributes)
  return raw ? inflateBBoxForStroke(raw, stroke) : null
}