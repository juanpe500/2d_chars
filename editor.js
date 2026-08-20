// ═══════════════════════════════════════════════════════════════
//  CharacterBuilder — standalone avatar editor for sprites.js
//  ---------------------------------------------------------------
//  Drop this file + sprites.js into any page and you get a full
//  character creator: random generator, every clothing / color
//  option, all 8 rotations, walk / pose animation, a variations
//  explorer, a random gallery, and JSON + link export / import.
//
//  The thing your game stores is the plain `avatar` object this
//  produces — feed it straight back into:
//      SpriteRenderer.drawAvatar(ctx, x, y, { avatar, direction })
//
//  Usage:
//      const cb = new CharacterBuilder(document.getElementById('app'), {
//          onChange(avatar) { ...persist it... }
//      });
//      cb.getConfig();        // -> avatar object
//      cb.setConfig(avatar);  // load one
//      cb.randomize();
//
//  No build step, no dependencies. sprites.js must load first.
// ═══════════════════════════════════════════════════════════════

(function (global) {
    'use strict';

    // ── Pull option tables from sprites.js (shared classic-script scope),
    //    with safe fallbacks so the file also works if names change. ──
    const _len = (name, fallback) =>
        (typeof global[name] !== 'undefined' && Array.isArray(global[name]))
            ? global[name].length : fallback;

    const SKIN = (typeof SKIN_PALETTES !== 'undefined') ? SKIN_PALETTES
        : [['#f5d0a9'], ['#deb887'], ['#a0785a'], ['#6b4226']];
    const HAIRC = (typeof HAIR_COLORS !== 'undefined') ? HAIR_COLORS
        : ['#2c1810', '#4a3020', '#8b6914', '#d4a030', '#c0392b', '#7d3c98', '#2c3e50', '#ecf0f1'];
    const SHIRTC = (typeof SHIRT_COLORS !== 'undefined') ? SHIRT_COLORS
        : ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#8b5cf6'];
    const PANTSC = (typeof PANTS_COLORS !== 'undefined') ? PANTS_COLORS
        : ['#2c3e50', '#34495e', '#1a252f', '#4a4a6a', '#2d2d44', '#3d3050', '#283028', '#2a2a3a'];
    const HAIR_S = (typeof HAIR_STYLES !== 'undefined') ? HAIR_STYLES
        : ['short', 'spiky', 'long', 'bald', 'mohawk', 'curly', 'ponytail', 'buzz', 'afro', 'bun', 'emo'];
    const FACES = (typeof FACE_TYPES !== 'undefined') ? FACE_TYPES
        : ['neutral', 'smile', 'happy', 'cool', 'wink', 'surprised', 'angry', 'sleepy'];
    const ACCS = (typeof ACCESSORIES !== 'undefined') ? ACCESSORIES
        : ['none', 'glasses', 'sunglasses', 'hat', 'headband', 'earring', 'mask', 'beard', 'eyepatch'];
    const PATTERNS = (typeof SHIRT_PATTERNS !== 'undefined') ? SHIRT_PATTERNS
        : ['solid', 'stripes', 'vneck', 'collar', 'dots', 'chevron'];

    const SKIN_NAMES = ['Light', 'Medium', 'Dark', 'Deep'];

    // Clockwise compass, starting facing the camera.
    const DIRECTIONS = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'];
    const DIR_LABEL = { S: 'Front', SE: 'F-Right', E: 'Right', NE: 'B-Right', N: 'Back', NW: 'B-Left', W: 'Left', SW: 'F-Left' };

    const POSES = [
        { id: 'stand', label: 'Stand', pose: null },
        { id: 'sit', label: 'Sit', pose: 'sit' },
        { id: 'lay_down', label: 'Lay', pose: 'lay_down' },
    ];

    // Optional held item (works via sprites.js legacy fallback, no catalog needed).
    const PROPS = ['none', 'gun'];

    // Shoes / accessory have no palette in the engine — offer our own presets.
    const SHOE_PRESETS = ['#1a1a2e', '#ffffff', '#c0392b', '#2c3e50', '#e67e22', '#7f8c8d', '#111111', '#f1c40f'];
    const ACC_PRESETS = ['#e74c3c', '#8b5cf6', '#111111', '#f1c40f', '#2ecc71', '#3498db', '#ffffff', '#e91e63'];

    const DEFAULT_SHOES = '#1a1a2e';
    const DEFAULT_ACC = '#e74c3c';

    // The full set of keys we persist. Custom* keys are omitted when unset.
    const IDX_KEYS = ['skin', 'hair', 'shirt', 'pants', 'hairStyle', 'face', 'accessory', 'shirtPattern'];

    // ── Small helpers ──────────────────────────────────────────────
    const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
    function ri(n) { return Math.floor(Math.random() * n); }
    function chance(p) { return Math.random() < p; }
    function clone(o) { return JSON.parse(JSON.stringify(o)); }
    function randHex() {
        const h = ri(360), s = 45 + ri(45), l = 35 + ri(35);
        return hslToHex(h, s, l);
    }
    function hslToHex(h, s, l) {
        s /= 100; l /= 100;
        const k = n => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = n => {
            const c = l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
            return Math.round(255 * c).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    }
    function el(tag, cls, html) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html != null) e.innerHTML = html;
        return e;
    }

    // ── Avatar factories ───────────────────────────────────────────
    function makeDefault() {
        return { skin: 0, hair: 0, shirt: 0, pants: 0, hairStyle: 0, face: 1, accessory: 0, shirtPattern: 0 };
    }

    function makeRandom() {
        const a = {
            skin: ri(SKIN.length),
            hair: ri(HAIRC.length),
            shirt: ri(SHIRTC.length),
            pants: ri(PANTSC.length),
            hairStyle: ri(HAIR_S.length),
            face: ri(FACES.length),
            accessory: chance(0.55) ? ri(ACCS.length) : 0,
            shirtPattern: ri(PATTERNS.length),
        };
        // Occasionally splash in free custom colors to show they work.
        if (chance(0.30)) a.customHair = randHex();
        if (chance(0.35)) a.customShirt = randHex();
        if (chance(0.25)) a.customPants = randHex();
        if (chance(0.20)) a.customShoes = randHex();
        return a;
    }

    // Keep only known keys, coerce indices into range, validate hex.
    function sanitize(raw) {
        const a = makeDefault();
        if (!raw || typeof raw !== 'object') return a;
        const src = raw.avatar && typeof raw.avatar === 'object' ? raw.avatar : raw;
        const bounds = {
            skin: SKIN.length, hair: HAIRC.length, shirt: SHIRTC.length, pants: PANTSC.length,
            hairStyle: HAIR_S.length, face: FACES.length, accessory: ACCS.length, shirtPattern: PATTERNS.length,
        };
        for (const k of IDX_KEYS) {
            const v = parseInt(src[k], 10);
            if (!isNaN(v)) a[k] = ((v % bounds[k]) + bounds[k]) % bounds[k];
        }
        for (const k of ['customSkin', 'customHair', 'customShirt', 'customPants', 'customShoes', 'customAccessory']) {
            if (typeof src[k] === 'string' && /^#[0-9a-fA-F]{6}$/.test(src[k])) a[k] = src[k].toLowerCase();
        }
        return a;
    }

    // ── Core render wrapper. Frames the sprite and clips the name tag. ──
    function renderAvatar(canvas, avatar, opts) {
        opts = opts || {};
        const zoom = opts.zoom || 4;
        const showName = !!opts.showName;
        const logicalW = 52;
        const logicalH = showName ? 84 : 58;
        const feetY = showName ? 76 : 50;

        if (canvas.width !== logicalW * zoom) canvas.width = logicalW * zoom;
        if (canvas.height !== logicalH * zoom) canvas.height = logicalH * zoom;

        const ctx = canvas.getContext('2d');
        ctx.setTransform(zoom, 0, 0, zoom, 0, 0);
        ctx.clearRect(0, 0, logicalW, logicalH);

        if (opts.bg && opts.bg !== 'transparent') {
            if (opts.bg === 'checker') {
                for (let yy = 0; yy < logicalH; yy += 6)
                    for (let xx = 0; xx < logicalW; xx += 6) {
                        ctx.fillStyle = ((xx + yy) / 6) % 2 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.10)';
                        ctx.fillRect(xx, yy, 6, 6);
                    }
            } else {
                ctx.fillStyle = opts.bg;
                ctx.fillRect(0, 0, logicalW, logicalH);
            }
        }

        const player = {
            username: showName ? (opts.username || 'Player') : '',
            avatar,
            direction: opts.direction || 'S',
            walkFrame: opts.frame || 0,
            isWalking: !!opts.isWalking,
            pose: opts.pose || null,
            equipped_item: opts.equipped_item || null,
        };
        SpriteRenderer.drawAvatar(ctx, logicalW / 2, feetY, player, !!opts.isLocal);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Component
    // ═══════════════════════════════════════════════════════════════
    class CharacterBuilder {
        constructor(container, options) {
            this.root = typeof container === 'string' ? document.querySelector(container) : container;
            if (!this.root) throw new Error('CharacterBuilder: container not found');
            this.opts = options || {};
            this.onChange = this.opts.onChange || null;

            this.avatar = sanitize(this.opts.initial || readHash() || makeRandom());
            this.username = this.opts.username || '';
            this.view = {
                dir: 'S', poseId: 'stand', walking: false, autorotate: false,
                speed: 1, showName: false, bg: 'checker', prop: 'none', showRotations: true,
            };
            this.frame = 0;
            this._raf = null;
            this._els = {};

            injectStyles();
            this._build();
            this._syncAll();
            this._loop = this._loop.bind(this);
            this._raf = requestAnimationFrame(this._loop);

            if (this.opts.syncHash !== false) {
                window.addEventListener('hashchange', this._onHash = () => {
                    const a = readHash();
                    if (a) { this.avatar = sanitize(a); this._syncAll(true); }
                });
            }
        }

        // ── Public API ──────────────────────────────────────────────
        getConfig() { return clone(this.avatar); }
        setConfig(a) { this.avatar = sanitize(a); this._syncAll(true); }
        randomize() { this.avatar = makeRandom(); this._syncAll(true); }
        reset() { this.avatar = makeDefault(); this._syncAll(true); }
        destroy() {
            if (this._raf) cancelAnimationFrame(this._raf);
            if (this._onHash) window.removeEventListener('hashchange', this._onHash);
            this.root.innerHTML = '';
        }

        // ── Change plumbing ─────────────────────────────────────────
        _emit(updateInputs) {
            this._syncPreview();
            this._syncControlsActive();
            if (updateInputs) this._syncControlValues();
            this._syncExport();
            if (this.opts.syncHash !== false) writeHash(this.avatar);
            if (this.onChange) { try { this.onChange(clone(this.avatar)); } catch (e) { } }
        }
        _set(key, value) {
            if (value == null) delete this.avatar[key]; else this.avatar[key] = value;
            this._emit(false);
        }
        // Set palette index and drop any custom override for that part.
        _setIndex(idxKey, customKey, value) {
            this.avatar[idxKey] = value;
            if (customKey) delete this.avatar[customKey];
            this._emit(true);
        }
        _setCustom(customKey, hex) { this.avatar[customKey] = hex; this._emit(true); }
        _clearCustom(customKey) { delete this.avatar[customKey]; this._emit(true); }

        // ── Build the whole UI ──────────────────────────────────────
        _build() {
            this.root.classList.add('cb');
            this.root.innerHTML = '';

            const main = el('div', 'cb-main');
            main.appendChild(this._buildPreview());
            main.appendChild(this._buildControls());
            this.root.appendChild(main);
            this.root.appendChild(this._buildExtras());
        }

        _buildPreview() {
            const wrap = el('div', 'cb-preview');

            const stage = el('div', 'cb-stage');
            const canvas = el('canvas', 'cb-canvas');
            this._els.stage = canvas;
            stage.appendChild(canvas);
            wrap.appendChild(stage);

            // Direction compass
            const compass = el('div', 'cb-compass');
            this._els.dirBtns = {};
            const layout = [['NW', 'N', 'NE'], ['W', '·', 'E'], ['SW', 'S', 'SE']];
            layout.forEach(row => {
                row.forEach(d => {
                    if (d === '·') {
                        const spin = el('button', 'cb-dir cb-spin', '⟳');
                        spin.title = 'Auto-rotate';
                        spin.onclick = () => { this.view.autorotate = !this.view.autorotate; spin.classList.toggle('on', this.view.autorotate); };
                        compass.appendChild(spin);
                        this._els.spinBtn = spin;
                        return;
                    }
                    const b = el('button', 'cb-dir', DIR_LABEL[d]);
                    b.title = d;
                    b.onclick = () => { this.view.dir = d; this.view.autorotate = false; this._els.spinBtn.classList.remove('on'); this._syncDirActive(); };
                    this._els.dirBtns[d] = b;
                    compass.appendChild(b);
                });
            });
            wrap.appendChild(compass);

            // Animation / pose row
            const anim = el('div', 'cb-animrow');
            const walkBtn = el('button', 'cb-toggle', '🚶 Walk');
            walkBtn.onclick = () => { this.view.walking = !this.view.walking; walkBtn.classList.toggle('on', this.view.walking); };
            this._els.walkBtn = walkBtn;
            anim.appendChild(walkBtn);

            const poseSel = el('div', 'cb-seg');
            POSES.forEach(p => {
                const b = el('button', 'cb-seg-btn' + (p.id === 'stand' ? ' on' : ''), p.label);
                b.onclick = () => {
                    this.view.poseId = p.id;
                    poseSel.querySelectorAll('.cb-seg-btn').forEach(x => x.classList.remove('on'));
                    b.classList.add('on');
                };
                poseSel.appendChild(b);
            });
            anim.appendChild(poseSel);
            wrap.appendChild(anim);

            // Speed + view toggles
            const row2 = el('div', 'cb-viewrow');
            const speed = el('input');
            speed.type = 'range'; speed.min = '0'; speed.max = '3'; speed.step = '0.1'; speed.value = '1';
            speed.className = 'cb-speed';
            speed.oninput = () => { this.view.speed = parseFloat(speed.value); };
            const speedLbl = el('span', 'cb-mini', 'speed');
            row2.appendChild(speedLbl); row2.appendChild(speed);

            const nameChk = this._checkbox('Name', false, v => { this.view.showName = v; });
            row2.appendChild(nameChk.wrap);
            const rotChk = this._checkbox('Rotations', true, v => { this.view.showRotations = v; this._els.rotations.style.display = v ? '' : 'none'; });
            row2.appendChild(rotChk.wrap);
            wrap.appendChild(row2);

            // Background swatches
            const bgRow = el('div', 'cb-bgrow');
            bgRow.appendChild(el('span', 'cb-mini', 'bg'));
            [['checker', 'checker'], ['transparent', 'none'], ['#0d0f13', 'dark'], ['#ffffff', 'white'], ['#4b9e5f', 'grass']].forEach(([val, label]) => {
                const s = el('button', 'cb-bg', label);
                s.onclick = () => { this.view.bg = val; bgRow.querySelectorAll('.cb-bg').forEach(x => x.classList.remove('on')); s.classList.add('on'); };
                if (val === 'checker') s.classList.add('on');
                bgRow.appendChild(s);
            });
            wrap.appendChild(bgRow);

            // Rotations strip (all 8)
            const rot = el('div', 'cb-rotations');
            this._els.rotCanvases = {};
            DIRECTIONS.forEach(d => {
                const cell = el('div', 'cb-rotcell');
                const c = el('canvas');
                c.onclick = () => { this.view.dir = d; this.view.autorotate = false; this._els.spinBtn.classList.remove('on'); this._syncDirActive(); };
                cell.appendChild(c);
                cell.appendChild(el('span', 'cb-rotlbl', d));
                this._els.rotCanvases[d] = c;
                rot.appendChild(cell);
            });
            this._els.rotations = rot;
            wrap.appendChild(rot);

            // Action buttons
            const actions = el('div', 'cb-actions');
            const rnd = el('button', 'cb-btn cb-primary', '🎲 Random');
            rnd.onclick = () => this.randomize();
            const reset = el('button', 'cb-btn', '↺ Reset');
            reset.onclick = () => this.reset();
            const link = el('button', 'cb-btn', '🔗 Copy link');
            link.onclick = () => this._copyLink(link);
            actions.appendChild(rnd); actions.appendChild(reset); actions.appendChild(link);
            wrap.appendChild(actions);

            return wrap;
        }

        _buildControls() {
            const wrap = el('div', 'cb-controls');
            this._els.ctl = {};

            // Name input
            const nameSec = this._section('Name tag');
            const nameInput = el('input', 'cb-text');
            nameInput.type = 'text'; nameInput.placeholder = 'Character name'; nameInput.value = this.username;
            nameInput.maxLength = 22;
            nameInput.oninput = () => { this.username = nameInput.value; };
            nameSec.body.appendChild(nameInput);
            wrap.appendChild(nameSec.wrap);

            // Colorable parts
            this._els.ctl.skin = this._colorPart(wrap, 'Skin tone', 'skin', 'customSkin',
                SKIN.map(p => p[0]), SKIN_NAMES);
            this._els.ctl.hair = this._colorPart(wrap, 'Hair color', 'hair', 'customHair', HAIRC);
            this._els.ctl.shirt = this._colorPart(wrap, 'Shirt color', 'shirt', 'customShirt', SHIRTC);
            this._els.ctl.pants = this._colorPart(wrap, 'Pants color', 'pants', 'customPants', PANTSC);
            this._els.ctl.shoes = this._customOnlyColor(wrap, 'Shoes color', 'customShoes', SHOE_PRESETS, DEFAULT_SHOES);
            this._els.ctl.acc = this._customOnlyColor(wrap, 'Accessory color', 'customAccessory', ACC_PRESETS, DEFAULT_ACC);

            // Enumerated parts
            this._els.ctl.hairStyle = this._choicePart(wrap, 'Hair style', 'hairStyle', HAIR_S);
            this._els.ctl.face = this._choicePart(wrap, 'Face', 'face', FACES);
            this._els.ctl.accessory = this._choicePart(wrap, 'Accessory', 'accessory', ACCS);
            this._els.ctl.shirtPattern = this._choicePart(wrap, 'Shirt pattern', 'shirtPattern', PATTERNS);

            // Held item
            const propSec = this._section('Held item');
            const propSeg = el('div', 'cb-seg');
            PROPS.forEach(p => {
                const b = el('button', 'cb-seg-btn' + (p === 'none' ? ' on' : ''), p);
                b.onclick = () => {
                    this.view.prop = p;
                    propSeg.querySelectorAll('.cb-seg-btn').forEach(x => x.classList.remove('on'));
                    b.classList.add('on');
                };
                propSeg.appendChild(b);
            });
            propSec.body.appendChild(propSeg);
            wrap.appendChild(propSec.wrap);

            return wrap;
        }

        _buildExtras() {
            const wrap = el('div', 'cb-extras');

            // Tabs
            const tabs = el('div', 'cb-tabs');
            const panes = el('div', 'cb-panes');
            const defs = [
                ['variations', 'Variations'],
                ['gallery', 'Gallery'],
                ['io', 'Export / Import'],
            ];
            this._els.panes = {};
            defs.forEach(([id, label], i) => {
                const t = el('button', 'cb-tab' + (i === 0 ? ' on' : ''), label);
                const pane = el('div', 'cb-pane' + (i === 0 ? ' on' : ''));
                t.onclick = () => {
                    tabs.querySelectorAll('.cb-tab').forEach(x => x.classList.remove('on'));
                    panes.querySelectorAll('.cb-pane').forEach(x => x.classList.remove('on'));
                    t.classList.add('on'); pane.classList.add('on');
                    if (id === 'variations') this._renderVariations();
                    if (id === 'gallery') this._syncExport(); // no-op keep
                };
                tabs.appendChild(t);
                panes.appendChild(pane);
                this._els.panes[id] = pane;
            });
            wrap.appendChild(tabs);
            wrap.appendChild(panes);

            this._buildVariationsPane(this._els.panes.variations);
            this._buildGalleryPane(this._els.panes.gallery);
            this._buildIOPane(this._els.panes.io);

            return wrap;
        }

        // ── Variations explorer ─────────────────────────────────────
        _buildVariationsPane(pane) {
            const bar = el('div', 'cb-varbar');
            bar.appendChild(el('span', 'cb-mini', 'Vary:'));
            const sel = el('select', 'cb-select');
            this._varAxes = [
                { id: 'hairStyle', label: 'Hair style', list: HAIR_S },
                { id: 'face', label: 'Face', list: FACES },
                { id: 'accessory', label: 'Accessory', list: ACCS },
                { id: 'shirtPattern', label: 'Shirt pattern', list: PATTERNS },
                { id: 'skin', label: 'Skin tone', list: SKIN_NAMES, custom: 'customSkin' },
                { id: 'hair', label: 'Hair color', list: HAIRC, custom: 'customHair', swatch: true },
                { id: 'shirt', label: 'Shirt color', list: SHIRTC, custom: 'customShirt', swatch: true },
                { id: 'pants', label: 'Pants color', list: PANTSC, custom: 'customPants', swatch: true },
            ];
            this._varAxes.forEach((a, i) => {
                const o = el('option', null, a.label); o.value = String(i); sel.appendChild(o);
            });
            sel.onchange = () => this._renderVariations();
            this._els.varSel = sel;
            bar.appendChild(sel);
            pane.appendChild(bar);

            const grid = el('div', 'cb-vargrid');
            this._els.varGrid = grid;
            pane.appendChild(grid);
        }

        _renderVariations() {
            const grid = this._els.varGrid;
            if (!grid) return;
            grid.innerHTML = '';
            const axis = this._varAxes[parseInt(this._els.varSel.value, 10) || 0];
            const n = axis.list.length;
            for (let i = 0; i < n; i++) {
                const a = clone(this.avatar);
                a[axis.id] = i;
                if (axis.custom) delete a[axis.custom]; // show the palette value, not override
                const cell = el('div', 'cb-varcell');
                const c = el('canvas');
                renderAvatar(c, a, { direction: this.view.dir, zoom: 3, bg: 'transparent' });
                const active = (this.avatar[axis.id] === i) && !(axis.custom && this.avatar[axis.custom]);
                if (active) cell.classList.add('on');
                cell.appendChild(c);
                cell.appendChild(el('span', 'cb-varlbl', axis.swatch ? '' : (axis.list[i] || i)));
                cell.onclick = () => {
                    this.avatar[axis.id] = i;
                    if (axis.custom) delete this.avatar[axis.custom];
                    this._emit(true);
                    this._renderVariations();
                };
                grid.appendChild(cell);
            }
        }

        // ── Random gallery ──────────────────────────────────────────
        _buildGalleryPane(pane) {
            const bar = el('div', 'cb-varbar');
            const regen = el('button', 'cb-btn cb-primary', '🎲 Regenerate');
            regen.onclick = () => this._fillGallery();
            bar.appendChild(regen);
            bar.appendChild(el('span', 'cb-mini', 'Click any to edit it'));
            pane.appendChild(bar);
            const grid = el('div', 'cb-gallery');
            this._els.galleryGrid = grid;
            pane.appendChild(grid);
            this._fillGallery();
        }

        _fillGallery(count) {
            const grid = this._els.galleryGrid;
            grid.innerHTML = '';
            count = count || 24;
            for (let i = 0; i < count; i++) {
                const a = makeRandom();
                const cell = el('div', 'cb-gcell');
                const c = el('canvas');
                renderAvatar(c, a, { direction: 'S', zoom: 3, bg: 'transparent' });
                cell.appendChild(c);
                cell.onclick = () => { this.avatar = a; this._syncAll(true); this.root.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
                grid.appendChild(cell);
            }
        }

        // ── Export / Import ─────────────────────────────────────────
        _buildIOPane(pane) {
            const grid = el('div', 'cb-io');

            const left = el('div', 'cb-iocol');
            left.appendChild(el('div', 'cb-iolbl', 'Config (this is what your game stores)'));
            const ta = el('textarea', 'cb-json'); ta.spellcheck = false; ta.readOnly = true;
            this._els.exportTa = ta;
            left.appendChild(ta);
            const lrow = el('div', 'cb-iorow');
            const copy = el('button', 'cb-btn cb-primary', 'Copy JSON');
            copy.onclick = () => this._copyText(this._els.exportTa.value, copy, 'Copied!');
            const dl = el('button', 'cb-btn', 'Download .json');
            dl.onclick = () => this._download();
            lrow.appendChild(copy); lrow.appendChild(dl);
            left.appendChild(lrow);

            const right = el('div', 'cb-iocol');
            right.appendChild(el('div', 'cb-iolbl', 'Import — paste config or a share link'));
            const ita = el('textarea', 'cb-json'); ita.spellcheck = false;
            ita.placeholder = '{ "skin": 0, "hair": 3, ... }  — or a #c=... link';
            this._els.importTa = ita;
            right.appendChild(ita);
            const rrow = el('div', 'cb-iorow');
            const load = el('button', 'cb-btn cb-primary', 'Load');
            load.onclick = () => this._importFromText();
            const file = el('input'); file.type = 'file'; file.accept = '.json,application/json'; file.style.display = 'none';
            file.onchange = () => {
                const f = file.files[0]; if (!f) return;
                const r = new FileReader();
                r.onload = () => { this._els.importTa.value = r.result; this._importFromText(); };
                r.readAsText(f);
            };
            const upl = el('button', 'cb-btn', 'Upload file');
            upl.onclick = () => file.click();
            const err = el('span', 'cb-err', '');
            this._els.importErr = err;
            rrow.appendChild(load); rrow.appendChild(upl); rrow.appendChild(file); rrow.appendChild(err);
            right.appendChild(rrow);

            grid.appendChild(left); grid.appendChild(right);
            pane.appendChild(grid);

            const hint = el('div', 'cb-hint',
                'In your game: <code>SpriteRenderer.drawAvatar(ctx, x, y, { avatar, direction })</code> — pass this exact object as <code>avatar</code>.');
            pane.appendChild(hint);
        }

        _importFromText() {
            const raw = (this._els.importTa.value || '').trim();
            this._els.importErr.textContent = '';
            if (!raw) return;
            try {
                let obj;
                const m = raw.match(/[#&?]c=([A-Za-z0-9+/=_-]+)/);
                if (m) obj = decodeHash(m[1]);
                else obj = JSON.parse(raw);
                this.avatar = sanitize(obj);
                this._syncAll(true);
                this._els.importErr.textContent = '';
            } catch (e) {
                this._els.importErr.textContent = 'Invalid config';
            }
        }

        _download() {
            const blob = new Blob([this._els.exportTa.value], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = el('a'); a.href = url; a.download = 'avatar.json';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        _copyText(text, btn, okMsg) {
            const done = () => { if (btn) { const old = btn.textContent; btn.textContent = okMsg || 'Copied!'; setTimeout(() => btn.textContent = old, 1200); } };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(done, () => this._fallbackCopy(text, done));
            } else this._fallbackCopy(text, done);
        }
        _fallbackCopy(text, done) {
            const ta = el('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); done && done(); } catch (e) { }
            ta.remove();
        }
        _copyLink(btn) {
            const base = location.href.split('#')[0];
            this._copyText(base + '#c=' + encodeHash(this.avatar), btn, '🔗 Copied!');
        }

        // ── Reusable control builders ───────────────────────────────
        _section(title) {
            const wrap = el('div', 'cb-sec');
            const head = el('div', 'cb-sechead', title);
            const body = el('div', 'cb-secbody');
            wrap.appendChild(head); wrap.appendChild(body);
            return { wrap, body, head };
        }

        _checkbox(label, checked, onchange) {
            const wrap = el('label', 'cb-check');
            const input = el('input'); input.type = 'checkbox'; input.checked = !!checked;
            input.onchange = () => onchange(input.checked);
            wrap.appendChild(input); wrap.appendChild(el('span', null, label));
            return { wrap, input };
        }

        // Colorable part backed by a palette index + optional custom hex.
        _colorPart(parent, title, idxKey, customKey, presets, names) {
            const sec = this._section(title);
            const sw = el('div', 'cb-swatches');
            const swBtns = [];
            presets.forEach((hex, i) => {
                const b = el('button', 'cb-swatch');
                b.style.background = hex;
                b.title = names ? names[i] : hex;
                b.onclick = () => this._setIndex(idxKey, customKey, i);
                sw.appendChild(b); swBtns.push(b);
            });
            sec.body.appendChild(sw);

            const crow = el('div', 'cb-customrow');
            const picker = el('input', 'cb-picker'); picker.type = 'color';
            picker.oninput = () => this._setCustom(customKey, picker.value);
            const hexIn = el('input', 'cb-hex'); hexIn.type = 'text'; hexIn.maxLength = 7; hexIn.placeholder = '#custom';
            hexIn.onchange = () => { if (/^#[0-9a-fA-F]{6}$/.test(hexIn.value)) this._setCustom(customKey, hexIn.value.toLowerCase()); };
            const clr = el('button', 'cb-clear', '×'); clr.title = 'Use palette';
            clr.onclick = () => this._clearCustom(customKey);
            crow.appendChild(el('span', 'cb-mini', 'custom'));
            crow.appendChild(picker); crow.appendChild(hexIn); crow.appendChild(clr);
            sec.body.appendChild(crow);

            parent.appendChild(sec.wrap);
            return { idxKey, customKey, swBtns, picker, hexIn, presets };
        }

        // Color part that only has a custom hex (shoes / accessory) + our presets.
        _customOnlyColor(parent, title, customKey, presets, def) {
            const sec = this._section(title);
            const sw = el('div', 'cb-swatches');
            const swBtns = [];
            presets.forEach(hex => {
                const b = el('button', 'cb-swatch');
                b.style.background = hex; b.title = hex;
                b.onclick = () => this._setCustom(customKey, hex);
                sw.appendChild(b); swBtns.push(b);
            });
            sec.body.appendChild(sw);
            const crow = el('div', 'cb-customrow');
            const picker = el('input', 'cb-picker'); picker.type = 'color';
            picker.oninput = () => this._setCustom(customKey, picker.value);
            const hexIn = el('input', 'cb-hex'); hexIn.type = 'text'; hexIn.maxLength = 7;
            hexIn.onchange = () => { if (/^#[0-9a-fA-F]{6}$/.test(hexIn.value)) this._setCustom(customKey, hexIn.value.toLowerCase()); };
            const clr = el('button', 'cb-clear', '×'); clr.title = 'Default';
            clr.onclick = () => this._clearCustom(customKey);
            crow.appendChild(el('span', 'cb-mini', 'custom'));
            crow.appendChild(picker); crow.appendChild(hexIn); crow.appendChild(clr);
            sec.body.appendChild(crow);
            parent.appendChild(sec.wrap);
            return { customKey, swBtns, picker, hexIn, presets, def };
        }

        // Enumerated part (hair style, face, ...): chip grid + arrows.
        _choicePart(parent, title, idxKey, list) {
            const sec = this._section(title);
            const nav = el('div', 'cb-chipnav');
            const prev = el('button', 'cb-arrow', '‹');
            const next = el('button', 'cb-arrow', '›');
            const count = list.length;
            prev.onclick = () => this._set(idxKey, ((this.avatar[idxKey] || 0) - 1 + count) % count);
            next.onclick = () => this._set(idxKey, ((this.avatar[idxKey] || 0) + 1) % count);
            const chips = el('div', 'cb-chips');
            const chipBtns = [];
            list.forEach((name, i) => {
                const b = el('button', 'cb-chip', name);
                b.onclick = () => this._set(idxKey, i);
                chips.appendChild(b); chipBtns.push(b);
            });
            nav.appendChild(prev); nav.appendChild(chips); nav.appendChild(next);
            sec.body.appendChild(nav);
            parent.appendChild(sec.wrap);
            return { idxKey, chipBtns };
        }

        // ── Sync: model -> view ─────────────────────────────────────
        _syncAll(updateInputs) {
            this._syncControlValues();
            this._syncControlsActive();
            this._syncDirActive();
            this._syncExport();
            this._syncPreview();
            if (this._els.panes && this._els.panes.variations.classList.contains('on')) this._renderVariations();
            if (this.opts.syncHash !== false) writeHash(this.avatar);
            if (this.onChange && updateInputs) { try { this.onChange(clone(this.avatar)); } catch (e) { } }
        }

        _syncControlValues() {
            // Set color pickers/hex fields to reflect current custom or palette color.
            const parts = [
                [this._els.ctl.skin, 'skin', 'customSkin', SKIN.map(p => p[0])],
                [this._els.ctl.hair, 'hair', 'customHair', HAIRC],
                [this._els.ctl.shirt, 'shirt', 'customShirt', SHIRTC],
                [this._els.ctl.pants, 'pants', 'customPants', PANTSC],
            ];
            parts.forEach(([ctl, idxKey, customKey, presets]) => {
                if (!ctl) return;
                const active = this.avatar[customKey] || presets[this.avatar[idxKey] || 0] || '#000000';
                ctl.picker.value = toHex6(active);
                ctl.hexIn.value = this.avatar[customKey] ? this.avatar[customKey] : '';
            });
            const shoes = this._els.ctl.shoes, acc = this._els.ctl.acc;
            if (shoes) { shoes.picker.value = toHex6(this.avatar.customShoes || shoes.def); shoes.hexIn.value = this.avatar.customShoes || ''; }
            if (acc) { acc.picker.value = toHex6(this.avatar.customAccessory || acc.def); acc.hexIn.value = this.avatar.customAccessory || ''; }
        }

        _syncControlsActive() {
            const colorParts = [
                [this._els.ctl.skin, 'skin', 'customSkin'],
                [this._els.ctl.hair, 'hair', 'customHair'],
                [this._els.ctl.shirt, 'shirt', 'customShirt'],
                [this._els.ctl.pants, 'pants', 'customPants'],
            ];
            colorParts.forEach(([ctl, idxKey, customKey]) => {
                if (!ctl) return;
                const usingCustom = !!this.avatar[customKey];
                ctl.swBtns.forEach((b, i) => b.classList.toggle('on', !usingCustom && (this.avatar[idxKey] || 0) === i));
                ctl.picker.classList.toggle('active', usingCustom);
            });
            [[this._els.ctl.shoes, 'customShoes'], [this._els.ctl.acc, 'customAccessory']].forEach(([ctl, customKey]) => {
                if (!ctl) return;
                ctl.swBtns.forEach(b => b.classList.toggle('on', this.avatar[customKey] === b.style.background || rgbEq(b, this.avatar[customKey])));
                ctl.picker.classList.toggle('active', !!this.avatar[customKey]);
            });
            const choices = [['hairStyle'], ['face'], ['accessory'], ['shirtPattern']];
            choices.forEach(([k]) => {
                const ctl = this._els.ctl[k]; if (!ctl) return;
                ctl.chipBtns.forEach((b, i) => b.classList.toggle('on', (this.avatar[k] || 0) === i));
            });
        }

        _syncDirActive() {
            if (this._els.dirBtns) Object.keys(this._els.dirBtns).forEach(d =>
                this._els.dirBtns[d].classList.toggle('on', d === this.view.dir));
            if (this._els.rotCanvases) Object.keys(this._els.rotCanvases).forEach(d =>
                this._els.rotCanvases[d].parentElement.classList.toggle('on', d === this.view.dir));
        }

        _syncExport() {
            if (this._els.exportTa) this._els.exportTa.value = JSON.stringify(this.avatar, null, 2);
        }

        _currentPose() { return (POSES.find(p => p.id === this.view.poseId) || POSES[0]).pose; }

        _syncPreview() {
            const pose = this._currentPose();
            renderAvatar(this._els.stage, this.avatar, {
                direction: this.view.dir, zoom: 6, showName: this.view.showName,
                username: this.username, isWalking: this.view.walking && !pose, pose,
                frame: this.frame, bg: this.view.bg,
                equipped_item: this.view.prop !== 'none' ? this.view.prop : null, isLocal: true,
            });
        }

        _syncRotations() {
            if (!this.view.showRotations) return;
            const pose = this._currentPose();
            DIRECTIONS.forEach(d => {
                renderAvatar(this._els.rotCanvases[d], this.avatar, {
                    direction: d, zoom: 3, isWalking: this.view.walking && !pose, pose,
                    frame: this.frame, bg: 'transparent',
                    equipped_item: this.view.prop !== 'none' ? this.view.prop : null,
                });
            });
        }

        // ── Animation loop ──────────────────────────────────────────
        _loop() {
            const animating = this.view.walking || this.view.autorotate;
            if (animating) {
                this.frame += this.view.speed;
                if (this.view.autorotate && (this.frame % 30 | 0) === 0) {
                    // step direction every ~30 frames of accumulated motion
                }
                if (this.view.autorotate) {
                    this._autoAccum = (this._autoAccum || 0) + this.view.speed;
                    if (this._autoAccum >= 12) {
                        this._autoAccum = 0;
                        const i = DIRECTIONS.indexOf(this.view.dir);
                        this.view.dir = DIRECTIONS[(i + 1) % DIRECTIONS.length];
                        this._syncDirActive();
                    }
                }
                this._syncPreview();
                if (this.view.walking) this._syncRotations();
            }
            this._raf = requestAnimationFrame(this._loop);
        }
    }

    // ── Hash / share encoding ──────────────────────────────────────
    function encodeHash(avatar) {
        try { return b64e(JSON.stringify(avatar)); } catch (e) { return ''; }
    }
    function decodeHash(str) { return JSON.parse(b64d(str)); }
    function readHash() {
        const m = (location.hash || '').match(/[#&]c=([A-Za-z0-9+/=_-]+)/);
        if (!m) return null;
        try { return decodeHash(m[1]); } catch (e) { return null; }
    }
    let _hashTimer = null;
    function writeHash(avatar) {
        if (_hashTimer) clearTimeout(_hashTimer);
        _hashTimer = setTimeout(() => {
            try { history.replaceState(null, '', location.pathname + location.search + '#c=' + encodeHash(avatar)); } catch (e) { }
        }, 250);
    }
    function b64e(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
    function b64d(s) {
        s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
        return decodeURIComponent(escape(atob(s)));
    }

    function toHex6(c) {
        if (typeof c !== 'string') return '#000000';
        if (/^#[0-9a-fA-F]{6}$/.test(c)) return c;
        if (/^#[0-9a-fA-F]{3}$/.test(c)) return '#' + c.slice(1).split('').map(x => x + x).join('');
        return '#000000';
    }
    function rgbEq(btn, hex) {
        if (!hex) return false;
        // best-effort match for preset highlight
        return false;
    }

    // ── Styles (injected once) ─────────────────────────────────────
    let _stylesDone = false;
    function injectStyles() {
        if (_stylesDone) return; _stylesDone = true;
        const css = `
.cb, .cb * { box-sizing: border-box; }
.cb {
  --cb-bg:#0d0f13; --cb-panel:#161922; --cb-panel2:#1e2230; --cb-border:rgba(255,255,255,.10);
  --cb-ink:#f2f2ef; --cb-ink2:#9aa0ad; --cb-accent:#8b5cf6; --cb-accent2:#a78bfa;
  color:var(--cb-ink);
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; font-size:13px;
}
.cb-main { display:grid; grid-template-columns:minmax(300px,380px) 1fr; gap:16px; align-items:start; }
@media (max-width:820px){ .cb-main{ grid-template-columns:1fr; } }

.cb-preview { position:sticky; top:12px; background:var(--cb-panel); border:1px solid var(--cb-border);
  border-radius:16px; padding:14px; display:flex; flex-direction:column; gap:10px; }
@media (max-width:820px){ .cb-preview{ position:static; } }
.cb-stage { border-radius:12px; background:
  linear-gradient(0deg,rgba(139,92,246,.06),rgba(139,92,246,.06)),
  radial-gradient(120% 90% at 50% 20%,#1a1f2b,#0b0d12); display:grid; place-items:center;
  padding:10px; min-height:200px; overflow:hidden; }
.cb-canvas { image-rendering:auto; max-width:100%; height:auto; filter:drop-shadow(0 6px 12px rgba(0,0,0,.4)); }

.cb-compass { display:grid; grid-template-columns:repeat(3,1fr); gap:5px; }
.cb-dir { padding:7px 4px; font-size:10.5px; border-radius:8px; cursor:pointer;
  background:var(--cb-panel2); border:1px solid var(--cb-border); color:var(--cb-ink2);
  font-weight:600; transition:.12s; }
.cb-dir:hover { color:var(--cb-ink); border-color:var(--cb-accent); }
.cb-dir.on { background:var(--cb-accent); border-color:transparent; color:#fff; }
.cb-spin { color:var(--cb-ink2); font-size:15px; }
.cb-spin.on { background:var(--cb-accent2); color:#fff; }

.cb-animrow, .cb-viewrow, .cb-bgrow { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.cb-toggle { padding:6px 10px; border-radius:8px; cursor:pointer; background:var(--cb-panel2);
  border:1px solid var(--cb-border); color:var(--cb-ink); font-weight:600; font-size:12px; }
.cb-toggle.on { background:var(--cb-accent); border-color:transparent; color:#fff; }
.cb-seg { display:inline-flex; background:var(--cb-panel2); border:1px solid var(--cb-border); border-radius:8px; overflow:hidden; }
.cb-seg-btn { padding:6px 10px; cursor:pointer; background:transparent; border:0; color:var(--cb-ink2); font-size:12px; font-weight:600; }
.cb-seg-btn.on { background:var(--cb-accent); color:#fff; }
.cb-speed { flex:1; min-width:80px; accent-color:var(--cb-accent); }
.cb-mini { font-size:11px; color:var(--cb-ink2); text-transform:uppercase; letter-spacing:.4px; }
.cb-check { display:inline-flex; align-items:center; gap:5px; font-size:12px; color:var(--cb-ink2); cursor:pointer; }
.cb-check input { accent-color:var(--cb-accent); }
.cb-bg { padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer; background:var(--cb-panel2);
  border:1px solid var(--cb-border); color:var(--cb-ink2); }
.cb-bg.on { border-color:var(--cb-accent); color:var(--cb-ink); }

.cb-rotations { display:grid; grid-template-columns:repeat(8,1fr); gap:4px; background:var(--cb-panel2);
  border:1px solid var(--cb-border); border-radius:10px; padding:6px; }
.cb-rotcell { display:flex; flex-direction:column; align-items:center; gap:2px; cursor:pointer;
  border-radius:6px; padding:2px 0; border:1px solid transparent; }
.cb-rotcell:hover { background:rgba(255,255,255,.05); }
.cb-rotcell.on { border-color:var(--cb-accent); background:rgba(139,92,246,.12); }
.cb-rotcell canvas { width:100%; height:auto; }
.cb-rotlbl { font-size:9px; color:var(--cb-ink2); font-weight:700; }

.cb-actions { display:flex; gap:8px; flex-wrap:wrap; }
.cb-btn { padding:8px 12px; border-radius:9px; cursor:pointer; background:var(--cb-panel2);
  border:1px solid var(--cb-border); color:var(--cb-ink); font-weight:600; font-size:12.5px; }
.cb-btn:hover { border-color:var(--cb-accent); }
.cb-primary { background:var(--cb-accent); border-color:transparent; color:#fff; }
.cb-primary:hover { background:var(--cb-accent2); }

.cb-controls { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:10px; align-content:start; }
.cb-sec { background:var(--cb-panel); border:1px solid var(--cb-border); border-radius:12px; padding:10px 11px; }
.cb-sechead { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:var(--cb-ink2); margin-bottom:8px; }
.cb-secbody { display:flex; flex-direction:column; gap:8px; }
.cb-text { width:100%; padding:7px 9px; border-radius:8px; background:var(--cb-panel2);
  border:1px solid var(--cb-border); color:var(--cb-ink); font-size:13px; }

.cb-swatches { display:flex; flex-wrap:wrap; gap:5px; }
.cb-swatch { width:24px; height:24px; border-radius:6px; cursor:pointer; border:2px solid rgba(255,255,255,.12); padding:0; }
.cb-swatch:hover { transform:scale(1.08); }
.cb-swatch.on { border-color:#fff; box-shadow:0 0 0 2px var(--cb-accent); }
.cb-customrow { display:flex; align-items:center; gap:6px; }
.cb-picker { width:30px; height:26px; border:1px solid var(--cb-border); border-radius:6px; background:none; cursor:pointer; padding:0; }
.cb-picker.active { box-shadow:0 0 0 2px var(--cb-accent); border-color:transparent; }
.cb-hex { width:78px; padding:5px 7px; border-radius:6px; background:var(--cb-panel2); border:1px solid var(--cb-border); color:var(--cb-ink); font-size:12px; font-family:ui-monospace,monospace; }
.cb-clear { width:24px; height:24px; border-radius:6px; cursor:pointer; background:var(--cb-panel2); border:1px solid var(--cb-border); color:var(--cb-ink2); font-size:14px; line-height:1; }
.cb-clear:hover { color:var(--cb-ink); border-color:var(--cb-accent); }

.cb-chipnav { display:flex; align-items:stretch; gap:6px; }
.cb-arrow { width:26px; border-radius:7px; cursor:pointer; background:var(--cb-panel2); border:1px solid var(--cb-border); color:var(--cb-ink); font-size:15px; flex:none; }
.cb-arrow:hover { border-color:var(--cb-accent); }
.cb-chips { display:flex; flex-wrap:wrap; gap:5px; flex:1; }
.cb-chip { padding:5px 9px; border-radius:20px; cursor:pointer; background:var(--cb-panel2);
  border:1px solid var(--cb-border); color:var(--cb-ink2); font-size:11.5px; font-weight:600; text-transform:capitalize; }
.cb-chip:hover { color:var(--cb-ink); }
.cb-chip.on { background:var(--cb-accent); border-color:transparent; color:#fff; }

.cb-extras { margin-top:16px; }
.cb-tabs { display:flex; gap:4px; border-bottom:1px solid var(--cb-border); margin-bottom:12px; }
.cb-tab { padding:9px 16px; cursor:pointer; background:none; border:0; border-bottom:2px solid transparent;
  color:var(--cb-ink2); font-weight:700; font-size:13px; }
.cb-tab.on { color:var(--cb-ink); border-bottom-color:var(--cb-accent); }
.cb-pane { display:none; } .cb-pane.on { display:block; }

.cb-varbar { display:flex; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap; }
.cb-select { padding:7px 10px; border-radius:8px; background:var(--cb-panel2); border:1px solid var(--cb-border); color:var(--cb-ink); font-size:13px; font-weight:600; }
.cb-vargrid, .cb-gallery { display:grid; grid-template-columns:repeat(auto-fill,minmax(90px,1fr)); gap:8px; }
.cb-varcell, .cb-gcell { background:var(--cb-panel); border:1px solid var(--cb-border); border-radius:10px;
  padding:6px; display:flex; flex-direction:column; align-items:center; gap:3px; cursor:pointer; transition:.12s; }
.cb-varcell:hover, .cb-gcell:hover { border-color:var(--cb-accent); transform:translateY(-2px); }
.cb-varcell.on { border-color:var(--cb-accent); background:rgba(139,92,246,.12); }
.cb-varcell canvas, .cb-gcell canvas { width:100%; height:auto; }
.cb-varlbl { font-size:10.5px; color:var(--cb-ink2); font-weight:600; text-transform:capitalize; text-align:center; }

.cb-io { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
@media (max-width:700px){ .cb-io{ grid-template-columns:1fr; } }
.cb-iocol { display:flex; flex-direction:column; gap:8px; }
.cb-iolbl { font-size:11px; font-weight:700; color:var(--cb-ink2); text-transform:uppercase; letter-spacing:.4px; }
.cb-json { width:100%; min-height:160px; resize:vertical; padding:10px; border-radius:10px;
  background:var(--cb-panel2); border:1px solid var(--cb-border); color:var(--cb-ink);
  font-family:ui-monospace,SFMono-Regular,monospace; font-size:12px; line-height:1.5; }
.cb-iorow { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.cb-err { color:#f87171; font-size:12px; font-weight:600; }
.cb-hint { margin-top:14px; font-size:12px; color:var(--cb-ink2); }
.cb-hint code { background:var(--cb-panel2); padding:2px 6px; border-radius:5px; color:var(--cb-accent2); font-size:11.5px; }
`;
        const style = document.createElement('style');
        style.setAttribute('data-cb', '');
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ── Exports ────────────────────────────────────────────────────
    global.CharacterBuilder = CharacterBuilder;
    global.SpriteAvatar = {
        render: renderAvatar,
        random: makeRandom,
        default: makeDefault,
        sanitize,
        encode: encodeHash,
        decode: decodeHash,
        DIRECTIONS,
        options: {
            skin: SKIN_NAMES, hairStyle: HAIR_S, face: FACES,
            accessory: ACCS, shirtPattern: PATTERNS,
            hairColors: HAIRC, shirtColors: SHIRTC, pantsColors: PANTSC,
        },
    };
})(window);
