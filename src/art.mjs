export const P = {
  bg: "#171717",
  field: "#222222",
  steel: "#393a39",
  edge: "#595b58",
  chalk: "#ecede6",
  muted: "#92938e",
  amber: "#edc967",
  red: "#eb7564",
  aqua: "#74c6be",
  shadow: "#111111",
};
const rect = (c, x, y, w, h, color) => {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};
export function drawMark(c, x, y, u = 3, color = P.amber) {
  const map = [
    "0001000",
    "0011100",
    "0010100",
    "0111110",
    "0001000",
    "0011100",
    "0010100",
    "0110110",
    "1100011",
  ];
  for (let row = 0; row < map.length; row++)
    for (let col = 0; col < 7; col++)
      if (map[row][col] === "1")
        rect(c, x + (col - 3.5) * u, y + (row - 4.5) * u, u, u, color);
}
export function drawKeeper(
  c,
  x,
  y,
  u = 3,
  { kind = 0, time = 0, walk = false } = {},
) {
  const coat = [P.amber, P.aqua, P.red][kind],
    step = walk ? Math.floor(time * 8) % 2 : 0;
  rect(c, x - 7 * u, y - u, 14 * u, 2 * u, P.shadow);
  rect(c, x - 4 * u, y - 8 * u, 3 * u, 7 * u, P.edge);
  rect(c, x + u, y - 8 * u, 3 * u, 7 * u, P.edge);
  rect(c, x - 5 * u, y - (step ? 1 : 2) * u, 5 * u, 2 * u, P.chalk);
  rect(c, x + u, y - (step ? 2 : 1) * u, 5 * u, 2 * u, P.chalk);
  rect(c, x - 6 * u, y - 18 * u, 12 * u, 11 * u, coat);
  rect(c, x - 7 * u, y - 16 * u, 2 * u, 8 * u, coat);
  rect(c, x + 5 * u, y - 16 * u, 2 * u, 8 * u, coat);
  rect(c, x - 4 * u, y - 24 * u, 9 * u, 8 * u, coat);
  rect(c, x - 5 * u, y - 23 * u, 11 * u, 6 * u, P.steel);
  rect(c, x - 3 * u, y - 22 * u, 7 * u, 4 * u, P.shadow);
  const blink = Math.sin(time * 1.2) > 0.99;
  rect(c, x - 2 * u, y - 21 * u, 2 * u, blink ? u : 2 * u, P.chalk);
  rect(c, x + 2 * u, y - 21 * u, u, blink ? u : 2 * u, P.chalk);
  rect(c, x - 5 * u, y - 25 * u, 11 * u, 2 * u, coat);
  rect(c, x - 3 * u, y - 27 * u, 7 * u, 3 * u, coat);
  rect(c, x + 4 * u, y - 24 * u, 5 * u, u, coat);
  rect(c, x - 3 * u, y - 14 * u, 6 * u, 4 * u, P.shadow);
  rect(c, x - u, y - 14 * u, u, 4 * u, coat);
  if (kind === 0) {
    rect(c, x - 2 * u, y - 27 * u, 3 * u, 2 * u, P.chalk);
  } else if (kind === 1) {
    rect(c, x - 7 * u, y - 24 * u, 2 * u, 6 * u, P.aqua);
    rect(c, x - 8 * u, y - 25 * u, u, 3 * u, P.aqua);
  } else {
    rect(c, x + 5 * u, y - 13 * u, 5 * u, 7 * u, P.chalk);
    rect(c, x + 6 * u, y - 12 * u, 3 * u, u, P.red);
  }
}
function tower(
  c,
  x,
  ground,
  u,
  { time = 0, lit = false, active = false } = {},
) {
  rect(c, x - 23 * u, ground - 2 * u, 46 * u, 3 * u, P.shadow);
  rect(c, x - 12 * u, ground - 5 * u, 24 * u, 5 * u, P.edge);
  rect(c, x - 6 * u, ground - 46 * u, 12 * u, 41 * u, P.steel);
  rect(c, x - 7 * u, ground - 46 * u, 2 * u, 41 * u, P.edge);
  rect(c, x + 5 * u, ground - 46 * u, 2 * u, 41 * u, P.edge);
  for (let i = 0; i < 7; i++)
    rect(c, x - 4 * u, ground - (8 + i * 5) * u, 8 * u, u, "#69705f");
  rect(c, x - 12 * u, ground - 47 * u, 24 * u, 3 * u, P.chalk);
  rect(c, x - 11 * u, ground - 60 * u, 22 * u, 13 * u, P.steel);
  rect(c, x - 12 * u, ground - 61 * u, 24 * u, 3 * u, P.edge);
  rect(c, x - 8 * u, ground - 64 * u, 16 * u, 3 * u, P.edge);
  rect(c, x - 3 * u, ground - 68 * u, 6 * u, 4 * u, P.edge);
  for (const side of [-1, 1]) {
    rect(c, x + side * 8 * u - u, ground - 58 * u, 2 * u, 11 * u, P.chalk);
  }
  rect(c, x - 5 * u, ground - 57 * u, 10 * u, 7 * u, lit ? P.amber : P.shadow);
  if (active) {
    const beamX = x + Math.sin(time * 1.2) * 42 * u;
    rect(c, beamX - 2 * u, ground - 55 * u, 4 * u, 2 * u, P.amber);
  }
  rect(c, x - 2 * u, ground - 73 * u, 4 * u, 5 * u, P.red);
  rect(c, x - 17 * u, ground - 28 * u, 10 * u, 8 * u, P.bg);
  rect(c, x - 15 * u, ground - 26 * u, 6 * u, 4 * u, lit ? P.aqua : P.edge);
}
function station(c, x, y, u, color, selected = false) {
  rect(c, x - 22 * u, y - 3 * u, 44 * u, 4 * u, P.shadow);
  rect(c, x - 18 * u, y - 26 * u, 36 * u, 24 * u, P.steel);
  rect(c, x - 20 * u, y - 29 * u, 40 * u, 3 * u, P.edge);
  rect(c, x - 16 * u, y - 33 * u, 32 * u, 4 * u, P.edge);
  rect(c, x - 14 * u, y - 22 * u, 19 * u, 12 * u, P.shadow);
  rect(c, x - 12 * u, y - 20 * u, 15 * u, 8 * u, color);
  rect(c, x + 9 * u, y - 20 * u, 6 * u, 18 * u, P.shadow);
  rect(c, x + 10 * u, y - 17 * u, u, 2 * u, color);
  rect(c, x + 10 * u, y - 47 * u, 2 * u, 15 * u, P.edge);
  rect(c, x + 5 * u, y - 44 * u, 12 * u, u, P.edge);
  rect(c, x + 8 * u, y - 48 * u, 6 * u, u, color);
  if (selected) {
    for (const side of [-1, 1]) {
      rect(c, x + side * 24 * u, y - 35 * u, side * u, 7 * u, P.amber);
      rect(c, x + side * 24 * u, y - 35 * u, -side * 6 * u, u, P.amber);
    }
  }
}
function route(c, a, b, color, time, active) {
  const mid = (a[0] + b[0]) / 2;
  c.strokeStyle = P.steel;
  c.lineWidth = 1;
  c.setLineDash([3, 5]);
  c.beginPath();
  c.moveTo(...a);
  c.lineTo(mid, a[1]);
  c.lineTo(mid, b[1]);
  c.lineTo(...b);
  c.stroke();
  c.setLineDash([]);
  if (active) {
    const t = (time * 0.2) % 1;
    let x, y;
    if (t < 0.4) {
      x = a[0] + ((mid - a[0]) * t) / 0.4;
      y = a[1];
    } else if (t < 0.7) {
      x = mid;
      y = a[1] + ((b[1] - a[1]) * (t - 0.4)) / 0.3;
    } else {
      x = mid + ((b[0] - mid) * (t - 0.7)) / 0.3;
      y = b[1];
    }
    rect(c, x - 3, y - 3, 6, 6, color);
  }
}
export function drawLandscape(
  c,
  w,
  h,
  {
    time = 0,
    stations = [],
    selected = null,
    active = null,
    reduced = false,
  } = {},
) {
  c.clearRect(0, 0, w, h);
  rect(c, 0, 0, w, h, P.bg);
  const mobile = w < 600,
    u = mobile ? 1.7 : Math.min(2.3, w / 425),
    ground = h * 0.79,
    center = w * 0.49;
  c.strokeStyle = "#252922";
  c.lineWidth = 1;
  for (let x = 20; x < w; x += 40) {
    c.beginPath();
    c.moveTo(x, h * 0.21);
    c.lineTo(x, h * 0.87);
    c.stroke();
  }
  for (let y = h * 0.21; y < h * 0.89; y += 40) {
    c.beginPath();
    c.moveTo(20, y);
    c.lineTo(w - 20, y);
    c.stroke();
  }
  const positions = mobile
    ? [
        [w * 0.18, h * 0.35],
        [w * 0.8, h * 0.39],
        [w * 0.17, h * 0.86],
        [w * 0.83, h * 0.9],
      ]
    : [
        [w * 0.17, h * 0.49],
        [w * 0.82, h * 0.41],
        [w * 0.17, h * 0.85],
        [w * 0.83, h * 0.83],
      ];
  stations.slice(0, 4).forEach((s, i) => {
    const p = positions[i],
      color =
        s.visibleStatus === "none"
          ? P.aqua
          : ["minor", "major", "critical"].includes(s.visibleStatus)
            ? P.red
            : P.muted;
    route(
      c,
      [center, ground - 40 * u],
      [p[0], p[1] - 22 * u],
      color,
      time,
      !reduced && active?.stationId === s.id,
    );
    station(c, p[0], p[1], u, color, selected === s.id);
    c.fillStyle = selected === s.id ? P.chalk : P.muted;
    c.font = `${mobile ? 10 : 11}px 'IBM Plex Mono'`;
    c.textAlign = "center";
    c.fillText(s.name, p[0], p[1] + 16);
  });
  tower(c, center, ground, u, {
    time,
    lit: stations.some((s) => s.latest),
    active: !!active,
  });
  drawKeeper(c, center + 28 * u, ground + 2 * u, u * 0.77, {
    time,
    walk: active?.stage === "listen",
  });
  if (!mobile) {
    drawKeeper(c, center - 31 * u, ground + 2 * u, u * 0.64, {
      kind: 1,
      time,
      walk: active?.stage === "compare",
    });
    rect(c, center + 45 * u, ground - 18 * u, 22 * u, 19 * u, P.steel);
    rect(c, center + 47 * u, ground - 15 * u, 17 * u, 9 * u, P.shadow);
    rect(c, center + 49 * u, ground - 13 * u, 12 * u, u, P.aqua);
    rect(c, center + 49 * u, ground - 10 * u, 8 * u, u, P.aqua);
  }
  for (let i = 0; i < 7; i++)
    rect(c, center - 22 * u + i * 7 * u, ground + 9 * u, 3 * u, u, P.edge);
  c.textAlign = "left";
}
export function drawIntro(c, w, h, t) {
  rect(c, 0, 0, w, h, P.bg);
  const u = Math.min(3.5, w / 115),
    ground = h * 0.67,
    x = w * 0.51;
  rect(c, 0, ground + 4 * u, w, u, P.steel);
  if (t > 1.9) {
    const spread = Math.min(1, (t - 1.9) / 0.65);
    rect(
      c,
      x - 70 * u * spread,
      ground - 57 * u,
      140 * u * spread,
      6 * u,
      "#302e23",
    );
    rect(
      c,
      x - 100 * u * spread,
      ground - 55 * u,
      200 * u * spread,
      2 * u,
      "#45402b",
    );
  }
  tower(c, x, ground, u, { time: t, lit: t > 1.95 });
  if (t < 1.1) {
    const px = x - 55 * u + Math.min(1, t / 1.1) * 52 * u;
    drawKeeper(c, px, ground, u * 0.55, { time: t, walk: true });
  } else if (t < 1.95) {
    const k = (t - 1.1) / 0.85;
    drawKeeper(c, x + u, ground - 48 * u * k, u * 0.55, {
      time: t,
      walk: true,
    });
  } else drawKeeper(c, x + 19 * u, ground - 45 * u, u * 0.55, { time: t });
  if (t > 2.65) {
    const p = Math.min(1, (t - 2.65) / 0.45);
    for (let y = 0; y < h; y += 14) {
      const edge = w * p + Math.sin(y * 0.05) * 30;
      rect(c, 0, y, Math.max(0, edge), 14, P.bg);
    }
  }
}
export function drawBrand(c, w, h, type = "banner") {
  rect(c, 0, 0, w, h, P.bg);
  if (type === "mark") {
    drawMark(c, w / 2, h / 2, w / 14);
    return;
  }
  if (type === "avatar") {
    drawKeeper(c, w / 2, h * 0.91, w / 42, { time: 0 });
    return;
  }
  const u = Math.min(h / 100, w / 200);
  tower(c, w * 0.23, h * 0.87, u, { lit: true });
  drawKeeper(c, w * 0.23 + 30 * u, h * 0.87, u * 0.75, {});
  c.fillStyle = P.chalk;
  c.textAlign = "left";
  c.font = `${Math.round(h * 0.13)}px Silkscreen`;
  c.fillText("BEACON", w * 0.43, h * 0.42);
  c.fillStyle = P.amber;
  c.font = `${Math.round(h * 0.04)}px 'IBM Plex Mono'`;
  c.fillText("A small crew. Always on watch.", w * 0.43, h * 0.56);
  c.fillStyle = P.muted;
  c.font = `${Math.round(h * 0.027)}px 'IBM Plex Mono'`;
  c.fillText("LISTEN / COMPARE / RECORD", w * 0.43, h * 0.74);
}
export function drawFilm(c, w, h, t, variant = 0) {
  rect(c, 0, 0, w, h, P.bg);
  const title = [
    [
      "THE WATCH IS ON.",
      "A SIGNAL. NOT A GUESS.",
      "EVERY CHANGE LEAVES A RECORD.",
    ],
    ["LISTEN TO THE SOURCE.", "COMPARE WHAT CHANGED.", "KEEP THE OBSERVATION."],
    ["SERVICE STATUS.", "SOURCE ATTACHED.", "BEACON. ON WATCH."],
  ][variant];
  const phase = Math.min(2, Math.floor(t / 2.6)),
    fade = Math.min(1, (t % 2.6) * 4);
  c.save();
  c.globalAlpha = fade;
  drawMark(c, 65, 58, 4);
  c.fillStyle = P.chalk;
  c.font = "24px Silkscreen";
  c.fillText("BEACON", 100, 66);
  c.font = "34px Silkscreen";
  c.textAlign = "center";
  c.fillText(title[phase], w / 2, 160);
  c.textAlign = "left";
  c.save();
  c.translate(w * 0.07, h * 0.27);
  drawLandscape(c, w * 0.86, h * 0.48, {
    time: t,
    stations: [
      { id: "a", name: "Source A", visibleStatus: "none", latest: true },
      {
        id: "b",
        name: "Source B",
        visibleStatus: phase === 1 && variant === 0 ? "minor" : "none",
        latest: true,
      },
      { id: "c", name: "Source C", visibleStatus: "none", latest: true },
    ],
    selected: ["a", "b", "c"][phase],
    active: {
      stationId: ["a", "b", "c"][phase],
      stage: ["listen", "compare", "record"][phase],
    },
  });
  c.restore();
  c.textAlign = "center";
  c.fillStyle = P.amber;
  c.font = "20px IBM Plex Mono";
  c.fillText(
    [
      "Public status. Observable work.",
      "A check is a record. Not an uptime guarantee.",
      "Three agents. One source-linked trail.",
    ][variant],
    w / 2,
    h * 0.86,
  );
  c.textAlign = "left";
  c.fillStyle = P.muted;
  c.font = "12px IBM Plex Mono";
  c.fillText("ILLUSTRATED WORKFLOW / NOT LIVE SERVICE DATA", 40, h - 25);
  c.restore();
}
