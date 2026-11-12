
(function () {
  "use strict";
  const N = NYPD;
  const GAP = 2; 

  function roundedRight(x, y, w, h, r) {
    r = Math.min(r, w, h / 2);
    return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
  }
  function roundedTop(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }

  function drawA(rows) {
    const svg = d3.select("#wh-a");
    svg.selectAll("*").remove();
    const W = 760, m = { t: 6, r: 24, b: 34, l: 190 }, rowH = 58, barH = 24;
    const iw = W - m.l - m.r;

    const types = d3
      .rollups(rows, (v) => v, (d) => d.fado_type)
      .map(([type, v]) => ({
        type,
        n: v.length,
        counts: d3.rollup(v, (x) => x.length, (d) => d.bucket),
      }))
      .sort((a, b) => d3.descending(a.n, b.n));

    const H = m.t + types.length * rowH + m.b;
    svg.attr("viewBox", `0 0 ${W} ${H}`);
    const x = d3.scaleLinear([0, 1], [0, iw]);
    const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);

    [0, 0.25, 0.5, 0.75, 1].forEach((t) => {
      g.append("line").attr("class", "grid")
        .attr("x1", x(t)).attr("x2", x(t)).attr("y1", 0).attr("y2", types.length * rowH);
      g.append("text").attr("class", "tick").attr("x", x(t)).attr("y", types.length * rowH + 18)
        .attr("text-anchor", "middle").text(N.pct(t));
    });

    types.forEach((t, i) => {
      const row = g.append("g").attr("transform", `translate(0,${i * rowH})`);
      const by = (rowH - barH) / 2;

      row.append("text").attr("class", "cat-label").attr("x", -14).attr("y", by + 11)
        .attr("text-anchor", "end").text(t.type);
      row.append("text").attr("class", "cat-sub").attr("x", -14).attr("y", by + 27)
        .attr("text-anchor", "end").text(`n = ${t.n.toLocaleString()} allegations`);

      const clipId = `clip-a-${i}`;
      row.append("clipPath").attr("id", clipId)
        .append("rect").attr("x", -20).attr("y", by).attr("width", iw + 20).attr("height", barH).attr("rx", 4);
      const segG = row.append("g").attr("clip-path", `url(#${clipId})`);

      let cum = 0;
      N.DISP.forEach((disp, j) => {
        const k = t.counts.get(disp) || 0;
        const share = k / t.n;
        const x0 = x(cum) + (j > 0 ? GAP / 2 : 0);
        const x1 = x(cum + share) - (j < N.DISP.length - 1 ? GAP / 2 : 0);
        const w = Math.max(0, x1 - x0);
        cum += share;
        if (!k) return;

        const d = { type: t.type, n: t.n, disp, k, share };
        const seg = segG.append("rect").datum(d).attr("class", "seg")
          .attr("x", x0).attr("y", by).attr("width", w).attr("height", barH)
          .attr("fill", N.DISP_VAR[disp])
          .attr("aria-label", `${t.type}: ${disp}, ${k} of ${t.n} allegations, ${N.pct(share)}`);
        N.attachTip(seg, (q) => ({
          title: `${q.type} (n = ${q.n})`,
          rows: [{ key: N.DISP_VAR[q.disp], value: `${N.pct(q.share, 1)} · ${q.k}`, label: q.disp }],
        }));

        const lab = segG.append("text").attr("class", "seg-label")
          .attr("x", x0 + w / 2).attr("y", by + barH / 2 + 4.5).attr("text-anchor", "middle")
          .attr("fill", N.DISP_INK[disp]).attr("pointer-events", "none").text(N.pct(share));
        if (lab.node().getComputedTextLength() + 16 > w) lab.remove();
      });
    });


    const trs = [];
    types.forEach((t) => {
      N.DISP.forEach((disp) => {
        const k = t.counts.get(disp) || 0;
        trs.push([t.type, disp, k, N.pct(k / t.n, 1), t.n]);
      });
    });
    N.renderTable(document.getElementById("wh-a-table"),
      "Allegations by type and board disposition",
      ["Allegation type", "Board disposition", "Allegations", "Share of type", "Type total"], trs);
  }

  function drawB(rows) {
    const svg = d3.select("#wh-b");
    svg.selectAll("*").remove();
    const W = 760, m = { t: 10, r: 96, b: 30, l: 56 };
    const ph = 220, gapY = 34, sh = 56; // rate panel, gap, n-strip
    const H = m.t + ph + gapY + sh + m.b;
    const iw = W - m.l - m.r;
    svg.attr("viewBox", `0 0 ${W} ${H}`);

    const years = d3.range(2002, 2021);
    const map = new Map(years.map((y) => [y, { y, k: 0, n: 0 }]));
    rows.forEach((r) => {
      const o = map.get(r.year_closed);
      if (!o) return;
      o.n++;
      if (r.bucket === "Substantiated") o.k++;
    });
    const data = [...map.values()].filter((d) => d.n > 0).map((d) => ({
      ...d, rate: d.k / d.n, ci: N.wilson(d.k, d.n), small: d.n < 20,
    }));
    const inRange = rows.filter((r) => r.year_closed >= 2002);
    const overall = inRange.filter((r) => r.bucket === "Substantiated").length / inRange.length;

    const top = Math.max(0.6, Math.ceil(d3.max(data, (d) => d.ci[1]) * 10) / 10);
    const x = d3.scaleBand(years, [0, iw]).padding(0.2);
    const y = d3.scaleLinear([0, top], [ph, 0]);
    const maxN = d3.max(data, (d) => d.n);
    const ys = d3.scaleLinear([0, maxN], [sh, 0]);
    const stripTop = ph + gapY;

    const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);

    // y gridlines (hairline, solid) + labels
    d3.range(0, top + 0.001, 0.2).forEach((t) => {
      g.append("line").attr("class", "grid").attr("x1", 0).attr("x2", iw).attr("y1", y(t)).attr("y2", y(t));
      g.append("text").attr("class", "tick").attr("x", -10).attr("y", y(t) + 4).attr("text-anchor", "end").text(N.pct(t));
    });
    g.append("line").attr("class", "axis").attr("x1", 0).attr("x2", iw).attr("y1", ph).attr("y2", ph);

    // overall reference line + direct label
    g.append("line").attr("class", "ref").attr("x1", 0).attr("x2", iw).attr("y1", y(overall)).attr("y2", y(overall));
    g.append("text").attr("class", "ref-label").attr("x", iw + 8).attr("y", y(overall) - 3)
      .text(`All years: ${N.pct(overall)}`);
    g.append("text").attr("class", "ref-label").attr("x", iw + 8).attr("y", y(overall) + 11)
      .text("(2002–2020)");

    // n strip
    g.append("text").attr("class", "strip-title").attr("x", 0).attr("y", stripTop - 10)
      .text("Allegations closed per year (n)");
    g.append("line").attr("class", "axis").attr("x1", 0).attr("x2", iw)
      .attr("y1", stripTop + sh).attr("y2", stripTop + sh);

    data.forEach((d) => {
      const cx = x(d.y) + x.bandwidth() / 2;
      const bw = Math.min(24, x.bandwidth());
      // n bar
      g.append("path").attr("class", "nbar")
        .attr("d", roundedTop(cx - bw / 2, stripTop + ys(d.n), bw, sh - ys(d.n), 4));
      if (d.n === maxN) {
        g.append("text").attr("class", "nlabel").attr("x", cx).attr("y", stripTop + ys(d.n) - 5)
          .attr("text-anchor", "middle").text(d.n);
      }
      // interval whisker
      g.append("line").attr("class", "whisker")
        .attr("x1", cx).attr("x2", cx).attr("y1", y(d.ci[0])).attr("y2", y(d.ci[1]));
      [d.ci[0], d.ci[1]].forEach((v) =>
        g.append("line").attr("class", "whisker")
          .attr("x1", cx - 4).attr("x2", cx + 4).attr("y1", y(v)).attr("y2", y(v)));
    });

    // dots drawn after whiskers so the surface ring sits on top
    g.selectAll("circle.dot").data(data).join("circle")
      .attr("class", (d) => "dot" + (d.small ? " hollow" : ""))
      .attr("cx", (d) => x(d.y) + x.bandwidth() / 2).attr("cy", (d) => y(d.rate)).attr("r", 5);

    // x labels
    g.selectAll("text.xl").data(data).join("text").attr("class", "tick xl")
      .attr("x", (d) => x(d.y) + x.bandwidth() / 2).attr("y", stripTop + sh + 18)
      .attr("text-anchor", "middle").text((d) => d.y);

    // crosshair + per-year hit target (wider than the mark)
    const cross = g.append("line").attr("class", "cross").attr("y1", 0).attr("y2", stripTop + sh).attr("visibility", "hidden");
    const hits = g.selectAll("rect.hit").data(data).join("rect").attr("class", "hit")
      .attr("x", (d) => x(d.y) - (x.step() - x.bandwidth()) / 2).attr("width", x.step())
      .attr("y", 0).attr("height", stripTop + sh)
      .attr("aria-label", (d) => `${d.y}: ${d.k} of ${d.n} allegations substantiated (${N.pct(d.rate)})`);
    N.attachTip(hits, (d) => ({
      title: `Closed in ${d.y}${d.y === 2020 ? " (partial year, through June)" : ""}`,
      rows: [
        { key: "var(--s1)", value: N.pct(d.rate, 1), label: `substantiated (${d.k} of ${d.n})` },
        { value: `${N.pct(d.ci[0])} – ${N.pct(d.ci[1])}`, label: "95% interval" },
        ...(d.small ? [{ value: "Small sample", label: "fewer than 20 allegations" }] : []),
      ],
    }));
    hits
      .on("pointerenter.cross focus.cross", function (e, d) {
        cross.attr("x1", x(d.y) + x.bandwidth() / 2).attr("x2", x(d.y) + x.bandwidth() / 2).attr("visibility", "visible");
      })
      .on("pointerleave.cross blur.cross", () => cross.attr("visibility", "hidden"));

    N.renderTable(document.getElementById("wh-b-table"),
      "Allegations substantiated, by year the case was closed",
      ["Year closed", "Allegations (n)", "Substantiated", "Rate", "95% interval (Wilson)"],
      data.map((d) => [d.y, d.n, d.k, N.pct(d.rate, 1), `${N.pct(d.ci[0], 1)} – ${N.pct(d.ci[1], 1)}`]));
  }

  /* ---------- View C: what "substantiated" led to ---------- */
  function drawC(rows) {
    const svg = d3.select("#wh-c");
    svg.selectAll("*").remove();
    const sub = rows.filter((r) => r.bucket === "Substantiated");
    const order = ["Charges", "Command discipline", "Formalized training", "Instructions"];
    const blurb = {
      "Charges": "Formal charges brought against the officer",
      "Command discipline": "Discipline imposed by the officer's commanding officer",
      "Formalized training": "Officer sent for additional training",
      "Instructions": "Officer given instructions / counselled",
    };
    const counts = d3.rollup(sub, (v) => v.length, (d) => d.family);
    const data = order.map((f) => ({ f, k: counts.get(f) || 0, share: (counts.get(f) || 0) / sub.length }));

    const W = 760, m = { t: 4, r: 90, b: 8, l: 190 }, rowH = 40, barH = 22;
    const H = m.t + data.length * rowH + m.b;
    const iw = W - m.l - m.r;
    svg.attr("viewBox", `0 0 ${W} ${H}`);
    const x = d3.scaleLinear([0, d3.max(data, (d) => d.k)], [0, iw]);
    const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);

    g.append("line").attr("class", "axis").attr("x1", 0).attr("x2", 0).attr("y1", 0).attr("y2", data.length * rowH);

    data.forEach((d, i) => {
      const y0 = i * rowH + (rowH - barH) / 2;
      g.append("text").attr("class", "cat-label").attr("x", -14).attr("y", y0 + barH / 2 + 4.5)
        .attr("text-anchor", "end").text(d.f);
      const bar = g.append("path").datum(d).attr("class", "seg c-bar")
        .attr("d", roundedRight(0, y0, Math.max(2, x(d.k)), barH, 4))
        .attr("fill", "var(--s1)")
        .attr("aria-label", `${d.f}: ${d.k} substantiated allegations (${N.pct(d.share)})`);
      N.attachTip(bar, (q) => ({
        title: q.f,
        rows: [{ key: "var(--s1)", value: `${q.k} (${N.pct(q.share, 1)})`, label: blurb[q.f] }],
      }));
      g.append("text").attr("class", "val-label").attr("x", x(d.k) + 8).attr("y", y0 + barH / 2 + 4.5)
        .text(`${d.k} · ${N.pct(d.share)}`);
    });

    N.renderTable(document.getElementById("wh-c-table"),
      "Substantiated allegations by outcome",
      ["Outcome", "Allegations", "Share of substantiated"],
      data.map((d) => [d.f, d.k, N.pct(d.share, 1)]));
  }

  window.drawWhiteHat = function (rows) {
    drawA(rows);
    drawB(rows);
    drawC(rows);
    ["a", "b", "c"].forEach((k) =>
      N.wireTableToggle(document.getElementById(`wh-${k}-btn`), document.getElementById(`wh-${k}-table`)));
  };
})();
