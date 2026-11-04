import { jsx as a } from "react/jsx-runtime";
import { useMemo as m, createElement as f } from "react";
import { WovenCloth as g, NEUFORM_CRAFT_DEFAULTS as r } from "../neuform-isolated/NeuformCraftEffects.js";
import b from "./woven-cloth-atelier.html.js";
import C from "./woven-cloth-iridescent.html.js";
import p from "./woven-cloth-washi.html.js";
const k = {
  iridescent: {
    title: "Woven Cloth iridescent silk",
    background: "#05060d",
    source: C
  },
  atelier: {
    title: "Woven Cloth atelier flag",
    background: "#12100d",
    source: b
  },
  washi: {
    title: "Woven Cloth washi noren",
    background: "#0d0a07",
    source: p
  }
};
function n(o, e, t) {
  return Math.min(t, Math.max(e, o));
}
function v({
  definition: o,
  hue: e = r.hue,
  saturation: t = r.saturation,
  brightness: l = r.brightness,
  className: u,
  style: h
}) {
  const i = n(e, -180, 180), s = n(t, 0, 2), c = n(l, 0.35, 1.65), d = i === 0 && s === 1 && c === 1 ? void 0 : `hue-rotate(${i}deg) saturate(${s}) brightness(${c})`;
  return /* @__PURE__ */ a(
    "iframe",
    {
      className: u,
      title: o.title,
      srcDoc: o.source,
      sandbox: "allow-scripts",
      loading: "eager",
      style: {
        display: "block",
        width: "100%",
        height: "100%",
        border: 0,
        background: o.background,
        filter: d,
        ...h
      }
    }
  );
}
function y({ variant: o = "woven-cloth", ...e }) {
  const t = m(
    () => o === "woven-cloth" ? void 0 : k[o] ?? void 0,
    [o]
  );
  return t ? /* @__PURE__ */ f(v, { ...e, key: o, definition: t }) : /* @__PURE__ */ a(g, { ...e });
}
export {
  y as WovenCloth
};
