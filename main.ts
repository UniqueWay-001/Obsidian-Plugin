import { Plugin, Notice } from 'obsidian';

interface GeometricObject {
  id: string;
  type:
  | 'point'
  | 'line'
  | 'segment'
  | 'ray'
  | 'midpoint'
  | 'bisector'
  | 'angle'
  | 'plane'
  | 'circle'
  | 'angleBisector'
  | 'transversal'
  ;
  // Explicit numeric coordinates
  values: Record<string, number | string | boolean>;
  x?: number;
  y?: number;

  label?: string;
  showDegrees?: boolean;
  [key:string]: any;

  startId?: string;
  endId?: string;
  centerId?: string;
  pointId?: string;
  vertexId?: string;
  p1Id?: string;
  p2Id?: string;
  otherIds?: string[];
  baseId?: string;
  meta?: Record<string, any>;
  transversalIds?: string[];
}



// used to keep track of handlers so we can clean them up on unload
type CanvasEntry = {
  objects: GeometricObject[];
  handlers: {
    mousedown: (e: MouseEvent) => void;
    mousemove: (e: MouseEvent) => void;
    mouseup: (e: MouseEvent) => void;
    mouseleave: (e: MouseEvent) => void;
  };
};

export default class GeometryPlugin extends Plugin {
  private canvasMap: Map<HTMLCanvasElement, CanvasEntry> = new Map();
  private locked = false;
  private cssLink?: HTMLLinkElement;

 private parseGeometryCode(code: string): GeometricObject[] {
  const objects: GeometricObject[] = [];
  const lines = code.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    // --- Point ---
    // Example: "A: point 100 200"
    let match = line.match(/^(\w+):\s*point\s+([\d.-]+)\s+([\d.-]+)/);
    if (match) {
      const [, id, x, y] = match;
      objects.push({
        id,
        type: 'point',
        x: Number(x),
        y: Number(y),
        values: {}
      });
      continue;
    }

    // --- Line, Segment, Ray ---
    // Example: "L1: line A B"
    match = line.match(/^(\w+):\s*(line|segment|ray)\s+(\w+)\s+(\w+)/);
    if (match) {
      const [, id, type, startId, endId] = match;
      objects.push({ id, type: type as any, startId, endId, values: {} });
      continue;
    }

    // --- Midpoint ---
    // Example: "M1: midpoint A B"
    match = line.match(/^(\w+):\s*midpoint\s+(\w+)\s+(\w+)/);
    if (match) {
      const [, id, startId, endId] = match;
      objects.push({ id, type: 'midpoint', startId, endId, values: {} });
      continue;
    }

    // --- Bisector ---
    // Example: "B1: bisector A B"
    match = line.match(/^(\w+):\s*bisector\s+(\w+)\s+(\w+)/);
    if (match) {
      const [, id, startId, endId] = match;
      objects.push({ id, type: 'bisector', startId, endId, values: {} });
      continue;
    }

  // --- Angle (Label or Degree Mode) ---
  // Examples:
  // Ang1: angle A B C label=X
  // Ang2: angle A B C deg
  match = line.match(/^(\w+):\s*angle\s+(\w+)\s+(\w+)\s+(\w+)(?:\s+(label=([\w\d]+)|deg))?/);
  if (match) {
    const [, id, vertexId, p1Id, p2Id, , label] = match;
    objects.push({
      id,
      type: 'angle',
      vertexId,
      p1Id,
      p2Id,
      values: {
        label: label ?? id,
        showDegrees: line.endsWith('deg')
      }
    });
    continue;
  }


    // --- Angle Bisector ---
    // Example: "AB1: angleBisector Angle1"
    match = line.match(/^(\w+):\s*angleBisector\s+(\w+)/);
    if (match) {
      const [, id, otherId] = match;
      objects.push({ id, type: 'angleBisector', otherIds: [otherId], values: {} });
      continue;
    }

    // --- Circle ---
    // Example: "Circle1: circle A B"
    match = line.match(/^(\w+):\s*circle\s+(\w+)\s+(\w+)/);
    if (match) {
      const [, id, centerId, pointId] = match;
      objects.push({ id, type: 'circle', centerId, pointId, values: {} });
      continue;
    }

    // --- Transversal ---
    // Example: "T1: transversal L1 L2 A B"
    match = line.match(/^(\w+):\s*transversal\s+(\w+)\s+(\w+)\s+(\w+)\s+(\w+)/);
    if (match) {
      const [, id, line1Id, line2Id, startId, endId] = match;
      objects.push({
        id,
        type: 'transversal',
        otherIds: [line1Id, line2Id],
        startId,
        endId,
        values: {}
      });
      continue;
    }
  }

  return objects;
}


  async onload() {
    console.log('🎉 Geometry Plugin Loaded!');

    // Load CSS if exists
    try {
      this.cssLink = document.createElement('link');
      this.cssLink.rel = 'stylesheet';
      this.cssLink.type = 'text/css';
      this.cssLink.href = this.manifest.dir + '/styles.css';
      document.head.appendChild(this.cssLink);
      console.log('🎨 Geometry Plugin CSS loaded!');
    } catch (e) {
      console.warn('Could not load plugin CSS:', e);
    }

    // Toggle lock
    this.addRibbonIcon('lock', 'Toggle Canvas Drag', () => {
      this.locked = !this.locked;
      new Notice(`Canvas drag is now ${this.locked ? 'locked' : 'unlocked'}`);
    });

    // ---------------- GEOMETRY CODE BLOCK ----------------
    this.registerMarkdownPostProcessor((el) => {
      const blocks = el.querySelectorAll('pre > code.language-geometry');
      blocks.forEach(block => {
        const pre = block.parentElement;
        if (!pre) return;

        const wrapper = document.createElement('div');
        wrapper.classList.add('geometry-wrapper');

        const canvas = document.createElement('canvas');

        // default size
        let width = 500;
        let height = 500;

        const firstLine = (block.textContent || '').split('\n')[0].trim();
        const sizeMatch = firstLine.match(/^#canvas\s+(\d+)\s+(\d+)/);
        if (sizeMatch) {
          width = parseInt(sizeMatch[1]);
          height = parseInt(sizeMatch[2]);
        }

        canvas.width = width;
        canvas.height = height;
        canvas.classList.add('geometry-canvas');
        wrapper.appendChild(canvas);

        pre.parentElement?.insertBefore(wrapper, pre.nextSibling);
        pre.style.display = 'none';

        const objects = this.parseGeometryCode(block.textContent || '');
        if (objects.some(o => o.type === 'transversal')) {
          canvas.classList.add('has-transversal');
        }
        // if no points, add a dummy point for testing
        if (objects.length === 0) {
          objects.push({ id: 'A', type: 'point', values: { x: 100, y: 100 } });
        }

        this.setupCanvas(canvas, objects);
        this.renderCanvas(canvas, objects);
      });
    });

    // ---------------- 2-COLUMN PROOF ----------------
    this.registerMarkdownPostProcessor((el) => {
      const blocks = el.querySelectorAll(
        'pre > code.language-proof2, pre > code.lang-proof2'
      );

      blocks.forEach(block => {
        const pre = block.parentElement;
        if (!pre) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'proof-2col';

        const table = document.createElement('table');

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        ['Step', 'Statement', 'Reason'].forEach(text => {
          const th = document.createElement('th');
          th.textContent = text;
          headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        table.appendChild(tbody);

        const raw = block.textContent || '';
        const lines = raw.split(/\r?\n/);

        let hasSteps = false;

        lines.forEach(rawLine => {
          const line = rawLine.trim();
          if (!line) return;
          if (line.startsWith('//')) return;

          const firstPipe = line.indexOf('|');
          if (firstPipe === -1) return;

          const secondPipe = line.indexOf('|', firstPipe + 1);
          if (secondPipe === -1) return;

          const rawStep = line.slice(0, firstPipe).trim();
          const statement = line.slice(firstPipe + 1, secondPipe).trim();
          const reason = line.slice(secondPipe + 1).trim();

          const tr = document.createElement('tr');

          const tdStep = document.createElement('td');
          if (rawStep.match(/^\d+\.?$/)) {
            tdStep.textContent = rawStep.replace('.', '');
            hasSteps = true;
          } else {
            tdStep.textContent = '';
          }

          const tdStatement = document.createElement('td');
          tdStatement.textContent = statement;

          const tdReason = document.createElement('td');
          tdReason.textContent = reason;

          tr.appendChild(tdStep);
          tr.appendChild(tdStatement);
          tr.appendChild(tdReason);

          tbody.appendChild(tr);
        });

        if (!hasSteps) {
          headerRow.removeChild(headerRow.children[0]);
          tbody.querySelectorAll('tr').forEach(row => {
            row.removeChild(row.children[0]);
          });
        }

        wrapper.appendChild(table);
        pre.parentElement?.insertBefore(wrapper, pre.nextSibling);
        pre.style.display = 'none';
      });
    });
  }

  onunload() {
    console.log('Geometry Plugin Unloaded');

    if (this.cssLink && this.cssLink.parentElement) {
      this.cssLink.parentElement.removeChild(this.cssLink);
    }

    this.canvasMap.forEach((entry, canvas) => {
      const { mousedown, mousemove, mouseup, mouseleave } = entry.handlers;
      canvas.removeEventListener('mousedown', mousedown);
      canvas.removeEventListener('mousemove', mousemove);
      canvas.removeEventListener('mouseup', mouseup);
      canvas.removeEventListener('mouseleave', mouseleave);
    });

    this.canvasMap.clear();
  }

  // -------------------- CANVAS SETUP --------------------
  private setupCanvas(canvas: HTMLCanvasElement, objects: GeometricObject[]) {
    if (this.canvasMap.has(canvas)) {
      const prev = this.canvasMap.get(canvas)!;
      canvas.removeEventListener('mousedown', prev.handlers.mousedown);
      canvas.removeEventListener('mousemove', prev.handlers.mousemove);
      canvas.removeEventListener('mouseup', prev.handlers.mouseup);
      canvas.removeEventListener('mouseleave', prev.handlers.mouseleave);
      this.canvasMap.delete(canvas);
    }

    let draggingPoint: GeometricObject | null = null;

    const mousedown = (e: MouseEvent) => {
      if (this.locked) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      draggingPoint = objects.find(obj =>
        obj.type === 'point' &&
        Math.hypot((obj.x ?? Infinity) - x, (obj.y ?? Infinity) - y) < 12
      ) || null;
    };

    const mousemove = (e: MouseEvent) => {
      if (!draggingPoint || this.locked) return;
      const rect = canvas.getBoundingClientRect();
      draggingPoint.x = e.clientX - rect.left;
      draggingPoint.y = e.clientY - rect.top;

      this.renderCanvas(canvas, objects);
    };

    const mouseup = () => { draggingPoint = null; };
    const mouseleave = () => { draggingPoint = null; };

    canvas.addEventListener('mousedown', mousedown);
    canvas.addEventListener('mousemove', mousemove);
    canvas.addEventListener('mouseup', mouseup);
    canvas.addEventListener('mouseleave', mouseleave);

    this.canvasMap.set(canvas, {
      objects,
      handlers: { mousedown, mousemove, mouseup, mouseleave }
    });
  }

  // -------------------- RENDER --------------------
  private renderCanvas(canvas: HTMLCanvasElement, objects: GeometricObject[]) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid
    const step = 50;
    const originX = canvas.width / 2;
    const originY = canvas.height / 2;

    ctx.save();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;

    for (let x = originX % step; x <= canvas.width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    for (let y = originY % step; y <= canvas.height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(canvas.width, originY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, canvas.height);
    ctx.stroke();

    // Map objects by id
    const idMap = new Map<string, GeometricObject>();
    objects.forEach(o => idMap.set(o.id, o));

    // Compute midpoints
    objects.forEach(obj => {
      if (obj.type === 'midpoint') {
        const p1 = idMap.get(obj.startId ?? '');
        const p2 = idMap.get(obj.endId ?? '');
        if (p1 && p2) {
          obj.x = ((p1.x ?? 0) + (p2.x ?? 0)) / 2;
          obj.y = ((p1.y ?? 0) + (p2.y ?? 0)) / 2;
        }
      }
    });

    // Helper: draw arrow
    const drawArrow = (x1: number, y1: number, x2: number, y2: number) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len === 0) return;
      const ux = dx / len, uy = dy / len;
      const tipX = x2 + ux * 10;
      const tipY = y2 + uy * 10;
      const size = 8;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - uy * size - ux * size, tipY + ux * size - uy * size);
      ctx.lineTo(tipX + uy * size - ux * size, tipY - ux * size - uy * size);
      ctx.closePath();
      ctx.fill();
    };

    // Draw lines, segments, rays, bisectors, and transversals
    objects.forEach(obj => {
      if (['line', 'segment', 'ray', 'bisector', 'transversal'].includes(obj.type)) {
        const p1 = idMap.get(obj.startId ?? '');
        const p2 = idMap.get(obj.endId ?? '');
        if (!p1 || !p2) return;
        if (p1.x == null || p2.x == null) return;

        let x1 = p1.x ?? 0;
        let y1 = p1.y ?? 0;
        let x2 = p2.x ?? 0;
        let y2 = p2.y ?? 0;

        // ---------- BISECTORS ----------
        if (obj.type === 'bisector') {
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.hypot(dx, dy);
          if (len !== 0) {
            const ux = -dy / len;
            const uy = dx / len;
            const halfLen = Math.max(canvas.width, canvas.height) / 3;
            x1 = mx - ux * halfLen;
            y1 = my - uy * halfLen;
            x2 = mx + ux * halfLen;
            y2 = my + uy * halfLen;
          }
        }

        // ---------- RAYS ----------
        if (obj.type === 'ray') {
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.hypot(dx, dy);
          if (len !== 0) {
            const ux = dx / len;
            const uy = dy / len;
            const extent = Math.max(canvas.width, canvas.height) * 1.2;
            x1 = x1 - ux * extent; // extend backward
            y1 = y1 - uy * extent;
            x2 = x2 + ux * extent; // extend forward
            y2 = y2 + uy * extent;
          }
        }

        // ---------- DRAW LINE ----------
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = 
          obj.type === 'bisector' ? 'cyan' : 
          obj.type === 'transversal' ? 'magenta' :
          'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        // ---------- TRANSVERSAL ----------
        if (obj.type === 'transversal') {
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.hypot(dx, dy);
          if (len !== 0) {
            const ux = dx / len;
            const uy = dy / len;
            const extent = Math.max(canvas.width, canvas.height) * 1.5;
            x1 -= ux * extent;
            y1 -= uy * extent;
            x2 += ux * extent;
            y2 += uy * extent;
          }
        }


        // ---------- DRAW ARROWS ----------
        ctx.fillStyle = ctx.strokeStyle as string;
        const drawArrow = (x1: number, y1: number, x2: number, y2: number) => {
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.hypot(dx, dy);
          if (len === 0) return;
          const ux = dx / len, uy = dy / len;
          const tipX = x2 + ux * 10;
          const tipY = y2 + uy * 10;
          const size = 8;
          ctx.beginPath();
          ctx.moveTo(tipX, tipY);
          ctx.lineTo(tipX - uy * size - ux * size, tipY + ux * size - uy * size);
          ctx.lineTo(tipX + uy * size - ux * size, tipY - ux * size - uy * size);
          ctx.closePath();
          ctx.fill();
        };

        //line arrows
        if (obj.type === 'line') {
          drawArrow(x2, y2, x1, y1); // both ends
          drawArrow(x1, y1, x2, y2);
        }
        //ray arrows
        if (obj.type === 'ray') {
          drawArrow(x1, y1, x2, y2);
        }
      }
    });



    if (objects.some(o => o.type === 'angle')) {
      canvas.classList.add('has-angles');
    }

    // Draw angles / angle bisectors
    objects.forEach(obj => {
      // -------- CLEAN ANGLE LABELS (NO ARCS) --------
      objects.forEach(obj => {
        if (obj.type !== 'angle') return;

        const vertex = idMap.get(obj.vertexId ?? '');
        const p1 = idMap.get(obj.p1Id ?? '');
        const p2 = idMap.get(obj.p2Id ?? '');
        if (!vertex || !p1 || !p2) return;

        const a1 = Math.atan2((p1.y ?? 0) - (vertex.y ?? 0), (p1.x ?? 0) - (vertex.x ?? 0));
        const a2 = Math.atan2((p2.y ?? 0) - (vertex.y ?? 0), (p2.x ?? 0) - (vertex.x ?? 0));

        let diff = a2 - a1;
        if (diff < 0) diff += Math.PI * 2;
        if (diff > Math.PI) diff = 2 * Math.PI - diff;

        const mid = (a1 + a2) / 2;

        let text = '';

        if (obj.values.showDegrees) {
          text = `${Math.round(diff * 180 / Math.PI)}°`;
        } else if (obj.values.label) {
          text = String(obj.values.label);
        } else {
          text = obj.id;
        }

        ctx.font = '14px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillText(
          text,
          (vertex.x ?? 0) + Math.cos(mid) * 30,
          (vertex.y ?? 0) + Math.sin(mid) * 30
        );
      });
      // Angle Bisector
      if (obj.type === 'angleBisector') {
        const angleObj = idMap.get(obj.otherIds?.[0] ?? '');
        if (!angleObj || angleObj.type !== 'angle') return;
        const vertex = idMap.get(angleObj.vertexId ?? '');
        const p1 = idMap.get(angleObj.p1Id ?? '');
        const p2 = idMap.get(angleObj.p2Id ?? '');
        if (!vertex || !p1 || !p2) return;

        const dx1 = (p1.x ?? 0) - (vertex.x ?? 0), dy1 = (p1.y ?? 0) - (vertex.y ?? 0);
        const dx2 = (p2.x ?? 0) - (vertex.x ?? 0), dy2 = (p2.y ?? 0) - (vertex.y ?? 0);
        let bx = dx1 / Math.hypot(dx1, dy1) + dx2 / Math.hypot(dx2, dy2);
        let by = dy1 / Math.hypot(dx1, dy1) + dy2 / Math.hypot(dx2, dy2);
        const len = Math.hypot(bx, by);
        if (len < 1e-6) { bx = -dy1 / Math.hypot(dx1, dy1); by = dx1 / Math.hypot(dx1, dy1); }
        ctx.beginPath();
        ctx.moveTo(vertex.x ?? 0, vertex.y ?? 0);
        ctx.lineTo((vertex.x ?? 0) + (bx / len) * 150, (vertex.y ?? 0) + (by / len) * 150);
        ctx.strokeStyle = 'orange';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // ------------------ TRANSVERSAL ANGLE LABELS ------------------
    objects.forEach(obj => {
      if (obj.type !== 'transversal') return;

      const lineObj1 = idMap.get(obj.otherIds?.[0] ?? '');
      const lineObj2 = idMap.get(obj.otherIds?.[1] ?? '');
      const p1 = idMap.get(obj.startId ?? '');
      const p2 = idMap.get(obj.endId ?? '');

      if (!lineObj1 || !lineObj2 || !p1 || !p2) return;

      const dx = (p2.x ?? 0) - (p1.x ?? 0);
      const dy = (p2.y ?? 0) - (p1.y ?? 0);

      const intersections = [lineObj1, lineObj2].map(line => {
        const a = idMap.get(line.startId ?? '');
        const b = idMap.get(line.endId ?? '');
        if (!a || !b) return null;

        const dxa = (b.x ?? 0) - (a.x ?? 0);
        const dya = (b.y ?? 0) - (a.y ?? 0);

        const det = dx * dya - dy * dxa;
        if (Math.abs(det) < 1e-6) return null;

        const t =
          (((a.x ?? 0) - (p1.x ?? 0)) * dya -
            ((a.y ?? 0) - (p1.y ?? 0)) * dxa) / det;

        return {
          x: (p1.x ?? 0) + t * dx,
          y: (p1.y ?? 0) + t * dy
        };
      });

      let count = 1;
      intersections.forEach(pt => {
        if (!pt) return;

        const offsets = [
          [20, -20], [20, 20], [-20, 20], [-20, -20]
        ];

        offsets.forEach(([ox, oy]) => {
          ctx.fillStyle = 'white';
          ctx.font = '12px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(
            `${count}`,
            pt.x + ox,
            pt.y + oy
          );
          count++;
        });
      });
    });


    // Draw circles
    objects.forEach(obj => {
      if (obj.type === 'circle') {
        const center = idMap.get(obj.centerId ?? '');
        const point = idMap.get(obj.pointId ?? '');
        if (!center || !point) return;
        const r = Math.hypot((point.x ?? 0) - (center.x ?? 0), (point.y ?? 0) - (center.y ?? 0));
        ctx.beginPath();
        ctx.arc(center.x ?? 0, center.y ?? 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'lime';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // Draw points
    objects.forEach(obj => {
      if (!obj.x || !obj.y) return;
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = obj.type === 'midpoint' ? 'orange' : 'yellow';
      ctx.fill();
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = '12px Arial';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const label = obj.id;
      ctx.fillText(label, obj.x + 8, obj.y);
    });

    ctx.restore();
  }

}