export interface GlassDrop {
  x: number;
  y: number;
  previousY: number;
  radius: number;
  velocity: number;
}

export function advanceGlassDrops(drops: GlassDrop[], dt: number) {
  for (const drop of drops) {
    drop.previousY = drop.y;
    drop.radius += 0.06 * dt;
    if (drop.radius < 2.1) continue;
    drop.velocity = Math.min(100, drop.velocity + (14 + (drop.radius - 2.1) * 42) * dt);
    drop.y += drop.velocity * dt;
  }
  for (let i = 0; i < drops.length; i++) {
    const a = drops[i];
    if (!a) continue;
    for (let j = i + 1; j < drops.length; j++) {
      const b = drops[j];
      if (!b) continue;
      // 检查整段滑落路径，避免快速水珠一步跨过小水珠。
      const gap = Math.max(a.previousY - b.y, b.previousY - a.y, 0);
      if (Math.hypot(a.x - b.x, gap) > a.radius + b.radius) continue;
      const areaA = a.radius * a.radius;
      const areaB = b.radius * b.radius;
      a.x = (a.x * areaA + b.x * areaB) / (areaA + areaB);
      a.radius = Math.sqrt(areaA + areaB);
      a.y = Math.max(a.y, b.y);
      a.previousY = Math.min(a.previousY, b.previousY);
      a.velocity = Math.max(a.velocity, b.velocity);
      drops.splice(j, 1);
      j--;
    }
  }
}

// 雨丝与玻璃水珠分开计时，只重绘窗格，保持室内原画清晰。
export function createDeskRain(canvases: HTMLCanvasElement[]) {
  const layers = canvases.flatMap((canvas) => {
    const context = canvas.getContext('2d');
    if (!context) return [];
    const { width, height } = canvas;
    const streaks = Array.from({ length: 46 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      speed: 160 + Math.random() * 240,
      length: 9 + Math.random() * 17,
      alpha: 0.08 + Math.random() * 0.16,
    }));
    const drops: GlassDrop[] = Array.from({ length: 30 }, (_, index) => ({
      x: 8 + Math.random() * (width - 16),
      y: Math.random() * height,
      previousY: 0,
      radius: index % 8 === 0 ? 2.2 + Math.random() * 0.5 : 0.6 + Math.random() * 1.1,
      velocity: index % 8 === 0 ? 12 : 0,
    }));
    return [{ context, width, height, streaks, drops }];
  });
  let running = false;
  let frame = 0;
  let previous = 0;
  let lastDraw = 0;

  function draw(now: number) {
    if (!running) return;
    const delta = now - lastDraw;
    if (delta >= 1000 / 30) {
      const dt = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      lastDraw = now - (delta % (1000 / 30));
      for (const layer of layers) {
        const { context, width, height, streaks, drops } = layer;
        context.clearRect(0, 0, width, height);
        context.lineCap = 'round';
        for (const streak of streaks) {
          streak.y += streak.speed * dt;
          streak.x -= streak.speed * dt * 0.07;
          if (streak.y > height + streak.length || streak.x < -4) {
            streak.y = -streak.length;
            streak.x = Math.random() * width;
          }
          const fade = Math.min(1, streak.y / 24, (height - streak.y) / 30);
          context.strokeStyle = `rgba(223, 239, 247, ${Math.max(0, fade) * streak.alpha})`;
          context.lineWidth = 0.7;
          context.beginPath();
          context.moveTo(streak.x, streak.y);
          context.lineTo(streak.x + streak.length * 0.07, streak.y - streak.length);
          context.stroke();
        }
        advanceGlassDrops(drops, dt);
        for (let i = drops.length - 1; i >= 0; i--) {
          const drop = drops[i];
          if (drop && drop.y > height + drop.radius * 2) drops.splice(i, 1);
        }
        while (drops.length < 30) {
          const y = Math.random() * height * 0.75;
          drops.push({ x: 8 + Math.random() * (width - 16), y, previousY: y, radius: 0.6 + Math.random() * 0.6, velocity: 0 });
        }
        for (const drop of drops) {
          const fade = Math.max(0, Math.min(1, drop.y / 28, (height - drop.y) / 28));
          if (drop.velocity > 0) {
            const trail = Math.min(42, drop.velocity * 0.4);
            context.lineWidth = Math.min(1.4, drop.radius * 0.5);
            context.strokeStyle = `rgba(230, 244, 250, ${fade * 0.20})`;
            context.beginPath();
            context.moveTo(drop.x, drop.y - trail);
            context.lineTo(drop.x, drop.y);
            context.stroke();
          }
          context.fillStyle = `rgba(10, 25, 36, ${fade * 0.22})`;
          context.beginPath();
          context.ellipse(drop.x, drop.y, drop.radius, drop.radius * 1.2, 0, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = `rgba(238, 248, 252, ${fade * 0.48})`;
          context.beginPath();
          context.ellipse(drop.x - drop.radius * 0.25, drop.y - drop.radius * 0.35, drop.radius * 0.3, drop.radius * 0.5, -0.3, 0, Math.PI * 2);
          context.fill();
        }
      }
    }
    frame = requestAnimationFrame(draw);
  }

  return {
    setRunning(next: boolean) {
      if (running === next) return;
      running = next;
      if (next) { previous = performance.now(); lastDraw = previous; frame = requestAnimationFrame(draw); }
      else cancelAnimationFrame(frame);
    },
  };
}
