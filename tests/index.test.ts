import { describe, expect, it } from "vitest"

import { svgElementBbox } from "../src/svg-element-bbox"

describe("svgElementBbox", () => {
  describe("unknown element", () => {
    it("returns null for unsupported element name", () => {
      expect(svgElementBbox("foo", {})).toBeNull()
      expect(svgElementBbox("g", {})).toBeNull()
      expect(svgElementBbox("svg", {})).toBeNull()
      expect(svgElementBbox("text", { x: "0", y: "0" })).toBeNull()
    })
  })

  describe("<path>", () => {
    it("returns null when `d` is missing", () => {
      expect(svgElementBbox("path", {})).toBeNull()
    })

    it("returns null when `d` is empty", () => {
      expect(svgElementBbox("path", { d: "" })).toBeNull()
    })

    it("computes bounds for a simple line path", () => {
      const bbox = svgElementBbox("path", { d: "M0 0 L10 20" })
      expect(bbox).toEqual([0, 0, 10, 20])
    })

    it("computes bounds for a closed shape", () => {
      const bbox = svgElementBbox("path", { d: "M0 0 H10 V10 H0 Z" })
      expect(bbox).toEqual([0, 0, 10, 10])
    })

    it("inflates a stroked path by stroke-width/2", () => {
      expect(
        svgElementBbox("path", {
          d: "M0 0 L10 0",
          stroke: "black",
          "stroke-width": "2",
        }),
      ).toEqual([-1, -1, 11, 1])
    })
  })

  describe("<rect>", () => {
    it("computes bounds with explicit x/y", () => {
      expect(svgElementBbox("rect", { x: "5", y: "10", width: "20", height: "30" })).toEqual([
        5, 10, 25, 40,
      ])
    })

    it("defaults x/y to 0 when missing", () => {
      expect(svgElementBbox("rect", { width: "20", height: "30" })).toEqual([0, 0, 20, 30])
    })

    it("treats empty x/y as 0", () => {
      expect(svgElementBbox("rect", { x: "", y: "", width: "10", height: "10" })).toEqual([
        0, 0, 10, 10,
      ])
    })

    it("returns null for missing width or height", () => {
      expect(svgElementBbox("rect", { width: "10" })).toBeNull()
      expect(svgElementBbox("rect", { height: "10" })).toBeNull()
      expect(svgElementBbox("rect", {})).toBeNull()
    })

    it("returns null for non-positive width or height", () => {
      expect(svgElementBbox("rect", { width: "0", height: "10" })).toBeNull()
      expect(svgElementBbox("rect", { width: "10", height: "0" })).toBeNull()
      expect(svgElementBbox("rect", { width: "-5", height: "10" })).toBeNull()
    })

    it("returns null for non-numeric width or height", () => {
      expect(svgElementBbox("rect", { width: "foo", height: "10" })).toBeNull()
    })
  })

  describe("<image>", () => {
    it("computes bounds like rect", () => {
      expect(svgElementBbox("image", { x: "1", y: "2", width: "30", height: "40" })).toEqual([
        1, 2, 31, 42,
      ])
    })

    it("returns null for missing dimensions", () => {
      expect(svgElementBbox("image", {})).toBeNull()
    })
  })

  describe("<circle>", () => {
    it("computes bounds with explicit cx/cy/r", () => {
      expect(svgElementBbox("circle", { cx: "10", cy: "20", r: "5" })).toEqual([5, 15, 15, 25])
    })

    it("defaults cx/cy to 0 when missing", () => {
      expect(svgElementBbox("circle", { r: "5" })).toEqual([-5, -5, 5, 5])
    })

    it("returns null for missing or non-positive r", () => {
      expect(svgElementBbox("circle", { cx: "0", cy: "0" })).toBeNull()
      expect(svgElementBbox("circle", { cx: "0", cy: "0", r: "0" })).toBeNull()
      expect(svgElementBbox("circle", { cx: "0", cy: "0", r: "-1" })).toBeNull()
    })
  })

  describe("<ellipse>", () => {
    it("computes bounds with explicit cx/cy/rx/ry", () => {
      expect(svgElementBbox("ellipse", { cx: "10", cy: "20", rx: "5", ry: "8" })).toEqual([
        5, 12, 15, 28,
      ])
    })

    it("defaults cx/cy to 0 when missing", () => {
      expect(svgElementBbox("ellipse", { rx: "3", ry: "4" })).toEqual([-3, -4, 3, 4])
    })

    it("returns null for missing or non-positive rx/ry", () => {
      expect(svgElementBbox("ellipse", { rx: "5" })).toBeNull()
      expect(svgElementBbox("ellipse", { ry: "5" })).toBeNull()
      expect(svgElementBbox("ellipse", { rx: "0", ry: "5" })).toBeNull()
      expect(svgElementBbox("ellipse", { rx: "5", ry: "-1" })).toBeNull()
    })
  })

  describe("<line>", () => {
    it("computes bounds for a forward line", () => {
      expect(svgElementBbox("line", { x1: "0", y1: "0", x2: "10", y2: "20" })).toEqual([
        0, 0, 10, 20,
      ])
    })

    it("normalises reversed coordinates", () => {
      expect(svgElementBbox("line", { x1: "10", y1: "20", x2: "0", y2: "0" })).toEqual([
        0, 0, 10, 20,
      ])
    })

    it("supports negative coordinates", () => {
      expect(svgElementBbox("line", { x1: "-5", y1: "-10", x2: "5", y2: "10" })).toEqual([
        -5, -10, 5, 10,
      ])
    })

    it("returns null when any coordinate is missing or invalid", () => {
      expect(svgElementBbox("line", { x1: "0", y1: "0", x2: "10" })).toBeNull()
      expect(svgElementBbox("line", { x1: "0", y1: "0", x2: "10", y2: "abc" })).toBeNull()
      expect(svgElementBbox("line", {})).toBeNull()
    })
  })

  describe("<polyline> / <polygon>", () => {
    it("parses space-separated points", () => {
      expect(svgElementBbox("polyline", { points: "0 0 10 10 20 5" })).toEqual([0, 0, 20, 10])
    })

    it("parses comma-separated points", () => {
      expect(svgElementBbox("polygon", { points: "0,0 10,10 20,5" })).toEqual([0, 0, 20, 10])
    })

    it("parses mixed comma and whitespace separators", () => {
      expect(svgElementBbox("polygon", { points: "0,0 10 10, 20,5" })).toEqual([0, 0, 20, 10])
    })

    it("ignores stray non-numeric tokens", () => {
      expect(svgElementBbox("polyline", { points: "0 0 foo 10 10" })).toEqual([0, 0, 10, 10])
    })

    it("supports negative coordinates", () => {
      expect(svgElementBbox("polyline", { points: "-5 -10 5 10" })).toEqual([-5, -10, 5, 10])
    })

    it("ignores a trailing unpaired coordinate", () => {
      expect(svgElementBbox("polyline", { points: "0 0 10 10 20" })).toEqual([0, 0, 10, 10])
    })

    it("returns null for missing points attribute", () => {
      expect(svgElementBbox("polyline", {})).toBeNull()
      expect(svgElementBbox("polygon", {})).toBeNull()
    })

    it("returns null when fewer than one full pair is present", () => {
      expect(svgElementBbox("polygon", { points: "5" })).toBeNull()
    })
  })

  describe("stroke inflation", () => {
    it("does not inflate when stroke is the initial value (none)", () => {
      expect(svgElementBbox("rect", { width: "10", height: "10", "stroke-width": "4" })).toEqual([
        0, 0, 10, 10,
      ])
    })

    it("inflates by strokeWidth/2 when stroke is a visible paint", () => {
      expect(
        svgElementBbox("rect", {
          width: "10",
          height: "10",
          stroke: "black",
          "stroke-width": "4",
        }),
      ).toEqual([-2, -2, 12, 12])
    })

    it("uses the default stroke-width of 1 when stroke is set but width is omitted", () => {
      expect(svgElementBbox("rect", { width: "10", height: "10", stroke: "red" })).toEqual([
        -0.5, -0.5, 10.5, 10.5,
      ])
    })

    it("does not inflate when stroke is 'none'", () => {
      expect(
        svgElementBbox("rect", {
          width: "10",
          height: "10",
          stroke: "none",
          "stroke-width": "4",
        }),
      ).toEqual([0, 0, 10, 10])
    })

    it("does not inflate when stroke is 'transparent'", () => {
      expect(
        svgElementBbox("rect", {
          width: "10",
          height: "10",
          stroke: "transparent",
          "stroke-width": "4",
        }),
      ).toEqual([0, 0, 10, 10])
    })

    it("does not inflate when stroke is an empty string", () => {
      expect(
        svgElementBbox("rect", {
          width: "10",
          height: "10",
          stroke: "",
          "stroke-width": "4",
        }),
      ).toEqual([0, 0, 10, 10])
    })

    it("treats the stroke value case-insensitively", () => {
      expect(
        svgElementBbox("rect", {
          width: "10",
          height: "10",
          stroke: "NONE",
          "stroke-width": "4",
        }),
      ).toEqual([0, 0, 10, 10])
    })

    it("parses stroke-width with px units", () => {
      expect(
        svgElementBbox("rect", {
          width: "10",
          height: "10",
          stroke: "black",
          "stroke-width": "2px",
        }),
      ).toEqual([-1, -1, 11, 11])
    })

    it("falls back to inherited stroke-width when value is invalid", () => {
      expect(
        svgElementBbox(
          "rect",
          {
            width: "10",
            height: "10",
            "stroke-width": "abc",
          },
          [{ stroke: "black", "stroke-width": "6" }],
        ),
      ).toEqual([-3, -3, 13, 13])
    })

    it("does not inflate when computed stroke-width is zero", () => {
      expect(
        svgElementBbox("rect", {
          width: "10",
          height: "10",
          stroke: "black",
          "stroke-width": "0",
        }),
      ).toEqual([0, 0, 10, 10])
    })

    it("does not inflate when computed stroke-width is negative", () => {
      expect(
        svgElementBbox("rect", {
          width: "10",
          height: "10",
          stroke: "black",
          "stroke-width": "-4",
        }),
      ).toEqual([0, 0, 10, 10])
    })
  })

  describe("inline style overrides", () => {
    it("reads stroke from inline style", () => {
      expect(
        svgElementBbox("rect", {
          width: "10",
          height: "10",
          style: "stroke: black; stroke-width: 4",
        }),
      ).toEqual([-2, -2, 12, 12])
    })

    it("inline style overrides element attribute", () => {
      expect(
        svgElementBbox("rect", {
          width: "10",
          height: "10",
          stroke: "none",
          "stroke-width": "1",
          style: "stroke: black; stroke-width: 4",
        }),
      ).toEqual([-2, -2, 12, 12])
    })

    it("ignores empty inline style declarations", () => {
      expect(
        svgElementBbox("rect", {
          width: "10",
          height: "10",
          stroke: "black",
          "stroke-width": "4",
          style: "stroke:; stroke-width:",
        }),
      ).toEqual([-2, -2, 12, 12])
    })

    it("ignores malformed inline style declarations without a colon", () => {
      expect(
        svgElementBbox("rect", {
          width: "10",
          height: "10",
          stroke: "black",
          "stroke-width": "4",
          style: "stroke black; stroke-width 4",
        }),
      ).toEqual([-2, -2, 12, 12])
    })

    it("treats style property names case-insensitively", () => {
      expect(
        svgElementBbox("rect", {
          width: "10",
          height: "10",
          style: "STROKE: black; Stroke-Width: 4",
        }),
      ).toEqual([-2, -2, 12, 12])
    })
  })

  describe("group tree inheritance", () => {
    it("inherits stroke from a single ancestor", () => {
      expect(
        svgElementBbox("rect", { width: "10", height: "10" }, [
          { stroke: "black", "stroke-width": "4" },
        ]),
      ).toEqual([-2, -2, 12, 12])
    })

    it("element attributes override inherited stroke", () => {
      expect(
        svgElementBbox(
          "rect",
          { width: "10", height: "10", stroke: "none" },
          [{ stroke: "black", "stroke-width": "4" }],
        ),
      ).toEqual([0, 0, 10, 10])
    })

    it("element stroke-width overrides inherited stroke-width", () => {
      expect(
        svgElementBbox(
          "rect",
          { width: "10", height: "10", "stroke-width": "2" },
          [{ stroke: "black", "stroke-width": "10" }],
        ),
      ).toEqual([-1, -1, 11, 11])
    })

    it("zero stroke-width overrides non-zero inherited stroke-width", () => {
      expect(
        svgElementBbox(
          "rect",
          {
            width: "10",
            height: "10",
            stroke: "black",
            "stroke-width": "0",
          },
          [{ stroke: "black", "stroke-width": "10" }],
        ),
      ).toEqual([0, 0, 10, 10])
    })

    it("nearest ancestor wins when multiple layers set the same property", () => {
      expect(
        svgElementBbox(
          "rect",
          { width: "10", height: "10" },
          [
            { stroke: "black", "stroke-width": "10" },
            { "stroke-width": "4" },
          ],
        ),
      ).toEqual([-2, -2, 12, 12])
    })

    it("inherits stroke from outer ancestor when inner does not redefine it", () => {
      expect(
        svgElementBbox(
          "rect",
          { width: "10", height: "10" },
          [{ stroke: "black", "stroke-width": "4" }, {}],
        ),
      ).toEqual([-2, -2, 12, 12])
    })

    it("supports stroke declared via ancestor inline style", () => {
      expect(
        svgElementBbox("rect", { width: "10", height: "10" }, [
          { style: "stroke: black; stroke-width: 4" },
        ]),
      ).toEqual([-2, -2, 12, 12])
    })

    it("does not inflate when the ancestor explicitly disables stroke", () => {
      expect(
        svgElementBbox(
          "rect",
          { width: "10", height: "10", "stroke-width": "4" },
          [{ stroke: "none" }],
        ),
      ).toEqual([0, 0, 10, 10])
    })

    it("treats undefined groupTreeAttributes the same as no ancestors", () => {
      expect(svgElementBbox("rect", { width: "10", height: "10" })).toEqual(
        svgElementBbox("rect", { width: "10", height: "10" }, []),
      )
    })
  })

  describe("transform / CTM", () => {
    it("applies a single ancestor translate to a centred circle", () => {
      const bbox = svgElementBbox(
        "circle",
        { cx: "0", cy: "0", r: "4.291" },
        [{ fill: "none", transform: "translate(50.291, 220.448)" }],
      )
      expect(bbox?.[0]).toBeCloseTo(50.291 - 4.291, 5)
      expect(bbox?.[1]).toBeCloseTo(220.448 - 4.291, 5)
      expect(bbox?.[2]).toBeCloseTo(50.291 + 4.291, 5)
      expect(bbox?.[3]).toBeCloseTo(220.448 + 4.291, 5)
    })

    it("composes outer then inner translates (outermost group first in the array)", () => {
      const bbox = svgElementBbox(
        "circle",
        { cx: "0", cy: "0", r: "1" },
        [{ transform: "translate(10, 0)" }, { transform: "translate(0, 5)" }],
      )
      expect(bbox).toEqual([9, 4, 11, 6])
    })

    it("applies element transform after ancestor transforms", () => {
      const bbox = svgElementBbox(
        "circle",
        { cx: "0", cy: "0", r: "1", transform: "translate(100, 0)" },
        [{ transform: "translate(10, 0)" }],
      )
      expect(bbox).toEqual([109, -1, 111, 1])
    })

    it("parses chained transforms left-to-right (translate then scale)", () => {
      const bbox = svgElementBbox("rect", {
        x: "10",
        y: "0",
        width: "1",
        height: "1",
        transform: "translate(1, 0) scale(2)",
      })
      expect(bbox?.[0]).toBeCloseTo(22, 5)
      expect(bbox?.[1]).toBeCloseTo(0, 5)
      expect(bbox?.[2]).toBeCloseTo(24, 5)
      expect(bbox?.[3]).toBeCloseTo(2, 5)
    })

    it("maps bbox corners through rotate()", () => {
      const bbox = svgElementBbox("rect", {
        x: "0",
        y: "0",
        width: "10",
        height: "10",
        transform: "rotate(90)",
      })
      expect(bbox?.[0]).toBeCloseTo(-10, 5)
      expect(bbox?.[1]).toBeCloseTo(0, 5)
      expect(bbox?.[2]).toBeCloseTo(0, 5)
      expect(bbox?.[3]).toBeCloseTo(10, 5)
    })

    it("translates stroke-inflated bounds with the same matrix as geometry", () => {
      expect(
        svgElementBbox(
          "rect",
          { width: "10", height: "10", stroke: "black", "stroke-width": "4", transform: "translate(3, -2)" },
        ),
      ).toEqual([1, -4, 15, 10])
    })
  })

  describe("stroke inflation across geometry types", () => {
    it("inflates a circle bounding box", () => {
      expect(
        svgElementBbox("circle", { cx: "10", cy: "10", r: "5", stroke: "black", "stroke-width": "4" }),
      ).toEqual([3, 3, 17, 17])
    })

    it("inflates a line bounding box", () => {
      expect(
        svgElementBbox("line", {
          x1: "0",
          y1: "0",
          x2: "10",
          y2: "0",
          stroke: "black",
          "stroke-width": "2",
        }),
      ).toEqual([-1, -1, 11, 1])
    })

    it("inflates a polyline bounding box", () => {
      expect(
        svgElementBbox("polyline", {
          points: "0 0 10 10",
          stroke: "black",
          "stroke-width": "2",
        }),
      ).toEqual([-1, -1, 11, 11])
    })

    it("inflates a path bounding box", () => {
      expect(
        svgElementBbox("path", {
          d: "M0 0 H10 V10 H0 Z",
          stroke: "black",
          "stroke-width": "2",
        }),
      ).toEqual([-1, -1, 11, 11])
    })
  })
})
