/**
 * CDN IP Scanner - small live charts (inline SVG, no library)
 * Author: shahinst
 *
 * One series per chart (the title names it, so no legend), thin marks in the
 * theme accent, recessive grid, and a hover crosshair + tooltip.
 * Colors come from CSS variables, so light/dark themes follow automatically.
 */
(function () {
    const NS = 'http://www.w3.org/2000/svg';
    const H = 150, PAD = { top: 10, right: 12, bottom: 24, left: 44 };

    function el(name, attrs) {
        const node = document.createElementNS(NS, name);
        for (const k in attrs) node.setAttribute(k, attrs[k]);
        return node;
    }

    // "Nice" upper bound for the y axis (1, 2, 2.5, 5 × 10^n)
    function niceMax(v) {
        if (!(v > 0)) return 1;
        const p = Math.pow(10, Math.floor(Math.log10(v)));
        for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p;
        return 10 * p;
    }

    class LiveChart {
        /**
         * @param {HTMLElement} container
         * @param {{kind: 'line'|'dots', label: string, formatY: function, formatX: function}} opts
         */
        constructor(container, opts) {
            this.container = container;
            this.opts = opts;
            this.data = [];
            this.pending = false;
            container.classList.add('live-chart');
            container.setAttribute('dir', 'ltr');  // time runs left to right, also in RTL pages
            this.tooltip = document.createElement('div');
            this.tooltip.className = 'chart-tooltip hidden';
            container.appendChild(this.tooltip);
            window.addEventListener('resize', () => this.schedule());
        }

        reset() { this.data = []; this.schedule(); }

        push(x, y) {
            if (y == null || !isFinite(y)) return;
            const last = this.data[this.data.length - 1];
            // Lines get one point per 0.5 s (progress events arrive per scanned IP)
            if (this.opts.kind === 'line' && last && x - last.x < 0.5) { last.y = y; this.schedule(); return; }
            this.data.push({ x, y });
            if (this.data.length > 2000) this.data.shift();
            this.schedule();
        }

        schedule() {
            if (this.pending) return;
            this.pending = true;
            requestAnimationFrame(() => { this.pending = false; this.render(); });
        }

        render() {
            const W = Math.max(240, this.container.clientWidth);
            this.svg?.remove();
            const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img' });
            this.svg = svg;
            this.container.insertBefore(svg, this.tooltip);

            const pw = W - PAD.left - PAD.right, ph = H - PAD.top - PAD.bottom;
            const xs = this.data.map(d => d.x), ys = this.data.map(d => d.y);
            const xMax = Math.max(10, ...xs), yMax = niceMax(Math.max(...ys, 0) * 1.05);
            const sx = x => PAD.left + (x / xMax) * pw;
            const sy = y => PAD.top + ph - (y / yMax) * ph;
            this.scale = { sx, sy, pw, ph };

            const last = this.data[this.data.length - 1];
            svg.setAttribute('aria-label', this.opts.label +
                (last ? ': ' + this.opts.formatY(last.y) + ' @ ' + this.opts.formatX(last.x) : ''));

            // Recessive grid + y labels (0, half, max)
            [0, 0.5, 1].forEach(f => {
                const y = PAD.top + ph - f * ph;
                svg.appendChild(el('line', { x1: PAD.left, x2: W - PAD.right, y1: y, y2: y, class: 'chart-grid' }));
                const t = el('text', { x: PAD.left - 6, y: y + 3, 'text-anchor': 'end', class: 'chart-axis' });
                t.textContent = this.opts.formatY(yMax * f);
                svg.appendChild(t);
            });
            // x labels (start, end)
            [[0, 'start'], [xMax, 'end']].forEach(([x, anchor]) => {
                const t = el('text', { x: sx(x), y: H - 6, 'text-anchor': anchor, class: 'chart-axis' });
                t.textContent = this.opts.formatX(x);
                svg.appendChild(t);
            });

            if (!this.data.length) return;

            if (this.opts.kind === 'line') {
                const d = this.data.map((p, i) => (i ? 'L' : 'M') + sx(p.x).toFixed(1) + ' ' + sy(p.y).toFixed(1)).join(' ');
                svg.appendChild(el('path', { d, class: 'chart-line' }));
                svg.appendChild(el('circle', { cx: sx(last.x), cy: sy(last.y), r: 4, class: 'chart-dot' }));
            } else {
                this.data.forEach(p => svg.appendChild(el('circle', { cx: sx(p.x), cy: sy(p.y), r: 4, class: 'chart-dot' })));
            }

            // Hover layer: crosshair + tooltip on the nearest point
            const cross = el('line', { y1: PAD.top, y2: PAD.top + ph, class: 'chart-cross hidden' });
            svg.appendChild(cross);
            const hit = el('rect', { x: PAD.left, y: PAD.top, width: pw, height: ph, fill: 'transparent' });
            svg.appendChild(hit);
            hit.addEventListener('mousemove', e => this.hover(e, cross));
            hit.addEventListener('mouseleave', () => {
                cross.classList.add('hidden');
                this.tooltip.classList.add('hidden');
            });
        }

        hover(e, cross) {
            const rect = this.svg.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            let best = null, bestDist = Infinity;
            for (const p of this.data) {
                const dist = Math.abs(this.scale.sx(p.x) - mx);
                if (dist < bestDist) { bestDist = dist; best = p; }
            }
            if (!best) return;
            const x = this.scale.sx(best.x);
            cross.setAttribute('x1', x); cross.setAttribute('x2', x);
            cross.classList.remove('hidden');
            this.tooltip.textContent = this.opts.formatY(best.y) + ' · ' + this.opts.formatX(best.x);
            this.tooltip.style.left = Math.min(x + 8, rect.width - 120) + 'px';
            this.tooltip.style.top = (this.scale.sy(best.y) - 30) + 'px';
            this.tooltip.classList.remove('hidden');
        }
    }

    window.LiveChart = LiveChart;
})();
