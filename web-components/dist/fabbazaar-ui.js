var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
var _a;
const t$3 = globalThis, e$4 = t$3.ShadowRoot && (void 0 === t$3.ShadyCSS || t$3.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, s$2 = Symbol(), o$5 = /* @__PURE__ */ new WeakMap();
let n$3 = class n {
  constructor(t2, e2, o2) {
    if (this._$cssResult$ = true, o2 !== s$2) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
    this.cssText = t2, this.t = e2;
  }
  get styleSheet() {
    let t2 = this.o;
    const s2 = this.t;
    if (e$4 && void 0 === t2) {
      const e2 = void 0 !== s2 && 1 === s2.length;
      e2 && (t2 = o$5.get(s2)), void 0 === t2 && ((this.o = t2 = new CSSStyleSheet()).replaceSync(this.cssText), e2 && o$5.set(s2, t2));
    }
    return t2;
  }
  toString() {
    return this.cssText;
  }
};
const r$4 = (t2) => new n$3("string" == typeof t2 ? t2 : t2 + "", void 0, s$2), i$4 = (t2, ...e2) => {
  const o2 = 1 === t2.length ? t2[0] : e2.reduce((e3, s2, o3) => e3 + ((t3) => {
    if (true === t3._$cssResult$) return t3.cssText;
    if ("number" == typeof t3) return t3;
    throw Error("Value passed to 'css' function must be a 'css' function result: " + t3 + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
  })(s2) + t2[o3 + 1], t2[0]);
  return new n$3(o2, t2, s$2);
}, S$1 = (s2, o2) => {
  if (e$4) s2.adoptedStyleSheets = o2.map((t2) => t2 instanceof CSSStyleSheet ? t2 : t2.styleSheet);
  else for (const e2 of o2) {
    const o3 = document.createElement("style"), n3 = t$3.litNonce;
    void 0 !== n3 && o3.setAttribute("nonce", n3), o3.textContent = e2.cssText, s2.appendChild(o3);
  }
}, c$2 = e$4 ? (t2) => t2 : (t2) => t2 instanceof CSSStyleSheet ? ((t3) => {
  let e2 = "";
  for (const s2 of t3.cssRules) e2 += s2.cssText;
  return r$4(e2);
})(t2) : t2;
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const { is: i$3, defineProperty: e$3, getOwnPropertyDescriptor: h$1, getOwnPropertyNames: r$3, getOwnPropertySymbols: o$4, getPrototypeOf: n$2 } = Object, a$1 = globalThis, c$1 = a$1.trustedTypes, l$1 = c$1 ? c$1.emptyScript : "", p$1 = a$1.reactiveElementPolyfillSupport, d$1 = (t2, s2) => t2, u$1 = { toAttribute(t2, s2) {
  switch (s2) {
    case Boolean:
      t2 = t2 ? l$1 : null;
      break;
    case Object:
    case Array:
      t2 = null == t2 ? t2 : JSON.stringify(t2);
  }
  return t2;
}, fromAttribute(t2, s2) {
  let i3 = t2;
  switch (s2) {
    case Boolean:
      i3 = null !== t2;
      break;
    case Number:
      i3 = null === t2 ? null : Number(t2);
      break;
    case Object:
    case Array:
      try {
        i3 = JSON.parse(t2);
      } catch (t3) {
        i3 = null;
      }
  }
  return i3;
} }, f$1 = (t2, s2) => !i$3(t2, s2), b$1 = { attribute: true, type: String, converter: u$1, reflect: false, useDefault: false, hasChanged: f$1 };
Symbol.metadata ?? (Symbol.metadata = Symbol("metadata")), a$1.litPropertyMetadata ?? (a$1.litPropertyMetadata = /* @__PURE__ */ new WeakMap());
let y$1 = class y extends HTMLElement {
  static addInitializer(t2) {
    this._$Ei(), (this.l ?? (this.l = [])).push(t2);
  }
  static get observedAttributes() {
    return this.finalize(), this._$Eh && [...this._$Eh.keys()];
  }
  static createProperty(t2, s2 = b$1) {
    if (s2.state && (s2.attribute = false), this._$Ei(), this.prototype.hasOwnProperty(t2) && ((s2 = Object.create(s2)).wrapped = true), this.elementProperties.set(t2, s2), !s2.noAccessor) {
      const i3 = Symbol(), h2 = this.getPropertyDescriptor(t2, i3, s2);
      void 0 !== h2 && e$3(this.prototype, t2, h2);
    }
  }
  static getPropertyDescriptor(t2, s2, i3) {
    const { get: e2, set: r2 } = h$1(this.prototype, t2) ?? { get() {
      return this[s2];
    }, set(t3) {
      this[s2] = t3;
    } };
    return { get: e2, set(s3) {
      const h2 = e2?.call(this);
      r2?.call(this, s3), this.requestUpdate(t2, h2, i3);
    }, configurable: true, enumerable: true };
  }
  static getPropertyOptions(t2) {
    return this.elementProperties.get(t2) ?? b$1;
  }
  static _$Ei() {
    if (this.hasOwnProperty(d$1("elementProperties"))) return;
    const t2 = n$2(this);
    t2.finalize(), void 0 !== t2.l && (this.l = [...t2.l]), this.elementProperties = new Map(t2.elementProperties);
  }
  static finalize() {
    if (this.hasOwnProperty(d$1("finalized"))) return;
    if (this.finalized = true, this._$Ei(), this.hasOwnProperty(d$1("properties"))) {
      const t3 = this.properties, s2 = [...r$3(t3), ...o$4(t3)];
      for (const i3 of s2) this.createProperty(i3, t3[i3]);
    }
    const t2 = this[Symbol.metadata];
    if (null !== t2) {
      const s2 = litPropertyMetadata.get(t2);
      if (void 0 !== s2) for (const [t3, i3] of s2) this.elementProperties.set(t3, i3);
    }
    this._$Eh = /* @__PURE__ */ new Map();
    for (const [t3, s2] of this.elementProperties) {
      const i3 = this._$Eu(t3, s2);
      void 0 !== i3 && this._$Eh.set(i3, t3);
    }
    this.elementStyles = this.finalizeStyles(this.styles);
  }
  static finalizeStyles(s2) {
    const i3 = [];
    if (Array.isArray(s2)) {
      const e2 = new Set(s2.flat(1 / 0).reverse());
      for (const s3 of e2) i3.unshift(c$2(s3));
    } else void 0 !== s2 && i3.push(c$2(s2));
    return i3;
  }
  static _$Eu(t2, s2) {
    const i3 = s2.attribute;
    return false === i3 ? void 0 : "string" == typeof i3 ? i3 : "string" == typeof t2 ? t2.toLowerCase() : void 0;
  }
  constructor() {
    super(), this._$Ep = void 0, this.isUpdatePending = false, this.hasUpdated = false, this._$Em = null, this._$Ev();
  }
  _$Ev() {
    this._$ES = new Promise((t2) => this.enableUpdating = t2), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((t2) => t2(this));
  }
  addController(t2) {
    (this._$EO ?? (this._$EO = /* @__PURE__ */ new Set())).add(t2), void 0 !== this.renderRoot && this.isConnected && t2.hostConnected?.();
  }
  removeController(t2) {
    this._$EO?.delete(t2);
  }
  _$E_() {
    const t2 = /* @__PURE__ */ new Map(), s2 = this.constructor.elementProperties;
    for (const i3 of s2.keys()) this.hasOwnProperty(i3) && (t2.set(i3, this[i3]), delete this[i3]);
    t2.size > 0 && (this._$Ep = t2);
  }
  createRenderRoot() {
    const t2 = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
    return S$1(t2, this.constructor.elementStyles), t2;
  }
  connectedCallback() {
    this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this.enableUpdating(true), this._$EO?.forEach((t2) => t2.hostConnected?.());
  }
  enableUpdating(t2) {
  }
  disconnectedCallback() {
    this._$EO?.forEach((t2) => t2.hostDisconnected?.());
  }
  attributeChangedCallback(t2, s2, i3) {
    this._$AK(t2, i3);
  }
  _$ET(t2, s2) {
    const i3 = this.constructor.elementProperties.get(t2), e2 = this.constructor._$Eu(t2, i3);
    if (void 0 !== e2 && true === i3.reflect) {
      const h2 = (void 0 !== i3.converter?.toAttribute ? i3.converter : u$1).toAttribute(s2, i3.type);
      this._$Em = t2, null == h2 ? this.removeAttribute(e2) : this.setAttribute(e2, h2), this._$Em = null;
    }
  }
  _$AK(t2, s2) {
    const i3 = this.constructor, e2 = i3._$Eh.get(t2);
    if (void 0 !== e2 && this._$Em !== e2) {
      const t3 = i3.getPropertyOptions(e2), h2 = "function" == typeof t3.converter ? { fromAttribute: t3.converter } : void 0 !== t3.converter?.fromAttribute ? t3.converter : u$1;
      this._$Em = e2;
      const r2 = h2.fromAttribute(s2, t3.type);
      this[e2] = r2 ?? this._$Ej?.get(e2) ?? r2, this._$Em = null;
    }
  }
  requestUpdate(t2, s2, i3, e2 = false, h2) {
    if (void 0 !== t2) {
      const r2 = this.constructor;
      if (false === e2 && (h2 = this[t2]), i3 ?? (i3 = r2.getPropertyOptions(t2)), !((i3.hasChanged ?? f$1)(h2, s2) || i3.useDefault && i3.reflect && h2 === this._$Ej?.get(t2) && !this.hasAttribute(r2._$Eu(t2, i3)))) return;
      this.C(t2, s2, i3);
    }
    false === this.isUpdatePending && (this._$ES = this._$EP());
  }
  C(t2, s2, { useDefault: i3, reflect: e2, wrapped: h2 }, r2) {
    i3 && !(this._$Ej ?? (this._$Ej = /* @__PURE__ */ new Map())).has(t2) && (this._$Ej.set(t2, r2 ?? s2 ?? this[t2]), true !== h2 || void 0 !== r2) || (this._$AL.has(t2) || (this.hasUpdated || i3 || (s2 = void 0), this._$AL.set(t2, s2)), true === e2 && this._$Em !== t2 && (this._$Eq ?? (this._$Eq = /* @__PURE__ */ new Set())).add(t2));
  }
  async _$EP() {
    this.isUpdatePending = true;
    try {
      await this._$ES;
    } catch (t3) {
      Promise.reject(t3);
    }
    const t2 = this.scheduleUpdate();
    return null != t2 && await t2, !this.isUpdatePending;
  }
  scheduleUpdate() {
    return this.performUpdate();
  }
  performUpdate() {
    if (!this.isUpdatePending) return;
    if (!this.hasUpdated) {
      if (this.renderRoot ?? (this.renderRoot = this.createRenderRoot()), this._$Ep) {
        for (const [t4, s3] of this._$Ep) this[t4] = s3;
        this._$Ep = void 0;
      }
      const t3 = this.constructor.elementProperties;
      if (t3.size > 0) for (const [s3, i3] of t3) {
        const { wrapped: t4 } = i3, e2 = this[s3];
        true !== t4 || this._$AL.has(s3) || void 0 === e2 || this.C(s3, void 0, i3, e2);
      }
    }
    let t2 = false;
    const s2 = this._$AL;
    try {
      t2 = this.shouldUpdate(s2), t2 ? (this.willUpdate(s2), this._$EO?.forEach((t3) => t3.hostUpdate?.()), this.update(s2)) : this._$EM();
    } catch (s3) {
      throw t2 = false, this._$EM(), s3;
    }
    t2 && this._$AE(s2);
  }
  willUpdate(t2) {
  }
  _$AE(t2) {
    this._$EO?.forEach((t3) => t3.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = true, this.firstUpdated(t2)), this.updated(t2);
  }
  _$EM() {
    this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = false;
  }
  get updateComplete() {
    return this.getUpdateComplete();
  }
  getUpdateComplete() {
    return this._$ES;
  }
  shouldUpdate(t2) {
    return true;
  }
  update(t2) {
    this._$Eq && (this._$Eq = this._$Eq.forEach((t3) => this._$ET(t3, this[t3]))), this._$EM();
  }
  updated(t2) {
  }
  firstUpdated(t2) {
  }
};
y$1.elementStyles = [], y$1.shadowRootOptions = { mode: "open" }, y$1[d$1("elementProperties")] = /* @__PURE__ */ new Map(), y$1[d$1("finalized")] = /* @__PURE__ */ new Map(), p$1?.({ ReactiveElement: y$1 }), (a$1.reactiveElementVersions ?? (a$1.reactiveElementVersions = [])).push("2.1.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const t$2 = globalThis, i$2 = (t2) => t2, s$1 = t$2.trustedTypes, e$2 = s$1 ? s$1.createPolicy("lit-html", { createHTML: (t2) => t2 }) : void 0, h = "$lit$", o$3 = `lit$${Math.random().toFixed(9).slice(2)}$`, n$1 = "?" + o$3, r$2 = `<${n$1}>`, l = document, c = () => l.createComment(""), a = (t2) => null === t2 || "object" != typeof t2 && "function" != typeof t2, u = Array.isArray, d = (t2) => u(t2) || "function" == typeof t2?.[Symbol.iterator], f = "[ 	\n\f\r]", v = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, _ = /-->/g, m = />/g, p = RegExp(`>|${f}(?:([^\\s"'>=/]+)(${f}*=${f}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`, "g"), g = /'/g, $ = /"/g, y2 = /^(?:script|style|textarea|title)$/i, x = (t2) => (i3, ...s2) => ({ _$litType$: t2, strings: i3, values: s2 }), b = x(1), E = Symbol.for("lit-noChange"), A = Symbol.for("lit-nothing"), C = /* @__PURE__ */ new WeakMap(), P = l.createTreeWalker(l, 129);
function V(t2, i3) {
  if (!u(t2) || !t2.hasOwnProperty("raw")) throw Error("invalid template strings array");
  return void 0 !== e$2 ? e$2.createHTML(i3) : i3;
}
const N = (t2, i3) => {
  const s2 = t2.length - 1, e2 = [];
  let n3, l2 = 2 === i3 ? "<svg>" : 3 === i3 ? "<math>" : "", c2 = v;
  for (let i4 = 0; i4 < s2; i4++) {
    const s3 = t2[i4];
    let a2, u2, d2 = -1, f2 = 0;
    for (; f2 < s3.length && (c2.lastIndex = f2, u2 = c2.exec(s3), null !== u2); ) f2 = c2.lastIndex, c2 === v ? "!--" === u2[1] ? c2 = _ : void 0 !== u2[1] ? c2 = m : void 0 !== u2[2] ? (y2.test(u2[2]) && (n3 = RegExp("</" + u2[2], "g")), c2 = p) : void 0 !== u2[3] && (c2 = p) : c2 === p ? ">" === u2[0] ? (c2 = n3 ?? v, d2 = -1) : void 0 === u2[1] ? d2 = -2 : (d2 = c2.lastIndex - u2[2].length, a2 = u2[1], c2 = void 0 === u2[3] ? p : '"' === u2[3] ? $ : g) : c2 === $ || c2 === g ? c2 = p : c2 === _ || c2 === m ? c2 = v : (c2 = p, n3 = void 0);
    const x2 = c2 === p && t2[i4 + 1].startsWith("/>") ? " " : "";
    l2 += c2 === v ? s3 + r$2 : d2 >= 0 ? (e2.push(a2), s3.slice(0, d2) + h + s3.slice(d2) + o$3 + x2) : s3 + o$3 + (-2 === d2 ? i4 : x2);
  }
  return [V(t2, l2 + (t2[s2] || "<?>") + (2 === i3 ? "</svg>" : 3 === i3 ? "</math>" : "")), e2];
};
class S {
  constructor({ strings: t2, _$litType$: i3 }, e2) {
    let r2;
    this.parts = [];
    let l2 = 0, a2 = 0;
    const u2 = t2.length - 1, d2 = this.parts, [f2, v2] = N(t2, i3);
    if (this.el = S.createElement(f2, e2), P.currentNode = this.el.content, 2 === i3 || 3 === i3) {
      const t3 = this.el.content.firstChild;
      t3.replaceWith(...t3.childNodes);
    }
    for (; null !== (r2 = P.nextNode()) && d2.length < u2; ) {
      if (1 === r2.nodeType) {
        if (r2.hasAttributes()) for (const t3 of r2.getAttributeNames()) if (t3.endsWith(h)) {
          const i4 = v2[a2++], s2 = r2.getAttribute(t3).split(o$3), e3 = /([.?@])?(.*)/.exec(i4);
          d2.push({ type: 1, index: l2, name: e3[2], strings: s2, ctor: "." === e3[1] ? I : "?" === e3[1] ? L : "@" === e3[1] ? z : H }), r2.removeAttribute(t3);
        } else t3.startsWith(o$3) && (d2.push({ type: 6, index: l2 }), r2.removeAttribute(t3));
        if (y2.test(r2.tagName)) {
          const t3 = r2.textContent.split(o$3), i4 = t3.length - 1;
          if (i4 > 0) {
            r2.textContent = s$1 ? s$1.emptyScript : "";
            for (let s2 = 0; s2 < i4; s2++) r2.append(t3[s2], c()), P.nextNode(), d2.push({ type: 2, index: ++l2 });
            r2.append(t3[i4], c());
          }
        }
      } else if (8 === r2.nodeType) if (r2.data === n$1) d2.push({ type: 2, index: l2 });
      else {
        let t3 = -1;
        for (; -1 !== (t3 = r2.data.indexOf(o$3, t3 + 1)); ) d2.push({ type: 7, index: l2 }), t3 += o$3.length - 1;
      }
      l2++;
    }
  }
  static createElement(t2, i3) {
    const s2 = l.createElement("template");
    return s2.innerHTML = t2, s2;
  }
}
function M(t2, i3, s2 = t2, e2) {
  if (i3 === E) return i3;
  let h2 = void 0 !== e2 ? s2._$Co?.[e2] : s2._$Cl;
  const o2 = a(i3) ? void 0 : i3._$litDirective$;
  return h2?.constructor !== o2 && (h2?._$AO?.(false), void 0 === o2 ? h2 = void 0 : (h2 = new o2(t2), h2._$AT(t2, s2, e2)), void 0 !== e2 ? (s2._$Co ?? (s2._$Co = []))[e2] = h2 : s2._$Cl = h2), void 0 !== h2 && (i3 = M(t2, h2._$AS(t2, i3.values), h2, e2)), i3;
}
class R {
  constructor(t2, i3) {
    this._$AV = [], this._$AN = void 0, this._$AD = t2, this._$AM = i3;
  }
  get parentNode() {
    return this._$AM.parentNode;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  u(t2) {
    const { el: { content: i3 }, parts: s2 } = this._$AD, e2 = (t2?.creationScope ?? l).importNode(i3, true);
    P.currentNode = e2;
    let h2 = P.nextNode(), o2 = 0, n3 = 0, r2 = s2[0];
    for (; void 0 !== r2; ) {
      if (o2 === r2.index) {
        let i4;
        2 === r2.type ? i4 = new k(h2, h2.nextSibling, this, t2) : 1 === r2.type ? i4 = new r2.ctor(h2, r2.name, r2.strings, this, t2) : 6 === r2.type && (i4 = new Z(h2, this, t2)), this._$AV.push(i4), r2 = s2[++n3];
      }
      o2 !== r2?.index && (h2 = P.nextNode(), o2++);
    }
    return P.currentNode = l, e2;
  }
  p(t2) {
    let i3 = 0;
    for (const s2 of this._$AV) void 0 !== s2 && (void 0 !== s2.strings ? (s2._$AI(t2, s2, i3), i3 += s2.strings.length - 2) : s2._$AI(t2[i3])), i3++;
  }
}
class k {
  get _$AU() {
    return this._$AM?._$AU ?? this._$Cv;
  }
  constructor(t2, i3, s2, e2) {
    this.type = 2, this._$AH = A, this._$AN = void 0, this._$AA = t2, this._$AB = i3, this._$AM = s2, this.options = e2, this._$Cv = e2?.isConnected ?? true;
  }
  get parentNode() {
    let t2 = this._$AA.parentNode;
    const i3 = this._$AM;
    return void 0 !== i3 && 11 === t2?.nodeType && (t2 = i3.parentNode), t2;
  }
  get startNode() {
    return this._$AA;
  }
  get endNode() {
    return this._$AB;
  }
  _$AI(t2, i3 = this) {
    t2 = M(this, t2, i3), a(t2) ? t2 === A || null == t2 || "" === t2 ? (this._$AH !== A && this._$AR(), this._$AH = A) : t2 !== this._$AH && t2 !== E && this._(t2) : void 0 !== t2._$litType$ ? this.$(t2) : void 0 !== t2.nodeType ? this.T(t2) : d(t2) ? this.k(t2) : this._(t2);
  }
  O(t2) {
    return this._$AA.parentNode.insertBefore(t2, this._$AB);
  }
  T(t2) {
    this._$AH !== t2 && (this._$AR(), this._$AH = this.O(t2));
  }
  _(t2) {
    this._$AH !== A && a(this._$AH) ? this._$AA.nextSibling.data = t2 : this.T(l.createTextNode(t2)), this._$AH = t2;
  }
  $(t2) {
    const { values: i3, _$litType$: s2 } = t2, e2 = "number" == typeof s2 ? this._$AC(t2) : (void 0 === s2.el && (s2.el = S.createElement(V(s2.h, s2.h[0]), this.options)), s2);
    if (this._$AH?._$AD === e2) this._$AH.p(i3);
    else {
      const t3 = new R(e2, this), s3 = t3.u(this.options);
      t3.p(i3), this.T(s3), this._$AH = t3;
    }
  }
  _$AC(t2) {
    let i3 = C.get(t2.strings);
    return void 0 === i3 && C.set(t2.strings, i3 = new S(t2)), i3;
  }
  k(t2) {
    u(this._$AH) || (this._$AH = [], this._$AR());
    const i3 = this._$AH;
    let s2, e2 = 0;
    for (const h2 of t2) e2 === i3.length ? i3.push(s2 = new k(this.O(c()), this.O(c()), this, this.options)) : s2 = i3[e2], s2._$AI(h2), e2++;
    e2 < i3.length && (this._$AR(s2 && s2._$AB.nextSibling, e2), i3.length = e2);
  }
  _$AR(t2 = this._$AA.nextSibling, s2) {
    for (this._$AP?.(false, true, s2); t2 !== this._$AB; ) {
      const s3 = i$2(t2).nextSibling;
      i$2(t2).remove(), t2 = s3;
    }
  }
  setConnected(t2) {
    void 0 === this._$AM && (this._$Cv = t2, this._$AP?.(t2));
  }
}
class H {
  get tagName() {
    return this.element.tagName;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  constructor(t2, i3, s2, e2, h2) {
    this.type = 1, this._$AH = A, this._$AN = void 0, this.element = t2, this.name = i3, this._$AM = e2, this.options = h2, s2.length > 2 || "" !== s2[0] || "" !== s2[1] ? (this._$AH = Array(s2.length - 1).fill(new String()), this.strings = s2) : this._$AH = A;
  }
  _$AI(t2, i3 = this, s2, e2) {
    const h2 = this.strings;
    let o2 = false;
    if (void 0 === h2) t2 = M(this, t2, i3, 0), o2 = !a(t2) || t2 !== this._$AH && t2 !== E, o2 && (this._$AH = t2);
    else {
      const e3 = t2;
      let n3, r2;
      for (t2 = h2[0], n3 = 0; n3 < h2.length - 1; n3++) r2 = M(this, e3[s2 + n3], i3, n3), r2 === E && (r2 = this._$AH[n3]), o2 || (o2 = !a(r2) || r2 !== this._$AH[n3]), r2 === A ? t2 = A : t2 !== A && (t2 += (r2 ?? "") + h2[n3 + 1]), this._$AH[n3] = r2;
    }
    o2 && !e2 && this.j(t2);
  }
  j(t2) {
    t2 === A ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, t2 ?? "");
  }
}
class I extends H {
  constructor() {
    super(...arguments), this.type = 3;
  }
  j(t2) {
    this.element[this.name] = t2 === A ? void 0 : t2;
  }
}
class L extends H {
  constructor() {
    super(...arguments), this.type = 4;
  }
  j(t2) {
    this.element.toggleAttribute(this.name, !!t2 && t2 !== A);
  }
}
class z extends H {
  constructor(t2, i3, s2, e2, h2) {
    super(t2, i3, s2, e2, h2), this.type = 5;
  }
  _$AI(t2, i3 = this) {
    if ((t2 = M(this, t2, i3, 0) ?? A) === E) return;
    const s2 = this._$AH, e2 = t2 === A && s2 !== A || t2.capture !== s2.capture || t2.once !== s2.once || t2.passive !== s2.passive, h2 = t2 !== A && (s2 === A || e2);
    e2 && this.element.removeEventListener(this.name, this, s2), h2 && this.element.addEventListener(this.name, this, t2), this._$AH = t2;
  }
  handleEvent(t2) {
    "function" == typeof this._$AH ? this._$AH.call(this.options?.host ?? this.element, t2) : this._$AH.handleEvent(t2);
  }
}
class Z {
  constructor(t2, i3, s2) {
    this.element = t2, this.type = 6, this._$AN = void 0, this._$AM = i3, this.options = s2;
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AI(t2) {
    M(this, t2);
  }
}
const B = t$2.litHtmlPolyfillSupport;
B?.(S, k), (t$2.litHtmlVersions ?? (t$2.litHtmlVersions = [])).push("3.3.2");
const D = (t2, i3, s2) => {
  const e2 = s2?.renderBefore ?? i3;
  let h2 = e2._$litPart$;
  if (void 0 === h2) {
    const t3 = s2?.renderBefore ?? null;
    e2._$litPart$ = h2 = new k(i3.insertBefore(c(), t3), t3, void 0, s2 ?? {});
  }
  return h2._$AI(t2), h2;
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const s = globalThis;
let i$1 = class i extends y$1 {
  constructor() {
    super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
  }
  createRenderRoot() {
    var _a2;
    const t2 = super.createRenderRoot();
    return (_a2 = this.renderOptions).renderBefore ?? (_a2.renderBefore = t2.firstChild), t2;
  }
  update(t2) {
    const r2 = this.render();
    this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(t2), this._$Do = D(r2, this.renderRoot, this.renderOptions);
  }
  connectedCallback() {
    super.connectedCallback(), this._$Do?.setConnected(true);
  }
  disconnectedCallback() {
    super.disconnectedCallback(), this._$Do?.setConnected(false);
  }
  render() {
    return E;
  }
};
i$1._$litElement$ = true, i$1["finalized"] = true, s.litElementHydrateSupport?.({ LitElement: i$1 });
const o$2 = s.litElementPolyfillSupport;
o$2?.({ LitElement: i$1 });
(s.litElementVersions ?? (s.litElementVersions = [])).push("4.2.2");
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const t$1 = (t2) => (e2, o2) => {
  void 0 !== o2 ? o2.addInitializer(() => {
    customElements.define(t2, e2);
  }) : customElements.define(t2, e2);
};
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const o$1 = { attribute: true, type: String, converter: u$1, reflect: false, hasChanged: f$1 }, r$1 = (t2 = o$1, e2, r2) => {
  const { kind: n3, metadata: i3 } = r2;
  let s2 = globalThis.litPropertyMetadata.get(i3);
  if (void 0 === s2 && globalThis.litPropertyMetadata.set(i3, s2 = /* @__PURE__ */ new Map()), "setter" === n3 && ((t2 = Object.create(t2)).wrapped = true), s2.set(r2.name, t2), "accessor" === n3) {
    const { name: o2 } = r2;
    return { set(r3) {
      const n4 = e2.get.call(this);
      e2.set.call(this, r3), this.requestUpdate(o2, n4, t2, true, r3);
    }, init(e3) {
      return void 0 !== e3 && this.C(o2, void 0, t2, e3), e3;
    } };
  }
  if ("setter" === n3) {
    const { name: o2 } = r2;
    return function(r3) {
      const n4 = this[o2];
      e2.call(this, r3), this.requestUpdate(o2, n4, t2, true, r3);
    };
  }
  throw Error("Unsupported decorator location: " + n3);
};
function n2(t2) {
  return (e2, o2) => "object" == typeof o2 ? r$1(t2, e2, o2) : ((t3, e3, o3) => {
    const r2 = e3.hasOwnProperty(o3);
    return e3.constructor.createProperty(o3, t3), r2 ? Object.getOwnPropertyDescriptor(e3, o3) : void 0;
  })(t2, e2, o2);
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
function r(r2) {
  return n2({ ...r2, state: true, attribute: false });
}
var __defProp$b = Object.defineProperty;
var __getOwnPropDesc$b = Object.getOwnPropertyDescriptor;
var __decorateClass$b = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$b(target, key) : target;
  for (var i3 = decorators.length - 1, decorator; i3 >= 0; i3--)
    if (decorator = decorators[i3])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$b(target, key, result);
  return result;
};
let FabCallout = class extends i$1 {
  constructor() {
    super(...arguments);
    this.title = "";
    this.text = "";
    this.linkHref = "";
    this.linkText = "";
  }
  render() {
    return b`
      <div class="callout">
        <div class="content">
          <div class="icon">
            ${this.renderLightbulbIcon()}
          </div>
          <div class="text-content">
            <h4>${this.title}</h4>
            <p>${this.text}</p>
          </div>
        </div>
        ${this.linkHref && this.linkText ? b`
          <div class="link">
            <a href="${this.linkHref}" target="_blank" rel="noopener noreferrer">
              ${this.linkText}
              ${this.renderExternalLinkIcon()}
            </a>
          </div>
        ` : ""}
      </div>
    `;
  }
  renderLightbulbIcon() {
    return b`
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
        <path d="M9 18h6"/>
        <path d="M10 22h4"/>
      </svg>
    `;
  }
  renderExternalLinkIcon() {
    return b`
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/>
        <line x1="10" x2="21" y1="14" y2="3"/>
      </svg>
    `;
  }
};
FabCallout.styles = i$4`
    :host {
      /* CSS Variables for theming */
      --fab-callout-bg: #f0f9ff;
      --fab-callout-border: #3b82f6;
      --fab-callout-text: #1e293b;
      --fab-callout-text-muted: #64748b;
      --fab-callout-icon-color: #3b82f6;
      --fab-callout-link-bg: #3b82f6;
      --fab-callout-link-text: #ffffff;
      --fab-callout-link-hover-bg: #2563eb;

      display: block;
      margin: 2rem 0;
    }

    .callout {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      padding: 1.5rem;
      background: var(--fab-callout-bg);
      border: 1px solid var(--fab-callout-border);
      border-radius: 0.5rem;
    }

    @media (min-width: 640px) {
      .callout {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
      }
    }

    .content {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      flex: 1;
    }

    .icon {
      flex-shrink: 0;
      margin-top: 0.25rem;
      color: var(--fab-callout-icon-color);
    }

    .icon svg {
      width: 1.5rem;
      height: 1.5rem;
    }

    .text-content h4 {
      margin: 0 0 0.25rem 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--fab-callout-text);
    }

    .text-content p {
      margin: 0;
      font-size: 0.875rem;
      color: var(--fab-callout-text-muted);
    }

    .link {
      flex-shrink: 0;
      width: 100%;
    }

    @media (min-width: 640px) {
      .link {
        width: auto;
      }
    }

    .link a {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: var(--fab-callout-link-bg);
      color: var(--fab-callout-link-text);
      text-decoration: none;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 500;
      transition: background-color 0.2s;
      width: 100%;
      justify-content: center;
    }

    @media (min-width: 640px) {
      .link a {
        width: auto;
      }
    }

    .link a:hover {
      background: var(--fab-callout-link-hover-bg);
    }

    .link svg {
      width: 1rem;
      height: 1rem;
    }
  `;
__decorateClass$b([
  n2()
], FabCallout.prototype, "title", 2);
__decorateClass$b([
  n2()
], FabCallout.prototype, "text", 2);
__decorateClass$b([
  n2({ attribute: "link-href" })
], FabCallout.prototype, "linkHref", 2);
__decorateClass$b([
  n2({ attribute: "link-text" })
], FabCallout.prototype, "linkText", 2);
FabCallout = __decorateClass$b([
  t$1("fab-callout")
], FabCallout);
var __defProp$a = Object.defineProperty;
var __getOwnPropDesc$a = Object.getOwnPropertyDescriptor;
var __decorateClass$a = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$a(target, key) : target;
  for (var i3 = decorators.length - 1, decorator; i3 >= 0; i3--)
    if (decorator = decorators[i3])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$a(target, key, result);
  return result;
};
let FabCreatorSpotlight = class extends i$1 {
  constructor() {
    super(...arguments);
    this.imageUrl = "";
    this.name = "";
    this.bio = "";
    this.links = "";
  }
  // JSON string
  render() {
    const hasSlots = this.querySelector("[slot]");
    return b`
      <div class="spotlight">
        <div class="content">
          <div class="avatar">
            ${this.imageUrl ? b`
              <img src="${this.imageUrl}" alt="${this.name || "Creator avatar"}" />
            ` : b`
              <div class="avatar-placeholder">
                ${this.renderUserIcon()}
              </div>
            `}
          </div>
          <div class="info">
            ${hasSlots ? this.renderSlotMode() : this.renderAttributeMode()}
          </div>
        </div>
      </div>
    `;
  }
  renderSlotMode() {
    return b`
      <slot name="header"></slot>
      <slot name="links"></slot>
    `;
  }
  renderAttributeMode() {
    const linkArray = this.parseLinks();
    return b`
      ${this.name ? b`<h3 class="name">${this.name}</h3>` : ""}
      ${this.bio ? b`<p class="bio">${this.bio}</p>` : ""}
      ${linkArray.length > 0 ? b`
        <div class="links-container">
          ${linkArray.map((link2) => b`
            <a
              href="${link2.href}"
              class="link-button"
              target="_blank"
              rel="noopener noreferrer"
            >
              ${this.renderLinkIcon(link2.icon)}
              ${link2.label}
            </a>
          `)}
        </div>
      ` : ""}
    `;
  }
  parseLinks() {
    if (!this.links) return [];
    try {
      return JSON.parse(this.links);
    } catch (e2) {
      console.error("Failed to parse links JSON:", e2);
      return [];
    }
  }
  renderUserIcon() {
    return b`
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    `;
  }
  renderLinkIcon(icon) {
    switch (icon) {
      case "patreon":
        return b`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        `;
      case "discord":
        return b`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        `;
      case "guide":
      case "decklist":
        return b`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        `;
      default:
        return b`
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" x2="21" y1="14" y2="3"/>
          </svg>
        `;
    }
  }
};
FabCreatorSpotlight.styles = i$4`
    :host {
      /* CSS Variables for theming */
      --fab-spotlight-bg-start: #dbeafe;
      --fab-spotlight-bg-end: #e0e7ff;
      --fab-spotlight-border: #cbd5e1;
      --fab-spotlight-text: #0f172a;
      --fab-spotlight-text-muted: #475569;
      --fab-spotlight-avatar-bg: #ffffff;
      --fab-spotlight-link-bg: #ffffff;
      --fab-spotlight-link-text: #3b82f6;
      --fab-spotlight-link-border: #cbd5e1;
      --fab-spotlight-link-hover-bg: #f1f5f9;

      display: block;
      margin: 2rem 0;
    }

    .spotlight {
      background: linear-gradient(to right, var(--fab-spotlight-bg-start), var(--fab-spotlight-bg-end));
      border: 1px solid var(--fab-spotlight-border);
      border-radius: 0.5rem;
      padding: 1.5rem;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }

    .content {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
    }

    .avatar {
      flex-shrink: 0;
      background: var(--fab-spotlight-avatar-bg);
      border-radius: 9999px;
      padding: 0.25rem;
      box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
    }

    .avatar img {
      width: 4.375rem;
      height: 4.375rem;
      border-radius: 9999px;
      object-fit: cover;
    }

    .avatar-placeholder {
      width: 4.375rem;
      height: 4.375rem;
      border-radius: 9999px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .avatar-placeholder svg {
      width: 2.5rem;
      height: 2.5rem;
      color: #6366f1;
    }

    .info {
      flex: 1;
      min-width: 0;
    }

    /* Simple mode styles */
    .name {
      margin: 0 0 0.5rem 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--fab-spotlight-text);
    }

    .bio {
      margin: 0 0 1rem 0;
      font-size: 0.875rem;
      color: var(--fab-spotlight-text-muted);
      line-height: 1.5;
    }

    .links-container {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .link-button {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: var(--fab-spotlight-link-bg);
      color: var(--fab-spotlight-link-text);
      border: 1px solid var(--fab-spotlight-link-border);
      border-radius: 0.375rem;
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      transition: background-color 0.2s;
    }

    .link-button:hover {
      background: var(--fab-spotlight-link-hover-bg);
    }

    .link-button svg {
      width: 1rem;
      height: 1rem;
    }

    /* Slot styles */
    ::slotted([slot="header"]) {
      margin-bottom: 1rem;
    }

    ::slotted([slot="header"] h3) {
      margin: 0 0 0.5rem 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--fab-spotlight-text);
    }

    ::slotted([slot="header"] p) {
      margin: 0;
      font-size: 0.875rem;
      color: var(--fab-spotlight-text-muted);
      line-height: 1.5;
    }
  `;
__decorateClass$a([
  n2({ attribute: "image-url" })
], FabCreatorSpotlight.prototype, "imageUrl", 2);
__decorateClass$a([
  n2()
], FabCreatorSpotlight.prototype, "name", 2);
__decorateClass$a([
  n2()
], FabCreatorSpotlight.prototype, "bio", 2);
__decorateClass$a([
  n2()
], FabCreatorSpotlight.prototype, "links", 2);
FabCreatorSpotlight = __decorateClass$a([
  t$1("fab-creator-spotlight")
], FabCreatorSpotlight);
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const t = { CHILD: 2 }, e$1 = (t2) => (...e2) => ({ _$litDirective$: t2, values: e2 });
class i2 {
  constructor(t2) {
  }
  get _$AU() {
    return this._$AM._$AU;
  }
  _$AT(t2, e2, i3) {
    this._$Ct = t2, this._$AM = e2, this._$Ci = i3;
  }
  _$AS(t2, e2) {
    return this.update(t2, e2);
  }
  update(t2, e2) {
    return this.render(...e2);
  }
}
/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
class e extends i2 {
  constructor(i3) {
    if (super(i3), this.it = A, i3.type !== t.CHILD) throw Error(this.constructor.directiveName + "() can only be used in child bindings");
  }
  render(r2) {
    if (r2 === A || null == r2) return this._t = void 0, this.it = r2;
    if (r2 === E) return r2;
    if ("string" != typeof r2) throw Error(this.constructor.directiveName + "() called with a non-string value");
    if (r2 === this.it) return this._t;
    this.it = r2;
    const s2 = [r2];
    return s2.raw = s2, this._t = { _$litType$: this.constructor.resultType, strings: s2, values: [] };
  }
}
e.directiveName = "unsafeHTML", e.resultType = 1;
const o = e$1(e);
function _getDefaults() {
  return {
    async: false,
    breaks: false,
    extensions: null,
    gfm: true,
    hooks: null,
    pedantic: false,
    renderer: null,
    silent: false,
    tokenizer: null,
    walkTokens: null
  };
}
var _defaults = _getDefaults();
function changeDefaults(newDefaults) {
  _defaults = newDefaults;
}
var noopTest = { exec: () => null };
function edit(regex, opt = "") {
  let source = typeof regex === "string" ? regex : regex.source;
  const obj = {
    replace: (name, val) => {
      let valSource = typeof val === "string" ? val : val.source;
      valSource = valSource.replace(other.caret, "$1");
      source = source.replace(name, valSource);
      return obj;
    },
    getRegex: () => {
      return new RegExp(source, opt);
    }
  };
  return obj;
}
var other = {
  codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm,
  outputLinkReplace: /\\([\[\]])/g,
  indentCodeCompensation: /^(\s+)(?:```)/,
  beginningSpace: /^\s+/,
  endingHash: /#$/,
  startingSpaceChar: /^ /,
  endingSpaceChar: / $/,
  nonSpaceChar: /[^ ]/,
  newLineCharGlobal: /\n/g,
  tabCharGlobal: /\t/g,
  multipleSpaceGlobal: /\s+/g,
  blankLine: /^[ \t]*$/,
  doubleBlankLine: /\n[ \t]*\n[ \t]*$/,
  blockquoteStart: /^ {0,3}>/,
  blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g,
  blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,
  listReplaceTabs: /^\t+/,
  listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
  listIsTask: /^\[[ xX]\] /,
  listReplaceTask: /^\[[ xX]\] +/,
  anyLine: /\n.*\n/,
  hrefBrackets: /^<(.*)>$/,
  tableDelimiter: /[:|]/,
  tableAlignChars: /^\||\| *$/g,
  tableRowBlankLine: /\n[ \t]*$/,
  tableAlignRight: /^ *-+: *$/,
  tableAlignCenter: /^ *:-+: *$/,
  tableAlignLeft: /^ *:-+ *$/,
  startATag: /^<a /i,
  endATag: /^<\/a>/i,
  startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
  endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i,
  startAngleBracket: /^</,
  endAngleBracket: />$/,
  pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/,
  unicodeAlphaNumeric: /[\p{L}\p{N}]/u,
  escapeTest: /[&<>"']/,
  escapeReplace: /[&<>"']/g,
  escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
  escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
  unescapeTest: /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig,
  caret: /(^|[^\[])\^/g,
  percentDecode: /%25/g,
  findPipe: /\|/g,
  splitPipe: / \|/,
  slashPipe: /\\\|/g,
  carriageReturn: /\r\n|\r/g,
  spaceLine: /^ +$/gm,
  notSpaceStart: /^\S*/,
  endingNewline: /\n$/,
  listItemRegex: (bull) => new RegExp(`^( {0,3}${bull})((?:[	 ][^\\n]*)?(?:\\n|$))`),
  nextBulletRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`),
  hrRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),
  fencesBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:\`\`\`|~~~)`),
  headingBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}#`),
  htmlBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}<(?:[a-z].*>|!--)`, "i")
};
var newline = /^(?:[ \t]*(?:\n|$))+/;
var blockCode = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
var fences = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
var hr = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
var heading = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
var bullet = /(?:[*+-]|\d{1,9}[.)])/;
var lheadingCore = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
var lheading = edit(lheadingCore).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
var lheadingGfm = edit(lheadingCore).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
var _paragraph = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;
var blockText = /^[^\n]+/;
var _blockLabel = /(?!\s*\])(?:\\.|[^\[\]\\])+/;
var def = edit(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", _blockLabel).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
var list = edit(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g, bullet).getRegex();
var _tag = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
var _comment = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
var html = edit(
  "^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))",
  "i"
).replace("comment", _comment).replace("tag", _tag).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
var paragraph = edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
var blockquote = edit(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", paragraph).getRegex();
var blockNormal = {
  blockquote,
  code: blockCode,
  def,
  fences,
  heading,
  hr,
  html,
  lheading,
  list,
  newline,
  paragraph,
  table: noopTest,
  text: blockText
};
var gfmTable = edit(
  "^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)"
).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
var blockGfm = {
  ...blockNormal,
  lheading: lheadingGfm,
  table: gfmTable,
  paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", gfmTable).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex()
};
var blockPedantic = {
  ...blockNormal,
  html: edit(
    `^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`
  ).replace("comment", _comment).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),
  def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
  heading: /^(#{1,6})(.*)(?:\n+|$)/,
  fences: noopTest,
  // fences not supported
  lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
  paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " *#{1,6} *[^\n]").replace("lheading", lheading).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex()
};
var escape = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
var inlineCode = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
var br = /^( {2,}|\\)\n(?!\s*$)/;
var inlineText = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
var _punctuation = /[\p{P}\p{S}]/u;
var _punctuationOrSpace = /[\s\p{P}\p{S}]/u;
var _notPunctuationOrSpace = /[^\s\p{P}\p{S}]/u;
var punctuation = edit(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, _punctuationOrSpace).getRegex();
var _punctuationGfmStrongEm = /(?!~)[\p{P}\p{S}]/u;
var _punctuationOrSpaceGfmStrongEm = /(?!~)[\s\p{P}\p{S}]/u;
var _notPunctuationOrSpaceGfmStrongEm = /(?:[^\s\p{P}\p{S}]|~)/u;
var blockSkip = /\[[^[\]]*?\]\((?:\\.|[^\\\(\)]|\((?:\\.|[^\\\(\)])*\))*\)|`[^`]*?`|<[^<>]*?>/g;
var emStrongLDelimCore = /^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/;
var emStrongLDelim = edit(emStrongLDelimCore, "u").replace(/punct/g, _punctuation).getRegex();
var emStrongLDelimGfm = edit(emStrongLDelimCore, "u").replace(/punct/g, _punctuationGfmStrongEm).getRegex();
var emStrongRDelimAstCore = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
var emStrongRDelimAst = edit(emStrongRDelimAstCore, "gu").replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
var emStrongRDelimAstGfm = edit(emStrongRDelimAstCore, "gu").replace(/notPunctSpace/g, _notPunctuationOrSpaceGfmStrongEm).replace(/punctSpace/g, _punctuationOrSpaceGfmStrongEm).replace(/punct/g, _punctuationGfmStrongEm).getRegex();
var emStrongRDelimUnd = edit(
  "^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)",
  "gu"
).replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
var anyPunctuation = edit(/\\(punct)/, "gu").replace(/punct/g, _punctuation).getRegex();
var autolink = edit(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
var _inlineComment = edit(_comment).replace("(?:-->|$)", "-->").getRegex();
var tag = edit(
  "^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>"
).replace("comment", _inlineComment).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
var _inlineLabel = /(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/;
var link = edit(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/).replace("label", _inlineLabel).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
var reflink = edit(/^!?\[(label)\]\[(ref)\]/).replace("label", _inlineLabel).replace("ref", _blockLabel).getRegex();
var nolink = edit(/^!?\[(ref)\](?:\[\])?/).replace("ref", _blockLabel).getRegex();
var reflinkSearch = edit("reflink|nolink(?!\\()", "g").replace("reflink", reflink).replace("nolink", nolink).getRegex();
var inlineNormal = {
  _backpedal: noopTest,
  // only used for GFM url
  anyPunctuation,
  autolink,
  blockSkip,
  br,
  code: inlineCode,
  del: noopTest,
  emStrongLDelim,
  emStrongRDelimAst,
  emStrongRDelimUnd,
  escape,
  link,
  nolink,
  punctuation,
  reflink,
  reflinkSearch,
  tag,
  text: inlineText,
  url: noopTest
};
var inlinePedantic = {
  ...inlineNormal,
  link: edit(/^!?\[(label)\]\((.*?)\)/).replace("label", _inlineLabel).getRegex(),
  reflink: edit(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", _inlineLabel).getRegex()
};
var inlineGfm = {
  ...inlineNormal,
  emStrongRDelimAst: emStrongRDelimAstGfm,
  emStrongLDelim: emStrongLDelimGfm,
  url: edit(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/, "i").replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),
  _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
  del: /^(~~?)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/,
  text: /^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/
};
var inlineBreaks = {
  ...inlineGfm,
  br: edit(br).replace("{2,}", "*").getRegex(),
  text: edit(inlineGfm.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex()
};
var block = {
  normal: blockNormal,
  gfm: blockGfm,
  pedantic: blockPedantic
};
var inline = {
  normal: inlineNormal,
  gfm: inlineGfm,
  breaks: inlineBreaks,
  pedantic: inlinePedantic
};
var escapeReplacements = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};
var getEscapeReplacement = (ch) => escapeReplacements[ch];
function escape2(html2, encode) {
  if (encode) {
    if (other.escapeTest.test(html2)) {
      return html2.replace(other.escapeReplace, getEscapeReplacement);
    }
  } else {
    if (other.escapeTestNoEncode.test(html2)) {
      return html2.replace(other.escapeReplaceNoEncode, getEscapeReplacement);
    }
  }
  return html2;
}
function cleanUrl(href) {
  try {
    href = encodeURI(href).replace(other.percentDecode, "%");
  } catch {
    return null;
  }
  return href;
}
function splitCells(tableRow, count) {
  const row = tableRow.replace(other.findPipe, (match, offset, str) => {
    let escaped = false;
    let curr = offset;
    while (--curr >= 0 && str[curr] === "\\") escaped = !escaped;
    if (escaped) {
      return "|";
    } else {
      return " |";
    }
  }), cells = row.split(other.splitPipe);
  let i3 = 0;
  if (!cells[0].trim()) {
    cells.shift();
  }
  if (cells.length > 0 && !cells.at(-1)?.trim()) {
    cells.pop();
  }
  if (count) {
    if (cells.length > count) {
      cells.splice(count);
    } else {
      while (cells.length < count) cells.push("");
    }
  }
  for (; i3 < cells.length; i3++) {
    cells[i3] = cells[i3].trim().replace(other.slashPipe, "|");
  }
  return cells;
}
function rtrim(str, c2, invert) {
  const l2 = str.length;
  if (l2 === 0) {
    return "";
  }
  let suffLen = 0;
  while (suffLen < l2) {
    const currChar = str.charAt(l2 - suffLen - 1);
    if (currChar === c2 && true) {
      suffLen++;
    } else {
      break;
    }
  }
  return str.slice(0, l2 - suffLen);
}
function findClosingBracket(str, b2) {
  if (str.indexOf(b2[1]) === -1) {
    return -1;
  }
  let level = 0;
  for (let i3 = 0; i3 < str.length; i3++) {
    if (str[i3] === "\\") {
      i3++;
    } else if (str[i3] === b2[0]) {
      level++;
    } else if (str[i3] === b2[1]) {
      level--;
      if (level < 0) {
        return i3;
      }
    }
  }
  if (level > 0) {
    return -2;
  }
  return -1;
}
function outputLink(cap, link2, raw, lexer2, rules) {
  const href = link2.href;
  const title = link2.title || null;
  const text = cap[1].replace(rules.other.outputLinkReplace, "$1");
  lexer2.state.inLink = true;
  const token = {
    type: cap[0].charAt(0) === "!" ? "image" : "link",
    raw,
    href,
    title,
    text,
    tokens: lexer2.inlineTokens(text)
  };
  lexer2.state.inLink = false;
  return token;
}
function indentCodeCompensation(raw, text, rules) {
  const matchIndentToCode = raw.match(rules.other.indentCodeCompensation);
  if (matchIndentToCode === null) {
    return text;
  }
  const indentToCode = matchIndentToCode[1];
  return text.split("\n").map((node) => {
    const matchIndentInNode = node.match(rules.other.beginningSpace);
    if (matchIndentInNode === null) {
      return node;
    }
    const [indentInNode] = matchIndentInNode;
    if (indentInNode.length >= indentToCode.length) {
      return node.slice(indentToCode.length);
    }
    return node;
  }).join("\n");
}
var _Tokenizer = class {
  // set by the lexer
  constructor(options2) {
    __publicField(this, "options");
    __publicField(this, "rules");
    // set by the lexer
    __publicField(this, "lexer");
    this.options = options2 || _defaults;
  }
  space(src) {
    const cap = this.rules.block.newline.exec(src);
    if (cap && cap[0].length > 0) {
      return {
        type: "space",
        raw: cap[0]
      };
    }
  }
  code(src) {
    const cap = this.rules.block.code.exec(src);
    if (cap) {
      const text = cap[0].replace(this.rules.other.codeRemoveIndent, "");
      return {
        type: "code",
        raw: cap[0],
        codeBlockStyle: "indented",
        text: !this.options.pedantic ? rtrim(text, "\n") : text
      };
    }
  }
  fences(src) {
    const cap = this.rules.block.fences.exec(src);
    if (cap) {
      const raw = cap[0];
      const text = indentCodeCompensation(raw, cap[3] || "", this.rules);
      return {
        type: "code",
        raw,
        lang: cap[2] ? cap[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : cap[2],
        text
      };
    }
  }
  heading(src) {
    const cap = this.rules.block.heading.exec(src);
    if (cap) {
      let text = cap[2].trim();
      if (this.rules.other.endingHash.test(text)) {
        const trimmed = rtrim(text, "#");
        if (this.options.pedantic) {
          text = trimmed.trim();
        } else if (!trimmed || this.rules.other.endingSpaceChar.test(trimmed)) {
          text = trimmed.trim();
        }
      }
      return {
        type: "heading",
        raw: cap[0],
        depth: cap[1].length,
        text,
        tokens: this.lexer.inline(text)
      };
    }
  }
  hr(src) {
    const cap = this.rules.block.hr.exec(src);
    if (cap) {
      return {
        type: "hr",
        raw: rtrim(cap[0], "\n")
      };
    }
  }
  blockquote(src) {
    const cap = this.rules.block.blockquote.exec(src);
    if (cap) {
      let lines = rtrim(cap[0], "\n").split("\n");
      let raw = "";
      let text = "";
      const tokens = [];
      while (lines.length > 0) {
        let inBlockquote = false;
        const currentLines = [];
        let i3;
        for (i3 = 0; i3 < lines.length; i3++) {
          if (this.rules.other.blockquoteStart.test(lines[i3])) {
            currentLines.push(lines[i3]);
            inBlockquote = true;
          } else if (!inBlockquote) {
            currentLines.push(lines[i3]);
          } else {
            break;
          }
        }
        lines = lines.slice(i3);
        const currentRaw = currentLines.join("\n");
        const currentText = currentRaw.replace(this.rules.other.blockquoteSetextReplace, "\n    $1").replace(this.rules.other.blockquoteSetextReplace2, "");
        raw = raw ? `${raw}
${currentRaw}` : currentRaw;
        text = text ? `${text}
${currentText}` : currentText;
        const top = this.lexer.state.top;
        this.lexer.state.top = true;
        this.lexer.blockTokens(currentText, tokens, true);
        this.lexer.state.top = top;
        if (lines.length === 0) {
          break;
        }
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "code") {
          break;
        } else if (lastToken?.type === "blockquote") {
          const oldToken = lastToken;
          const newText = oldToken.raw + "\n" + lines.join("\n");
          const newToken = this.blockquote(newText);
          tokens[tokens.length - 1] = newToken;
          raw = raw.substring(0, raw.length - oldToken.raw.length) + newToken.raw;
          text = text.substring(0, text.length - oldToken.text.length) + newToken.text;
          break;
        } else if (lastToken?.type === "list") {
          const oldToken = lastToken;
          const newText = oldToken.raw + "\n" + lines.join("\n");
          const newToken = this.list(newText);
          tokens[tokens.length - 1] = newToken;
          raw = raw.substring(0, raw.length - lastToken.raw.length) + newToken.raw;
          text = text.substring(0, text.length - oldToken.raw.length) + newToken.raw;
          lines = newText.substring(tokens.at(-1).raw.length).split("\n");
          continue;
        }
      }
      return {
        type: "blockquote",
        raw,
        tokens,
        text
      };
    }
  }
  list(src) {
    let cap = this.rules.block.list.exec(src);
    if (cap) {
      let bull = cap[1].trim();
      const isordered = bull.length > 1;
      const list2 = {
        type: "list",
        raw: "",
        ordered: isordered,
        start: isordered ? +bull.slice(0, -1) : "",
        loose: false,
        items: []
      };
      bull = isordered ? `\\d{1,9}\\${bull.slice(-1)}` : `\\${bull}`;
      if (this.options.pedantic) {
        bull = isordered ? bull : "[*+-]";
      }
      const itemRegex = this.rules.other.listItemRegex(bull);
      let endsWithBlankLine = false;
      while (src) {
        let endEarly = false;
        let raw = "";
        let itemContents = "";
        if (!(cap = itemRegex.exec(src))) {
          break;
        }
        if (this.rules.block.hr.test(src)) {
          break;
        }
        raw = cap[0];
        src = src.substring(raw.length);
        let line = cap[2].split("\n", 1)[0].replace(this.rules.other.listReplaceTabs, (t2) => " ".repeat(3 * t2.length));
        let nextLine = src.split("\n", 1)[0];
        let blankLine = !line.trim();
        let indent = 0;
        if (this.options.pedantic) {
          indent = 2;
          itemContents = line.trimStart();
        } else if (blankLine) {
          indent = cap[1].length + 1;
        } else {
          indent = cap[2].search(this.rules.other.nonSpaceChar);
          indent = indent > 4 ? 1 : indent;
          itemContents = line.slice(indent);
          indent += cap[1].length;
        }
        if (blankLine && this.rules.other.blankLine.test(nextLine)) {
          raw += nextLine + "\n";
          src = src.substring(nextLine.length + 1);
          endEarly = true;
        }
        if (!endEarly) {
          const nextBulletRegex = this.rules.other.nextBulletRegex(indent);
          const hrRegex = this.rules.other.hrRegex(indent);
          const fencesBeginRegex = this.rules.other.fencesBeginRegex(indent);
          const headingBeginRegex = this.rules.other.headingBeginRegex(indent);
          const htmlBeginRegex = this.rules.other.htmlBeginRegex(indent);
          while (src) {
            const rawLine = src.split("\n", 1)[0];
            let nextLineWithoutTabs;
            nextLine = rawLine;
            if (this.options.pedantic) {
              nextLine = nextLine.replace(this.rules.other.listReplaceNesting, "  ");
              nextLineWithoutTabs = nextLine;
            } else {
              nextLineWithoutTabs = nextLine.replace(this.rules.other.tabCharGlobal, "    ");
            }
            if (fencesBeginRegex.test(nextLine)) {
              break;
            }
            if (headingBeginRegex.test(nextLine)) {
              break;
            }
            if (htmlBeginRegex.test(nextLine)) {
              break;
            }
            if (nextBulletRegex.test(nextLine)) {
              break;
            }
            if (hrRegex.test(nextLine)) {
              break;
            }
            if (nextLineWithoutTabs.search(this.rules.other.nonSpaceChar) >= indent || !nextLine.trim()) {
              itemContents += "\n" + nextLineWithoutTabs.slice(indent);
            } else {
              if (blankLine) {
                break;
              }
              if (line.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4) {
                break;
              }
              if (fencesBeginRegex.test(line)) {
                break;
              }
              if (headingBeginRegex.test(line)) {
                break;
              }
              if (hrRegex.test(line)) {
                break;
              }
              itemContents += "\n" + nextLine;
            }
            if (!blankLine && !nextLine.trim()) {
              blankLine = true;
            }
            raw += rawLine + "\n";
            src = src.substring(rawLine.length + 1);
            line = nextLineWithoutTabs.slice(indent);
          }
        }
        if (!list2.loose) {
          if (endsWithBlankLine) {
            list2.loose = true;
          } else if (this.rules.other.doubleBlankLine.test(raw)) {
            endsWithBlankLine = true;
          }
        }
        let istask = null;
        let ischecked;
        if (this.options.gfm) {
          istask = this.rules.other.listIsTask.exec(itemContents);
          if (istask) {
            ischecked = istask[0] !== "[ ] ";
            itemContents = itemContents.replace(this.rules.other.listReplaceTask, "");
          }
        }
        list2.items.push({
          type: "list_item",
          raw,
          task: !!istask,
          checked: ischecked,
          loose: false,
          text: itemContents,
          tokens: []
        });
        list2.raw += raw;
      }
      const lastItem = list2.items.at(-1);
      if (lastItem) {
        lastItem.raw = lastItem.raw.trimEnd();
        lastItem.text = lastItem.text.trimEnd();
      } else {
        return;
      }
      list2.raw = list2.raw.trimEnd();
      for (let i3 = 0; i3 < list2.items.length; i3++) {
        this.lexer.state.top = false;
        list2.items[i3].tokens = this.lexer.blockTokens(list2.items[i3].text, []);
        if (!list2.loose) {
          const spacers = list2.items[i3].tokens.filter((t2) => t2.type === "space");
          const hasMultipleLineBreaks = spacers.length > 0 && spacers.some((t2) => this.rules.other.anyLine.test(t2.raw));
          list2.loose = hasMultipleLineBreaks;
        }
      }
      if (list2.loose) {
        for (let i3 = 0; i3 < list2.items.length; i3++) {
          list2.items[i3].loose = true;
        }
      }
      return list2;
    }
  }
  html(src) {
    const cap = this.rules.block.html.exec(src);
    if (cap) {
      const token = {
        type: "html",
        block: true,
        raw: cap[0],
        pre: cap[1] === "pre" || cap[1] === "script" || cap[1] === "style",
        text: cap[0]
      };
      return token;
    }
  }
  def(src) {
    const cap = this.rules.block.def.exec(src);
    if (cap) {
      const tag2 = cap[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " ");
      const href = cap[2] ? cap[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "";
      const title = cap[3] ? cap[3].substring(1, cap[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : cap[3];
      return {
        type: "def",
        tag: tag2,
        raw: cap[0],
        href,
        title
      };
    }
  }
  table(src) {
    const cap = this.rules.block.table.exec(src);
    if (!cap) {
      return;
    }
    if (!this.rules.other.tableDelimiter.test(cap[2])) {
      return;
    }
    const headers = splitCells(cap[1]);
    const aligns = cap[2].replace(this.rules.other.tableAlignChars, "").split("|");
    const rows = cap[3]?.trim() ? cap[3].replace(this.rules.other.tableRowBlankLine, "").split("\n") : [];
    const item = {
      type: "table",
      raw: cap[0],
      header: [],
      align: [],
      rows: []
    };
    if (headers.length !== aligns.length) {
      return;
    }
    for (const align of aligns) {
      if (this.rules.other.tableAlignRight.test(align)) {
        item.align.push("right");
      } else if (this.rules.other.tableAlignCenter.test(align)) {
        item.align.push("center");
      } else if (this.rules.other.tableAlignLeft.test(align)) {
        item.align.push("left");
      } else {
        item.align.push(null);
      }
    }
    for (let i3 = 0; i3 < headers.length; i3++) {
      item.header.push({
        text: headers[i3],
        tokens: this.lexer.inline(headers[i3]),
        header: true,
        align: item.align[i3]
      });
    }
    for (const row of rows) {
      item.rows.push(splitCells(row, item.header.length).map((cell, i3) => {
        return {
          text: cell,
          tokens: this.lexer.inline(cell),
          header: false,
          align: item.align[i3]
        };
      }));
    }
    return item;
  }
  lheading(src) {
    const cap = this.rules.block.lheading.exec(src);
    if (cap) {
      return {
        type: "heading",
        raw: cap[0],
        depth: cap[2].charAt(0) === "=" ? 1 : 2,
        text: cap[1],
        tokens: this.lexer.inline(cap[1])
      };
    }
  }
  paragraph(src) {
    const cap = this.rules.block.paragraph.exec(src);
    if (cap) {
      const text = cap[1].charAt(cap[1].length - 1) === "\n" ? cap[1].slice(0, -1) : cap[1];
      return {
        type: "paragraph",
        raw: cap[0],
        text,
        tokens: this.lexer.inline(text)
      };
    }
  }
  text(src) {
    const cap = this.rules.block.text.exec(src);
    if (cap) {
      return {
        type: "text",
        raw: cap[0],
        text: cap[0],
        tokens: this.lexer.inline(cap[0])
      };
    }
  }
  escape(src) {
    const cap = this.rules.inline.escape.exec(src);
    if (cap) {
      return {
        type: "escape",
        raw: cap[0],
        text: cap[1]
      };
    }
  }
  tag(src) {
    const cap = this.rules.inline.tag.exec(src);
    if (cap) {
      if (!this.lexer.state.inLink && this.rules.other.startATag.test(cap[0])) {
        this.lexer.state.inLink = true;
      } else if (this.lexer.state.inLink && this.rules.other.endATag.test(cap[0])) {
        this.lexer.state.inLink = false;
      }
      if (!this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(cap[0])) {
        this.lexer.state.inRawBlock = true;
      } else if (this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(cap[0])) {
        this.lexer.state.inRawBlock = false;
      }
      return {
        type: "html",
        raw: cap[0],
        inLink: this.lexer.state.inLink,
        inRawBlock: this.lexer.state.inRawBlock,
        block: false,
        text: cap[0]
      };
    }
  }
  link(src) {
    const cap = this.rules.inline.link.exec(src);
    if (cap) {
      const trimmedUrl = cap[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(trimmedUrl)) {
        if (!this.rules.other.endAngleBracket.test(trimmedUrl)) {
          return;
        }
        const rtrimSlash = rtrim(trimmedUrl.slice(0, -1), "\\");
        if ((trimmedUrl.length - rtrimSlash.length) % 2 === 0) {
          return;
        }
      } else {
        const lastParenIndex = findClosingBracket(cap[2], "()");
        if (lastParenIndex === -2) {
          return;
        }
        if (lastParenIndex > -1) {
          const start = cap[0].indexOf("!") === 0 ? 5 : 4;
          const linkLen = start + cap[1].length + lastParenIndex;
          cap[2] = cap[2].substring(0, lastParenIndex);
          cap[0] = cap[0].substring(0, linkLen).trim();
          cap[3] = "";
        }
      }
      let href = cap[2];
      let title = "";
      if (this.options.pedantic) {
        const link2 = this.rules.other.pedanticHrefTitle.exec(href);
        if (link2) {
          href = link2[1];
          title = link2[3];
        }
      } else {
        title = cap[3] ? cap[3].slice(1, -1) : "";
      }
      href = href.trim();
      if (this.rules.other.startAngleBracket.test(href)) {
        if (this.options.pedantic && !this.rules.other.endAngleBracket.test(trimmedUrl)) {
          href = href.slice(1);
        } else {
          href = href.slice(1, -1);
        }
      }
      return outputLink(cap, {
        href: href ? href.replace(this.rules.inline.anyPunctuation, "$1") : href,
        title: title ? title.replace(this.rules.inline.anyPunctuation, "$1") : title
      }, cap[0], this.lexer, this.rules);
    }
  }
  reflink(src, links) {
    let cap;
    if ((cap = this.rules.inline.reflink.exec(src)) || (cap = this.rules.inline.nolink.exec(src))) {
      const linkString = (cap[2] || cap[1]).replace(this.rules.other.multipleSpaceGlobal, " ");
      const link2 = links[linkString.toLowerCase()];
      if (!link2) {
        const text = cap[0].charAt(0);
        return {
          type: "text",
          raw: text,
          text
        };
      }
      return outputLink(cap, link2, cap[0], this.lexer, this.rules);
    }
  }
  emStrong(src, maskedSrc, prevChar = "") {
    let match = this.rules.inline.emStrongLDelim.exec(src);
    if (!match) return;
    if (match[3] && prevChar.match(this.rules.other.unicodeAlphaNumeric)) return;
    const nextChar = match[1] || match[2] || "";
    if (!nextChar || !prevChar || this.rules.inline.punctuation.exec(prevChar)) {
      const lLength = [...match[0]].length - 1;
      let rDelim, rLength, delimTotal = lLength, midDelimTotal = 0;
      const endReg = match[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      endReg.lastIndex = 0;
      maskedSrc = maskedSrc.slice(-1 * src.length + lLength);
      while ((match = endReg.exec(maskedSrc)) != null) {
        rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
        if (!rDelim) continue;
        rLength = [...rDelim].length;
        if (match[3] || match[4]) {
          delimTotal += rLength;
          continue;
        } else if (match[5] || match[6]) {
          if (lLength % 3 && !((lLength + rLength) % 3)) {
            midDelimTotal += rLength;
            continue;
          }
        }
        delimTotal -= rLength;
        if (delimTotal > 0) continue;
        rLength = Math.min(rLength, rLength + delimTotal + midDelimTotal);
        const lastCharLength = [...match[0]][0].length;
        const raw = src.slice(0, lLength + match.index + lastCharLength + rLength);
        if (Math.min(lLength, rLength) % 2) {
          const text2 = raw.slice(1, -1);
          return {
            type: "em",
            raw,
            text: text2,
            tokens: this.lexer.inlineTokens(text2)
          };
        }
        const text = raw.slice(2, -2);
        return {
          type: "strong",
          raw,
          text,
          tokens: this.lexer.inlineTokens(text)
        };
      }
    }
  }
  codespan(src) {
    const cap = this.rules.inline.code.exec(src);
    if (cap) {
      let text = cap[2].replace(this.rules.other.newLineCharGlobal, " ");
      const hasNonSpaceChars = this.rules.other.nonSpaceChar.test(text);
      const hasSpaceCharsOnBothEnds = this.rules.other.startingSpaceChar.test(text) && this.rules.other.endingSpaceChar.test(text);
      if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) {
        text = text.substring(1, text.length - 1);
      }
      return {
        type: "codespan",
        raw: cap[0],
        text
      };
    }
  }
  br(src) {
    const cap = this.rules.inline.br.exec(src);
    if (cap) {
      return {
        type: "br",
        raw: cap[0]
      };
    }
  }
  del(src) {
    const cap = this.rules.inline.del.exec(src);
    if (cap) {
      return {
        type: "del",
        raw: cap[0],
        text: cap[2],
        tokens: this.lexer.inlineTokens(cap[2])
      };
    }
  }
  autolink(src) {
    const cap = this.rules.inline.autolink.exec(src);
    if (cap) {
      let text, href;
      if (cap[2] === "@") {
        text = cap[1];
        href = "mailto:" + text;
      } else {
        text = cap[1];
        href = text;
      }
      return {
        type: "link",
        raw: cap[0],
        text,
        href,
        tokens: [
          {
            type: "text",
            raw: text,
            text
          }
        ]
      };
    }
  }
  url(src) {
    let cap;
    if (cap = this.rules.inline.url.exec(src)) {
      let text, href;
      if (cap[2] === "@") {
        text = cap[0];
        href = "mailto:" + text;
      } else {
        let prevCapZero;
        do {
          prevCapZero = cap[0];
          cap[0] = this.rules.inline._backpedal.exec(cap[0])?.[0] ?? "";
        } while (prevCapZero !== cap[0]);
        text = cap[0];
        if (cap[1] === "www.") {
          href = "http://" + cap[0];
        } else {
          href = cap[0];
        }
      }
      return {
        type: "link",
        raw: cap[0],
        text,
        href,
        tokens: [
          {
            type: "text",
            raw: text,
            text
          }
        ]
      };
    }
  }
  inlineText(src) {
    const cap = this.rules.inline.text.exec(src);
    if (cap) {
      const escaped = this.lexer.state.inRawBlock;
      return {
        type: "text",
        raw: cap[0],
        text: cap[0],
        escaped
      };
    }
  }
};
var _Lexer = class __Lexer {
  constructor(options2) {
    __publicField(this, "tokens");
    __publicField(this, "options");
    __publicField(this, "state");
    __publicField(this, "tokenizer");
    __publicField(this, "inlineQueue");
    this.tokens = [];
    this.tokens.links = /* @__PURE__ */ Object.create(null);
    this.options = options2 || _defaults;
    this.options.tokenizer = this.options.tokenizer || new _Tokenizer();
    this.tokenizer = this.options.tokenizer;
    this.tokenizer.options = this.options;
    this.tokenizer.lexer = this;
    this.inlineQueue = [];
    this.state = {
      inLink: false,
      inRawBlock: false,
      top: true
    };
    const rules = {
      other,
      block: block.normal,
      inline: inline.normal
    };
    if (this.options.pedantic) {
      rules.block = block.pedantic;
      rules.inline = inline.pedantic;
    } else if (this.options.gfm) {
      rules.block = block.gfm;
      if (this.options.breaks) {
        rules.inline = inline.breaks;
      } else {
        rules.inline = inline.gfm;
      }
    }
    this.tokenizer.rules = rules;
  }
  /**
   * Expose Rules
   */
  static get rules() {
    return {
      block,
      inline
    };
  }
  /**
   * Static Lex Method
   */
  static lex(src, options2) {
    const lexer2 = new __Lexer(options2);
    return lexer2.lex(src);
  }
  /**
   * Static Lex Inline Method
   */
  static lexInline(src, options2) {
    const lexer2 = new __Lexer(options2);
    return lexer2.inlineTokens(src);
  }
  /**
   * Preprocessing
   */
  lex(src) {
    src = src.replace(other.carriageReturn, "\n");
    this.blockTokens(src, this.tokens);
    for (let i3 = 0; i3 < this.inlineQueue.length; i3++) {
      const next = this.inlineQueue[i3];
      this.inlineTokens(next.src, next.tokens);
    }
    this.inlineQueue = [];
    return this.tokens;
  }
  blockTokens(src, tokens = [], lastParagraphClipped = false) {
    if (this.options.pedantic) {
      src = src.replace(other.tabCharGlobal, "    ").replace(other.spaceLine, "");
    }
    while (src) {
      let token;
      if (this.options.extensions?.block?.some((extTokenizer) => {
        if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          return true;
        }
        return false;
      })) {
        continue;
      }
      if (token = this.tokenizer.space(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (token.raw.length === 1 && lastToken !== void 0) {
          lastToken.raw += "\n";
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.code(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "paragraph" || lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.fences(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.heading(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.hr(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.blockquote(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.list(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.html(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.def(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "paragraph" || lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.raw;
          this.inlineQueue.at(-1).src = lastToken.text;
        } else if (!this.tokens.links[token.tag]) {
          this.tokens.links[token.tag] = {
            href: token.href,
            title: token.title
          };
        }
        continue;
      }
      if (token = this.tokenizer.table(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.lheading(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      let cutSrc = src;
      if (this.options.extensions?.startBlock) {
        let startIndex = Infinity;
        const tempSrc = src.slice(1);
        let tempStart;
        this.options.extensions.startBlock.forEach((getStartIndex) => {
          tempStart = getStartIndex.call({ lexer: this }, tempSrc);
          if (typeof tempStart === "number" && tempStart >= 0) {
            startIndex = Math.min(startIndex, tempStart);
          }
        });
        if (startIndex < Infinity && startIndex >= 0) {
          cutSrc = src.substring(0, startIndex + 1);
        }
      }
      if (this.state.top && (token = this.tokenizer.paragraph(cutSrc))) {
        const lastToken = tokens.at(-1);
        if (lastParagraphClipped && lastToken?.type === "paragraph") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        lastParagraphClipped = cutSrc.length !== src.length;
        src = src.substring(token.raw.length);
        continue;
      }
      if (token = this.tokenizer.text(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (src) {
        const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
        if (this.options.silent) {
          console.error(errMsg);
          break;
        } else {
          throw new Error(errMsg);
        }
      }
    }
    this.state.top = true;
    return tokens;
  }
  inline(src, tokens = []) {
    this.inlineQueue.push({ src, tokens });
    return tokens;
  }
  /**
   * Lexing/Compiling
   */
  inlineTokens(src, tokens = []) {
    let maskedSrc = src;
    let match = null;
    if (this.tokens.links) {
      const links = Object.keys(this.tokens.links);
      if (links.length > 0) {
        while ((match = this.tokenizer.rules.inline.reflinkSearch.exec(maskedSrc)) != null) {
          if (links.includes(match[0].slice(match[0].lastIndexOf("[") + 1, -1))) {
            maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex);
          }
        }
      }
    }
    while ((match = this.tokenizer.rules.inline.anyPunctuation.exec(maskedSrc)) != null) {
      maskedSrc = maskedSrc.slice(0, match.index) + "++" + maskedSrc.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
    }
    while ((match = this.tokenizer.rules.inline.blockSkip.exec(maskedSrc)) != null) {
      maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
    }
    let keepPrevChar = false;
    let prevChar = "";
    while (src) {
      if (!keepPrevChar) {
        prevChar = "";
      }
      keepPrevChar = false;
      let token;
      if (this.options.extensions?.inline?.some((extTokenizer) => {
        if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          return true;
        }
        return false;
      })) {
        continue;
      }
      if (token = this.tokenizer.escape(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.tag(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.link(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.reflink(src, this.tokens.links)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (token.type === "text" && lastToken?.type === "text") {
          lastToken.raw += token.raw;
          lastToken.text += token.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.emStrong(src, maskedSrc, prevChar)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.codespan(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.br(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.del(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.autolink(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (!this.state.inLink && (token = this.tokenizer.url(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      let cutSrc = src;
      if (this.options.extensions?.startInline) {
        let startIndex = Infinity;
        const tempSrc = src.slice(1);
        let tempStart;
        this.options.extensions.startInline.forEach((getStartIndex) => {
          tempStart = getStartIndex.call({ lexer: this }, tempSrc);
          if (typeof tempStart === "number" && tempStart >= 0) {
            startIndex = Math.min(startIndex, tempStart);
          }
        });
        if (startIndex < Infinity && startIndex >= 0) {
          cutSrc = src.substring(0, startIndex + 1);
        }
      }
      if (token = this.tokenizer.inlineText(cutSrc)) {
        src = src.substring(token.raw.length);
        if (token.raw.slice(-1) !== "_") {
          prevChar = token.raw.slice(-1);
        }
        keepPrevChar = true;
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "text") {
          lastToken.raw += token.raw;
          lastToken.text += token.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (src) {
        const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
        if (this.options.silent) {
          console.error(errMsg);
          break;
        } else {
          throw new Error(errMsg);
        }
      }
    }
    return tokens;
  }
};
var _Renderer = class {
  // set by the parser
  constructor(options2) {
    __publicField(this, "options");
    __publicField(this, "parser");
    this.options = options2 || _defaults;
  }
  space(token) {
    return "";
  }
  code({ text, lang, escaped }) {
    const langString = (lang || "").match(other.notSpaceStart)?.[0];
    const code = text.replace(other.endingNewline, "") + "\n";
    if (!langString) {
      return "<pre><code>" + (escaped ? code : escape2(code, true)) + "</code></pre>\n";
    }
    return '<pre><code class="language-' + escape2(langString) + '">' + (escaped ? code : escape2(code, true)) + "</code></pre>\n";
  }
  blockquote({ tokens }) {
    const body = this.parser.parse(tokens);
    return `<blockquote>
${body}</blockquote>
`;
  }
  html({ text }) {
    return text;
  }
  heading({ tokens, depth }) {
    return `<h${depth}>${this.parser.parseInline(tokens)}</h${depth}>
`;
  }
  hr(token) {
    return "<hr>\n";
  }
  list(token) {
    const ordered = token.ordered;
    const start = token.start;
    let body = "";
    for (let j = 0; j < token.items.length; j++) {
      const item = token.items[j];
      body += this.listitem(item);
    }
    const type = ordered ? "ol" : "ul";
    const startAttr = ordered && start !== 1 ? ' start="' + start + '"' : "";
    return "<" + type + startAttr + ">\n" + body + "</" + type + ">\n";
  }
  listitem(item) {
    let itemBody = "";
    if (item.task) {
      const checkbox = this.checkbox({ checked: !!item.checked });
      if (item.loose) {
        if (item.tokens[0]?.type === "paragraph") {
          item.tokens[0].text = checkbox + " " + item.tokens[0].text;
          if (item.tokens[0].tokens && item.tokens[0].tokens.length > 0 && item.tokens[0].tokens[0].type === "text") {
            item.tokens[0].tokens[0].text = checkbox + " " + escape2(item.tokens[0].tokens[0].text);
            item.tokens[0].tokens[0].escaped = true;
          }
        } else {
          item.tokens.unshift({
            type: "text",
            raw: checkbox + " ",
            text: checkbox + " ",
            escaped: true
          });
        }
      } else {
        itemBody += checkbox + " ";
      }
    }
    itemBody += this.parser.parse(item.tokens, !!item.loose);
    return `<li>${itemBody}</li>
`;
  }
  checkbox({ checked }) {
    return "<input " + (checked ? 'checked="" ' : "") + 'disabled="" type="checkbox">';
  }
  paragraph({ tokens }) {
    return `<p>${this.parser.parseInline(tokens)}</p>
`;
  }
  table(token) {
    let header = "";
    let cell = "";
    for (let j = 0; j < token.header.length; j++) {
      cell += this.tablecell(token.header[j]);
    }
    header += this.tablerow({ text: cell });
    let body = "";
    for (let j = 0; j < token.rows.length; j++) {
      const row = token.rows[j];
      cell = "";
      for (let k2 = 0; k2 < row.length; k2++) {
        cell += this.tablecell(row[k2]);
      }
      body += this.tablerow({ text: cell });
    }
    if (body) body = `<tbody>${body}</tbody>`;
    return "<table>\n<thead>\n" + header + "</thead>\n" + body + "</table>\n";
  }
  tablerow({ text }) {
    return `<tr>
${text}</tr>
`;
  }
  tablecell(token) {
    const content = this.parser.parseInline(token.tokens);
    const type = token.header ? "th" : "td";
    const tag2 = token.align ? `<${type} align="${token.align}">` : `<${type}>`;
    return tag2 + content + `</${type}>
`;
  }
  /**
   * span level renderer
   */
  strong({ tokens }) {
    return `<strong>${this.parser.parseInline(tokens)}</strong>`;
  }
  em({ tokens }) {
    return `<em>${this.parser.parseInline(tokens)}</em>`;
  }
  codespan({ text }) {
    return `<code>${escape2(text, true)}</code>`;
  }
  br(token) {
    return "<br>";
  }
  del({ tokens }) {
    return `<del>${this.parser.parseInline(tokens)}</del>`;
  }
  link({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens);
    const cleanHref = cleanUrl(href);
    if (cleanHref === null) {
      return text;
    }
    href = cleanHref;
    let out = '<a href="' + href + '"';
    if (title) {
      out += ' title="' + escape2(title) + '"';
    }
    out += ">" + text + "</a>";
    return out;
  }
  image({ href, title, text, tokens }) {
    if (tokens) {
      text = this.parser.parseInline(tokens, this.parser.textRenderer);
    }
    const cleanHref = cleanUrl(href);
    if (cleanHref === null) {
      return escape2(text);
    }
    href = cleanHref;
    let out = `<img src="${href}" alt="${text}"`;
    if (title) {
      out += ` title="${escape2(title)}"`;
    }
    out += ">";
    return out;
  }
  text(token) {
    return "tokens" in token && token.tokens ? this.parser.parseInline(token.tokens) : "escaped" in token && token.escaped ? token.text : escape2(token.text);
  }
};
var _TextRenderer = class {
  // no need for block level renderers
  strong({ text }) {
    return text;
  }
  em({ text }) {
    return text;
  }
  codespan({ text }) {
    return text;
  }
  del({ text }) {
    return text;
  }
  html({ text }) {
    return text;
  }
  text({ text }) {
    return text;
  }
  link({ text }) {
    return "" + text;
  }
  image({ text }) {
    return "" + text;
  }
  br() {
    return "";
  }
};
var _Parser = class __Parser {
  constructor(options2) {
    __publicField(this, "options");
    __publicField(this, "renderer");
    __publicField(this, "textRenderer");
    this.options = options2 || _defaults;
    this.options.renderer = this.options.renderer || new _Renderer();
    this.renderer = this.options.renderer;
    this.renderer.options = this.options;
    this.renderer.parser = this;
    this.textRenderer = new _TextRenderer();
  }
  /**
   * Static Parse Method
   */
  static parse(tokens, options2) {
    const parser2 = new __Parser(options2);
    return parser2.parse(tokens);
  }
  /**
   * Static Parse Inline Method
   */
  static parseInline(tokens, options2) {
    const parser2 = new __Parser(options2);
    return parser2.parseInline(tokens);
  }
  /**
   * Parse Loop
   */
  parse(tokens, top = true) {
    let out = "";
    for (let i3 = 0; i3 < tokens.length; i3++) {
      const anyToken = tokens[i3];
      if (this.options.extensions?.renderers?.[anyToken.type]) {
        const genericToken = anyToken;
        const ret = this.options.extensions.renderers[genericToken.type].call({ parser: this }, genericToken);
        if (ret !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "paragraph", "text"].includes(genericToken.type)) {
          out += ret || "";
          continue;
        }
      }
      const token = anyToken;
      switch (token.type) {
        case "space": {
          out += this.renderer.space(token);
          continue;
        }
        case "hr": {
          out += this.renderer.hr(token);
          continue;
        }
        case "heading": {
          out += this.renderer.heading(token);
          continue;
        }
        case "code": {
          out += this.renderer.code(token);
          continue;
        }
        case "table": {
          out += this.renderer.table(token);
          continue;
        }
        case "blockquote": {
          out += this.renderer.blockquote(token);
          continue;
        }
        case "list": {
          out += this.renderer.list(token);
          continue;
        }
        case "html": {
          out += this.renderer.html(token);
          continue;
        }
        case "paragraph": {
          out += this.renderer.paragraph(token);
          continue;
        }
        case "text": {
          let textToken = token;
          let body = this.renderer.text(textToken);
          while (i3 + 1 < tokens.length && tokens[i3 + 1].type === "text") {
            textToken = tokens[++i3];
            body += "\n" + this.renderer.text(textToken);
          }
          if (top) {
            out += this.renderer.paragraph({
              type: "paragraph",
              raw: body,
              text: body,
              tokens: [{ type: "text", raw: body, text: body, escaped: true }]
            });
          } else {
            out += body;
          }
          continue;
        }
        default: {
          const errMsg = 'Token with "' + token.type + '" type was not found.';
          if (this.options.silent) {
            console.error(errMsg);
            return "";
          } else {
            throw new Error(errMsg);
          }
        }
      }
    }
    return out;
  }
  /**
   * Parse Inline Tokens
   */
  parseInline(tokens, renderer = this.renderer) {
    let out = "";
    for (let i3 = 0; i3 < tokens.length; i3++) {
      const anyToken = tokens[i3];
      if (this.options.extensions?.renderers?.[anyToken.type]) {
        const ret = this.options.extensions.renderers[anyToken.type].call({ parser: this }, anyToken);
        if (ret !== false || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(anyToken.type)) {
          out += ret || "";
          continue;
        }
      }
      const token = anyToken;
      switch (token.type) {
        case "escape": {
          out += renderer.text(token);
          break;
        }
        case "html": {
          out += renderer.html(token);
          break;
        }
        case "link": {
          out += renderer.link(token);
          break;
        }
        case "image": {
          out += renderer.image(token);
          break;
        }
        case "strong": {
          out += renderer.strong(token);
          break;
        }
        case "em": {
          out += renderer.em(token);
          break;
        }
        case "codespan": {
          out += renderer.codespan(token);
          break;
        }
        case "br": {
          out += renderer.br(token);
          break;
        }
        case "del": {
          out += renderer.del(token);
          break;
        }
        case "text": {
          out += renderer.text(token);
          break;
        }
        default: {
          const errMsg = 'Token with "' + token.type + '" type was not found.';
          if (this.options.silent) {
            console.error(errMsg);
            return "";
          } else {
            throw new Error(errMsg);
          }
        }
      }
    }
    return out;
  }
};
var _Hooks = (_a = class {
  constructor(options2) {
    __publicField(this, "options");
    __publicField(this, "block");
    this.options = options2 || _defaults;
  }
  /**
   * Process markdown before marked
   */
  preprocess(markdown) {
    return markdown;
  }
  /**
   * Process HTML after marked is finished
   */
  postprocess(html2) {
    return html2;
  }
  /**
   * Process all tokens before walk tokens
   */
  processAllTokens(tokens) {
    return tokens;
  }
  /**
   * Provide function to tokenize markdown
   */
  provideLexer() {
    return this.block ? _Lexer.lex : _Lexer.lexInline;
  }
  /**
   * Provide function to parse tokens
   */
  provideParser() {
    return this.block ? _Parser.parse : _Parser.parseInline;
  }
}, __publicField(_a, "passThroughHooks", /* @__PURE__ */ new Set([
  "preprocess",
  "postprocess",
  "processAllTokens"
])), _a);
var Marked = class {
  constructor(...args) {
    __publicField(this, "defaults", _getDefaults());
    __publicField(this, "options", this.setOptions);
    __publicField(this, "parse", this.parseMarkdown(true));
    __publicField(this, "parseInline", this.parseMarkdown(false));
    __publicField(this, "Parser", _Parser);
    __publicField(this, "Renderer", _Renderer);
    __publicField(this, "TextRenderer", _TextRenderer);
    __publicField(this, "Lexer", _Lexer);
    __publicField(this, "Tokenizer", _Tokenizer);
    __publicField(this, "Hooks", _Hooks);
    this.use(...args);
  }
  /**
   * Run callback for every token
   */
  walkTokens(tokens, callback) {
    let values = [];
    for (const token of tokens) {
      values = values.concat(callback.call(this, token));
      switch (token.type) {
        case "table": {
          const tableToken = token;
          for (const cell of tableToken.header) {
            values = values.concat(this.walkTokens(cell.tokens, callback));
          }
          for (const row of tableToken.rows) {
            for (const cell of row) {
              values = values.concat(this.walkTokens(cell.tokens, callback));
            }
          }
          break;
        }
        case "list": {
          const listToken = token;
          values = values.concat(this.walkTokens(listToken.items, callback));
          break;
        }
        default: {
          const genericToken = token;
          if (this.defaults.extensions?.childTokens?.[genericToken.type]) {
            this.defaults.extensions.childTokens[genericToken.type].forEach((childTokens) => {
              const tokens2 = genericToken[childTokens].flat(Infinity);
              values = values.concat(this.walkTokens(tokens2, callback));
            });
          } else if (genericToken.tokens) {
            values = values.concat(this.walkTokens(genericToken.tokens, callback));
          }
        }
      }
    }
    return values;
  }
  use(...args) {
    const extensions = this.defaults.extensions || { renderers: {}, childTokens: {} };
    args.forEach((pack) => {
      const opts = { ...pack };
      opts.async = this.defaults.async || opts.async || false;
      if (pack.extensions) {
        pack.extensions.forEach((ext) => {
          if (!ext.name) {
            throw new Error("extension name required");
          }
          if ("renderer" in ext) {
            const prevRenderer = extensions.renderers[ext.name];
            if (prevRenderer) {
              extensions.renderers[ext.name] = function(...args2) {
                let ret = ext.renderer.apply(this, args2);
                if (ret === false) {
                  ret = prevRenderer.apply(this, args2);
                }
                return ret;
              };
            } else {
              extensions.renderers[ext.name] = ext.renderer;
            }
          }
          if ("tokenizer" in ext) {
            if (!ext.level || ext.level !== "block" && ext.level !== "inline") {
              throw new Error("extension level must be 'block' or 'inline'");
            }
            const extLevel = extensions[ext.level];
            if (extLevel) {
              extLevel.unshift(ext.tokenizer);
            } else {
              extensions[ext.level] = [ext.tokenizer];
            }
            if (ext.start) {
              if (ext.level === "block") {
                if (extensions.startBlock) {
                  extensions.startBlock.push(ext.start);
                } else {
                  extensions.startBlock = [ext.start];
                }
              } else if (ext.level === "inline") {
                if (extensions.startInline) {
                  extensions.startInline.push(ext.start);
                } else {
                  extensions.startInline = [ext.start];
                }
              }
            }
          }
          if ("childTokens" in ext && ext.childTokens) {
            extensions.childTokens[ext.name] = ext.childTokens;
          }
        });
        opts.extensions = extensions;
      }
      if (pack.renderer) {
        const renderer = this.defaults.renderer || new _Renderer(this.defaults);
        for (const prop in pack.renderer) {
          if (!(prop in renderer)) {
            throw new Error(`renderer '${prop}' does not exist`);
          }
          if (["options", "parser"].includes(prop)) {
            continue;
          }
          const rendererProp = prop;
          const rendererFunc = pack.renderer[rendererProp];
          const prevRenderer = renderer[rendererProp];
          renderer[rendererProp] = (...args2) => {
            let ret = rendererFunc.apply(renderer, args2);
            if (ret === false) {
              ret = prevRenderer.apply(renderer, args2);
            }
            return ret || "";
          };
        }
        opts.renderer = renderer;
      }
      if (pack.tokenizer) {
        const tokenizer = this.defaults.tokenizer || new _Tokenizer(this.defaults);
        for (const prop in pack.tokenizer) {
          if (!(prop in tokenizer)) {
            throw new Error(`tokenizer '${prop}' does not exist`);
          }
          if (["options", "rules", "lexer"].includes(prop)) {
            continue;
          }
          const tokenizerProp = prop;
          const tokenizerFunc = pack.tokenizer[tokenizerProp];
          const prevTokenizer = tokenizer[tokenizerProp];
          tokenizer[tokenizerProp] = (...args2) => {
            let ret = tokenizerFunc.apply(tokenizer, args2);
            if (ret === false) {
              ret = prevTokenizer.apply(tokenizer, args2);
            }
            return ret;
          };
        }
        opts.tokenizer = tokenizer;
      }
      if (pack.hooks) {
        const hooks = this.defaults.hooks || new _Hooks();
        for (const prop in pack.hooks) {
          if (!(prop in hooks)) {
            throw new Error(`hook '${prop}' does not exist`);
          }
          if (["options", "block"].includes(prop)) {
            continue;
          }
          const hooksProp = prop;
          const hooksFunc = pack.hooks[hooksProp];
          const prevHook = hooks[hooksProp];
          if (_Hooks.passThroughHooks.has(prop)) {
            hooks[hooksProp] = (arg) => {
              if (this.defaults.async) {
                return Promise.resolve(hooksFunc.call(hooks, arg)).then((ret2) => {
                  return prevHook.call(hooks, ret2);
                });
              }
              const ret = hooksFunc.call(hooks, arg);
              return prevHook.call(hooks, ret);
            };
          } else {
            hooks[hooksProp] = (...args2) => {
              let ret = hooksFunc.apply(hooks, args2);
              if (ret === false) {
                ret = prevHook.apply(hooks, args2);
              }
              return ret;
            };
          }
        }
        opts.hooks = hooks;
      }
      if (pack.walkTokens) {
        const walkTokens2 = this.defaults.walkTokens;
        const packWalktokens = pack.walkTokens;
        opts.walkTokens = function(token) {
          let values = [];
          values.push(packWalktokens.call(this, token));
          if (walkTokens2) {
            values = values.concat(walkTokens2.call(this, token));
          }
          return values;
        };
      }
      this.defaults = { ...this.defaults, ...opts };
    });
    return this;
  }
  setOptions(opt) {
    this.defaults = { ...this.defaults, ...opt };
    return this;
  }
  lexer(src, options2) {
    return _Lexer.lex(src, options2 ?? this.defaults);
  }
  parser(tokens, options2) {
    return _Parser.parse(tokens, options2 ?? this.defaults);
  }
  parseMarkdown(blockType) {
    const parse2 = (src, options2) => {
      const origOpt = { ...options2 };
      const opt = { ...this.defaults, ...origOpt };
      const throwError = this.onError(!!opt.silent, !!opt.async);
      if (this.defaults.async === true && origOpt.async === false) {
        return throwError(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      }
      if (typeof src === "undefined" || src === null) {
        return throwError(new Error("marked(): input parameter is undefined or null"));
      }
      if (typeof src !== "string") {
        return throwError(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(src) + ", string expected"));
      }
      if (opt.hooks) {
        opt.hooks.options = opt;
        opt.hooks.block = blockType;
      }
      const lexer2 = opt.hooks ? opt.hooks.provideLexer() : blockType ? _Lexer.lex : _Lexer.lexInline;
      const parser2 = opt.hooks ? opt.hooks.provideParser() : blockType ? _Parser.parse : _Parser.parseInline;
      if (opt.async) {
        return Promise.resolve(opt.hooks ? opt.hooks.preprocess(src) : src).then((src2) => lexer2(src2, opt)).then((tokens) => opt.hooks ? opt.hooks.processAllTokens(tokens) : tokens).then((tokens) => opt.walkTokens ? Promise.all(this.walkTokens(tokens, opt.walkTokens)).then(() => tokens) : tokens).then((tokens) => parser2(tokens, opt)).then((html2) => opt.hooks ? opt.hooks.postprocess(html2) : html2).catch(throwError);
      }
      try {
        if (opt.hooks) {
          src = opt.hooks.preprocess(src);
        }
        let tokens = lexer2(src, opt);
        if (opt.hooks) {
          tokens = opt.hooks.processAllTokens(tokens);
        }
        if (opt.walkTokens) {
          this.walkTokens(tokens, opt.walkTokens);
        }
        let html2 = parser2(tokens, opt);
        if (opt.hooks) {
          html2 = opt.hooks.postprocess(html2);
        }
        return html2;
      } catch (e2) {
        return throwError(e2);
      }
    };
    return parse2;
  }
  onError(silent, async) {
    return (e2) => {
      e2.message += "\nPlease report this to https://github.com/markedjs/marked.";
      if (silent) {
        const msg = "<p>An error occurred:</p><pre>" + escape2(e2.message + "", true) + "</pre>";
        if (async) {
          return Promise.resolve(msg);
        }
        return msg;
      }
      if (async) {
        return Promise.reject(e2);
      }
      throw e2;
    };
  }
};
var markedInstance = new Marked();
function marked(src, opt) {
  return markedInstance.parse(src, opt);
}
marked.options = marked.setOptions = function(options2) {
  markedInstance.setOptions(options2);
  marked.defaults = markedInstance.defaults;
  changeDefaults(marked.defaults);
  return marked;
};
marked.getDefaults = _getDefaults;
marked.defaults = _defaults;
marked.use = function(...args) {
  markedInstance.use(...args);
  marked.defaults = markedInstance.defaults;
  changeDefaults(marked.defaults);
  return marked;
};
marked.walkTokens = function(tokens, callback) {
  return markedInstance.walkTokens(tokens, callback);
};
marked.parseInline = markedInstance.parseInline;
marked.Parser = _Parser;
marked.parser = _Parser.parse;
marked.Renderer = _Renderer;
marked.TextRenderer = _TextRenderer;
marked.Lexer = _Lexer;
marked.lexer = _Lexer.lex;
marked.Tokenizer = _Tokenizer;
marked.Hooks = _Hooks;
marked.parse = marked;
marked.options;
marked.setOptions;
marked.use;
marked.walkTokens;
marked.parseInline;
_Parser.parse;
_Lexer.lex;
const IMPACT_CONFIG = {
  PARTNER_ID: "6477326",
  CAMPAIGN_IDS: "1830156/21018",
  BASE_URL: "https://partner.tcgplayer.com/c"
};
function checkCookieConsent() {
  if (typeof window === "undefined") return null;
  try {
    const consentStr = localStorage.getItem("cookieConsentOptions");
    if (!consentStr) return null;
    const consent = JSON.parse(consentStr);
    return consent;
  } catch (error) {
    console.error("Failed to parse cookie consent:", error);
    return null;
  }
}
function getUserContext() {
  if (typeof window === "undefined") return "Unknown";
  const hasAuth = localStorage.getItem("auth") || sessionStorage.getItem("session") || document.cookie.includes("session");
  return hasAuth ? "LoggedIn" : "Guest";
}
function getReturnUserContext() {
  if (typeof window === "undefined") return "Unknown";
  const hasVisited = localStorage.getItem("previousVisit");
  if (!hasVisited) {
    localStorage.setItem("previousVisit", "true");
    return "NewUser";
  }
  return "ReturningUser";
}
function getDeviceContext() {
  if (typeof window === "undefined") return "Unknown";
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  return isMobile ? "Mobile" : "Desktop";
}
function buildTrackingContext(feature, options) {
  return {
    pageContext: options?.pageContext,
    feature,
    userContext: getUserContext(),
    returnContext: getReturnUserContext(),
    deviceContext: getDeviceContext()
  };
}
function buildTcgAffiliateLink(tcgplayerUrl, feature, options) {
  const consent = checkCookieConsent();
  if (!consent || !consent.advertising) {
    return tcgplayerUrl;
  }
  const context = buildTrackingContext(feature, options);
  const trackingParams = new URLSearchParams();
  trackingParams.append("subId1", context.pageContext);
  trackingParams.append("subId2", context.feature);
  trackingParams.append("subId3", context.userContext);
  trackingParams.append("subId4", context.returnContext);
  trackingParams.append("subId5", context.deviceContext);
  const urlWithTracking = `${tcgplayerUrl}&${trackingParams.toString()}`;
  const affiliateUrl = `${IMPACT_CONFIG.BASE_URL}/${IMPACT_CONFIG.PARTNER_ID}/${IMPACT_CONFIG.CAMPAIGN_IDS}?u=${encodeURIComponent(urlWithTracking)}`;
  return affiliateUrl;
}
function shouldShowAffiliateLink(tcgplayerUrl) {
  if (!tcgplayerUrl) return false;
  if (typeof window === "undefined") return false;
  return true;
}
var __defProp$9 = Object.defineProperty;
var __getOwnPropDesc$9 = Object.getOwnPropertyDescriptor;
var __decorateClass$9 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$9(target, key) : target;
  for (var i3 = decorators.length - 1, decorator; i3 >= 0; i3--)
    if (decorator = decorators[i3])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$9(target, key, result);
  return result;
};
let FabSpotlightCard = class extends i$1 {
  constructor() {
    super(...arguments);
    this.printingId = "";
    this.title = "";
    this.commentary = "";
    this.apiBase = "";
    this.card = null;
    this.loading = true;
    this.error = null;
    this.cardDataMap = /* @__PURE__ */ new Map();
    this.loadingCards = /* @__PURE__ */ new Set();
    this.overlayImageUrl = null;
    this.overlayAlt = "";
    this.handleKeydown = (e2) => {
      if (e2.key === "Escape" && this.overlayImageUrl) {
        this.closeOverlay();
      }
    };
  }
  async connectedCallback() {
    super.connectedCallback();
    await this.fetchCard();
    await this.fetchCardDataByNames();
    document.addEventListener("keydown", this.handleKeydown);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.handleKeydown);
  }
  async updated(changedProperties) {
    if (changedProperties.has("printingId") && !changedProperties.get("printingId")) {
      await this.fetchCard();
    }
    if (changedProperties.has("commentary")) {
      await this.fetchCardDataByNames();
    }
  }
  async fetchCard() {
    if (!this.printingId) {
      this.error = "No printing ID provided";
      this.loading = false;
      return;
    }
    try {
      this.loading = true;
      this.error = null;
      const base = this.apiBase || window.location.origin;
      const url = `${base}/api/printings/search?printingIds=${this.printingId}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.success && data.data?.printings?.length > 0) {
        this.card = data.data.printings[0];
      } else {
        throw new Error("Card not found in response");
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to load card data";
    } finally {
      this.loading = false;
    }
  }
  extractCardNames() {
    if (!this.commentary) return [];
    const cardNames = [];
    const cardMentionRegex = /\*\*([^*]+)\*\*/g;
    let match;
    while ((match = cardMentionRegex.exec(this.commentary)) !== null) {
      const cardName = match[1];
      const isLikelyCardName = /[A-Z]/.test(cardName) || cardName.includes("'");
      if (isLikelyCardName) {
        cardNames.push(cardName);
      }
    }
    return [...new Set(cardNames)];
  }
  async fetchCardDataByNames() {
    const cardNames = this.extractCardNames();
    for (const cardName of cardNames) {
      if (this.cardDataMap.has(cardName) || this.loadingCards.has(cardName)) {
        continue;
      }
      this.loadingCards.add(cardName);
      try {
        const base = this.apiBase || window.location.origin;
        const url = `${base}/api/printings/search?name=${encodeURIComponent(cardName)}&show=all&limit=1`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (data.success && data.data?.printings?.length > 0) {
          const cardData = data.data.printings[0];
          this.cardDataMap.set(cardName, cardData);
          this.requestUpdate();
        }
      } catch (err) {
      } finally {
        this.loadingCards.delete(cardName);
        this.requestUpdate();
      }
    }
  }
  openOverlay(imageUrl, alt) {
    this.overlayImageUrl = imageUrl;
    this.overlayAlt = alt;
  }
  closeOverlay() {
    this.overlayImageUrl = null;
    this.overlayAlt = "";
  }
  render() {
    let mainContent;
    if (this.loading) {
      mainContent = this.renderLoading();
    } else if (this.error || !this.card) {
      mainContent = this.renderError();
    } else {
      mainContent = this.renderCard();
    }
    return b`
      ${mainContent}
      ${this.renderOverlay()}
    `;
  }
  renderLoading() {
    return b`
      <div class="card">
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading spotlight card...</p>
        </div>
      </div>
    `;
  }
  renderError() {
    return b`
      <div class="card">
        <div class="error">
          <div class="error-title">Failed to load card</div>
          <div>${this.error || `Card not found: ${this.printingId}`}</div>
        </div>
      </div>
    `;
  }
  renderCard() {
    const displayTitle = this.title || this.card.display_name || this.card.name;
    const editionDisplay = this.getEditionDisplay(this.card.edition);
    const foilingInfo = this.getFoilingInfo(this.card.foiling);
    return b`
      <div class="card">
        <div class="card-content">
          <div class="layout">
            <!-- Card Image -->
            <div class="card-image">
              ${this.card.image_url ? b`
                <img src="${this.card.image_url}" alt="${displayTitle}" />
              ` : b`
                <div class="placeholder">No image available</div>
              `}
              ${this.renderPurchaseLink()}
            </div>

            <!-- Card Info -->
            <div class="info">
              <!-- Badge -->
              <div class="badge-container">
                <span class="badge">
                  ${this.renderStarIcon()}
                  Card Spotlight
                </span>
              </div>

              <!-- Title -->
              <h3 class="title">${displayTitle}</h3>

              <!-- Meta -->
              <div class="meta">
                ${this.card.set ? b`<span>${this.card.set.toUpperCase()}</span>` : ""}
                ${editionDisplay ? b`<span>${editionDisplay}</span>` : ""}
                ${this.card.rarity ? b`<span>${this.card.rarity.toUpperCase()}</span>` : ""}
                ${this.card.foiling && foilingInfo ? b`<span>${foilingInfo}</span>` : ""}
              </div>

              <!-- Commentary -->
              ${this.commentary ? b`
                <div class="commentary">
                  <div class="commentary-text">
                    ${this.parseCommentary(this.commentary)}
                  </div>
                </div>
              ` : ""}

              <!-- Actions -->
              <div class="actions">
                ${this.card.printing_id ? b`
                  <div class="action-row">
                    <div class="action-label">
                      <div class="action-title">Who has this exact copy</div>
                      <div class="action-subtitle">Same set, edition, and foiling</div>
                    </div>
                  </div>
                ` : ""}
                ${this.card.card_unique_id ? b`
                  <div class="action-row">
                    <div class="action-label">
                      <div class="action-title">Who has other versions</div>
                      <div class="action-subtitle">Any set, edition, or foiling</div>
                    </div>
                  </div>
                ` : ""}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  parseCommentary(text) {
    if (!text) return b``;
    const cardMentions = [];
    const cardMentionRegex = /\*\*([^*]+)\*\*/g;
    const withPlaceholders = text.replace(cardMentionRegex, (match, cardName) => {
      const isLikelyCardName = /[A-Z]/.test(cardName) || cardName.includes("'");
      if (isLikelyCardName) {
        const index = cardMentions.length;
        cardMentions.push(cardName);
        return `{{CARDMENTION${index}}}`;
      }
      return match;
    });
    const htmlContent = marked.parse(withPlaceholders, {
      breaks: true,
      // Convert \n to <br>
      gfm: true
      // GitHub Flavored Markdown
    });
    const parts = [];
    let lastIndex = 0;
    cardMentions.forEach((cardName, index) => {
      const placeholder = `{{CARDMENTION${index}}}`;
      const placeholderIndex = htmlContent.indexOf(placeholder, lastIndex);
      if (placeholderIndex !== -1) {
        if (placeholderIndex > lastIndex) {
          parts.push(o(htmlContent.substring(lastIndex, placeholderIndex)));
        }
        const cardData = this.cardDataMap.get(cardName);
        const isLoading = this.loadingCards.has(cardName);
        if (cardData && cardData.image_url) {
          parts.push(b`
            <span class="inline-card-wrapper" @click="${() => this.openOverlay(cardData.image_url, cardName)}" title="Click to view full size">
              <img
                class="inline-card-thumbnail"
                src="${cardData.image_url}"
                alt="${cardName}"
              />
              <span class="inline-card-name">${cardName}</span>
            </span>
          `);
        } else if (isLoading) {
          parts.push(b`
            <span class="inline-card-wrapper">
              <span class="inline-card-loading"></span>
              <span class="inline-card-name">${cardName}</span>
            </span>
          `);
        } else {
          parts.push(b`<span class="card-mention">${cardName}</span>`);
        }
        lastIndex = placeholderIndex + placeholder.length;
      }
    });
    if (lastIndex < htmlContent.length) {
      parts.push(o(htmlContent.substring(lastIndex)));
    }
    return parts;
  }
  getEditionDisplay(code) {
    if (!code) return "";
    const lookupCode = code.toLowerCase();
    const editions = {
      a: "Alpha",
      f: "1st",
      u: "UNL",
      n: "",
      normal: ""
    };
    return editions[lookupCode] || code.toUpperCase();
  }
  getFoilingInfo(foiling) {
    const foilingMap = {
      "R": "Rainbow Foil",
      "C": "Cold Foil",
      "G": "Gold Foil",
      "S": "Non-foil"
    };
    const code = foiling?.toUpperCase();
    return code ? foilingMap[code] || "Non-foil" : "";
  }
  renderOverlay() {
    if (!this.overlayImageUrl) return b``;
    return b`
      <div class="card-overlay" @click="${this.closeOverlay}">
        <button
          class="card-overlay-close"
          @click="${this.closeOverlay}"
          aria-label="Close"
        >
          ×
        </button>
        <img
          src="${this.overlayImageUrl}"
          alt="${this.overlayAlt}"
          @click="${(e2) => e2.stopPropagation()}"
        />
      </div>
    `;
  }
  renderStarIcon() {
    return b`
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    `;
  }
  renderPurchaseLink() {
    if (!shouldShowAffiliateLink(this.card.tcgplayer_url)) {
      return b``;
    }
    const affiliateUrl = buildTcgAffiliateLink(
      this.card.tcgplayer_url,
      "SpotlightCardPurchase",
      { pageContext: "Article" }
      // Override page context since this is in article content
    );
    return b`
      <div class="purchase-link-container">
        <a
          href="${affiliateUrl}"
          class="purchase-link"
          target="_blank"
          rel="noopener noreferrer"
          title="Purchase this card on TCGPlayer"
          @click="${(e2) => e2.stopPropagation()}"
        >
          <span class="purchase-link-text">Available for purchase here</span>
          <img
            src="https://imagedelivery.net/jR5MG4_30kkyiS4RKxXOPg/596dace2-8614-4efc-b58d-0b0ebdc0d300/public"
            alt="TCGPlayer"
            class="purchase-link-logo"
          />
        </a>
      </div>
    `;
  }
};
FabSpotlightCard.styles = i$4`
    :host {
      /* CSS Variables for theming - Light Mode */
      --fab-spotlight-bg: #eff6ff;
      --fab-spotlight-border: #93c5fd;
      --fab-spotlight-badge-bg: #6366f1;
      --fab-spotlight-badge-text: #ffffff;
      --fab-spotlight-text: #0f172a;
      --fab-spotlight-text-muted: #64748b;
      --fab-spotlight-commentary-bg: #f0f9ff;
      --fab-spotlight-commentary-border: #bae6fd;
      --fab-spotlight-action-bg: #f0f9ff;
      --fab-spotlight-action-hover-bg: #e0f2fe;
      --fab-spotlight-action-border: #bae6fd;
      --fab-spotlight-error-bg: #fef2f2;
      --fab-spotlight-error-border: #fca5a5;
      --fab-spotlight-error-text: #dc2626;

      display: block;
      margin: 1.5rem 0;
    }

    /* Dark Mode */
    @media (prefers-color-scheme: dark) {
      :host {
        --fab-spotlight-bg: #1e293b;
        --fab-spotlight-border: #475569;
        --fab-spotlight-badge-bg: #818cf8;
        --fab-spotlight-badge-text: #0f172a;
        --fab-spotlight-text: #f1f5f9;
        --fab-spotlight-text-muted: #94a3b8;
        --fab-spotlight-commentary-bg: #0f172a;
        --fab-spotlight-commentary-border: #334155;
        --fab-spotlight-action-bg: #0f172a;
        --fab-spotlight-action-hover-bg: #1e293b;
        --fab-spotlight-action-border: #334155;
        --fab-spotlight-error-bg: #450a0a;
        --fab-spotlight-error-border: #991b1b;
        --fab-spotlight-error-text: #fca5a5;
      }
    }

    /* Tailwind class-based dark mode */
    :host-context(.dark) {
      --fab-spotlight-bg: #1e293b;
      --fab-spotlight-border: #475569;
      --fab-spotlight-badge-bg: #818cf8;
      --fab-spotlight-badge-text: #0f172a;
      --fab-spotlight-text: #f1f5f9;
      --fab-spotlight-text-muted: #94a3b8;
      --fab-spotlight-commentary-bg: #0f172a;
      --fab-spotlight-commentary-border: #334155;
      --fab-spotlight-action-bg: #0f172a;
      --fab-spotlight-action-hover-bg: #1e293b;
      --fab-spotlight-action-border: #334155;
      --fab-spotlight-error-bg: #450a0a;
      --fab-spotlight-error-border: #991b1b;
      --fab-spotlight-error-text: #fca5a5;
    }

    .card {
      background: var(--fab-spotlight-bg);
      border: 2px solid var(--fab-spotlight-border);
      border-radius: 0.5rem;
      overflow: hidden;
    }

    .card-content {
      padding: 1.5rem;
    }

    .layout {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    @media (min-width: 1024px) {
      .layout {
        flex-direction: row;
      }
    }

    .card-image {
      flex-shrink: 0;
    }

    .card-image img {
      width: 100%;
      max-width: 300px;
      height: auto;
      border-radius: 0.5rem;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }

    .info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .badge-container {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.75rem;
      background: var(--fab-spotlight-badge-bg);
      color: var(--fab-spotlight-badge-text);
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .badge svg {
      width: 1rem;
      height: 1rem;
    }

    .title {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--fab-spotlight-text);
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: var(--fab-spotlight-text-muted);
    }

    .meta span::after {
      content: "•";
      margin-left: 0.5rem;
    }

    .meta span:last-child::after {
      content: "";
    }

    .commentary {
      background: var(--fab-spotlight-commentary-bg);
      border: 1px solid var(--fab-spotlight-commentary-border);
      border-radius: 0.5rem;
      padding: 1rem;
    }

    .commentary-text {
      font-size: 0.875rem;
      line-height: 1.6;
      color: var(--fab-spotlight-text);
    }

    .card-mention {
      font-weight: 600;
      color: var(--fab-spotlight-badge-bg);
    }

    /* Markdown-specific styles */
    .commentary-text h1,
    .commentary-text h2,
    .commentary-text h3 {
      margin: 1em 0 0.5em 0;
      font-weight: 600;
      color: var(--fab-spotlight-text);
    }

    .commentary-text h1 { font-size: 1.5em; }
    .commentary-text h2 { font-size: 1.25em; }
    .commentary-text h3 { font-size: 1.1em; }

    .commentary-text ul,
    .commentary-text ol {
      margin: 0.5em 0;
      padding-left: 1.5em;
    }

    .commentary-text li {
      margin: 0.25em 0;
    }

    .commentary-text a {
      color: var(--fab-spotlight-badge-bg);
      text-decoration: underline;
    }

    .commentary-text a:hover {
      opacity: 0.8;
    }

    .commentary-text code {
      background: var(--fab-spotlight-action-bg);
      padding: 0.125rem 0.25rem;
      border-radius: 0.25rem;
      font-family: monospace;
      font-size: 0.875em;
    }

    .commentary-text pre {
      background: var(--fab-spotlight-action-bg);
      padding: 1rem;
      border-radius: 0.375rem;
      overflow-x: auto;
      margin: 0.5em 0;
    }

    .commentary-text pre code {
      background: none;
      padding: 0;
    }

    .commentary-text blockquote {
      border-left: 3px solid var(--fab-spotlight-badge-bg);
      padding-left: 1rem;
      margin: 0.5em 0;
      color: var(--fab-spotlight-text-muted);
      font-style: italic;
    }

    .commentary-text p {
      margin: 0.5em 0;
    }

    .commentary-text p:first-child {
      margin-top: 0;
    }

    .commentary-text p:last-child {
      margin-bottom: 0;
    }

    .actions {
      padding-top: 0.75rem;
      margin-top: 0.75rem;
      border-top: 1px solid var(--fab-spotlight-action-border);
    }

    .action-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem;
      background: var(--fab-spotlight-action-bg);
      border-radius: 0.375rem;
      margin-bottom: 0.5rem;
      transition: background-color 0.2s;
    }

    .action-row:hover {
      background: var(--fab-spotlight-action-hover-bg);
    }

    .action-row:last-child {
      margin-bottom: 0;
    }

    .action-label {
      flex: 1;
      font-size: 0.875rem;
    }

    .action-title {
      font-weight: 500;
      color: var(--fab-spotlight-text);
      margin-bottom: 0.125rem;
    }

    .action-subtitle {
      font-size: 0.75rem;
      color: var(--fab-spotlight-text-muted);
    }

    /* Loading state */
    .loading {
      padding: 1.5rem;
      text-align: center;
      color: var(--fab-spotlight-text-muted);
    }

    .spinner {
      display: inline-block;
      width: 1.5rem;
      height: 1.5rem;
      border: 3px solid rgba(0, 0, 0, 0.1);
      border-radius: 50%;
      border-top-color: var(--fab-spotlight-badge-bg);
      animation: spinner 0.6s linear infinite;
    }

    @keyframes spinner {
      to { transform: rotate(360deg); }
    }

    /* Error state */
    .error {
      padding: 1.5rem;
      background: var(--fab-spotlight-error-bg);
      border: 1px solid var(--fab-spotlight-error-border);
      border-radius: 0.5rem;
      color: var(--fab-spotlight-error-text);
    }

    .error-title {
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    /* Interactive card mentions */
    .inline-card-wrapper {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      vertical-align: middle;
      margin: 0 0.125rem;
      cursor: pointer;
      transition: opacity 0.15s ease;
    }

    .inline-card-wrapper:hover {
      opacity: 0.85;
    }

    .inline-card-thumbnail {
      width: 28px;
      height: 39px;
      border-radius: 2px;
      object-fit: cover;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      vertical-align: middle;
    }

    .inline-card-wrapper:hover .inline-card-thumbnail {
      transform: scale(1.15);
      box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
    }

    .inline-card-name {
      font-weight: 600;
      color: var(--fab-spotlight-text);
    }

    .inline-card-loading {
      display: inline-block;
      width: 28px;
      height: 39px;
      background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);
      background-size: 200% 100%;
      animation: loading 1.5s ease-in-out infinite;
      border-radius: 2px;
    }

    @keyframes loading {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* Card overlay modal */
    .card-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      cursor: pointer;
      backdrop-filter: blur(4px);
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .card-overlay img {
      max-width: 90vw;
      max-height: 90vh;
      width: auto;
      height: auto;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      cursor: default;
      animation: zoomIn 0.2s ease;
    }

    @keyframes zoomIn {
      from { transform: scale(0.9); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    .card-overlay-close {
      position: absolute;
      top: 1rem;
      right: 1rem;
      width: 40px;
      height: 40px;
      background: rgba(255, 255, 255, 0.1);
      border: 2px solid rgba(255, 255, 255, 0.3);
      color: white;
      border-radius: 50%;
      font-size: 1.5rem;
      cursor: pointer;
      transition: background 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      font-weight: 300;
      z-index: 10000;
    }

    .card-overlay-close:hover {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.5);
    }

    /* TCGPlayer Purchase Link */
    .purchase-link-container {
      margin-top: 0.375rem;
      padding-top: 0.375rem;
      border-top: 1px solid rgba(203, 213, 225, 0.3);
    }

    .purchase-link {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.6875rem;
      line-height: 1;
      color: #2563eb;
      text-decoration: none;
      transition: color 0.2s ease;
      opacity: 0.85;
    }

    .purchase-link:hover {
      color: #1d4ed8;
      opacity: 1;
    }

    @media (prefers-color-scheme: dark) {
      .purchase-link-container {
        border-top: 1px solid rgba(71, 85, 105, 0.3);
      }

      .purchase-link {
        color: #60a5fa;
      }

      .purchase-link:hover {
        color: #93c5fd;
      }
    }

    :host-context(.dark) .purchase-link-container {
      border-top: 1px solid rgba(71, 85, 105, 0.3);
    }

    :host-context(.dark) .purchase-link {
      color: #60a5fa;
    }

    :host-context(.dark) .purchase-link:hover {
      color: #93c5fd;
    }

    .purchase-link-text {
      white-space: nowrap;
    }

    .purchase-link-logo {
      height: 0.625rem;
      width: auto;
      flex-shrink: 0;
    }
  `;
__decorateClass$9([
  n2({ attribute: "printing-id" })
], FabSpotlightCard.prototype, "printingId", 2);
__decorateClass$9([
  n2()
], FabSpotlightCard.prototype, "title", 2);
__decorateClass$9([
  n2()
], FabSpotlightCard.prototype, "commentary", 2);
__decorateClass$9([
  n2({ attribute: "api-base" })
], FabSpotlightCard.prototype, "apiBase", 2);
__decorateClass$9([
  r()
], FabSpotlightCard.prototype, "card", 2);
__decorateClass$9([
  r()
], FabSpotlightCard.prototype, "loading", 2);
__decorateClass$9([
  r()
], FabSpotlightCard.prototype, "error", 2);
__decorateClass$9([
  r()
], FabSpotlightCard.prototype, "cardDataMap", 2);
__decorateClass$9([
  r()
], FabSpotlightCard.prototype, "loadingCards", 2);
__decorateClass$9([
  r()
], FabSpotlightCard.prototype, "overlayImageUrl", 2);
__decorateClass$9([
  r()
], FabSpotlightCard.prototype, "overlayAlt", 2);
FabSpotlightCard = __decorateClass$9([
  t$1("fab-spotlight-card")
], FabSpotlightCard);
var __defProp$8 = Object.defineProperty;
var __getOwnPropDesc$8 = Object.getOwnPropertyDescriptor;
var __decorateClass$8 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$8(target, key) : target;
  for (var i3 = decorators.length - 1, decorator; i3 >= 0; i3--)
    if (decorator = decorators[i3])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$8(target, key, result);
  return result;
};
let FabIntro = class extends i$1 {
  constructor() {
    super(...arguments);
    this.text = "";
    this.tags = "";
  }
  render() {
    if (!this.text) return b``;
    const tagArray = this.tags ? this.tags.split(",").map((t2) => t2.trim()).filter(Boolean) : [];
    return b`
      <div class="intro">
        <p class="intro-text">${this.text}</p>
        ${tagArray.length > 0 ? b`
          <div class="tags">
            ${tagArray.map((tag2) => b`
              <span class="tag">${tag2}</span>
            `)}
          </div>
        ` : ""}
      </div>
    `;
  }
};
FabIntro.styles = i$4`
    :host {
      /* CSS Variables for theming */
      --fab-intro-text: #475569;
      --fab-intro-text-dark: #94a3b8;
      --fab-intro-border: #e2e8f0;
      --fab-intro-tag-bg: #f1f5f9;
      --fab-intro-tag-text: #475569;
      --fab-intro-tag-bg-dark: #334155;
      --fab-intro-tag-text-dark: #cbd5e1;

      display: block;
      margin: 1.5rem 0 2rem 0;
    }

    .intro {
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--fab-intro-border);
    }

    .intro-text {
      font-size: 1.125rem;
      line-height: 1.75;
      color: var(--fab-intro-text);
      margin: 0 0 1rem 0;
    }

    @media (prefers-color-scheme: dark) {
      .intro-text {
        color: var(--fab-intro-text-dark);
      }
    }

    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .tag {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      background: var(--fab-intro-tag-bg);
      color: var(--fab-intro-tag-text);
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.025em;
    }

    @media (prefers-color-scheme: dark) {
      .tag {
        background: var(--fab-intro-tag-bg-dark);
        color: var(--fab-intro-tag-text-dark);
      }
    }

    /* Hide component if no content */
    :host(:empty) {
      display: none;
    }
  `;
__decorateClass$8([
  n2()
], FabIntro.prototype, "text", 2);
__decorateClass$8([
  n2()
], FabIntro.prototype, "tags", 2);
FabIntro = __decorateClass$8([
  t$1("fab-intro")
], FabIntro);
var __defProp$7 = Object.defineProperty;
var __getOwnPropDesc$7 = Object.getOwnPropertyDescriptor;
var __decorateClass$7 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$7(target, key) : target;
  for (var i3 = decorators.length - 1, decorator; i3 >= 0; i3--)
    if (decorator = decorators[i3])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$7(target, key, result);
  return result;
};
let FabByline = class extends i$1 {
  constructor() {
    super(...arguments);
    this.role = "By";
    this.name = "";
    this.link = "";
  }
  render() {
    if (!this.name) return b``;
    return b`
      <div class="byline">
        <span class="role">${this.role}</span>
        ${this.link ? b`
          <a
            href="${this.link}"
            class="name-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            ${this.name}
            <span class="link-icon">${this.renderExternalLinkIcon()}</span>
          </a>
        ` : b`
          <span class="name">${this.name}</span>
        `}
      </div>
    `;
  }
  renderExternalLinkIcon() {
    return b`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/>
        <line x1="10" x2="21" y1="14" y2="3"/>
      </svg>
    `;
  }
};
FabByline.styles = i$4`
    :host {
      /* CSS Variables for theming */
      --fab-byline-text: #64748b;
      --fab-byline-text-dark: #94a3b8;
      --fab-byline-name: #0f172a;
      --fab-byline-name-dark: #f1f5f9;
      --fab-byline-link: #3b82f6;
      --fab-byline-link-hover: #2563eb;

      display: block;
      margin: 1rem 0;
    }

    .byline {
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .role {
      color: var(--fab-byline-text);
      font-style: italic;
    }

    @media (prefers-color-scheme: dark) {
      .role {
        color: var(--fab-byline-text-dark);
      }
    }

    .name {
      color: var(--fab-byline-name);
      font-weight: 500;
      margin-left: 0.25rem;
    }

    @media (prefers-color-scheme: dark) {
      .name {
        color: var(--fab-byline-name-dark);
      }
    }

    .name-link {
      color: var(--fab-byline-link);
      text-decoration: none;
      font-weight: 500;
      margin-left: 0.25rem;
      transition: color 0.2s;
    }

    .name-link:hover {
      color: var(--fab-byline-link-hover);
      text-decoration: underline;
    }

    /* Icon for external link */
    .link-icon {
      display: inline-block;
      width: 0.875rem;
      height: 0.875rem;
      margin-left: 0.25rem;
      vertical-align: baseline;
    }

    .link-icon svg {
      width: 100%;
      height: 100%;
    }

    /* Hide component if no content */
    :host(:empty) {
      display: none;
    }
  `;
__decorateClass$7([
  n2()
], FabByline.prototype, "role", 2);
__decorateClass$7([
  n2()
], FabByline.prototype, "name", 2);
__decorateClass$7([
  n2()
], FabByline.prototype, "link", 2);
FabByline = __decorateClass$7([
  t$1("fab-byline")
], FabByline);
var __defProp$6 = Object.defineProperty;
var __getOwnPropDesc$6 = Object.getOwnPropertyDescriptor;
var __decorateClass$6 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$6(target, key) : target;
  for (var i3 = decorators.length - 1, decorator; i3 >= 0; i3--)
    if (decorator = decorators[i3])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$6(target, key, result);
  return result;
};
let FabSectionHeader = class extends i$1 {
  constructor() {
    super(...arguments);
    this.title = "";
    this.subtitle = "";
    this.level = "2";
  }
  render() {
    if (!this.title) {
      return b``;
    }
    return b`
      <div class="header">
        ${this.level === "3" ? b`<h3>${this.title}</h3>` : b`<h2>${this.title}</h2>`}
        ${this.subtitle ? b`
          <p class="subtitle">${this.subtitle}</p>
        ` : ""}
      </div>
    `;
  }
};
FabSectionHeader.styles = i$4`
    :host {
      /* CSS Variables for theming */
      --fab-header-title: #0f172a;
      --fab-header-title-dark: #f1f5f9;
      --fab-header-subtitle: #64748b;
      --fab-header-subtitle-dark: #94a3b8;
      --fab-header-border: #e2e8f0;

      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      margin: 2rem 0 1.5rem 0;
    }

    * {
      visibility: visible !important;
      opacity: 1 !important;
    }

    .header {
      border-bottom: 2px solid var(--fab-header-border);
      padding-bottom: 0.75rem;
    }

    h2, h3 {
      margin: 0 0 0.5rem 0;
      color: var(--fab-header-title);
      font-weight: 700;
      line-height: 1.2;
    }

    h2 {
      font-size: 1.875rem;
    }

    h3 {
      font-size: 1.5rem;
    }

    @media (prefers-color-scheme: dark) {
      h2, h3 {
        color: var(--fab-header-title-dark);
      }
    }

    /* Support Tailwind's class-based dark mode */
    :host-context(.dark) h2,
    :host-context(.dark) h3 {
      color: var(--fab-header-title-dark);
    }

    .subtitle {
      margin: 0.5rem 0 0 0;
      font-size: 1rem;
      color: var(--fab-header-subtitle);
      font-weight: 400;
      line-height: 1.5;
    }

    @media (prefers-color-scheme: dark) {
      .subtitle {
        color: var(--fab-header-subtitle-dark);
      }
    }

    :host-context(.dark) .subtitle {
      color: var(--fab-header-subtitle-dark);
    }

    /* Hide component if no content */
    :host(:empty) {
      display: none;
    }
  `;
__decorateClass$6([
  n2()
], FabSectionHeader.prototype, "title", 2);
__decorateClass$6([
  n2()
], FabSectionHeader.prototype, "subtitle", 2);
__decorateClass$6([
  n2()
], FabSectionHeader.prototype, "level", 2);
FabSectionHeader = __decorateClass$6([
  t$1("fab-section-header")
], FabSectionHeader);
var __defProp$5 = Object.defineProperty;
var __getOwnPropDesc$5 = Object.getOwnPropertyDescriptor;
var __decorateClass$5 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$5(target, key) : target;
  for (var i3 = decorators.length - 1, decorator; i3 >= 0; i3--)
    if (decorator = decorators[i3])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$5(target, key, result);
  return result;
};
let FabKeyTakeaways = class extends i$1 {
  constructor() {
    super(...arguments);
    this.items = "";
    this.title = "Key Takeaways";
  }
  render() {
    if (!this.items) {
      return b``;
    }
    const itemArray = this.items.split("|").map((item) => item.trim()).filter(Boolean);
    if (itemArray.length === 0) {
      return b``;
    }
    return b`
      <div class="takeaways">
        <h3 class="title">
          <span class="title-icon">${this.renderListIcon()}</span>
          ${this.title}
        </h3>
        <ul class="items">
          ${itemArray.map((item) => b`
            <li class="item">
              <span class="bullet"></span>
              <span class="item-text">${item}</span>
            </li>
          `)}
        </ul>
      </div>
    `;
  }
  renderListIcon() {
    return b`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="8" x2="21" y1="6" y2="6"/>
        <line x1="8" x2="21" y1="12" y2="12"/>
        <line x1="8" x2="21" y1="18" y2="18"/>
        <line x1="3" x2="3.01" y1="6" y2="6"/>
        <line x1="3" x2="3.01" y1="12" y2="12"/>
        <line x1="3" x2="3.01" y1="18" y2="18"/>
      </svg>
    `;
  }
};
FabKeyTakeaways.styles = i$4`
    :host {
      /* CSS Variables for theming */
      --fab-takeaways-bg: #f0f9ff;
      --fab-takeaways-bg-dark: #1e3a5f;
      --fab-takeaways-border: #3b82f6;
      --fab-takeaways-title: #1e40af;
      --fab-takeaways-title-dark: #93c5fd;
      --fab-takeaways-text: #1e293b;
      --fab-takeaways-text-dark: #e2e8f0;
      --fab-takeaways-bullet: #3b82f6;

      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      margin: 2rem 0;
    }

    * {
      visibility: visible !important;
      opacity: 1 !important;
    }

    .takeaways {
      background: var(--fab-takeaways-bg);
      border-left: 4px solid var(--fab-takeaways-border);
      border-radius: 0.5rem;
      padding: 1.5rem;
    }

    @media (prefers-color-scheme: dark) {
      .takeaways {
        background: var(--fab-takeaways-bg-dark);
      }
    }

    .title {
      margin: 0 0 1rem 0;
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--fab-takeaways-title);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    @media (prefers-color-scheme: dark) {
      .title {
        color: var(--fab-takeaways-title-dark);
      }
    }

    .title-icon {
      width: 1.25rem;
      height: 1.25rem;
      flex-shrink: 0;
    }

    .title-icon svg {
      width: 100%;
      height: 100%;
    }

    .items {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      color: var(--fab-takeaways-text);
      line-height: 1.6;
    }

    @media (prefers-color-scheme: dark) {
      .item {
        color: var(--fab-takeaways-text-dark);
      }
    }

    .bullet {
      flex-shrink: 0;
      width: 0.375rem;
      height: 0.375rem;
      border-radius: 50%;
      background: var(--fab-takeaways-bullet);
      margin-top: 0.5rem;
    }

    .item-text {
      flex: 1;
    }

    /* Hide component if no content */
    :host(:empty) {
      display: none;
    }
  `;
__decorateClass$5([
  n2()
], FabKeyTakeaways.prototype, "items", 2);
__decorateClass$5([
  n2()
], FabKeyTakeaways.prototype, "title", 2);
FabKeyTakeaways = __decorateClass$5([
  t$1("fab-key-takeaways")
], FabKeyTakeaways);
var __defProp$4 = Object.defineProperty;
var __getOwnPropDesc$4 = Object.getOwnPropertyDescriptor;
var __decorateClass$4 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$4(target, key) : target;
  for (var i3 = decorators.length - 1, decorator; i3 >= 0; i3--)
    if (decorator = decorators[i3])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$4(target, key, result);
  return result;
};
let FabMatchReport = class extends i$1 {
  constructor() {
    super(...arguments);
    this.overlayImageUrl = null;
    this.overlayAlt = "";
    this.round = "";
    this.opponent = "";
    this.hero = "";
    this.heroPrintingId = "";
    this.result = "";
    this.record = "";
    this.summary = "";
    this.sideboard = "";
    this.sideboardCardsJson = "";
    this.cardDataMap = /* @__PURE__ */ new Map();
    this.loadingCards = /* @__PURE__ */ new Set();
    this.heroCardData = null;
    this.loadingHeroCard = false;
    this.handleKeyDown = (e2) => {
      if (e2.key === "Escape" && this.overlayImageUrl) {
        this.closeOverlay();
      }
    };
  }
  get parsedSideboardCards() {
    if (!this.sideboardCardsJson) return [];
    try {
      return JSON.parse(this.sideboardCardsJson);
    } catch {
      return [];
    }
  }
  // Parse InlineCard tags from summary text
  // Format: <InlineCard printingId="abc123">Card Name</InlineCard>
  get inlineCardIds() {
    if (!this.summary) return [];
    const regex = /<InlineCard\s+printingId="([^"]+)"[^>]*>/g;
    const ids = [];
    let match;
    while ((match = regex.exec(this.summary)) !== null) {
      ids.push(match[1]);
    }
    return ids;
  }
  connectedCallback() {
    super.connectedCallback();
    this.fetchCardData();
    this.fetchHeroCard();
    document.addEventListener("keydown", this.handleKeyDown);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.handleKeyDown);
  }
  updated(changedProperties) {
    if (changedProperties.has("sideboardCardsJson") || changedProperties.has("summary")) {
      this.fetchCardData();
    }
    if (changedProperties.has("heroPrintingId")) {
      this.fetchHeroCard();
    }
  }
  openOverlay(imageUrl, alt) {
    this.overlayImageUrl = imageUrl;
    this.overlayAlt = alt;
  }
  closeOverlay() {
    this.overlayImageUrl = null;
    this.overlayAlt = "";
  }
  async fetchHeroCard() {
    if (!this.heroPrintingId) {
      this.heroCardData = null;
      return;
    }
    this.loadingHeroCard = true;
    try {
      const response = await fetch(
        `/api/printings/search?printingIds=${encodeURIComponent(this.heroPrintingId)}&show=all&limit=1`
      );
      if (response.ok) {
        const json = await response.json();
        const printings = json?.data?.printings || [];
        if (printings.length > 0) {
          this.heroCardData = printings[0];
        }
      }
    } catch (error) {
      console.error("Failed to fetch hero card:", error);
    } finally {
      this.loadingHeroCard = false;
    }
  }
  async fetchCardData() {
    const sideboardIds = this.parsedSideboardCards.map((c2) => c2.printingId);
    const inlineIds = this.inlineCardIds;
    const allIds = [.../* @__PURE__ */ new Set([...sideboardIds, ...inlineIds])];
    if (allIds.length === 0) return;
    const newPrintingIds = allIds.filter((id) => !this.cardDataMap.has(id) && !this.loadingCards.has(id));
    if (newPrintingIds.length === 0) return;
    newPrintingIds.forEach((id) => this.loadingCards.add(id));
    this.requestUpdate();
    try {
      const response = await fetch(
        `/api/printings/search?printingIds=${encodeURIComponent(newPrintingIds.join(","))}&show=all&limit=${newPrintingIds.length}`
      );
      if (response.ok) {
        const json = await response.json();
        const printings = json?.data?.printings || [];
        printings.forEach((p2) => {
          this.cardDataMap.set(p2.printing_id, p2);
        });
      }
    } catch (error) {
      console.error("Failed to fetch card data:", error);
    } finally {
      newPrintingIds.forEach((id) => this.loadingCards.delete(id));
      this.requestUpdate();
    }
  }
  renderCardThumbnails() {
    const cards = this.parsedSideboardCards;
    if (cards.length === 0) return null;
    const cardsIn = cards.filter((c2) => c2.action === "in");
    const cardsOut = cards.filter((c2) => c2.action === "out");
    return b`
      <div class="sideboard-cards">
        ${cardsIn.length > 0 ? b`
          <div class="card-group">
            <span class="card-group-label in">+In (${cardsIn.length})</span>
            ${cardsIn.map((card) => this.renderSingleCard(card.printingId))}
          </div>
        ` : ""}
        ${cardsOut.length > 0 ? b`
          <div class="card-group">
            <span class="card-group-label out">-Out (${cardsOut.length})</span>
            ${cardsOut.map((card) => this.renderSingleCard(card.printingId))}
          </div>
        ` : ""}
      </div>
    `;
  }
  renderSingleCard(printingId) {
    const cardData = this.cardDataMap.get(printingId);
    const isLoading = this.loadingCards.has(printingId);
    if (isLoading || !cardData) {
      return b`
        <div class="sideboard-card-item">
          <div class="card-thumbnail-placeholder"></div>
        </div>
      `;
    }
    return b`
      <div class="sideboard-card-item" @click="${() => this.openOverlay(cardData.image_url, cardData.display_name)}" title="${cardData.display_name} — click to enlarge">
        <div class="card-thumb-wrap">
          <img class="card-thumb-top" src="${cardData.image_url}" alt="${cardData.display_name}" />
          <img class="card-thumb-bottom" src="${cardData.image_url}" alt="" aria-hidden="true" />
        </div>
        <div class="sideboard-card-name">${cardData.display_name}</div>
      </div>
    `;
  }
  renderHeroCard() {
    if (this.loadingHeroCard) {
      return b`<div class="hero-card-placeholder"></div>`;
    }
    if (!this.heroCardData) {
      return b`<span class="hero">vs ${this.hero}</span>`;
    }
    return b`
      <div class="hero-card-container">
        <img
          class="hero-card-image"
          src="${this.heroCardData.image_url}"
          alt="${this.heroCardData.display_name}"
          title="${this.heroCardData.display_name} - Click to enlarge"
          @click="${() => this.openOverlay(this.heroCardData.image_url, this.heroCardData.display_name)}"
        />
        <span class="hero">vs ${this.hero}</span>
      </div>
    `;
  }
  renderOverlay() {
    if (!this.overlayImageUrl) return null;
    return b`
      <div class="card-overlay" @click="${this.closeOverlay}">
        <button class="card-overlay-close" @click="${this.closeOverlay}">&times;</button>
        <img src="${this.overlayImageUrl}" alt="${this.overlayAlt}" @click="${(e2) => e2.stopPropagation()}" />
      </div>
    `;
  }
  // Render summary text with inline card thumbnails
  renderSummaryWithInlineCards() {
    if (!this.summary) return null;
    const regex = /<InlineCard\s+printingId="([^"]+)"[^>]*>([^<]*)<\/InlineCard>/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(this.summary)) !== null) {
      if (match.index > lastIndex) {
        parts.push(this.summary.substring(lastIndex, match.index));
      }
      parts.push({ printingId: match[1], cardName: match[2] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < this.summary.length) {
      parts.push(this.summary.substring(lastIndex));
    }
    if (parts.length === 1 && typeof parts[0] === "string") {
      return b`${parts[0]}`;
    }
    return b`${parts.map((part) => {
      if (typeof part === "string") {
        return b`${part}`;
      }
      const cardData = this.cardDataMap.get(part.printingId);
      const isLoading = this.loadingCards.has(part.printingId);
      if (isLoading) {
        return b`<span class="inline-card-name">${part.cardName}</span>`;
      }
      if (!cardData) {
        return b`<span class="inline-card-name">${part.cardName}</span>`;
      }
      return b`<span
        class="inline-card-name inline-card-clickable"
        title="${cardData.display_name} — click to view"
        @click="${() => this.openOverlay(cardData.image_url, cardData.display_name)}"
      >${part.cardName}</span>`;
    })}`;
  }
  render() {
    if (!this.round || !this.hero || !this.result) {
      return b``;
    }
    const resultClass = this.result.toUpperCase() === "W" ? "win" : this.result.toUpperCase() === "L" ? "loss" : "draw";
    const resultLabel = this.result.toUpperCase() === "W" ? "W" : this.result.toUpperCase() === "L" ? "L" : "D";
    const resultWord = resultClass === "win" ? "Win" : resultClass === "loss" ? "Loss" : "Draw";
    return b`
      ${this.renderOverlay()}
      <div class="match">
        <div class="header ${resultClass}">
          <div class="round-info">
            <span class="round">${this.round}</span>
            ${this.renderHeroCard()}
            ${this.opponent ? b`<span class="opponent-inline">${this.opponent}</span>` : ""}
          </div>
          <div class="result-right">
            ${this.record ? b`<span class="record">${this.record}</span>` : ""}
            <div class="result-badge ${resultClass}">
              <span class="result-letter">${resultLabel}</span>
              <span class="result-word">${resultWord}</span>
            </div>
          </div>
        </div>
        <div class="content">
          ${this.summary ? b`
            <div class="summary">${this.renderSummaryWithInlineCards()}</div>
          ` : ""}
          ${this.parsedSideboardCards.length > 0 || this.sideboard ? b`
            <div class="sideboard">
              <div class="sideboard-title">Sideboard Notes</div>
              ${this.renderCardThumbnails()}
              ${this.sideboard ? b`
                <div class="sideboard-text">${this.sideboard}</div>
              ` : ""}
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }
};
FabMatchReport.styles = i$4`
    :host {
      display: block;
      margin: 1.5rem 0;
    }

    /* ===== LIGHT MODE (default) ===== */
    .match {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 0.625rem;
      overflow: hidden;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1.25rem;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    /* Subtle result color tint on header */
    .header.win  { background: rgba(34, 197, 94, 0.06);  border-bottom-color: rgba(34, 197, 94, 0.2); }
    .header.loss { background: rgba(239, 68, 68, 0.06);  border-bottom-color: rgba(239, 68, 68, 0.2); }
    .header.draw { background: rgba(234, 179, 8, 0.06);  border-bottom-color: rgba(234, 179, 8, 0.2); }

    .round-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    /* Round label — styled pill badge */
    .round {
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #64748b;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      padding: 0.1875rem 0.5rem;
      border-radius: 0.25rem;
    }

    .hero {
      display: inline-flex;
      align-items: center;
      padding: 0.1875rem 0.625rem;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      font-size: 0.8125rem;
      font-weight: 600;
      color: #334155;
    }

    .opponent-inline {
      font-size: 0.8125rem;
      color: #94a3b8;
      font-weight: 400;
    }

    /* Result pill — wider, shows full word */
    .result-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.875rem;
      border-radius: 99px;
      font-weight: 700;
      font-size: 0.8125rem;
      color: white;
      letter-spacing: 0.03em;
    }

    .result-badge.win  { background: #16a34a; }
    .result-badge.loss { background: #dc2626; }
    .result-badge.draw { background: #ca8a04; }

    .result-letter {
      font-size: 1rem;
      font-weight: 800;
      line-height: 1;
    }

    .result-word {
      font-size: 0.6875rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.85;
    }

    .result-right {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }

    .record {
      font-size: 0.8125rem;
      color: #64748b;
      font-weight: 500;
    }

    .content {
      padding: 1.25rem 1.5rem;
    }

    .summary {
      color: #475569;
      line-height: 1.6;
      margin-bottom: 1rem;
      white-space: pre-wrap;
    }

    .sideboard {
      background: #fef3c7;
      border-radius: 0.375rem;
      padding: 1rem;
      margin-top: 1rem;
    }

    .sideboard-title {
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #0f172a;
    }

    .sideboard-text {
      font-size: 0.875rem;
      color: #475569;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    .sideboard-cards {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .card-group {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .card-group-label {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.125rem 0.5rem;
      border-radius: 0.25rem;
      min-width: 2rem;
      text-align: center;
      align-self: flex-start;
      margin-top: 0.25rem;
    }

    .card-group-label.in {
      background: #dcfce7;
      color: #166534;
    }

    .card-group-label.out {
      background: #fee2e2;
      color: #991b1b;
    }

    /* Sideboard card item: dual-crop thumbnail + name below */
    .sideboard-card-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      width: 52px;
      cursor: pointer;
    }

    .card-thumb-wrap {
      width: 52px;
      border-radius: 4px;
      overflow: hidden;
      aspect-ratio: 63/53;
      display: flex;
      flex-direction: column;
      gap: 1px;
      background: #111827;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      flex-shrink: 0;
    }

    .sideboard-card-item:hover .card-thumb-wrap {
      transform: scale(1.08);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    }

    .card-thumb-top {
      width: 100%;
      object-fit: cover;
      object-position: top;
      flex: 0 0 81%;
      min-height: 0;
      display: block;
    }

    .card-thumb-bottom {
      width: 100%;
      object-fit: cover;
      object-position: bottom;
      flex: 1 0 0;
      min-height: 0;
      display: block;
    }

    .sideboard-card-name {
      font-size: 0.6rem;
      font-weight: 500;
      color: #475569;
      text-align: center;
      line-height: 1.2;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      width: 100%;
    }

    .card-thumbnail-placeholder {
      width: 52px;
      aspect-ratio: 63/53;
      border-radius: 4px;
      background: #e2e8f0;
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .hero-card-container {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .hero-card-image {
      width: 64px;
      height: 90px;
      border-radius: 6px;
      object-fit: cover;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .hero-card-image:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
    }

    .hero-card-placeholder {
      width: 64px;
      height: 90px;
      border-radius: 6px;
      background: #e2e8f0;
      animation: pulse 1.5s ease-in-out infinite;
    }

    .card-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      cursor: pointer;
      backdrop-filter: blur(4px);
    }

    .card-overlay img {
      max-width: 90vw;
      max-height: 90vh;
      width: auto;
      height: auto;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    }

    .card-overlay-close {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: white;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      font-size: 1.5rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s ease;
    }

    .card-overlay-close:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .inline-card-name {
      font-weight: 600;
      color: #0f172a;
    }

    .inline-card-clickable {
      cursor: pointer;
      border-bottom: 1px dashed #94a3b8;
      transition: color 0.1s, border-color 0.1s;
    }

    .inline-card-clickable:hover {
      color: #6366f1;
      border-bottom-color: #6366f1;
    }

    /* ===== DARK MODE (via .dark class on html) ===== */
    :host-context(.dark) .match {
      background: #0f172a;
      border-color: #1e293b;
    }

    :host-context(.dark) .header {
      border-bottom-color: #1e293b;
    }

    :host-context(.dark) .header.win  { background: rgba(34, 197, 94, 0.08);  border-bottom-color: rgba(34, 197, 94, 0.2); }
    :host-context(.dark) .header.loss { background: rgba(239, 68, 68, 0.08);  border-bottom-color: rgba(239, 68, 68, 0.2); }
    :host-context(.dark) .header.draw { background: rgba(234, 179, 8, 0.08);  border-bottom-color: rgba(234, 179, 8, 0.2); }

    :host-context(.dark) .round {
      color: #94a3b8;
      background: #1e293b;
      border-color: #334155;
    }

    :host-context(.dark) .hero {
      background: #1e293b;
      border-color: #334155;
      color: #e2e8f0;
    }

    :host-context(.dark) .opponent-inline {
      color: #64748b;
    }

    :host-context(.dark) .record {
      color: #94a3b8;
    }

    :host-context(.dark) .summary {
      color: #cbd5e1;
    }

    :host-context(.dark) .sideboard {
      background: #422006;
    }

    :host-context(.dark) .sideboard-title {
      color: #fef3c7;
    }

    :host-context(.dark) .sideboard-text {
      color: #fcd34d;
    }

    :host-context(.dark) .card-group-label.in {
      background: #14532d;
      color: #86efac;
    }

    :host-context(.dark) .card-group-label.out {
      background: #450a0a;
      color: #fca5a5;
    }

    :host-context(.dark) .card-thumbnail-placeholder,
    :host-context(.dark) .hero-card-placeholder {
      background: #334155;
    }

    :host-context(.dark) .sideboard-card-name {
      color: #94a3b8;
    }

    :host-context(.dark) .inline-card-name {
      color: #f1f5f9;
    }

    :host-context(.dark) .inline-card-clickable:hover {
      color: #818cf8;
      border-bottom-color: #818cf8;
    }

    /* ===== DARK MODE (Safari/iOS fallback via OS preference) ===== */
    @media (prefers-color-scheme: dark) {
      .match {
        background: #0f172a;
        border-color: #1e293b;
      }
      .header { border-bottom-color: #1e293b; }
      .header.win  { background: rgba(34, 197, 94, 0.08); }
      .header.loss { background: rgba(239, 68, 68, 0.08); }
      .header.draw { background: rgba(234, 179, 8, 0.08); }
      .round { color: #94a3b8; background: #1e293b; border-color: #334155; }
      .hero { background: #1e293b; border-color: #334155; color: #e2e8f0; }
      .opponent-inline { color: #64748b; }
      .record { color: #94a3b8; }
      .opponent { color: #94a3b8; }
      .summary { color: #cbd5e1; }
      .sideboard { background: #422006; }
      .sideboard-title { color: #fef3c7; }
      .sideboard-text { color: #fcd34d; }
      .card-group-label.in { background: #14532d; color: #86efac; }
      .card-group-label.out { background: #450a0a; color: #fca5a5; }
      .card-thumbnail-placeholder,
      .hero-card-placeholder { background: #334155; }
      .sideboard-card-name { color: #94a3b8; }
      .inline-card-name { color: #f1f5f9; }
    }
  `;
__decorateClass$4([
  r()
], FabMatchReport.prototype, "overlayImageUrl", 2);
__decorateClass$4([
  r()
], FabMatchReport.prototype, "overlayAlt", 2);
__decorateClass$4([
  n2()
], FabMatchReport.prototype, "round", 2);
__decorateClass$4([
  n2()
], FabMatchReport.prototype, "opponent", 2);
__decorateClass$4([
  n2()
], FabMatchReport.prototype, "hero", 2);
__decorateClass$4([
  n2({ attribute: "hero-printing-id" })
], FabMatchReport.prototype, "heroPrintingId", 2);
__decorateClass$4([
  n2()
], FabMatchReport.prototype, "result", 2);
__decorateClass$4([
  n2()
], FabMatchReport.prototype, "record", 2);
__decorateClass$4([
  n2()
], FabMatchReport.prototype, "summary", 2);
__decorateClass$4([
  n2()
], FabMatchReport.prototype, "sideboard", 2);
__decorateClass$4([
  n2({ attribute: "sideboard-cards" })
], FabMatchReport.prototype, "sideboardCardsJson", 2);
__decorateClass$4([
  r()
], FabMatchReport.prototype, "cardDataMap", 2);
__decorateClass$4([
  r()
], FabMatchReport.prototype, "loadingCards", 2);
__decorateClass$4([
  r()
], FabMatchReport.prototype, "heroCardData", 2);
__decorateClass$4([
  r()
], FabMatchReport.prototype, "loadingHeroCard", 2);
FabMatchReport = __decorateClass$4([
  t$1("fab-match-report")
], FabMatchReport);
var __defProp$3 = Object.defineProperty;
var __getOwnPropDesc$3 = Object.getOwnPropertyDescriptor;
var __decorateClass$3 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$3(target, key) : target;
  for (var i3 = decorators.length - 1, decorator; i3 >= 0; i3--)
    if (decorator = decorators[i3])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$3(target, key, result);
  return result;
};
const COST_CHIPS = [0, 1, 2, 3, 4, 5];
const POWER_CHIPS = [3, 4, 5, 6, 7];
const DEFENSE_CHIPS = [0, 2, 3, 4];
let FabDecklistBlock = class extends i$1 {
  constructor() {
    super(...arguments);
    this.deckId = "";
    this.sections = "";
    this.exportUrl = "";
    this.notes = "";
    this.title = "Decklist";
    this.articlePublicId = "";
    this.heroPublicId = "";
    this._loading = false;
    this._error = "";
    this._deckData = null;
    this._viewMode = "grid";
    this._highlightFilters = [];
    this._overlayImage = null;
    this._onKeyDown = (e2) => {
      if (e2.key === "Escape") this._overlayImage = null;
    };
    this._lastFetchedDeckId = "";
    this._imageUrlById = /* @__PURE__ */ new Map();
    this._attemptedImageIds = /* @__PURE__ */ new Set();
  }
  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("keydown", this._onKeyDown);
    const saved = localStorage.getItem("fab-decklist-view");
    if (saved === "list" || saved === "grid") {
      this._viewMode = saved;
    }
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this._onKeyDown);
  }
  firstUpdated() {
    if (this.deckId && !this._lastFetchedDeckId) {
      this._fetchDeck();
    }
  }
  updated(changedProperties) {
    if (changedProperties.has("deckId") && this.deckId && this.deckId !== this._lastFetchedDeckId) {
      this._fetchDeck();
    }
  }
  _setViewMode(mode) {
    this._viewMode = mode;
    localStorage.setItem("fab-decklist-view", mode);
  }
  _toggleFilter(stat, value) {
    const idx = this._highlightFilters.findIndex((f2) => f2.stat === stat && f2.value === value);
    if (idx >= 0) {
      this._highlightFilters = this._highlightFilters.filter((_2, i3) => i3 !== idx);
    } else {
      this._highlightFilters = [...this._highlightFilters, { stat, value }];
    }
  }
  _isFilterActive(stat, value) {
    return this._highlightFilters.some((f2) => f2.stat === stat && f2.value === value);
  }
  _matchesStat(card, stat, value) {
    switch (stat) {
      case "pitch":
        return card.pitch === value;
      case "cost":
        if (card.cost === null) return false;
        return value === 5 ? card.cost >= 5 : card.cost === value;
      case "power":
        if (card.power === null) return false;
        return value === 7 ? card.power >= 7 : card.power === value;
      case "defense":
        if (value === 0) return card.defense === null || card.defense === 0;
        return card.defense === value;
      default:
        return false;
    }
  }
  _matchesAllFilters(card) {
    return this._highlightFilters.every((f2) => this._matchesStat(card, f2.stat, f2.value));
  }
  _computeAllCards() {
    if (!this._deckData) return [];
    return this._deckData.sections.flatMap((s2) => s2.cards);
  }
  // Count total copies (with quantity) matching a chip
  _getChipCount(stat, value) {
    return this._computeAllCards().reduce((sum, card) => {
      return sum + (this._matchesStat(card, stat, value) ? card.quantity : 0);
    }, 0);
  }
  async _fetchDeck() {
    if (!this.deckId) return;
    this._loading = true;
    this._error = "";
    this._highlightFilters = [];
    this._lastFetchedDeckId = this.deckId;
    try {
      const params = new URLSearchParams();
      if (this.articlePublicId) {
        params.set("articlePublicId", this.articlePublicId);
      } else if (this.heroPublicId) {
        params.set("heroPublicId", this.heroPublicId);
      }
      const queryString = params.toString();
      const url = `/api/decks/${this.deckId}${queryString ? `?${queryString}` : ""}`;
      const response = await fetch(url);
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to fetch deck");
      }
      this._deckData = this._transformDeckToSections(result.data);
    } catch (e2) {
      this._error = e2 instanceof Error ? e2.message : "Failed to fetch deck";
    } finally {
      this._loading = false;
    }
  }
  _transformDeckToSections(deck) {
    const sections = [];
    const heroAndEquipment = [
      ...Array.isArray(deck.hero) ? deck.hero : [],
      ...Array.isArray(deck.equipment) ? deck.equipment : []
    ];
    if (heroAndEquipment.length > 0) {
      const cardMap = /* @__PURE__ */ new Map();
      for (const card of heroAndEquipment) {
        const printingId = card.printingId;
        const cardName = card.printingDetails?.display_name || card.printingDetails?.name || "Unknown Card";
        const qty = card.quantity ?? 1;
        if (cardMap.has(printingId)) {
          cardMap.get(printingId).quantity += qty;
        } else {
          cardMap.set(printingId, {
            cardName,
            printingId,
            quantity: qty,
            foiling: card.printingDetails?.foiling || card.foiling,
            imageUrl: card.printingDetails?.image_url,
            pitch: card.printingDetails?.pitch ?? null,
            cost: card.printingDetails?.cost ?? null,
            power: card.printingDetails?.power ?? null,
            defense: card.printingDetails?.defense ?? null,
            types: card.printingDetails?.types ?? [],
            keywords: card.printingDetails?.keywords ?? []
          });
        }
      }
      const totalEquip = Array.from(cardMap.values()).reduce((s2, c2) => s2 + c2.quantity, 0);
      sections.push({
        label: "EQUIPMENT & WEAPONS",
        pitchColor: null,
        totalCards: totalEquip,
        uniqueCards: cardMap.size,
        cards: Array.from(cardMap.values())
      });
    }
    const remainingCategories = [
      { key: "maindeck", label: "Main Deck" },
      { key: "inventory", label: "Inventory" },
      { key: "maybeboard", label: "Maybeboard" },
      { key: "tokens", label: "Tokens" }
    ];
    for (const { key } of remainingCategories) {
      const categoryCards = deck[key];
      if (!Array.isArray(categoryCards) || categoryCards.length === 0) continue;
      if (key === "maindeck") {
        const pitchBuckets = [
          { label: "LIBRARY — RED", pitchColor: "red", cardMap: /* @__PURE__ */ new Map(), totalCards: 0 },
          { label: "LIBRARY — YELLOW", pitchColor: "yellow", cardMap: /* @__PURE__ */ new Map(), totalCards: 0 },
          { label: "LIBRARY — BLUE", pitchColor: "blue", cardMap: /* @__PURE__ */ new Map(), totalCards: 0 },
          { label: "Other", pitchColor: null, cardMap: /* @__PURE__ */ new Map(), totalCards: 0 }
        ];
        for (const card of categoryCards) {
          const pitch = card.printingDetails?.pitch;
          const bucketIndex = pitch === 1 ? 0 : pitch === 2 ? 1 : pitch === 3 ? 2 : 3;
          const bucket = pitchBuckets[bucketIndex];
          const printingId = card.printingId;
          const cardName = card.printingDetails?.display_name || card.printingDetails?.name || "Unknown Card";
          const qty = card.quantity ?? 1;
          bucket.totalCards += qty;
          if (bucket.cardMap.has(printingId)) {
            bucket.cardMap.get(printingId).quantity += qty;
          } else {
            bucket.cardMap.set(printingId, {
              cardName,
              printingId,
              quantity: qty,
              foiling: card.printingDetails?.foiling || card.foiling,
              imageUrl: card.printingDetails?.image_url,
              pitch: pitch ?? null,
              cost: card.printingDetails?.cost ?? null,
              power: card.printingDetails?.power ?? null,
              defense: card.printingDetails?.defense ?? null,
              types: card.printingDetails?.types ?? [],
              keywords: card.printingDetails?.keywords ?? []
            });
          }
        }
        for (const bucket of pitchBuckets) {
          if (bucket.cardMap.size > 0) {
            sections.push({
              label: bucket.label,
              pitchColor: bucket.pitchColor,
              totalCards: bucket.totalCards,
              uniqueCards: bucket.cardMap.size,
              cards: Array.from(bucket.cardMap.values())
            });
          }
        }
        continue;
      }
      const cardMap = /* @__PURE__ */ new Map();
      for (const card of categoryCards) {
        const printingId = card.printingId;
        const cardName = card.printingDetails?.display_name || card.printingDetails?.name || "Unknown Card";
        const qty = card.quantity ?? 1;
        if (cardMap.has(printingId)) {
          cardMap.get(printingId).quantity += qty;
        } else {
          cardMap.set(printingId, {
            cardName,
            printingId,
            quantity: qty,
            foiling: card.printingDetails?.foiling || card.foiling,
            imageUrl: card.printingDetails?.image_url,
            pitch: card.printingDetails?.pitch ?? null,
            cost: card.printingDetails?.cost ?? null,
            power: card.printingDetails?.power ?? null,
            defense: card.printingDetails?.defense ?? null,
            types: card.printingDetails?.types ?? [],
            keywords: card.printingDetails?.keywords ?? []
          });
        }
      }
      const label = key === "inventory" ? "Inventory" : key === "maybeboard" ? "Maybeboard" : "Tokens";
      sections.push({
        label,
        pitchColor: null,
        totalCards: categoryCards.length,
        uniqueCards: cardMap.size,
        cards: Array.from(cardMap.values())
      });
    }
    return {
      sections,
      title: deck.name || "Decklist",
      exportUrl: deck.fabraryUrl,
      notes: deck.description
    };
  }
  /**
   * Resolve the CDN url for a card. Images are keyed by printing characteristics,
   * not by printing_id, so the url must come from the printing row (deck API) or
   * from a lookup — an id-derived url 404s and falls back to the cardback.
   */
  getCardImageUrl(card) {
    return card.imageUrl || this._imageUrlById.get(card.printingId) || "";
  }
  /**
   * Hand-authored `sections` JSON carries printing ids without image urls.
   * Look them up the same way fab-match-report does.
   */
  async _fetchMissingImages(printingIds) {
    const missing = [...new Set(printingIds)].filter(
      (id) => id && !this._attemptedImageIds.has(id)
    );
    if (missing.length === 0) return;
    missing.forEach((id) => this._attemptedImageIds.add(id));
    try {
      const response = await fetch(
        `/api/printings/search?printingIds=${encodeURIComponent(missing.join(","))}&show=all&limit=${missing.length}`
      );
      if (response.ok) {
        const json = await response.json();
        const printings = json?.data?.printings || [];
        for (const p2 of printings) {
          if (p2?.printing_id && p2?.image_url) {
            this._imageUrlById.set(p2.printing_id, p2.image_url);
          }
        }
        this.requestUpdate();
      }
    } catch {
    }
  }
  getFoilingClass(foiling) {
    if (!foiling) return "nf";
    const f2 = foiling.toLowerCase();
    if (f2.includes("rainbow") || f2.includes("rf")) return "rf";
    if (f2.includes("cold") || f2.includes("cf")) return "cf";
    return "nf";
  }
  getFoilingText(foiling) {
    if (!foiling) return "NF";
    const f2 = foiling.toLowerCase();
    if (f2.includes("rainbow") || f2.includes("rf")) return "RF";
    if (f2.includes("cold") || f2.includes("cf")) return "CF";
    return "NF";
  }
  renderHud() {
    const allCards = this._computeAllCards();
    if (allCards.length === 0) return null;
    const pitchChips = [1, 2, 3].map((v2) => {
      const count = this._getChipCount("pitch", v2);
      const active = this._isFilterActive("pitch", v2);
      return b`
        <button
          class="hud-chip ${active ? "active" : ""} ${count === 0 ? "zero" : ""}"
          @click="${() => count > 0 && this._toggleFilter("pitch", v2)}"
          title="Pitch ${v2} (${count} cards)"
        >
          <img class="hud-stat-icon" src="/fab/symbols/pitch${v2}.png" alt="Pitch ${v2}" />
        </button>
      `;
    });
    const costChips = COST_CHIPS.map((v2) => {
      const label = v2 === 5 ? "5+" : String(v2);
      const count = this._getChipCount("cost", v2);
      const active = this._isFilterActive("cost", v2);
      return b`
        <button
          class="hud-chip ${active ? "active" : ""} ${count === 0 ? "zero" : ""}"
          @click="${() => count > 0 && this._toggleFilter("cost", v2)}"
          title="Cost ${label} (${count} cards)"
        >
          <div class="hud-cost-icon-wrap">
            <img src="/fab/symbols/cost.png" alt="Cost" />
            <span>${label}</span>
          </div>
        </button>
      `;
    });
    const powerChips = POWER_CHIPS.map((v2) => {
      const label = v2 === 7 ? "7+" : String(v2);
      const count = this._getChipCount("power", v2);
      const active = this._isFilterActive("power", v2);
      return b`
        <button
          class="hud-chip ${active ? "active" : ""} ${count === 0 ? "zero" : ""}"
          @click="${() => count > 0 && this._toggleFilter("power", v2)}"
          title="Power ${label} (${count} cards)"
        >
          <span>${label}</span>
          <img class="hud-stat-icon" src="/fab/symbols/power.png" alt="Power" />
        </button>
      `;
    });
    const defenseChips = DEFENSE_CHIPS.map((v2) => {
      const count = this._getChipCount("defense", v2);
      const active = this._isFilterActive("defense", v2);
      return b`
        <button
          class="hud-chip ${active ? "active" : ""} ${count === 0 ? "zero" : ""}"
          @click="${() => count > 0 && this._toggleFilter("defense", v2)}"
          title="Defense ${v2} (${count} cards)"
        >
          <span>${v2}</span>
          <img class="hud-stat-icon" src="/fab/symbols/block.png" alt="Defense" />
        </button>
      `;
    });
    return b`
      <div class="hud">
        <span class="hud-label">Highlight</span>
        <div class="hud-group">${pitchChips}</div>
        <div class="hud-divider"></div>
        <div class="hud-group">${costChips}</div>
        <div class="hud-divider"></div>
        <div class="hud-group">${powerChips}</div>
        <div class="hud-divider"></div>
        <div class="hud-group">${defenseChips}</div>
        ${this._highlightFilters.length > 0 ? b`
          <button class="hud-clear" @click="${() => {
      this._highlightFilters = [];
    }}">
            × clear
          </button>
        ` : ""}
      </div>
    `;
  }
  renderGridView(cards) {
    const hasFilters = this._highlightFilters.length > 0;
    const tiles = cards.flatMap(
      (card) => Array.from({ length: card.quantity }, () => card)
    );
    return b`
      <div class="cards-grid">
        ${tiles.map((card) => {
      const matched = hasFilters && this._matchesAllFilters(card);
      const dimmed = hasFilters && !this._matchesAllFilters(card);
      const imageUrl = this.getCardImageUrl(card);
      return b`
            <div class="card-item ${matched ? "highlighted" : ""} ${dimmed ? "dimmed" : ""}">
              <div class="card-image-wrapper" @click="${() => imageUrl && (this._overlayImage = imageUrl)}">
                ${imageUrl ? b`
                  <img
                    class="card-image-top"
                    src="${imageUrl}"
                    alt="${card.cardName}"
                    loading="lazy"
                    @error=${(e2) => {
        e2.target.src = "/cardback.webp";
        const wrapper = e2.target.closest(".card-image-wrapper");
        const bottom = wrapper?.querySelector(".card-image-bottom");
        if (bottom) bottom.style.display = "none";
      }}
                  />
                  <img
                    class="card-image-bottom"
                    src="${imageUrl}"
                    alt=""
                    loading="lazy"
                  />
                ` : b`
                  <img class="card-image" src="/cardback.webp" alt="${card.cardName}" />
                `}
                ${this.getFoilingText(card.foiling) !== "NF" ? b`
                  <span class="foil-badge ${this.getFoilingClass(card.foiling)}">
                    ${this.getFoilingText(card.foiling)}
                  </span>
                ` : ""}
                <div class="card-name-hover">${card.cardName}</div>
              </div>
            </div>
          `;
    })}
      </div>
    `;
  }
  renderListView(cards) {
    const hasFilters = this._highlightFilters.length > 0;
    return b`
      <div class="cards-list">
        ${cards.map((card) => {
      const matched = hasFilters && this._matchesAllFilters(card);
      const dimmed = hasFilters && !this._matchesAllFilters(card);
      const imageUrl = this.getCardImageUrl(card);
      return b`
            <div class="list-row ${matched ? "highlighted" : ""} ${dimmed ? "dimmed" : ""}" @click="${() => imageUrl && (this._overlayImage = imageUrl)}">
              ${imageUrl ? b`
                <img
                  class="list-card-thumb"
                  src="${imageUrl}"
                  alt="${card.cardName}"
                  loading="lazy"
                  @error=${(e2) => {
        e2.target.src = "/cardback.webp";
      }}
                />
              ` : b`
                <img class="list-card-thumb" src="/cardback.webp" alt="${card.cardName}" />
              `}
              <span class="list-card-name">${card.cardName}</span>
              ${card.quantity > 1 ? b`<span class="list-card-qty">${card.quantity}×</span>` : ""}
              <span class="list-foil-badge ${this.getFoilingClass(card.foiling)}">
                ${this.getFoilingText(card.foiling)}
              </span>
            </div>
          `;
    })}
      </div>
    `;
  }
  render() {
    if (this._loading) {
      return b`
        <div class="decklist">
          <div class="header">
            <h3 class="title">${this.title}</h3>
          </div>
          <div class="loading">
            <div class="loading-spinner"></div>
            <span>Loading deck...</span>
          </div>
        </div>
      `;
    }
    if (this._error) {
      return b`
        <div class="decklist">
          <div class="header">
            <h3 class="title">${this.title}</h3>
          </div>
          <div style="color: #ef4444; padding: 1.5rem; text-align: center;">
            Error: ${this._error}
          </div>
        </div>
      `;
    }
    let sectionsData = [];
    let effectiveTitle = this.title;
    let effectiveExportUrl = this.exportUrl;
    let effectiveNotes = this.notes;
    const hasApiData = !!this._deckData;
    if (this._deckData) {
      sectionsData = this._deckData.sections;
      effectiveTitle = this.title !== "Decklist" ? this.title : this._deckData.title || "Decklist";
      effectiveExportUrl = this.exportUrl || this._deckData.exportUrl || "";
      effectiveNotes = this.notes || this._deckData.notes || "";
    } else if (this.sections) {
      try {
        const parsed = JSON.parse(this.sections);
        sectionsData = parsed.map((section) => ({
          label: section.label,
          pitchColor: null,
          totalCards: section.cards?.length || 0,
          uniqueCards: section.cards?.length || 0,
          cards: (section.cards || []).map((card) => {
            if (typeof card === "string") {
              const match = card.match(/^(\d+)x\s+(.+)$/);
              if (match) {
                return { cardName: match[2], printingId: "", quantity: parseInt(match[1], 10), pitch: null, cost: null, power: null, defense: null, types: [], keywords: [] };
              }
              return { cardName: card, printingId: "", quantity: 1, pitch: null, cost: null, power: null, defense: null, types: [], keywords: [] };
            }
            return {
              pitch: null,
              cost: null,
              power: null,
              defense: null,
              types: [],
              keywords: [],
              ...card,
              imageUrl: card.imageUrl || card.image_url || void 0,
              quantity: card.quantity || 1
            };
          })
        }));
        const unresolved = sectionsData.flatMap((s2) => s2.cards).filter((c2) => c2.printingId && !c2.imageUrl).map((c2) => c2.printingId);
        if (unresolved.length > 0) this._fetchMissingImages(unresolved);
      } catch (e2) {
        return b`<div style="color: #ef4444; padding: 1rem;">Error: Invalid sections data</div>`;
      }
    } else if (this.deckId) {
      return b``;
    } else {
      return b``;
    }
    if (sectionsData.length === 0) return b``;
    return b`
      <div class="decklist">
        <div class="header">
          <h3 class="title">${effectiveTitle}</h3>
          <div class="header-actions">
            <div class="view-toggle" role="group" aria-label="View mode">
              <button
                class="view-btn ${this._viewMode === "grid" ? "active" : ""}"
                @click="${() => this._setViewMode("grid")}"
                title="Grid view"
                aria-pressed="${this._viewMode === "grid"}"
              >
                ${this.renderGridIcon()} Grid
              </button>
              <button
                class="view-btn ${this._viewMode === "list" ? "active" : ""}"
                @click="${() => this._setViewMode("list")}"
                title="List view"
                aria-pressed="${this._viewMode === "list"}"
              >
                ${this.renderListIcon()} List
              </button>
            </div>
            ${effectiveExportUrl ? b`
              <a
                href="${effectiveExportUrl}"
                class="export-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                View Full List
                <span class="export-icon">${this.renderExternalLinkIcon()}</span>
              </a>
            ` : ""}
          </div>
        </div>
        <div class="content">
          ${hasApiData ? this.renderHud() : ""}
          ${sectionsData.map((section) => b`
            <div class="section">
              <div class="section-header">
                ${section.pitchColor ? b`<span class="pitch-dot ${section.pitchColor}"></span>` : ""}
                <h4 class="section-title ${section.pitchColor ? "library" : ""}">${section.label}</h4>
                ${section.totalCards ? b`
                  <span class="section-count">
                    ${section.totalCards} ${section.totalCards === 1 ? "card" : "cards"}${section.uniqueCards && section.uniqueCards !== section.totalCards ? b` • ${section.uniqueCards} unique` : ""}
                  </span>
                ` : ""}
              </div>
              ${this._viewMode === "list" ? this.renderListView(section.cards) : this.renderGridView(section.cards)}
            </div>
          `)}
          ${effectiveNotes ? b`
            <div class="notes">
              <div class="notes-title">Notes</div>
              <div class="notes-text">${effectiveNotes}</div>
            </div>
          ` : ""}
        </div>
      </div>
      ${this._overlayImage ? b`
        <div class="card-overlay" @click="${() => this._overlayImage = null}">
          <img
            class="card-overlay-img"
            src="${this._overlayImage}"
            alt="Card preview"
          />
        </div>
      ` : ""}
    `;
  }
  renderGridIcon() {
    return b`
      <svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="6" height="6" rx="1"/>
        <rect x="9" y="1" width="6" height="6" rx="1"/>
        <rect x="1" y="9" width="6" height="6" rx="1"/>
        <rect x="9" y="9" width="6" height="6" rx="1"/>
      </svg>
    `;
  }
  renderListIcon() {
    return b`
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg">
        <line x1="4" y1="4" x2="14" y2="4"/>
        <line x1="4" y1="8" x2="14" y2="8"/>
        <line x1="4" y1="12" x2="14" y2="12"/>
        <circle cx="1.5" cy="4" r="1" fill="currentColor" stroke="none"/>
        <circle cx="1.5" cy="8" r="1" fill="currentColor" stroke="none"/>
        <circle cx="1.5" cy="12" r="1" fill="currentColor" stroke="none"/>
      </svg>
    `;
  }
  renderExternalLinkIcon() {
    return b`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/>
        <line x1="10" x2="21" y1="14" y2="3"/>
      </svg>
    `;
  }
};
FabDecklistBlock.styles = i$4`
    /* ===== HOST SETUP ===== */
    :host {
      display: block;
      margin: 2rem 0;
    }

    /* ===== LIGHT MODE (default) ===== */
    .decklist {
      background: #fefce8;
      border: 1px solid #fde047;
      border-radius: 0.75rem;
      overflow: hidden;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    /* ===== VIEW TOGGLE ===== */
    .view-toggle {
      display: inline-flex;
      border: 1px solid #e2e8f0;
      border-radius: 0.375rem;
      overflow: hidden;
    }

    .view-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.25rem;
      padding: 0.3125rem 0.625rem;
      background: transparent;
      border: none;
      cursor: pointer;
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 500;
      transition: background 0.15s, color 0.15s;
      line-height: 1;
    }

    .view-btn + .view-btn {
      border-left: 1px solid #e2e8f0;
    }

    .view-btn:hover {
      background: #f1f5f9;
      color: #0f172a;
    }

    .view-btn.active {
      background: #0f172a;
      color: white;
    }

    .view-btn svg {
      width: 13px;
      height: 13px;
      flex-shrink: 0;
    }

    .export-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: #3b82f6;
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      transition: opacity 0.2s;
    }

    .export-link:hover {
      opacity: 0.7;
    }

    .export-icon {
      width: 1rem;
      height: 1rem;
    }

    .export-icon svg {
      width: 100%;
      height: 100%;
    }

    .content {
      padding: 1rem;
    }

    /* ===== HUD FILTER BAR ===== */
    .hud {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.75rem;
      padding: 0.375rem 0.625rem;
      margin-bottom: 1rem;
      background: rgba(15, 23, 42, 0.08);
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-radius: 0.5rem;
      font-size: 0.625rem;
    }

    .hud-label {
      font-size: 0.625rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #64748b;
      flex-shrink: 0;
    }

    .hud-group {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    /* Cost chips: icon with number overlaid */
    .hud-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.125rem 0.25rem;
      border-radius: 0.25rem;
      border: none;
      background: rgba(15, 23, 42, 0.12);
      cursor: pointer;
      font-size: 0.6875rem;
      font-weight: 600;
      color: #1e293b;
      transition: background 0.1s, opacity 0.1s;
      line-height: 1;
    }

    .hud-chip:hover:not(.zero) {
      background: rgba(15, 23, 42, 0.2);
    }

    .hud-chip.active {
      background: #f59e0b;
      color: white;
      box-shadow: 0 0 0 1px #d97706;
    }

    .hud-chip.zero {
      opacity: 0.3;
      cursor: default;
    }

    /* Cost chip: icon with number centered on top */
    .hud-cost-icon-wrap {
      position: relative;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    .hud-cost-icon-wrap img {
      width: 18px;
      height: 18px;
      object-fit: contain;
    }

    .hud-cost-icon-wrap span {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.5rem;
      font-weight: 800;
      color: white;
      text-shadow: 0 0 3px rgba(0,0,0,1), 0 0 1px rgba(0,0,0,1);
      line-height: 1;
    }

    /* Stat icon (power/defense/pitch) */
    .hud-stat-icon {
      width: 16px;
      height: 16px;
      object-fit: contain;
      flex-shrink: 0;
    }

    .hud-divider {
      width: 1px;
      height: 14px;
      background: rgba(15, 23, 42, 0.15);
      flex-shrink: 0;
    }

    .hud-clear {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 0.625rem;
      font-weight: 500;
      color: #94a3b8;
      transition: color 0.1s;
      margin-left: auto;
    }

    .hud-clear:hover {
      color: #64748b;
    }

    /* ===== SECTION STYLES ===== */
    .section {
      margin-bottom: 1rem;
    }

    .section:last-child {
      margin-bottom: 0;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0.5rem 0.5rem;
      border-bottom: 1px solid #e2e8f0;
      margin-bottom: 0.375rem;
    }

    .pitch-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .pitch-dot.red { background: #ef4444; }
    .pitch-dot.yellow { background: #eab308; }
    .pitch-dot.blue { background: #3b82f6; }

    .section-title {
      font-size: 1rem;
      font-weight: 600;
      color: #0f172a;
      margin: 0;
    }

    .section-title.library {
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .section-count {
      font-size: 0.75rem;
      color: #64748b;
    }

    /* ===== CARD GRID ===== */
    .cards-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }

    /* ===== CARD ITEM (grid view) ===== */
    .card-item {
      width: 72px;
      flex-shrink: 0;
      transition: opacity 0.2s ease, filter 0.2s ease, transform 0.2s ease;
    }

    .card-item.dimmed {
      opacity: 0.18;
      filter: grayscale(1);
      transform: scale(0.95);
    }

    .card-item.highlighted .card-image-wrapper {
      box-shadow: 0 0 0 2px #f59e0b, 0 0 14px rgba(245, 158, 11, 0.55);
    }

    .card-image-wrapper {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 1px;
      border-radius: 4px;
      overflow: hidden;
      background: #080c14;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      cursor: pointer;
    }

    .card-image-wrapper:hover {
      transform: translateY(-2px) scale(1.04);
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
      z-index: 1;
    }

    .card-item.highlighted .card-image-wrapper:hover {
      box-shadow: 0 0 0 2px #f59e0b, 0 6px 18px rgba(245, 158, 11, 0.6);
    }

    /* Top slice: name banner + artwork (~top 55% of card) */
    .card-image-top {
      width: 100%;
      height: 55px;
      object-fit: cover;
      object-position: top;
      display: block;
      flex-shrink: 0;
    }

    /* Bottom slice: type/stats frame (~bottom 13% of card) */
    .card-image-bottom {
      width: 100%;
      height: 13px;
      object-fit: cover;
      object-position: bottom;
      display: block;
      flex-shrink: 0;
    }

    /* Fallback: single full card (cardback or no-image) */
    .card-image {
      width: 100%;
      height: 69px;
      object-fit: cover;
      display: block;
    }

    /* Hover name overlay — sits over the top slice only */
    .card-name-hover {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 55px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding: 0 3px 4px;
      background: linear-gradient(transparent 30%, rgba(0, 0, 0, 0.85));
      color: white;
      font-size: 0.5rem;
      font-weight: 600;
      text-align: center;
      line-height: 1.2;
      opacity: 0;
      transition: opacity 0.15s ease;
      pointer-events: none;
    }

    .card-image-wrapper:hover .card-name-hover {
      opacity: 1;
    }

    .quantity-badge {
      position: absolute;
      top: 4px;
      right: 4px;
      background: rgba(0, 0, 0, 0.75);
      color: white;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      backdrop-filter: blur(4px);
    }

    .foil-badge {
      position: absolute;
      top: 4px;
      left: 4px;
      font-size: 0.65rem;
      font-weight: 600;
      padding: 2px 5px;
      border-radius: 3px;
      backdrop-filter: blur(4px);
    }

    .foil-badge.nf {
      background: rgba(100, 116, 139, 0.85);
      color: white;
    }

    .foil-badge.rf {
      background: rgba(234, 179, 8, 0.9);
      color: #1e293b;
    }

    .foil-badge.cf {
      background: linear-gradient(135deg, #ec4899, #8b5cf6, #06b6d4);
      color: white;
    }

    /* ===== LIST VIEW ===== */
    .cards-list {
      display: flex;
      flex-direction: column;
    }

    .list-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.1875rem 0.5rem;
      border-radius: 3px;
      transition: background 0.1s, opacity 0.2s, filter 0.2s;
      cursor: pointer;
    }

    .list-row:hover {
      background: rgba(0, 0, 0, 0.04);
    }

    .list-row.dimmed {
      opacity: 0.2;
      filter: grayscale(1);
    }

    .list-row.highlighted {
      background: rgba(245, 158, 11, 0.1);
      border-left: 2px solid #f59e0b;
      padding-left: 0.25rem;
    }

    .list-card-thumb {
      width: 22px;
      height: 31px;
      border-radius: 2px;
      object-fit: cover;
      object-position: top;
      flex-shrink: 0;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
    }

    .list-card-name {
      flex: 1;
      font-size: 0.75rem;
      font-weight: 500;
      color: #1e293b;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      min-width: 0;
    }

    .list-card-qty {
      font-size: 0.6875rem;
      font-weight: 600;
      color: #94a3b8;
      min-width: 1.25rem;
      text-align: right;
      flex-shrink: 0;
    }

    /* Only show foil badge for non-NF cards */
    .list-foil-badge {
      font-size: 0.6rem;
      font-weight: 700;
      padding: 1px 4px;
      border-radius: 3px;
      flex-shrink: 0;
    }

    .list-foil-badge.nf {
      display: none;
    }

    .list-foil-badge.rf {
      background: rgba(234, 179, 8, 0.2);
      color: #92400e;
    }

    .list-foil-badge.cf {
      background: linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(139, 92, 246, 0.15), rgba(6, 182, 212, 0.15));
      color: #6d28d9;
    }

    /* ===== NOTES ===== */
    .notes {
      background: #fef3c7;
      border-radius: 0.5rem;
      padding: 1rem;
      margin: 1rem 0.5rem 0.5rem;
    }

    .notes-title {
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #0f172a;
    }

    .notes-text {
      font-size: 0.875rem;
      color: #1e293b;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    /* ===== LOADING STATE ===== */
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3rem;
      color: #64748b;
    }

    .loading-spinner {
      width: 24px;
      height: 24px;
      border: 2px solid #e2e8f0;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-right: 0.75rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* ===== DARK MODE ===== */
    :host-context(.dark) .decklist {
      background: #1e293b;
      border-color: #334155;
    }

    :host-context(.dark) .header {
      border-bottom-color: #334155;
    }

    :host-context(.dark) .title {
      color: #f1f5f9;
    }

    :host-context(.dark) .view-toggle {
      border-color: #334155;
    }

    :host-context(.dark) .view-btn {
      color: #94a3b8;
    }

    :host-context(.dark) .view-btn + .view-btn {
      border-left-color: #334155;
    }

    :host-context(.dark) .view-btn:hover {
      background: #0f172a;
      color: #f1f5f9;
    }

    :host-context(.dark) .view-btn.active {
      background: #f1f5f9;
      color: #0f172a;
    }

    :host-context(.dark) .hud {
      background: rgba(255, 255, 255, 0.04);
      border-color: rgba(255, 255, 255, 0.08);
    }

    :host-context(.dark) .hud-label {
      color: #94a3b8;
    }

    :host-context(.dark) .hud-chip {
      background: rgba(255, 255, 255, 0.08);
      color: #e2e8f0;
    }

    :host-context(.dark) .hud-chip:hover:not(.zero) {
      background: rgba(255, 255, 255, 0.14);
    }

    :host-context(.dark) .hud-divider {
      background: rgba(255, 255, 255, 0.1);
    }

    :host-context(.dark) .hud-clear {
      color: #64748b;
    }

    :host-context(.dark) .hud-clear:hover {
      color: #94a3b8;
    }

    :host-context(.dark) .section-header {
      border-bottom-color: #334155;
    }

    :host-context(.dark) .section-title {
      color: #f1f5f9;
    }

    :host-context(.dark) .section-count {
      color: #94a3b8;
    }

    :host-context(.dark) .card-image-wrapper {
      background: #0f172a;
    }

    :host-context(.dark) .list-row:hover {
      background: rgba(255, 255, 255, 0.04);
    }

    :host-context(.dark) .list-row.highlighted {
      background: rgba(245, 158, 11, 0.12);
    }

    :host-context(.dark) .list-card-name {
      color: #e2e8f0;
    }

    :host-context(.dark) .list-card-qty {
      color: #94a3b8;
    }

    :host-context(.dark) .list-foil-badge.rf {
      background: rgba(234, 179, 8, 0.2);
      color: #fcd34d;
    }

    :host-context(.dark) .list-foil-badge.cf {
      color: #a78bfa;
    }

    :host-context(.dark) .notes {
      background: #422006;
    }

    :host-context(.dark) .notes-title {
      color: #f1f5f9;
    }

    :host-context(.dark) .notes-text {
      color: #e2e8f0;
    }

    :host-context(.dark) .loading {
      color: #94a3b8;
    }

    :host-context(.dark) .loading-spinner {
      border-color: #334155;
      border-top-color: #60a5fa;
    }

    /* ===== SYSTEM DARK MODE (fallback) ===== */
    @media (prefers-color-scheme: dark) {
      .decklist { background: #1e293b; border-color: #334155; }
      .header { border-bottom-color: #334155; }
      .title { color: #f1f5f9; }
      .view-toggle { border-color: #334155; }
      .view-btn { color: #94a3b8; }
      .view-btn + .view-btn { border-left-color: #334155; }
      .view-btn:hover { background: #0f172a; color: #f1f5f9; }
      .view-btn.active { background: #f1f5f9; color: #0f172a; }
      .hud { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.08); }
      .hud-chip { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.12); color: #cbd5e1; }
      .hud-chip:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }
      .hud-divider { background: rgba(255,255,255,0.1); }
      .hud-group-icon { filter: invert(1); opacity: 0.6; }
      .section-header { border-bottom-color: #334155; }
      .section-title { color: #f1f5f9; }
      .section-count { color: #94a3b8; }
      .card-image-wrapper { background: #0f172a; }
      .list-row:hover { background: rgba(255,255,255,0.04); }
      .list-row.highlighted { background: rgba(245,158,11,0.12); }
      .list-card-name { color: #e2e8f0; }
      .list-card-qty { color: #94a3b8; }
      .list-foil-badge.nf { background: rgba(100,116,139,0.3); color: #94a3b8; }
      .list-foil-badge.rf { background: rgba(234,179,8,0.2); color: #fcd34d; }
      .list-foil-badge.cf { color: #a78bfa; }
      .notes { background: #422006; }
      .notes-title { color: #f1f5f9; }
      .notes-text { color: #e2e8f0; }
      .loading { color: #94a3b8; }
      .loading-spinner { border-color: #334155; border-top-color: #60a5fa; }
    }

    /* ===== CARD OVERLAY ===== */
    .card-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(0, 0, 0, 0.88);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      animation: overlayIn 0.15s ease;
    }

    @keyframes overlayIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .card-overlay-img {
      max-height: 88vh;
      max-width: min(88vw, 320px);
      border-radius: 10px;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
      pointer-events: none;
      animation: overlayImgIn 0.15s ease;
    }

    @keyframes overlayImgIn {
      from { transform: scale(0.92); opacity: 0; }
      to   { transform: scale(1);    opacity: 1; }
    }
  `;
__decorateClass$3([
  n2({ attribute: "deck-id" })
], FabDecklistBlock.prototype, "deckId", 2);
__decorateClass$3([
  n2()
], FabDecklistBlock.prototype, "sections", 2);
__decorateClass$3([
  n2({ attribute: "export-url" })
], FabDecklistBlock.prototype, "exportUrl", 2);
__decorateClass$3([
  n2()
], FabDecklistBlock.prototype, "notes", 2);
__decorateClass$3([
  n2()
], FabDecklistBlock.prototype, "title", 2);
__decorateClass$3([
  n2({ attribute: "article-public-id" })
], FabDecklistBlock.prototype, "articlePublicId", 2);
__decorateClass$3([
  n2({ attribute: "hero-public-id" })
], FabDecklistBlock.prototype, "heroPublicId", 2);
__decorateClass$3([
  r()
], FabDecklistBlock.prototype, "_loading", 2);
__decorateClass$3([
  r()
], FabDecklistBlock.prototype, "_error", 2);
__decorateClass$3([
  r()
], FabDecklistBlock.prototype, "_deckData", 2);
__decorateClass$3([
  r()
], FabDecklistBlock.prototype, "_viewMode", 2);
__decorateClass$3([
  r()
], FabDecklistBlock.prototype, "_highlightFilters", 2);
__decorateClass$3([
  r()
], FabDecklistBlock.prototype, "_overlayImage", 2);
FabDecklistBlock = __decorateClass$3([
  t$1("fab-decklist-block")
], FabDecklistBlock);
var __defProp$2 = Object.defineProperty;
var __getOwnPropDesc$2 = Object.getOwnPropertyDescriptor;
var __decorateClass$2 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$2(target, key) : target;
  for (var i3 = decorators.length - 1, decorator; i3 >= 0; i3--)
    if (decorator = decorators[i3])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$2(target, key, result);
  return result;
};
let FabBuylistBlock = class extends i$1 {
  constructor() {
    super(...arguments);
    this.tiers = "";
    this.title = "Buy List";
    this.note = "";
    this._loading = false;
    this._error = "";
    this._data = null;
    this._collapsed = /* @__PURE__ */ new Set();
    this._adding = false;
    this._addMessage = "";
    this._addFailed = false;
    this._lastFetched = "";
  }
  firstUpdated() {
    this._fetchRollup();
  }
  updated(changed) {
    if (changed.has("tiers") && this.tiers !== this._lastFetched) {
      this._fetchRollup();
    }
  }
  _parseTiers() {
    if (!this.tiers) return null;
    try {
      const parsed = JSON.parse(this.tiers);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  async _fetchRollup() {
    const tiers = this._parseTiers();
    this._lastFetched = this.tiers;
    if (!tiers) {
      this._error = "This buy list is misconfigured.";
      return;
    }
    this._loading = true;
    this._error = "";
    try {
      const response = await fetch("/api/buylist/rollup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tiers })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to price this buy list");
      }
      this._data = result.data;
    } catch (e2) {
      this._error = e2 instanceof Error ? e2.message : "Failed to price this buy list";
    } finally {
      this._loading = false;
    }
  }
  _toggleGroup(key) {
    const next = new Set(this._collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this._collapsed = next;
  }
  _money(value) {
    return `$${value.toFixed(2)}`;
  }
  _range(range) {
    return range.min === range.max ? this._money(range.min) : `${this._money(range.min)} – ${this._money(range.max)}`;
  }
  _qtyText(qty) {
    return qty.min === qty.max ? `${qty.min}x` : `${qty.min}-${qty.max}x`;
  }
  /** Every card the reader still needs at least one copy of. */
  _missingCards() {
    if (!this._data) return [];
    return this._data.rollup.tiers.flatMap((tier) => tier.groups).flatMap((group) => group.cards).filter((card) => card.needed.max > 0).map((card) => ({ printingId: card.printingId, quantity: card.needed.max }));
  }
  async _addMissingToWants() {
    const printings = this._missingCards();
    if (printings.length === 0) return;
    this._adding = true;
    this._addMessage = "";
    this._addFailed = false;
    try {
      const response = await fetch("/api/wants/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ printings })
      });
      const result = await response.json();
      if (!response.ok || result.success === false) {
        throw new Error(result.error || "Could not update your wants list");
      }
      this._addMessage = `Added ${printings.length} card${printings.length === 1 ? "" : "s"} to your wants`;
    } catch (e2) {
      this._addFailed = true;
      this._addMessage = e2 instanceof Error ? e2.message : "Could not update your wants list";
    } finally {
      this._adding = false;
    }
  }
  _renderOwnPill(totals) {
    if (!this._data?.authenticated) return null;
    const owned = totals.ownedCopies;
    const wanted = totals.wantedCopies.max;
    const cls = owned === 0 ? "none" : owned >= wanted ? "complete" : "partial";
    const glyph = owned === 0 ? "✗" : owned >= wanted ? "✓" : "◐";
    return b`<span class="own-pill ${cls}">${glyph} own ${owned} / ${wanted}</span>`;
  }
  _renderCard(card) {
    const meta = this._data?.cards[card.printingId];
    const name = meta?.name ?? card.printingId;
    const authenticated = this._data?.authenticated ?? false;
    return b`
      <li class="row">
        ${meta?.image_url ? b`<img class="thumb" src=${meta.image_url} alt="" loading="lazy" />` : b`<span class="thumb" aria-hidden="true"></span>`}
        <span class="row-main">
          <span class="row-name">${name}</span>
          ${meta?.collector_number ? b`<span class="row-meta"> ${meta.collector_number.toUpperCase()}</span>` : null}
        </span>
        <span class="row-qty">${this._qtyText(card.qty)}</span>
        <span class="row-price">
          ${card.unitPrice == null ? b`<span class="no-price">no price</span>` : b`${this._range(card.subtotal)}${card.priceIsFallback ? b`<span class="fallback-flag" title="Priced from TCG Market — no low price available"> ·M</span>` : null}`}
        </span>
        ${authenticated ? b`<span class="row-own ${card.owned > 0 ? "have" : "need"}">
              ${card.owned > 0 ? b`✓ ${card.owned}` : b`—`}
            </span>` : null}
      </li>
    `;
  }
  _renderGroup(group, key) {
    const collapsed = this._collapsed.has(key);
    return b`
      <div class="group">
        <button
          class="group-header"
          aria-expanded=${collapsed ? "false" : "true"}
          @click=${() => this._toggleGroup(key)}
        >
          <svg class="caret ${collapsed ? "collapsed" : ""}" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          ${group.qtyLabel ? b`<span class="group-qty">${group.qtyLabel}</span>` : null}
          <span class="group-label">${group.label}</span>
          ${this._renderOwnPill(group.totals)}
          <span class="group-cost">${this._range(group.totals.cost)}</span>
        </button>
        ${collapsed ? null : b`<ul class="rows">${group.cards.map((card) => this._renderCard(card))}</ul>`}
      </div>
    `;
  }
  _renderTier(tier, tierIndex) {
    return b`
      <section class="tier">
        <div class="tier-header">
          <h3 class="tier-title">${tier.label}</h3>
          <span class="tier-total">${this._range(tier.totals.cost)}</span>
        </div>
        ${tier.groups.map((group, i3) => this._renderGroup(group, `${tierIndex}-${i3}`))}
      </section>
    `;
  }
  render() {
    if (this._loading) {
      return b`<div class="buylist"><div class="state">Pricing this buy list…</div></div>`;
    }
    if (this._error) {
      return b`<div class="buylist"><div class="state error">${this._error}</div></div>`;
    }
    if (!this._data) {
      return b`<div class="buylist"><div class="state">No cards in this buy list yet.</div></div>`;
    }
    const { rollup, authenticated } = this._data;
    const missingCount = this._missingCards().length;
    const showNeed = authenticated && rollup.totals.needCost.max > 0 && rollup.totals.needCost.max < rollup.totals.cost.max;
    return b`
      <div class="buylist">
        <div class="header">
          <h2 class="title">${this.title}</h2>
          <div class="totals">
            <span class="total-cost">${this._range(rollup.totals.cost)}</span>
            <span class="total-label">
              ${rollup.totals.wantedCopies.max} cards
              ${rollup.totals.missingPrices.length > 0 ? b`· <span class="no-price">${rollup.totals.missingPrices.length} unpriced</span>` : null}
            </span>
            ${showNeed ? b`<span class="total-need">you still need ${this._range(rollup.totals.needCost)}</span>` : null}
          </div>
        </div>

        ${rollup.tiers.map((tier, i3) => this._renderTier(tier, i3))}

        <div class="footer">
          <p class="note">
            ${this.note || (authenticated ? "Ownership counts any printing of a card you already have." : "Sign in to see which of these you already own.")}
          </p>
          ${this._addMessage ? b`<span class="add-status ${this._addFailed ? "error" : ""}">${this._addMessage}</span>` : null}
          ${authenticated && missingCount > 0 ? b`<button class="add-btn" ?disabled=${this._adding} @click=${this._addMissingToWants}>
                ${this._adding ? "Adding…" : `Add ${missingCount} missing to Wants`}
              </button>` : null}
        </div>
      </div>
    `;
  }
};
FabBuylistBlock.styles = i$4`
    /* ===== HOST SETUP ===== */
    :host {
      display: block;
      margin: 2rem 0;
    }

    .buylist {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      overflow: hidden;
    }

    /* ===== HEADER ===== */
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;
    }

    .title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }

    .totals {
      text-align: right;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }

    .total-cost {
      font-size: 1.125rem;
      font-weight: 700;
      color: #0f172a;
    }

    .total-need {
      font-size: 0.875rem;
      font-weight: 600;
      color: #047857;
    }

    .total-label {
      font-size: 0.875rem;
      color: #475569;
      font-weight: 500;
    }

    /* ===== TIERS ===== */
    .tier {
      border-top: 1px solid #e2e8f0;
    }

    .tier:first-of-type {
      border-top: none;
    }

    .tier-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.75rem 1.25rem;
      background: #f1f5f9;
      flex-wrap: wrap;
    }

    .tier-title {
      font-size: 1rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .tier-total {
      font-size: 0.875rem;
      font-weight: 600;
      color: #334155;
    }

    /* ===== GROUPS ===== */
    .group {
      border-top: 1px solid #e2e8f0;
    }

    .group-header {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      width: 100%;
      padding: 0.75rem 1.25rem;
      background: transparent;
      border: none;
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      color: #0f172a;
    }

    .group-header:hover {
      background: #f1f5f9;
    }

    .group-header:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px #60a5fa;
    }

    .caret {
      flex-shrink: 0;
      width: 0.75rem;
      height: 0.75rem;
      transition: transform 0.15s;
      color: #475569;
    }

    .caret.collapsed {
      transform: rotate(-90deg);
    }

    .group-qty {
      flex-shrink: 0;
      font-size: 0.875rem;
      font-weight: 700;
      color: #1e293b;
      background: #e2e8f0;
      border-radius: 0.25rem;
      padding: 0.125rem 0.375rem;
      min-width: 2.25rem;
      text-align: center;
    }

    .group-label {
      font-size: 1rem;
      font-weight: 600;
      flex: 1;
      min-width: 0;
    }

    .group-cost {
      font-size: 0.875rem;
      font-weight: 600;
      color: #334155;
      white-space: nowrap;
    }

    /* ===== OWNERSHIP PILL ===== */
    .own-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.875rem;
      font-weight: 600;
      border-radius: 999px;
      padding: 0.125rem 0.5rem;
      white-space: nowrap;
      border: 1px solid transparent;
    }

    /* Shape + glyph carry the meaning, not colour alone (WCAG SC 1.4.1). */
    .own-pill.complete {
      color: #065f46;
      background: #d1fae5;
      border-color: #34d399;
    }

    .own-pill.partial {
      color: #854d0e;
      background: #fef3c7;
      border-color: #fbbf24;
    }

    .own-pill.none {
      color: #475569;
      background: transparent;
      border-style: dashed;
      border-color: #94a3b8;
    }

    /* ===== CARD ROWS ===== */
    .rows {
      list-style: none;
      margin: 0;
      padding: 0 0 0.5rem 0;
    }

    .row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.375rem 1.25rem 0.375rem 2.75rem;
    }

    .row:hover {
      background: #f1f5f9;
    }

    .thumb {
      flex-shrink: 0;
      width: 2rem;
      height: 2.8rem;
      object-fit: cover;
      border-radius: 0.1875rem;
      background: #e2e8f0;
      border: 1px solid #cbd5e1;
    }

    .row-main {
      flex: 1;
      min-width: 0;
    }

    .row-name {
      font-size: 1rem;
      color: #0f172a;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .row-meta {
      font-size: 0.875rem;
      color: #475569;
      font-variant-numeric: tabular-nums;
    }

    .row-qty {
      flex-shrink: 0;
      font-size: 0.875rem;
      font-weight: 700;
      color: #1e293b;
      font-variant-numeric: tabular-nums;
      min-width: 2.75rem;
      text-align: right;
    }

    .row-price {
      flex-shrink: 0;
      font-size: 0.875rem;
      color: #334155;
      font-variant-numeric: tabular-nums;
      min-width: 5rem;
      text-align: right;
    }

    .row-own {
      flex-shrink: 0;
      min-width: 4.5rem;
      text-align: right;
      font-size: 0.875rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .row-own.have {
      color: #047857;
    }

    .row-own.need {
      color: #475569;
    }

    .fallback-flag {
      font-size: 0.875rem;
      color: #854d0e;
      font-weight: 600;
    }

    .no-price {
      color: #854d0e;
      font-weight: 600;
    }

    /* ===== FOOTER ===== */
    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.875rem 1.25rem;
      border-top: 1px solid #e2e8f0;
      background: #f1f5f9;
      flex-wrap: wrap;
    }

    .note {
      font-size: 0.875rem;
      color: #475569;
      margin: 0;
      flex: 1;
      min-width: 12rem;
    }

    .add-btn {
      font-family: inherit;
      font-size: 1rem;
      font-weight: 600;
      padding: 0.5rem 0.875rem;
      border-radius: 0.375rem;
      border: 1px solid #0f172a;
      background: #0f172a;
      color: #ffffff;
      cursor: pointer;
      white-space: nowrap;
    }

    .add-btn:hover:not(:disabled) {
      background: #1e293b;
    }

    .add-btn:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px #60a5fa;
    }

    .add-btn:disabled {
      opacity: 1;
      background: #64748b;
      border-color: #64748b;
      cursor: not-allowed;
    }

    .add-status {
      font-size: 0.875rem;
      font-weight: 600;
      color: #047857;
    }

    .add-status.error {
      color: #b91c1c;
    }

    /* ===== STATES ===== */
    .state {
      padding: 1.5rem 1.25rem;
      text-align: center;
      color: #475569;
      font-size: 1rem;
    }

    .state.error {
      color: #b91c1c;
    }

    /* ===== MOBILE ===== */
    @media (max-width: 640px) {
      .row {
        padding-left: 1.25rem;
        flex-wrap: wrap;
      }

      .row-main {
        flex-basis: calc(100% - 3rem);
      }

      .row-price,
      .row-own {
        min-width: 0;
      }

      .row-meta {
        display: none;
      }
    }

    /* ===== DARK MODE ===== */
    :host-context(.dark) .buylist {
      background: #0f172a;
      border-color: #334155;
    }

    :host-context(.dark) .header,
    :host-context(.dark) .tier,
    :host-context(.dark) .group,
    :host-context(.dark) .footer {
      border-color: #334155;
    }

    :host-context(.dark) .title,
    :host-context(.dark) .tier-title,
    :host-context(.dark) .group-header,
    :host-context(.dark) .row-name,
    :host-context(.dark) .row-qty,
    :host-context(.dark) .total-cost {
      color: #f1f5f9;
    }

    :host-context(.dark) .tier-header {
      background: #1e293b;
    }

    :host-context(.dark) .tier-total,
    :host-context(.dark) .group-cost,
    :host-context(.dark) .row-price {
      color: #cbd5e1;
    }

    :host-context(.dark) .total-label,
    :host-context(.dark) .row-meta,
    :host-context(.dark) .note,
    :host-context(.dark) .state,
    :host-context(.dark) .caret,
    :host-context(.dark) .row-own.need {
      color: #cbd5e1;
    }

    :host-context(.dark) .group-header:hover,
    :host-context(.dark) .row:hover {
      background: #1e293b;
    }

    :host-context(.dark) .group-qty {
      background: #334155;
      color: #f1f5f9;
    }

    :host-context(.dark) .footer {
      background: #1e293b;
    }

    :host-context(.dark) .thumb {
      background: #334155;
      border-color: #475569;
    }

    :host-context(.dark) .total-need,
    :host-context(.dark) .row-own.have,
    :host-context(.dark) .add-status {
      color: #34d399;
    }

    :host-context(.dark) .own-pill.complete {
      color: #d1fae5;
      background: #064e3b;
      border-color: #34d399;
    }

    :host-context(.dark) .own-pill.partial {
      color: #fef3c7;
      background: #78350f;
      border-color: #fbbf24;
    }

    :host-context(.dark) .own-pill.none {
      color: #cbd5e1;
      border-color: #64748b;
    }

    :host-context(.dark) .fallback-flag,
    :host-context(.dark) .no-price {
      color: #fbbf24;
    }

    :host-context(.dark) .add-btn {
      background: #f1f5f9;
      border-color: #f1f5f9;
      color: #0f172a;
    }

    :host-context(.dark) .add-btn:hover:not(:disabled) {
      background: #ffffff;
    }

    :host-context(.dark) .add-btn:disabled {
      background: #475569;
      border-color: #475569;
      color: #e2e8f0;
    }

    :host-context(.dark) .state.error,
    :host-context(.dark) .add-status.error {
      color: #fca5a5;
    }
  `;
__decorateClass$2([
  n2()
], FabBuylistBlock.prototype, "tiers", 2);
__decorateClass$2([
  n2()
], FabBuylistBlock.prototype, "title", 2);
__decorateClass$2([
  n2()
], FabBuylistBlock.prototype, "note", 2);
__decorateClass$2([
  r()
], FabBuylistBlock.prototype, "_loading", 2);
__decorateClass$2([
  r()
], FabBuylistBlock.prototype, "_error", 2);
__decorateClass$2([
  r()
], FabBuylistBlock.prototype, "_data", 2);
__decorateClass$2([
  r()
], FabBuylistBlock.prototype, "_collapsed", 2);
__decorateClass$2([
  r()
], FabBuylistBlock.prototype, "_adding", 2);
__decorateClass$2([
  r()
], FabBuylistBlock.prototype, "_addMessage", 2);
__decorateClass$2([
  r()
], FabBuylistBlock.prototype, "_addFailed", 2);
FabBuylistBlock = __decorateClass$2([
  t$1("fab-buylist-block")
], FabBuylistBlock);
var __defProp$1 = Object.defineProperty;
var __getOwnPropDesc$1 = Object.getOwnPropertyDescriptor;
var __decorateClass$1 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$1(target, key) : target;
  for (var i3 = decorators.length - 1, decorator; i3 >= 0; i3--)
    if (decorator = decorators[i3])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$1(target, key, result);
  return result;
};
let FabVideo = class extends i$1 {
  constructor() {
    super(...arguments);
    this.videoId = "";
    this.title = "";
    this.description = "";
    this.creatorName = "";
    this.creatorUrl = "";
  }
  render() {
    const embedUrl = `https://www.youtube.com/embed/${this.videoId}`;
    return b`
      <div class="video-container">
        <div class="video-wrapper">
          <iframe
            src="${embedUrl}"
            title="${this.title}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>
        <div class="video-info">
          <div class="info-content">
            <div class="youtube-icon">
              ${this.renderYoutubeIcon()}
            </div>
            <div class="text-content">
              <h3 class="title">${this.title}</h3>
              ${this.description ? b`
                <p class="description">${this.description}</p>
              ` : ""}
              ${this.creatorName && this.creatorUrl ? b`
                <a class="creator-link" href="${this.creatorUrl}" target="_blank" rel="noopener noreferrer">
                  ${this.renderLinkIcon()}
                  <span>Credit: ${this.creatorName}</span>
                </a>
              ` : ""}
            </div>
          </div>
        </div>
      </div>
    `;
  }
  renderYoutubeIcon() {
    return b`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/>
        <path d="m10 15 5-3-5-3z"/>
      </svg>
    `;
  }
  renderLinkIcon() {
    return b`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
    `;
  }
};
FabVideo.styles = i$4`
    :host {
      /* CSS Variables for theming */
      --fab-video-bg: #fef2f2;
      --fab-video-border: #fca5a5;
      --fab-video-text: #0f172a;
      --fab-video-text-muted: #64748b;
      --fab-video-youtube-color: #ef4444;
      --fab-video-link-hover: #3b82f6;

      display: block;
      margin: 3rem 0;
    }

    .video-container {
      background: var(--fab-video-bg);
      border: 1px solid var(--fab-video-border);
      border-radius: 0.5rem;
      overflow: hidden;
      box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
    }

    .video-wrapper {
      position: relative;
      width: 100%;
      padding-bottom: 56.25%; /* 16:9 aspect ratio */
    }

    .video-wrapper iframe {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: none;
    }

    .video-info {
      padding: 1rem 1.5rem;
    }

    @media (min-width: 768px) {
      .video-info {
        padding: 1.5rem;
      }
    }

    .info-content {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .youtube-icon {
      flex-shrink: 0;
      margin-top: 0.25rem;
      color: var(--fab-video-youtube-color);
    }

    .youtube-icon svg {
      width: 1.5rem;
      height: 1.5rem;
    }

    .text-content {
      flex: 1;
      min-width: 0;
    }

    .title {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--fab-video-text);
    }

    .description {
      margin: 0.25rem 0 0 0;
      font-size: 0.875rem;
      color: var(--fab-video-text-muted);
    }

    .creator-link {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      margin-top: 0.75rem;
      font-size: 0.75rem;
      color: var(--fab-video-text-muted);
      text-decoration: none;
      transition: color 0.2s;
    }

    .creator-link:hover {
      color: var(--fab-video-link-hover);
    }

    .creator-link svg {
      width: 0.75rem;
      height: 0.75rem;
    }

    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      :host {
        --fab-video-bg: rgba(30, 41, 59, 0.5);
        --fab-video-border: #334155;
        --fab-video-text: #f1f5f9;
        --fab-video-text-muted: #94a3b8;
      }
    }
  `;
__decorateClass$1([
  n2({ attribute: "video-id" })
], FabVideo.prototype, "videoId", 2);
__decorateClass$1([
  n2()
], FabVideo.prototype, "title", 2);
__decorateClass$1([
  n2()
], FabVideo.prototype, "description", 2);
__decorateClass$1([
  n2({ attribute: "creator-name" })
], FabVideo.prototype, "creatorName", 2);
__decorateClass$1([
  n2({ attribute: "creator-url" })
], FabVideo.prototype, "creatorUrl", 2);
FabVideo = __decorateClass$1([
  t$1("fab-video")
], FabVideo);
var __defProp2 = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i3 = decorators.length - 1, decorator; i3 >= 0; i3--)
    if (decorator = decorators[i3])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp2(target, key, result);
  return result;
};
let FabOpportunityCard = class extends i$1 {
  constructor() {
    super(...arguments);
    this.printingId = "";
    this.reason = "underpriced";
    this.confidence = "medium";
    this.priceChangeJson = "";
    this.note = "";
    this.apiBase = "";
    this.card = null;
    this.loading = true;
    this.error = null;
  }
  get priceChange() {
    if (!this.priceChangeJson) return null;
    try {
      return JSON.parse(this.priceChangeJson);
    } catch {
      return null;
    }
  }
  async connectedCallback() {
    super.connectedCallback();
    await this.fetchCard();
  }
  async fetchCard() {
    if (!this.printingId) {
      this.error = "No printing ID provided";
      this.loading = false;
      return;
    }
    try {
      this.loading = true;
      this.error = null;
      const base = this.apiBase || window.location.origin;
      const url = `${base}/api/printings/search?printingIds=${this.printingId}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.success && data.data?.printings?.length > 0) {
        this.card = data.data.printings[0];
      } else {
        throw new Error("Card not found in response");
      }
    } catch (err) {
      console.error("Failed to fetch card data:", err);
      this.error = err instanceof Error ? err.message : "Failed to load card data";
    } finally {
      this.loading = false;
    }
  }
  render() {
    if (this.loading) {
      return b`
        <div class="card ${this.reason}">
          <div class="loading">
            <div class="spinner"></div>
            <p>Loading opportunity analysis...</p>
          </div>
        </div>
      `;
    }
    if (this.error || !this.card) {
      return b`
        <div class="error">
          <strong>Failed to load card</strong>
          <div>${this.error || `Card not found: ${this.printingId}`}</div>
        </div>
      `;
    }
    return this.renderCard();
  }
  renderCard() {
    const editionDisplay = this.getEditionDisplay(this.card.edition);
    const foilingInfo = this.getFoilingInfo(this.card.foiling);
    const reasonConfig = this.getReasonConfig(this.reason);
    const priceChange = this.priceChange;
    const normalizedPercentage = priceChange ? Math.abs(priceChange.percentage) <= 1 ? priceChange.percentage * 100 : priceChange.percentage : 0;
    return b`
      <div class="card ${this.reason}">
        <div class="card-content">
          <div class="layout">
            <!-- Card Image -->
            <div class="card-image">
              ${this.card.image_url ? b`
                <img src="${this.card.image_url}" alt="${this.card.display_name || this.card.name}" />
              ` : ""}
            </div>

            <!-- Card Info -->
            <div class="info">
              <!-- Badges -->
              <div class="badges">
                <span class="badge ${this.reason}">
                  ${this.renderReasonIcon(this.reason)}
                  ${reasonConfig.label}
                </span>
                <div class="confidence">
                  <span>Confidence:</span>
                  <div class="confidence-dot ${this.confidence}"></div>
                  <span class="confidence-label">${this.confidence}</span>
                </div>
              </div>

              <!-- Title -->
              <h3 class="title">${this.card.display_name || this.card.name}</h3>

              <!-- Meta -->
              <div class="meta">
                ${this.card.set ? b`<span>${this.card.set.toUpperCase()}</span>` : ""}
                ${editionDisplay ? b`<span>${editionDisplay}</span>` : ""}
                ${this.card.rarity ? b`<span>${this.card.rarity.toUpperCase()}</span>` : ""}
                ${foilingInfo ? b`<span>${foilingInfo}</span>` : ""}
              </div>

              <!-- Price Change -->
              ${priceChange ? b`
                <div class="price-change">
                  <div>
                    <span>Price: </span>
                    <span class="price-old">$${priceChange.old.toFixed(2)}</span>
                    <span class="price-arrow"> → </span>
                    <span class="price-new">$${priceChange.new.toFixed(2)}</span>
                  </div>
                  <span class="price-badge ${normalizedPercentage > 0 ? "positive" : normalizedPercentage < 0 ? "negative" : "neutral"}">
                    ${normalizedPercentage > 0 ? "+" : ""}${normalizedPercentage.toFixed(1)}%
                  </span>
                </div>
              ` : ""}

              <!-- Note -->
              ${this.note ? b`
                <div class="note">
                  <div class="note-text">${this.note}</div>
                </div>
              ` : ""}

              <!-- Actions -->
              <div class="actions">
                <div class="action-row">
                  <div>
                    <div class="action-title">Who has this exact copy</div>
                    <div class="action-subtitle">Same set, edition, and foiling</div>
                  </div>
                </div>
                <div class="action-row">
                  <div>
                    <div class="action-title">Who has other versions</div>
                    <div class="action-subtitle">Any set, edition, or foiling</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  getReasonConfig(reason) {
    const configs = {
      underpriced: { label: "Potential Buy" },
      trending: { label: "Trending Up" },
      "supply-issue": { label: "Supply Constraint" },
      correction: { label: "Price Correction" },
      outlier: { label: "Unusual Movement" }
    };
    return configs[reason] || configs.underpriced;
  }
  renderReasonIcon(reason) {
    const icons = {
      underpriced: b`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>`,
      trending: b`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
      "supply-issue": b`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      correction: b`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>`,
      outlier: b`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`
    };
    return icons[reason];
  }
  getEditionDisplay(code) {
    if (!code) return "";
    const lookupCode = code.toLowerCase();
    const editions = {
      a: "Alpha",
      f: "1st",
      u: "UNL",
      n: "",
      normal: ""
    };
    return editions[lookupCode] || code.toUpperCase();
  }
  getFoilingInfo(foiling) {
    const foilingMap = {
      "R": "Rainbow Foil",
      "C": "Cold Foil",
      "G": "Gold Foil",
      "S": "Non-foil"
    };
    const code = foiling?.toUpperCase();
    return code ? foilingMap[code] || "" : "";
  }
};
FabOpportunityCard.styles = i$4`
    :host {
      display: block;
      margin: 1.5rem 0;
    }

    .card {
      border: 2px solid;
      border-radius: 0.5rem;
      overflow: hidden;
    }

    /* Reason-based styling */
    .card.underpriced {
      background: #f0fdf4;
      border-color: #86efac;
    }
    .card.trending {
      background: #eff6ff;
      border-color: #93c5fd;
    }
    .card.supply-issue {
      background: #fff7ed;
      border-color: #fdba74;
    }
    .card.correction {
      background: #f8fafc;
      border-color: #cbd5e1;
    }
    .card.outlier {
      background: #faf5ff;
      border-color: #d8b4fe;
    }

    .card-content {
      padding: 1.5rem;
    }

    .layout {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    @media (min-width: 1024px) {
      .layout {
        flex-direction: row;
      }
    }

    .card-image {
      flex-shrink: 0;
    }

    .card-image img {
      width: 100%;
      max-width: 300px;
      height: auto;
      border-radius: 0.5rem;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    }

    .info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    /* Badge container */
    .badges {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.75rem;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .badge svg {
      width: 1rem;
      height: 1rem;
    }

    /* Reason badges */
    .badge.underpriced {
      background: #22c55e;
      color: white;
    }
    .badge.trending {
      background: #6366f1;
      color: white;
    }
    .badge.supply-issue {
      background: #f97316;
      color: white;
    }
    .badge.correction {
      background: #64748b;
      color: white;
    }
    .badge.outlier {
      background: #a855f7;
      color: white;
    }

    /* Confidence indicator */
    .confidence {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: #64748b;
    }

    .confidence-dot {
      width: 0.75rem;
      height: 0.75rem;
      border-radius: 50%;
    }

    .confidence-dot.high { background: #22c55e; }
    .confidence-dot.medium { background: #eab308; }
    .confidence-dot.low { background: #ef4444; }

    .confidence-label {
      font-weight: 500;
      text-transform: capitalize;
    }

    /* Card title and meta */
    .title {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: #0f172a;
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: #64748b;
    }

    .meta span::after {
      content: "•";
      margin-left: 0.5rem;
    }

    .meta span:last-child::after {
      content: "";
    }

    /* Price change */
    .price-change {
      display: flex;
      align-items: center;
      gap: 1rem;
      font-size: 0.875rem;
    }

    .price-old {
      text-decoration: line-through;
      color: #94a3b8;
    }

    .price-arrow {
      color: #64748b;
    }

    .price-new {
      font-weight: 600;
      color: #0f172a;
    }

    .price-badge {
      padding: 0.125rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .price-badge.positive {
      background: #dcfce7;
      color: #166534;
    }

    .price-badge.negative {
      background: #fee2e2;
      color: #991b1b;
    }

    .price-badge.neutral {
      background: #f1f5f9;
      color: #475569;
    }

    /* Note */
    .note {
      background: rgba(255, 255, 255, 0.5);
      border: 1px solid #e2e8f0;
      border-radius: 0.5rem;
      padding: 1rem;
    }

    .note-text {
      font-size: 0.875rem;
      line-height: 1.6;
      color: #334155;
    }

    /* Actions */
    .actions {
      padding-top: 0.75rem;
      margin-top: 0.75rem;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
    }

    .action-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 0.375rem;
      margin-bottom: 0.5rem;
    }

    .action-row:last-child {
      margin-bottom: 0;
    }

    .action-title {
      font-size: 0.875rem;
      font-weight: 500;
      color: #0f172a;
    }

    .action-subtitle {
      font-size: 0.75rem;
      color: #64748b;
    }

    /* Loading state */
    .loading {
      padding: 1.5rem;
      text-align: center;
      color: #64748b;
    }

    .spinner {
      display: inline-block;
      width: 1.5rem;
      height: 1.5rem;
      border: 3px solid rgba(0, 0, 0, 0.1);
      border-radius: 50%;
      border-top-color: #3b82f6;
      animation: spinner 0.6s linear infinite;
    }

    @keyframes spinner {
      to { transform: rotate(360deg); }
    }

    /* Error state */
    .error {
      padding: 1.5rem;
      background: #fef2f2;
      border: 1px solid #fca5a5;
      border-radius: 0.5rem;
      color: #dc2626;
    }

    /* Dark mode */
    @media (prefers-color-scheme: dark) {
      .card.underpriced { background: rgba(34, 197, 94, 0.1); border-color: #166534; }
      .card.trending { background: rgba(99, 102, 241, 0.1); border-color: #4338ca; }
      .card.supply-issue { background: rgba(249, 115, 22, 0.1); border-color: #c2410c; }
      .card.correction { background: rgba(100, 116, 139, 0.1); border-color: #475569; }
      .card.outlier { background: rgba(168, 85, 247, 0.1); border-color: #7c3aed; }

      .title { color: #f1f5f9; }
      .meta { color: #94a3b8; }
      .price-new { color: #f1f5f9; }
      .note { background: rgba(30, 41, 59, 0.5); border-color: #334155; }
      .note-text { color: #cbd5e1; }
      .action-row { background: rgba(30, 41, 59, 0.3); }
      .action-title { color: #f1f5f9; }
    }
  `;
__decorateClass([
  n2({ attribute: "printing-id" })
], FabOpportunityCard.prototype, "printingId", 2);
__decorateClass([
  n2()
], FabOpportunityCard.prototype, "reason", 2);
__decorateClass([
  n2()
], FabOpportunityCard.prototype, "confidence", 2);
__decorateClass([
  n2({ attribute: "price-change" })
], FabOpportunityCard.prototype, "priceChangeJson", 2);
__decorateClass([
  n2()
], FabOpportunityCard.prototype, "note", 2);
__decorateClass([
  n2({ attribute: "api-base" })
], FabOpportunityCard.prototype, "apiBase", 2);
__decorateClass([
  r()
], FabOpportunityCard.prototype, "card", 2);
__decorateClass([
  r()
], FabOpportunityCard.prototype, "loading", 2);
__decorateClass([
  r()
], FabOpportunityCard.prototype, "error", 2);
FabOpportunityCard = __decorateClass([
  t$1("fab-opportunity-card")
], FabOpportunityCard);
const version = "2.1.0";
export {
  FabBuylistBlock,
  FabByline,
  FabCallout,
  FabCreatorSpotlight,
  FabDecklistBlock,
  FabIntro,
  FabKeyTakeaways,
  FabMatchReport,
  FabOpportunityCard,
  FabSectionHeader,
  FabSpotlightCard,
  FabVideo,
  version
};
