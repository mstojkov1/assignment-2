(function () {
  "use strict";
  const N = NYPD;
  const W = 520, H = 560;
  const m = { t: 24, r: 14, b: 70, l: 52 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;

  const state = { fullRange: false, zeroBase: false, showN: false, honest: false };
  let rowsAll = null;
  let built = false;
  let stats = null;

  const TEXT = {
    title: {
      lie: "NYPD Cracks Down: Misconduct Findings Up 9× Since 2008",
      honest: "Share of allegations substantiated, by year closed",
    },
    sub: {
      lie: "Share of civilian complaints upheld by the review board",
      honest: "856-allegation CCRB sample (ProPublica). “Substantiated” includes training and instructions, not only discipline.",
    },
    ylab: { lie: "Complaints upheld", honest: "Allegations substantiated (%)" },
    note: {
      fullRange: [
        "Full range restored (2002–2020): the “surge” is one peak, not a trend. 2005 was already near 40%, and later years fall back.",
        "Back to the cherry-picked window: it starts at the lowest year and ends at the highest.",
      ],
      zeroBase: [
        "Baseline set to zero: the 2008 bar is now visible and the 2015 bar is about 9× taller, not 100×. The gap in bar height now matches the gap in values.",
        "Axis truncated at 5%: bar heights no longer match values, so a 5% year looks almost empty.",
      ],
      showN: [
        "Sample sizes shown: 2008 rests on a very small number of allegations, so its 5% is far less certain than 2015’s.",
        "Sample sizes hidden: the reader cannot tell a rate built on a handful of cases from a solid one.",
      ],
      honest: [
        "Honest title and label restored: the chart now says what was measured and where the data came from.",
        "Loaded title back on: “Cracks down”, “9×” and “upheld” imply action and results the data does not show.",
      ],
    },
  };

  function series(years) {
    const map = new Map(years.map((y) => [y, { y, k: 0, n: 0 }]));
    rowsAll.forEach((r) => {
      const o = map.get(r.year_closed);
      if (!o) return;
      o.n++;
      if (r.bucket === "Substantiated") o.k++;
    });
    return [...map.values()].map((d) => ({ ...d, rate: d.n ? d.k / d.n : 0 }));
  }

  const dur = () => (N.reducedMotion ? 0 : 550);

  function build() {
    const svg = d3.select("#bh-svg").attr("viewBox", `0 0 ${W} ${H}`);
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
    g.append("g").attr("class", "g-grid");
    g.append("g").attr("class", "g-bars");
    g.append("g").attr("class", "g-vals");
    g.append("g").attr("class", "g-x");
    g.append("g").attr("class", "g-n");
    g.append("g").attr("class", "g-annot");
    g.append("line").attr("class", "bh-axis").attr("x1", 0).attr("x2", iw).attr("y1", ih).attr("y2", ih);
    svg.append("text").attr("class", "bh-ylab").attr("id", "bh-ylab")
      .attr("transform", `translate(14,${m.t + ih / 2}) rotate(-90)`).attr("text-anchor", "middle");
    built = true;
  }

  function render() {
    if (!built) build();
    const years = state.fullRange ? d3.range(2002, 2021) : d3.range(2008, 2016);
    const data = series(years);
    const x = d3.scaleBand(years, [0, iw]).padding(state.fullRange ? 0.18 : 0.22);
    const dom = state.zeroBase ? [0, 0.6] : [0.05, 0.5];
    const y = d3.scaleLinear(dom, [ih, 0]).clamp(true);
    const ticks = state.zeroBase ? [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6] : [0.1, 0.2, 0.3, 0.4, 0.5];
    const t = d3.transition().duration(dur()).ease(d3.easeCubicOut);
    const g = d3.select("#bh-svg g");

    // grid + tick labels
    const gg = g.select(".g-grid").selectAll("g.tk").data(ticks, (d) => d);
    const gEnter = gg.enter().append("g").attr("class", "tk").attr("transform", (d) => `translate(0,${y(d)})`);
    gEnter.append("line").attr("class", "bh-grid").attr("x2", iw);
    gEnter.append("text").attr("class", "bh-tick").attr("x", -8).attr("y", 4).attr("text-anchor", "end")
      .text((d) => N.pct(d));
    gg.merge(gEnter).transition(t).attr("transform", (d) => `translate(0,${y(d)})`);
    gg.exit().remove();

    // bars
    const last = years[years.length - 1];
    const highlight = (d) => (!state.fullRange && d.y === 2015) || (state.fullRange && d.y === 2015);
    g.select(".g-bars").selectAll("rect.bar").data(data, (d) => d.y)
      .join(
        (enter) => enter.append("rect").attr("class", "bar")
          .attr("x", (d) => x(d.y)).attr("width", x.bandwidth()).attr("y", ih).attr("height", 0),
        (update) => update,
        (exit) => exit.transition(t).attr("height", 0).attr("y", ih).remove()
      )
      .attr("fill", (d) => (highlight(d) ? "#0b6b32" : "#2fa862"))
      .call((sel) => {
        N.attachTip(sel, (q) => ({
          title: `${q.y}`,
          rows: [{ value: N.pct(q.rate), label: state.showN ? `upheld (${q.k} of ${q.n})` : "upheld" }],
        }));
      })
      .transition(t)
      .attr("x", (d) => x(d.y)).attr("width", x.bandwidth())
      .attr("y", (d) => y(d.rate)).attr("height", (d) => ih - y(d.rate));

    // value labels: only the two bars the story is about
    const showVals = data.filter((d) => d.y === 2008 || d.y === 2015);
    g.select(".g-vals").selectAll("text.bh-val").data(showVals, (d) => d.y)
      .join("text").attr("class", "bh-val").attr("text-anchor", "middle")
      .text((d) => N.pct(d.rate))
      .transition(t)
      .attr("x", (d) => x(d.y) + x.bandwidth() / 2).attr("y", (d) => y(d.rate) - 7);

    // x labels
    const label = (yr) => (state.fullRange ? `’${String(yr).slice(2)}` : String(yr));
    g.select(".g-x").selectAll("text.bh-xl").data(data, (d) => d.y)
      .join(
        (enter) => enter.append("text").attr("class", "bh-xl").attr("text-anchor", "middle")
          .attr("y", ih + 20).attr("x", (d) => x(d.y) + x.bandwidth() / 2),
        (update) => update,
        (exit) => exit.remove()
      )
      .text((d) => label(d.y))
      .transition(t).attr("x", (d) => x(d.y) + x.bandwidth() / 2);

    // sample sizes (only when revealed)
    const nData = state.showN ? data : [];
    const nSel = g.select(".g-n").selectAll("text.bh-n").data(nData, (d) => d.y);
    nSel.join(
      (enter) => enter.append("text").attr("class", "bh-n").attr("text-anchor", "middle")
        .attr("y", ih + 36).attr("x", (d) => x(d.y) + x.bandwidth() / 2).attr("opacity", 0)
        .call((e) => e.transition(t).attr("opacity", 1)),
      (update) => update.call((u) => u.transition(t).attr("x", (d) => x(d.y) + x.bandwidth() / 2)),
      (exit) => exit.remove()
    ).text((d) => d.n);
    g.select(".g-n").selectAll("text.bh-nlab").data(state.showN ? [1] : [])
      .join("text").attr("class", "bh-nlab").attr("x", 0).attr("y", ih + 52).text("n = allegations closed that year");

    // annotation arrow + shout (hidden once the title is honest)
    const ann = g.select(".g-annot");
    ann.selectAll("*").remove();
    if (!state.honest) {
      const a = data.find((d) => d.y === 2008);
      const b = data.find((d) => d.y === 2015);
      if (a && b) {
        const x1 = x(2008) + x.bandwidth() / 2, y1 = y(a.rate) - 32;
        const x2 = x(2015) - 8, y2 = y(b.rate) + 16;
        const shout = String(stats.ratio).replace(".0", "");
        ann.attr("opacity", 0);
        ann.append("defs").append("marker").attr("id", "bh-arrow").attr("viewBox", "0 0 10 10")
          .attr("refX", 8).attr("refY", 5).attr("markerWidth", 7).attr("markerHeight", 7).attr("orient", "auto")
          .append("path").attr("d", "M0,0L10,5L0,10Z").attr("fill", "#d1242f");
        ann.append("path")
          .attr("d", `M${x1},${y1} Q${(x1 + x2) / 2 - 24},${(y1 + y2) / 2 - 10} ${x2},${y2}`)
          .attr("fill", "none").attr("stroke", "#d1242f").attr("stroke-width", 3).attr("marker-end", "url(#bh-arrow)");
        ann.append("text").attr("class", "bh-shout").attr("x", x(2009) - 4).attr("y", y(0.44))
          .attr("text-anchor", "start").text(`${shout} increase!`);
        ann.transition().delay(dur()).duration(dur() ? 250 : 0).attr("opacity", 1);
      }
    }

    // text pieces outside the svg
    const k = state.honest ? "honest" : "lie";
    document.getElementById("bh-title").textContent = TEXT.title[k];
    document.getElementById("bh-sub").textContent = TEXT.sub[k];
    document.getElementById("bh-foot").hidden = !state.honest;
    document.getElementById("bh-ylab").textContent = TEXT.ylab[k];
    d3.select("#bh-card").classed("is-honest", state.honest);
  }

  window.drawBlackHat = function (rows, s) {
    rowsAll = rows;
    stats = s;
    const note = document.getElementById("bh-note");
    const boxes = {
      fullRange: document.getElementById("bh-range"),
      zeroBase: document.getElementById("bh-zero"),
      showN: document.getElementById("bh-n"),
      honest: document.getElementById("bh-title-fix"),
    };
    Object.entries(boxes).forEach(([key, el]) => {
      el.addEventListener("change", () => {
        state[key] = el.checked;
        note.textContent = TEXT.note[key][el.checked ? 0 : 1];
        render();
      });
    });
    document.getElementById("bh-undo").addEventListener("click", () => {
      const all = Object.values(boxes).every((b) => b.checked);
      Object.entries(boxes).forEach(([key, el]) => { el.checked = !all; state[key] = !all; });
      note.textContent = all
        ? "All four tricks are back on."
        : "All four tricks undone. Compare this with the white hat chart above.";
      render();
    });
    render();
  };
})();