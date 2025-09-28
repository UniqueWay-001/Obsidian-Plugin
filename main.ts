import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';


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
		| 'angleBisector'; // <-- add this
	values: Record<string, number>;
	startId?: string;
	endId?: string;
	centerId?: string;
	pointId?: string;
	vertexId?: string;
	p1Id?: string;
	p2Id?: string;
	otherIds?: string[];
}


export default class GeometryPlugin extends Plugin {
	private objectsMap: Map<HTMLCanvasElement, GeometricObject[]> = new Map();
	private locked = false; //LOCK

	async onload() {
		console.log('🎉 Geometry Plugin Loaded!');

    // Load CSS from plugin folder
		const cssLink = document.createElement('link');
		cssLink.rel = 'stylesheet';
		cssLink.type = 'text/css';
		cssLink.href = this.manifest.dir + '/styles.css';
		document.head.appendChild(cssLink);

		console.log('🎨 Geometry Plugin CSS loaded!');



		this.addRibbonIcon('lock', 'Toggle Canvas Drag', () => {
    this.locked = !this.locked;
    new Notice(`Canvas drag is now ${this.locked ? 'locked' : 'unlocked'}`);
});


		this.addCommand({
			id: 'open-geometry-panel',
			name: 'Open Geometry Panel',
			callback: () => console.log('Command triggered: Open Geometry Panel'),
		});

		this.registerMarkdownPostProcessor((el, ctx) => {
			const blocks = el.querySelectorAll('pre > code.language-geometry');
			blocks.forEach(block => {
				const pre = block.parentElement;
				if (!pre) return;

				const wrapper = document.createElement('div');
				wrapper.classList.add('geometry-wrapper');

				const canvas = document.createElement('canvas');
				canvas.width = 500;
				canvas.height = 500;
				canvas.classList.add('geometry-canvas');
				wrapper.appendChild(canvas);

				pre.parentElement?.insertBefore(wrapper, pre.nextSibling);
				pre.style.display = 'none';

				const objects = this.parseGeometryCode(block.textContent || '');
				this.objectsMap.set(canvas, objects);

				this.renderCanvas(canvas, objects);
				this.enableDrag(canvas, objects);
			});
		});
	}

	onunload() {
		console.log('Geometry Plugin Unloaded');
	}

private parseGeometryCode(code: string): GeometricObject[] {
	const objects: GeometricObject[] = [];
	const lines = code.split('\n');

	lines.forEach(line => {
		line = line.trim();
		if (!line) return;

		// --- Point ---
		if (line.startsWith('Point')) {
			const match = line.match(/Point\s+(\w+)\s*\((\d+),\s*(\d+)\)/);
			if (match) {
				const [, id, x, y] = match;
				objects.push({
					id,
					type: 'point',
					values: { x: parseInt(x), y: parseInt(y) }
				});
			}
		}

		// --- Line / Segment / Ray ---
		if (line.startsWith('Line') || line.startsWith('Segment') || line.startsWith('Ray')) {
			const match = line.match(/(Line|Segment|Ray)\s+(\w+)\s+(\w+)\s+(\w+)/);
			if (match) {
				const [, type, id, start, end] = match;
				const startObj = objects.find(o => o.id === start);
				const endObj = objects.find(o => o.id === end);
				if (startObj && endObj) {
					objects.push({
						id,
						type: type.toLowerCase() as 'line' | 'segment' | 'ray',
						startId: start,
						endId: end,
						values: {
							x1: startObj.values.x,
							y1: startObj.values.y,
							x2: endObj.values.x,
							y2: endObj.values.y
						}
					});
				}
			}
		}

		// --- Midpoint ---
		if (line.startsWith('Midpoint')) {
			const match = line.match(/Midpoint\s+(\w+)\s+(\w+)\s+(\w+)/);
			if (match) {
				const [, id, p1Id, p2Id] = match;
				const p1 = objects.find(o => o.id === p1Id);
				const p2 = objects.find(o => o.id === p2Id);
				if (p1 && p2) {
					objects.push({
						id,
						type: 'midpoint',
						values: {}, // computed dynamically in renderCanvas
						startId: p1Id,
						endId: p2Id
					});
				}
			}
		}

		// --- Bisector ---
		if (line.startsWith('Bisector')) {
			const match = line.match(/Bisector\s+(\w+)\s+(\w+)\s+(\w+)/);
			if (match) {
				const [, id, p1Id, p2Id] = match;
				const p1 = objects.find(o => o.id === p1Id);
				const p2 = objects.find(o => o.id === p2Id);
				if (p1 && p2) {
					objects.push({
						id,
						type: 'bisector',
						values: {},
						startId: p1Id,
						endId: p2Id
					});
				}
			}
		}

		// --- Circle ---
		if (line.startsWith('Circle')) {
			const match = line.match(/Circle\s+(\w+)\s+(\w+)\s+(\w+)/);
			if (match) {
				const [, id, centerId, pointId] = match;
				const center = objects.find(o => o.id === centerId);
				const pt = objects.find(o => o.id === pointId);
				if (center && pt) {
					objects.push({
						id,
						type: 'circle',
						values: {}, // radius computed in renderCanvas
						centerId,
						pointId
					});
				}
			}
		}

		// --- Angle ---
		if (line.startsWith('Angle')) {
			const match = line.match(/Angle\s+(\w+)\s+(\w+)\s+(\w+)\s+(\w+)/);
			if (match) {
				const [, id, vertexId, p1Id, p2Id] = match;
				const vertex = objects.find(o => o.id === vertexId);
				const p1 = objects.find(o => o.id === p1Id);
				const p2 = objects.find(o => o.id === p2Id);
				if (vertex && p1 && p2) {
					objects.push({
						id,
						type: 'angle',
						values: {},
						vertexId,
						p1Id,
						p2Id
					});
				}
			}
		}

		// --- AngleBisector ---
		if (line.startsWith('AngleBisector')) {
			const match = line.match(/AngleBisector\s+(\w+)\s+(\w+)/);
			if (match) {
				const [, id, angleId] = match;
				const angleObj = objects.find(o => o.id === angleId);
				if (angleObj && angleObj.type === 'angle') {
					objects.push({
						id,
						type: 'angleBisector',
						values: {}, 
						otherIds: [angleId] // store reference to angle
					});
				}
			}
		}

	});

	return objects;
}



	// ---------------------- RENDER ----------------------
private renderCanvas(canvas: HTMLCanvasElement, objects: GeometricObject[]) {
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// Helper: draw arrow
const drawArrow = (x1: number, y1: number, x2: number, y2: number) => {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const len = Math.hypot(dx, dy);
	if (len === 0) return;
	const ux = dx / len, uy = dy / len;

	// shorten by 40px (was 20 before)
	const tipX = x2 + ux * 10;
	const tipY = y2 + uy * 10;

	// arrowhead size
	const size = 8;

	ctx.beginPath();
	ctx.moveTo(tipX, tipY);
	ctx.lineTo(tipX - uy * size - ux * size, tipY + ux * size - uy * size);
	ctx.lineTo(tipX + uy * size - ux * size, tipY - ux * size - uy * size);
	ctx.closePath();
	ctx.fillStyle = ctx.strokeStyle;
	ctx.fill();
};


	objects.forEach(obj => {
		// --- Lines, Segments, Rays, Bisectors ---
		if (['line', 'segment', 'ray', 'bisector'].includes(obj.type)) {
			const p1 = objects.find(o => o.id === obj.startId);
			const p2 = objects.find(o => o.id === obj.endId);
			if (!p1 || !p2) return;

			let x1 = p1.values.x;
			let y1 = p1.values.y;
			let x2 = p2.values.x;
			let y2 = p2.values.y;

			if (obj.type === 'ray') {
				const dx = x2 - x1;
				const dy = y2 - y1;
				const len = Math.hypot(dx, dy);
				if (len === 0) return;
				const ux = dx / len, uy = dy / len;
				x2 = x1 + ux * 300;
				y2 = y1 + uy * 300;
			}

			if (obj.type === 'bisector') {
				const mx = (x1 + x2) / 2;
				const my = (y1 + y2) / 2;
				const dx = x2 - x1;
				const dy = y2 - y1;
				const len = Math.hypot(dx, dy);
				if (len === 0) return;
				const ux = -dy / len, uy = dx / len;
				const halfLen = 100;
				x1 = mx - ux * halfLen; 
				y1 = my - uy * halfLen;
				x2 = mx + ux * halfLen; 
				y2 = my + uy * halfLen;
			}

			ctx.beginPath();
			ctx.moveTo(x1, y1);
			ctx.lineTo(x2, y2);
			ctx.strokeStyle = obj.type === 'bisector' ? 'cyan' : 'white';
			ctx.lineWidth = 2;
			ctx.stroke();

			// arrows
			if (obj.type === 'line') {
				drawArrow(x2, y2, x1, y1); // both ends
				drawArrow(x1, y1, x2, y2);
			}
			if (obj.type === 'ray') {
				drawArrow(x1, y1, x2, y2);
			}
		}
		
		// --- Angles ---
		if (obj.type === 'angle') {
			const vertex = objects.find(o => o.id === obj.vertexId);
			const p1 = objects.find(o => o.id === obj.p1Id);
			const p2 = objects.find(o => o.id === obj.p2Id);
			if (!vertex || !p1 || !p2) return;

			// Compute start/end angles
			let startAngle = Math.atan2(p1.values.y - vertex.values.y, p1.values.x - vertex.values.x);
			let endAngle = Math.atan2(p2.values.y - vertex.values.y, p2.values.x - vertex.values.x);

			// Ensure smaller arc
			let diff = endAngle - startAngle;
			if (diff < 0) diff += 2 * Math.PI;
			if (diff > Math.PI) [startAngle, endAngle] = [endAngle, startAngle + 2 * Math.PI];

			// Draw the arc
			const radius = 40;
			ctx.beginPath();
			ctx.arc(vertex.values.x, vertex.values.y, radius, startAngle, endAngle, false);
			ctx.strokeStyle = 'purple';
			ctx.lineWidth = 2;
			ctx.stroke();

			// Draw the measurement (in degrees)
			const angleDeg = Math.round((endAngle - startAngle) * 180 / Math.PI);
			const midAngle = (startAngle + endAngle) / 2;
			const labelX = vertex.values.x + Math.cos(midAngle) * (radius + 15);
			const labelY = vertex.values.y + Math.sin(midAngle) * (radius + 15);

			ctx.font = '12px Arial';
			ctx.fillStyle = 'white';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(`${angleDeg}°`, labelX, labelY);
		}

		// --- Angle Bisector ---
		if (obj.type === 'angleBisector') {
			const angleObj = objects.find(o => o.id === obj.otherIds?.[0]);
			if (!angleObj) return;

			const vertex = objects.find(o => o.id === angleObj.vertexId);
			const p1 = objects.find(o => o.id === angleObj.p1Id);
			const p2 = objects.find(o => o.id === angleObj.p2Id);
			if (!vertex || !p1 || !p2) return;

			const dx1 = p1.values.x - vertex.values.x;
			const dy1 = p1.values.y - vertex.values.y;
			const dx2 = p2.values.x - vertex.values.x;
			const dy2 = p2.values.y - vertex.values.y;

			// Normalize vectors
			const len1 = Math.hypot(dx1, dy1);
			const len2 = Math.hypot(dx2, dy2);
			const ux1 = dx1 / len1;
			const uy1 = dy1 / len1;
			const ux2 = dx2 / len2;
			const uy2 = dy2 / len2;

			// Angle bisector vector (unit)
			const bisX = ux1 + ux2;
			const bisY = uy1 + uy2;
			const bisLen = Math.hypot(bisX, bisY);
			if (bisLen === 0) return;
			const bx = bisX / bisLen;
			const by = bisY / bisLen;

			const length = 100; // arbitrary line length
			ctx.beginPath();
			ctx.moveTo(vertex.values.x, vertex.values.y);
			ctx.lineTo(vertex.values.x + bx * length, vertex.values.y + by * length);
			ctx.strokeStyle = 'orange';
			ctx.lineWidth = 2;
			ctx.stroke();
		}


		// --- Circle ---
		if (obj.type === 'circle') {
			const center = objects.find(o => o.id === obj.centerId);
			const point = objects.find(o => o.id === obj.pointId);
			if (!center || !point) return;
			const dx = point.values.x - center.values.x;
			const dy = point.values.y - center.values.y;
			const r = Math.hypot(dx, dy);
			ctx.beginPath();
			ctx.arc(center.values.x, center.values.y, r, 0, Math.PI * 2);
			ctx.strokeStyle = 'lime';
			ctx.lineWidth = 2;
			ctx.stroke();
		}
	});
	 

	// Compute dynamic values first
	objects.forEach(obj => {
		if (obj.type === 'midpoint') {
			const p1 = objects.find(o => o.id === obj.startId);
			const p2 = objects.find(o => o.id === obj.endId);
			if (!p1 || !p2) return;
			obj.values.x = (p1.values.x + p2.values.x) / 2;
			obj.values.y = (p1.values.y + p2.values.y) / 2;
		}
	});

	
	// --- Points ---
	objects.forEach(obj => {
		if (obj.type === 'point') {
			// Draw the point
			ctx.beginPath();
			ctx.arc(obj.values.x, obj.values.y, 5, 0, Math.PI * 2);
			ctx.fillStyle = 'yellow';
			ctx.fill();
			ctx.strokeStyle = 'black';
			ctx.lineWidth = 1;
			ctx.stroke();

			// Draw the label
			ctx.font = '12px Arial';
			ctx.fillStyle = 'white'; // label color
			ctx.textAlign = 'left';
			ctx.textBaseline = 'middle';
			ctx.fillText(obj.id, obj.values.x + 8, obj.values.y);
		}

		if (obj.type === 'midpoint') {
			ctx.beginPath();
			ctx.arc(obj.values.x, obj.values.y, 5, 0, Math.PI * 2);
			ctx.fillStyle = 'orange'; // differentiate midpoints
			ctx.fill();
			ctx.strokeStyle = 'black';
			ctx.lineWidth = 1;
			ctx.stroke();

			ctx.font = '12px Arial';
			ctx.fillStyle = 'white';
			ctx.textAlign = 'left';
			ctx.textBaseline = 'middle';
			ctx.fillText(obj.id, obj.values.x + 8, obj.values.y);
		}

	});

}



	// ---------------------- ENABLE DRAG ----------------------
	private enableDrag(canvas: HTMLCanvasElement, objects: GeometricObject[]) {
    let draggingPoint: GeometricObject | null = null;

    canvas.addEventListener('mousedown', (e) => {
        if (this.locked) return; // ❌ skip drag if locked

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        draggingPoint = objects.find(obj =>
            obj.type === 'point' &&
            Math.hypot(obj.values.x - x, obj.values.y - y) < 12
        ) || null;
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!draggingPoint || this.locked) return;

        const rect = canvas.getBoundingClientRect();
        draggingPoint.values.x = e.clientX - rect.left;
        draggingPoint.values.y = e.clientY - rect.top;

        this.renderCanvas(canvas, objects);
    });

    canvas.addEventListener('mouseup', () => draggingPoint = null);
    canvas.addEventListener('mouseleave', () => draggingPoint = null);
}

}
