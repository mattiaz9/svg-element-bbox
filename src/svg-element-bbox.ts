import { svgPathBbox } from "svg-path-bbox"

/** SVG `matrix(a,b,c,d,e,f)`: x' = a*x + c*y + e, y' = b*x + d*y + f */
type SvgAffine = readonly [number, number, number, number, number, number]

const IDENTITY_AFFINE: SvgAffine = [1, 0, 0, 1, 0, 0]

function multiplyAffine(a: SvgAffine, b: SvgAffine): SvgAffine {
  const [a0, a1, a2, a3, a4, a5] = a
  const [b0, b1, b2, b3, b4, b5] = b
  return [
    a0 * b0 + a2 * b1,
    a1 * b0 + a3 * b1,
    a0 * b2 + a2 * b3,
    a1 * b2 + a3 * b3,
    a0 * b4 + a2 * b5 + a4,
    a1 * b4 + a3 * b5 + a5,
  ]
}

/** Split SVG transform arguments into finite numbers (commas optional). */
function splitTransformNumbers(slice: string): number[] {
  const out: number[] = []
  for (const token of slice.trim().replace(/,/g, " ").split(/\s+/).filter(Boolean)) {
    const n = Number(token)
    if (Number.isFinite(n)) out.push(n)
  }
  return out
}

/** Cos/sin using degrees (SVG rotates in degrees). */
function rotateAffineDegrees(angleDeg: number, cx?: number, cy?: number): SvgAffine {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const r: SvgAffine = [cos, sin, -sin, cos, 0, 0]
  if (cx === undefined || cy === undefined) return r
  const t1: SvgAffine = [1, 0, 0, 1, cx, cy]
  const tm: SvgAffine = [1, 0, 0, 1, -cx, -cy]
  return multiplyAffine(multiplyAffine(t1, r), tm)
}

/** One `transform=""` attribute: transforms apply left-to-right, so combined M = T_last * … * T_first. */
function parseSvgTransformAttribute(transform: string): SvgAffine {
  let s = transform.trim()
  if (s === "") return IDENTITY_AFFINE

  let combined: SvgAffine = IDENTITY_AFFINE

  while (s.length > 0) {
    s = s.replace(/^\s+/, "")
    const m =
      /^matrix\s*\(\s*([^)]+)\)/i.exec(s) ??
      /^translate\s*\(\s*([^)]+)\)/i.exec(s) ??
      /^scale\s*\(\s*([^)]+)\)/i.exec(s) ??
      /^rotate\s*\(\s*([^)]+)\)/i.exec(s) ??
      /^skewX\s*\(\s*([^)]+)\)/i.exec(s) ??
      /^skewY\s*\(\s*([^)]+)\)/i.exec(s)

    if (!m) break

    const args = splitTransformNumbers(m[1] ?? "")
    let next: SvgAffine = IDENTITY_AFFINE

    if (/^matrix/i.test(m[0])) {
      const [aa, bb, cc, dd, ee, ff] = args
      if (args.length >= 6 && [aa, bb, cc, dd, ee, ff].every(Number.isFinite)) {
        next = [aa!, bb!, cc!, dd!, ee!, ff!]
      }
    } else if (/^translate/i.test(m[0])) {
      if (args.length >= 2) next = [1, 0, 0, 1, args[0]!, args[1]!]
      else if (args.length === 1) next = [1, 0, 0, 1, args[0]!, 0]
    } else if (/^scale/i.test(m[0])) {
      if (args.length >= 2 && args.every(Number.isFinite)) next = [args[0]!, 0, 0, args[1]!, 0, 0]
      else if (args.length === 1 && Number.isFinite(args[0]!)) {
        const k = args[0]!
        next = [k, 0, 0, k, 0, 0]
      }
    } else if (/^rotate/i.test(m[0])) {
      const deg = args[0]
      if (Number.isFinite(deg)) {
        next =
          args.length >= 3 && Number.isFinite(args[1]) && Number.isFinite(args[2]!)
            ? rotateAffineDegrees(deg!, args[1], args[2])
            : rotateAffineDegrees(deg!)
      }
    } else if (/^skewX/i.test(m[0])) {
      const deg = args[0]
      if (Number.isFinite(deg)) {
        const t = Math.tan((deg! * Math.PI) / 180)
        next = [1, 0, t, 1, 0, 0]
      }
    } else if (/^skewY/i.test(m[0])) {
      const deg = args[0]
      if (Number.isFinite(deg)) {
        const t = Math.tan((deg! * Math.PI) / 180)
        next = [1, t, 0, 1, 0, 0]
      }
    }

    combined = multiplyAffine(next, combined)
    s = s.slice(m[0].length)
  }

  return combined
}

/** Outermost ancestor first — same iteration order as stroke inheritance. */
function accumulateContainerTransforms(groupTreeAttributes: readonly Record<string, string>[] | undefined): SvgAffine {
  if (!groupTreeAttributes?.length) return IDENTITY_AFFINE
  let m: SvgAffine = IDENTITY_AFFINE
  for (const layer of groupTreeAttributes) {
    const raw = layer.transform
    if (raw !== undefined && raw.trim() !== "") {
      m = multiplyAffine(m, parseSvgTransformAttribute(raw))
    }
  }
  return m
}

function transformAxisAlignedBBox(
  bbox: [number, number, number, number],
  m: SvgAffine,
): [number, number, number, number] {
  const [x1, y1, x2, y2] = bbox
  if (
    m[0] === 1 &&
    m[1] === 0 &&
    m[2] === 0 &&
    m[3] === 1 &&
    m[4] === 0 &&
    m[5] === 0
  ) {
    return bbox
  }
  const pts: [number, number][] = [
    [x1, y1],
    [x2, y1],
    [x1, y2],
    [x2, y2],
  ]
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const [a0, a1, a2, a3, a4, a5] = m
  for (const [x, y] of pts) {
    const xt = a0 * x + a2 * y + a4
    const yt = a1 * x + a3 * y + a5
    minX = Math.min(minX, xt)
    minY = Math.min(minY, yt)
    maxX = Math.max(maxX, xt)
    maxY = Math.max(maxY, yt)
  }
  return [minX, minY, maxX, maxY]
}

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
 * merging SVG initial values → each ancestor container → this element, then mapped
 * through each ancestor’s `transform` (outermost first) and this element’s `transform`.
 *
 * Supported on containers and elements: comma-separated SVG `transform` list entries
 * `matrix`, `translate`, `scale`, `rotate`, `skewX`, `skewY`. Animation (`animateTransform`)
 * is ignored.
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
  if (!raw) return null
  const inflated = inflateBBoxForStroke(raw, stroke)
  const ancestorM = accumulateContainerTransforms(groupTreeAttributes)
  const elemRaw = attributes.transform
  const elemM =
    elemRaw !== undefined && elemRaw.trim() !== ""
      ? parseSvgTransformAttribute(elemRaw)
      : IDENTITY_AFFINE
  const worldM = multiplyAffine(ancestorM, elemM)
  return transformAxisAlignedBBox(inflated, worldM)
}