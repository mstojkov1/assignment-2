/* Shared helpers for both visualizations.
   Loads the CCRB CSV, derives a few fields, and provides tooltip + table helpers. */
(function () {
  "use strict";

  const DISP = ["Substantiated", "Unsubstantiated", "Exonerated"];
  const DISP_VAR = {
    Substantiated: "var(--s1)",
    Unsubstantiated: "var(--s2)",
    Exonerated: "var(--s3)",
  };

  const DISP_INK = {
    Substantiated: "#ffffff",
    Unsubstantiated: "#0b0b0b",
    Exonerated: "#0b0b0b",
  };
  const DISP_BLURB = {
    Substantiated: "Review board found the officer's conduct broke the rules",
    Unsubstantiated: "Not enough evidence to decide either way",
    Exonerated: "Conduct happened but was within the rules",
  };

  function penaltyFamily(disp) {
    const m = /\((.*)\)/.exec(disp);
    const t = m ? m[1] : "";
    if (/^Charges/.test(t)) return "Charges";
    if (/^Command Discipline/.test(t)) return "Command discipline";
    if (/Training/.test(t)) return "Formalized training";
    if (/Instructions/.test(t)) return "Instructions";
    return "Other";
  }

  function toBucket(disp) {
    if (disp.startsWith("Substantiated")) return "Substantiated";
    if (disp.startsWith("Exonerated")) return "Exonerated";
    return "Unsubstantiated";
  }

  // 95% Wilson score interval for a proportion k/n.
  function wilson(k, n, z) {
    z = z || 1.96;
    if (!n) return [0, 0];
    const p = k / n;
    const d = 1 + (z * z) / n;
    const c = p + (z * z) / (2 * n);
    const r = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
    return [Math.max(0, (c - r) / d), Math.min(1, (c + r) / d)];
  }

  const pct = (v, digits) => (v * 100).toFixed(digits || 0) + "%";

  async function load() {
    const rows = await d3.csv("data/complaints.csv", (r) => ({
      complaint_id: r.complaint_id,
      officer: r.unique_mos_id,
      year_received: +r.year_received,
      year_closed: +r.year_closed,
      fado_type: r.fado_type,
      board_disposition: r.board_disposition,
      bucket: toBucket(r.board_disposition),
      family: penaltyFamily(r.board_disposition),
    }));
    return rows;
  }

  // ---- tooltip (one shared element; all text via textContent) --------------
  const tipEl = document.createElement("div");
  tipEl.className = "tip";
  tipEl.setAttribute("role", "tooltip");
  tipEl.hidden = true;
  document.body.appendChild(tipEl);

  function fillTip(info) {
    tipEl.replaceChildren();
    const h = document.createElement("div");
    h.className = "tip-title";
    h.textContent = info.title;
    tipEl.appendChild(h);
    (info.rows || []).forEach((r) => {
      const row = document.createElement("div");
      row.className = "tip-row";
      if (r.key) {
        const k = document.createElement("span");
        k.className = "tip-key";
        k.style.background = r.key;
        row.appendChild(k);
      }
      const v = document.createElement("strong");
      v.textContent = r.value;
      const l = document.createElement("span");
      l.className = "tip-label";
      l.textContent = r.label;
      row.append(v, l);
      tipEl.appendChild(row);
    });
  }

  function placeTip(x, y) {
    tipEl.hidden = false;
    const pad = 14;
    const w = tipEl.offsetWidth;
    const h = tipEl.offsetHeight;
    let left = x + pad;
    let top = y + pad;
    if (left + w > window.innerWidth - 8) left = x - w - pad;
    if (top + h > window.innerHeight - 8) top = y - h - pad;
    tipEl.style.left = Math.max(8, left) + window.scrollX + "px";
    tipEl.style.top = Math.max(8, top) + window.scrollY + "px";
  }

  function hideTip() {
    tipEl.hidden = true;
  }

  // Wire hover + keyboard focus for a d3 selection of marks.
  function attachTip(sel, infoFn) {
    sel
      .attr("tabindex", 0)
      .on("pointermove", function (event, d) {
        fillTip(infoFn(d));
        placeTip(event.clientX, event.clientY);
      })
      .on("pointerleave", hideTip)
      .on("focus", function (event, d) {
        fillTip(infoFn(d));
        const b = this.getBoundingClientRect();
        placeTip(b.left + b.width / 2, b.top);
      })
      .on("blur", hideTip);
  }

  // ---- table view ----------------------------------------------------------
  function renderTable(container, caption, headers, rows) {
    container.replaceChildren();
    const t = document.createElement("table");
    const cap = document.createElement("caption");
    cap.textContent = caption;
    t.appendChild(cap);
    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    headers.forEach((h) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = h;
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    t.appendChild(thead);
    const tb = document.createElement("tbody");
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      r.forEach((c, i) => {
        const td = document.createElement(i === 0 ? "th" : "td");
        if (i === 0) td.scope = "row";
        td.textContent = c;
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    container.appendChild(t);
  }

  function wireTableToggle(btn, panel) {
    btn.addEventListener("click", () => {
      const open = panel.hidden;
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      btn.textContent = open ? "Hide data table" : "View as data table";
    });
  }

  // Fill <span data-stat="..."> placeholders so write-up numbers always match the data.
  function fillStats(rows) {
    const total = rows.length;
    const subst = rows.filter((r) => r.bucket === "Substantiated").length;
    const force = rows.filter((r) => r.fado_type === "Force");
    const aoa = rows.filter((r) => r.fado_type === "Abuse of Authority");
    const rate = (arr) =>
      arr.filter((r) => r.bucket === "Substantiated").length / arr.length;
    const yr = (y) => {
      const a = rows.filter((r) => r.year_closed === y);
      return { n: a.length, rate: rate(a), k: a.filter((r) => r.bucket === "Substantiated").length };
    };
    const chargesN = rows.filter((r) => r.bucket === "Substantiated" && r.family === "Charges").length;
    const y08 = yr(2008);
    const y15 = yr(2015);
    const y05 = yr(2005);
    const y16 = yr(2016);
    const y18 = yr(2018);
    const stats = {
      allegations: total.toLocaleString(),
      complaints: new Set(rows.map((r) => r.complaint_id)).size.toLocaleString(),
      officers: new Set(rows.map((r) => r.officer)).size.toLocaleString(),
      subst_pct: pct(subst / total),
      force_pct: pct(rate(force)),
      force_n: force.length.toLocaleString(),
      aoa_pct: pct(rate(aoa)),
      rate08: pct(y08.rate, 1),
      n08: y08.n,
      k08: y08.k,
      charges_pct: pct(chargesN / subst),
      rate15: pct(y15.rate, 1),
      n15: y15.n,
      ratio: (y15.rate / y08.rate).toFixed(1) + "×",
      rate05: pct(y05.rate),
      rate16: pct(y16.rate),
      rate18: pct(y18.rate),
    };
    document.querySelectorAll("[data-stat]").forEach((el) => {
      const v = stats[el.dataset.stat];
      if (v !== undefined) el.textContent = v;
    });
    return stats;
  }

  window.NYPD = {
    DISP, DISP_VAR, DISP_INK, DISP_BLURB, wilson, pct, load, fillStats,
    attachTip, hideTip, renderTable, wireTableToggle,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
})();