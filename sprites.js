// ═══════════════════════════════════════════════════════════════
// Sprites — Procedural avatar rendering (Habbo-style)
//  Expanded: hair styles, face expressions, accessories, shirt patterns
// ═══════════════════════════════════════════════════════════════

const SKIN_PALETTES = [
    ['#f5d0a9', '#e8b88a', '#d4a06e'],  // Light
    ['#deb887', '#c9a06a', '#b08850'],  // Medium
    ['#a0785a', '#8a6548', '#705038'],  // Dark
    ['#6b4226', '#553418', '#402810'],  // Deep
];

const HAIR_COLORS = ['#2c1810', '#4a3020', '#8b6914', '#d4a030', '#c0392b', '#7d3c98', '#2c3e50', '#ecf0f1'];
const SHIRT_COLORS = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#8b5cf6'];
const PANTS_COLORS = ['#2c3e50', '#34495e', '#1a252f', '#4a4a6a', '#2d2d44', '#3d3050', '#283028', '#2a2a3a'];

// Hair style names for UI
const HAIR_STYLES = ['short', 'spiky', 'long', 'bald', 'mohawk', 'curly',
    'ponytail', 'buzz', 'afro', 'bun', 'emo'];
// Face expression names for UI
const FACE_TYPES = ['neutral', 'smile', 'happy', 'cool',
    'wink', 'surprised', 'angry', 'sleepy'];
// Accessory names for UI
const ACCESSORIES = ['none', 'glasses', 'sunglasses', 'hat', 'headband', 'earring',
    'mask', 'beard', 'eyepatch'];
// Shirt pattern names for UI
const SHIRT_PATTERNS = ['solid', 'stripes', 'vneck', 'collar', 'dots', 'chevron'];


class SpriteRenderer {
    /**
     * Draw a Habbo-style isometric avatar
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x - Center X on screen
     * @param {number} y - Base Y on screen (bottom of tile)
     * @param {object} player - { username, avatar, direction, walkFrame }
     * @param {boolean} isLocal
     */
    static drawAvatar(ctx, x, y, player, isLocal = false) {
        const avatar = player.avatar || {};
        const skinIdx = (avatar.skin || 0) % SKIN_PALETTES.length;
        const hairIdx = (avatar.hair || 0) % HAIR_COLORS.length;
        const shirtIdx = (avatar.shirt || 0) % SHIRT_COLORS.length;
        const pantsIdx = (avatar.pants || 0) % PANTS_COLORS.length;
        const hairStyle = (avatar.hairStyle || 0) % HAIR_STYLES.length;
        const faceType = (avatar.face || 0) % FACE_TYPES.length;
        const accessory = (avatar.accessory || 0) % ACCESSORIES.length;
        const shirtPattern = (avatar.shirtPattern || 0) % SHIRT_PATTERNS.length;

        // Resolve colors — custom hex overrides palette index
        const skin = avatar.customSkin
            ? [avatar.customSkin, SpriteRenderer._darken(avatar.customSkin, 20), SpriteRenderer._darken(avatar.customSkin, 40)]
            : SKIN_PALETTES[skinIdx];
        const hairColor = avatar.customHair || HAIR_COLORS[hairIdx];
        const shirtColor = avatar.customShirt || SHIRT_COLORS[shirtIdx];
        const pantsColor = avatar.customPants || PANTS_COLORS[pantsIdx];
        const shoeColor = avatar.customShoes || '#1a1a2e';
        const accColor = avatar.customAccessory || '#e74c3c';

        const dir = player.direction || 'S';
        const frame = player.walkFrame || 0;
        const isWalking = player.isWalking || false;
        const isFacingBack = (dir === 'N' || dir === 'NW' || dir === 'NE');
        const pose = player.pose || null; // "sit", "lay_down", or null

        // Walking bob (disabled when posing)
        const bob = (isWalking && !pose) ? Math.sin(frame * 0.4) * 2 : 0;
        const sitDrop = (pose === 'sit') ? 8 : 0; // Lower body when sitting
        const baseY = y - 28 + bob + sitDrop;

        ctx.save();

        if (pose === 'lay_down') {
            // Lay down: rotate the whole avatar 90° around the base point
            ctx.translate(x, y);
            ctx.rotate(-Math.PI / 2);
            ctx.translate(-x, -y);
        }

        // Shadow
        ctx.beginPath();
        if (pose === 'lay_down') {
            ctx.ellipse(x, y, 6, 16, 0, 0, Math.PI * 2);
        } else {
            ctx.ellipse(x, y, 12, 6, 0, 0, Math.PI * 2);
        }
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fill();

        if (pose === 'sit') {
            // ── SITTING POSE ──
            // Legs bent forward (shorter, horizontal)
            ctx.fillStyle = pantsColor;
            ctx.fillRect(x - 5, baseY + 18, 5, 6);  // Left upper leg
            ctx.fillRect(x, baseY + 18, 5, 6);       // Right upper leg
            // Lower legs (dangling forward)
            ctx.fillRect(x - 6, baseY + 24, 5, 6);
            ctx.fillRect(x + 1, baseY + 24, 5, 6);
            // Shoes
            ctx.fillStyle = shoeColor;
            ctx.fillRect(x - 7, baseY + 29, 6, 3);
            ctx.fillRect(x + 1, baseY + 29, 6, 3);
        } else {
            // ── STANDING/WALKING LEGS ──
            const legSpread = isWalking ? Math.sin(frame * 0.4) * 3 : 0;
            ctx.fillStyle = pantsColor;
            ctx.fillRect(x - 5 - legSpread, baseY + 20, 5, 10);
            ctx.fillRect(x + legSpread, baseY + 20, 5, 10);
            // Shoes
            ctx.fillStyle = shoeColor;
            ctx.fillRect(x - 6 - legSpread, baseY + 28, 7, 4);
            ctx.fillRect(x - 1 + legSpread, baseY + 28, 7, 4);
        }

        // ── Body / Shirt ──
        SpriteRenderer._drawShirt(ctx, x, baseY, shirtColor, shirtPattern);

        // ── Arms ──
        // Check for prop arm overrides (direction-aware)
        let propArmOverrides = null;
        let _propForArms = null;
        if (player.equipped_item && window.PROP_CATALOG) {
            const prop = window.PROP_CATALOG[player.equipped_item];
            _propForArms = prop;
            if (prop && prop.pose_data) {
                const dir = player.direction || 'S';
                const isLeft = (dir === 'W' || dir === 'SW' || dir === 'NW');
                const isBack = (dir === 'N' || dir === 'NW' || dir === 'NE');
                const isSide = (dir === 'E' || dir === 'W');

                // Action-based pose key: 'hold', 'interact', or 'reload'
                const action = player.prop_action || 'hold';

                // Determine direction group and look up pose
                let dirPose = null;
                if (isBack && prop.pose_data['back_' + action]) {
                    dirPose = prop.pose_data['back_' + action];
                } else if (isSide && prop.pose_data['side_' + action]) {
                    dirPose = prop.pose_data['side_' + action];
                }

                if (dirPose) {
                    propArmOverrides = dirPose;
                } else if (prop.pose_data[action]) {
                    propArmOverrides = prop.pose_data[action];
                } else if (prop.pose_data.hold) {
                    // Fallback to hold if action-specific pose doesn't exist
                    propArmOverrides = prop.pose_data.hold;
                }
            }
        }

        if (pose === 'sit') {
            // Arms resting on lap
            ctx.fillStyle = shirtColor;
            ctx.save();
            ctx.translate(x - 8, baseY + 6);
            ctx.rotate(-5 * Math.PI / 180);
            ctx.fillRect(-3, 0, 4, 12);
            ctx.fillStyle = skin[0];
            ctx.fillRect(-2, 10, 3, 4);
            ctx.restore();
            ctx.fillStyle = shirtColor;
            ctx.save();
            ctx.translate(x + 8, baseY + 6);
            ctx.rotate(5 * Math.PI / 180);
            ctx.fillRect(-1, 0, 4, 12);
            ctx.fillStyle = skin[0];
            ctx.fillRect(0, 10, 3, 4);
            ctx.restore();
        } else {
            const armSwing = isWalking ? Math.sin(frame * 0.4) * 8 : 0;
            let leftArmAngle = propArmOverrides ? propArmOverrides.left_arm : (-15 + armSwing);
            let rightArmAngle = propArmOverrides ? propArmOverrides.right_arm : (15 - armSwing);
            // Read arm lengths from pose data
            let leftArmLenPct = propArmOverrides ? (propArmOverrides.left_arm_len != null ? propArmOverrides.left_arm_len : 100) : 100;
            let rightArmLenPct = propArmOverrides ? (propArmOverrides.right_arm_len != null ? propArmOverrides.right_arm_len : 100) : 100;

            // Mirror arm angles when facing left with flip_h prop (only for front fallback, not custom dir poses)
            if (propArmOverrides && _propForArms) {
                const dir = player.direction || 'S';
                const isLeft = (dir === 'W' || dir === 'SW' || dir === 'NW');
                const isBack = (dir === 'N' || dir === 'NW' || dir === 'NE');
                const isSide = (dir === 'E' || dir === 'W');
                const hasCustomDir = (isBack && _propForArms.pose_data.back_hold) || (isSide && _propForArms.pose_data.side_hold);

                // Only mirror if using front fallback (no custom direction pose)
                if (!hasCustomDir && (isLeft || isBack) && _propForArms.flip_h !== false) {
                    const tmpR = rightArmAngle;
                    rightArmAngle = -propArmOverrides.left_arm;
                    leftArmAngle = -tmpR;
                    // Also swap arm lengths
                    const tmpLen = rightArmLenPct;
                    rightArmLenPct = leftArmLenPct;
                    leftArmLenPct = tmpLen;
                }
            }

            const leftArmH = Math.round(14 * leftArmLenPct / 100);
            const rightArmH = Math.round(14 * rightArmLenPct / 100);

            ctx.fillStyle = shirtColor;
            // Left arm
            ctx.save();
            ctx.translate(x - 8, baseY + 6);
            ctx.rotate(leftArmAngle * Math.PI / 180);
            ctx.fillRect(-3, 0, 4, leftArmH);
            ctx.fillStyle = skin[0];
            ctx.fillRect(-2, leftArmH - 2, 3, 4);
            ctx.restore();

            // Right arm
            ctx.fillStyle = shirtColor;
            ctx.save();
            ctx.translate(x + 8, baseY + 6);
            ctx.rotate(rightArmAngle * Math.PI / 180);
            ctx.fillRect(-1, 0, 4, rightArmH);
            ctx.fillStyle = skin[0];
            ctx.fillRect(0, rightArmH - 2, 3, 4);
            ctx.restore();
        }

        // ── Head ──
        ctx.fillStyle = skin[0];
        SpriteRenderer._roundRect(ctx, x - 7, baseY - 12, 14, 16, 5);
        ctx.fill();
        // Face outline
        ctx.strokeStyle = skin[2];
        ctx.lineWidth = 0.5;
        SpriteRenderer._roundRect(ctx, x - 7, baseY - 12, 14, 16, 5);
        ctx.stroke();

        // ── Face ──
        if (!isFacingBack) {
            SpriteRenderer._drawFace(ctx, x, baseY, dir, faceType);
        }

        // ── Hair ──
        SpriteRenderer._drawHair(ctx, x, baseY, hairColor, hairStyle, dir);

        // ── Accessories ──
        SpriteRenderer._drawAccessory(ctx, x, baseY, dir, accessory, skin, accColor);

        // ── Equipped Items (Guns) ──
        if (player.equipped_item) {
            SpriteRenderer._drawEquippedItem(ctx, x, baseY, dir, player.equipped_item, frame, isWalking, pose);
        }

        // ── Name tag ──
        let rawName = player.username || 'Player';
        // nombre completo (email o IP); solo se recorta si es larguísimo
        const name = rawName.length > 22 ? rawName.slice(0, 21) + '…' : rawName;
        ctx.font = '800 11px Inter, sans-serif';
        const nameWidth = ctx.measureText(name).width;

        const tagX = x - nameWidth / 2 - 5;
        const tagY = baseY - 40;
        ctx.fillStyle = isLocal ? 'rgba(139, 92, 246, 0.8)' : 'rgba(0, 0, 0, 0.65)';
        SpriteRenderer._roundRect(ctx, tagX, tagY, nameWidth + 10, 16, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(name, x, tagY + 12);

        // ── Chat bubble / Status icon / Typing indicator ──
        if (player.chatBubble && player.chatBubble.text) {
            SpriteRenderer._drawBubble(ctx, x, tagY - 8, player.chatBubble.text);
        }
        else if (player.statusIcon) {
            SpriteRenderer._drawStatusIcon(ctx, x, tagY - 8, player.statusIcon, performance.now());
        }
        else if (player.isTyping) {
            SpriteRenderer._drawTypingIndicator(ctx, x, tagY - 8, performance.now());
        }

        ctx.restore();
    }

    // ══════════════════════════════════════════════════════════
    // Shirt Rendering (with patterns)
    // ══════════════════════════════════════════════════════════

    static _drawShirt(ctx, x, baseY, shirtColor, pattern) {
        // Base torso
        ctx.fillStyle = shirtColor;
        SpriteRenderer._roundRect(ctx, x - 8, baseY + 4, 16, 18, 3);
        ctx.fill();

        const darker = SpriteRenderer._darken(shirtColor, 25);
        const lighter = SpriteRenderer._lighten(shirtColor, 30);

        switch (pattern) {
            case 0: // solid — just collar
                ctx.fillStyle = darker;
                ctx.fillRect(x - 3, baseY + 4, 6, 3);
                break;

            case 1: // stripes — horizontal lines
                ctx.fillStyle = darker;
                ctx.fillRect(x - 3, baseY + 4, 6, 3); // collar
                ctx.fillStyle = SpriteRenderer._darken(shirtColor, 55);
                ctx.globalAlpha = 0.85;
                for (let i = 0; i < 3; i++) {
                    ctx.fillRect(x - 6, baseY + 9 + i * 5, 12, 2);
                }
                ctx.globalAlpha = 1.0;
                break;

            case 2: // v-neck
                ctx.fillStyle = darker;
                // V shape collar
                ctx.beginPath();
                ctx.moveTo(x - 4, baseY + 4);
                ctx.lineTo(x, baseY + 10);
                ctx.lineTo(x + 4, baseY + 4);
                ctx.closePath();
                ctx.fill();
                // Inner skin peek
                ctx.beginPath();
                ctx.moveTo(x - 3, baseY + 4);
                ctx.lineTo(x, baseY + 9);
                ctx.lineTo(x + 3, baseY + 4);
                ctx.closePath();
                ctx.fillStyle = SpriteRenderer._darken(shirtColor, 40);
                ctx.fill();
                break;

            case 3: // polo collar
                // Collar wings
                ctx.fillStyle = lighter;
                ctx.fillRect(x - 5, baseY + 3, 4, 4);
                ctx.fillRect(x + 1, baseY + 3, 4, 4);
                // Collar outline
                ctx.fillStyle = darker;
                ctx.fillRect(x - 1, baseY + 4, 2, 5);
                // Two small buttons
                ctx.fillStyle = lighter;
                ctx.fillRect(x - 0.5, baseY + 10, 1, 1);
                ctx.fillRect(x - 0.5, baseY + 13, 1, 1);
                break;

            case 4: // dots
                ctx.fillStyle = darker;
                ctx.fillRect(x - 3, baseY + 4, 6, 3); // collar
                ctx.fillStyle = SpriteRenderer._lighten(shirtColor, 70); ctx.globalAlpha = 0.95;
                for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
                    ctx.beginPath(); ctx.arc(x - 4 + c * 4, baseY + 9 + r * 4, 1.2, 0, Math.PI * 2); ctx.fill();
                }
                ctx.globalAlpha = 1;
                break;

            case 5: // chevron
                ctx.fillStyle = darker;
                ctx.fillRect(x - 3, baseY + 4, 6, 3);
                ctx.strokeStyle = SpriteRenderer._darken(shirtColor, 55); ctx.lineWidth = 1.6; ctx.globalAlpha = 0.95;
                for (let i = 0; i < 3; i++) {
                    const yy = baseY + 9 + i * 4;
                    ctx.beginPath(); ctx.moveTo(x - 6, yy); ctx.lineTo(x, yy - 2); ctx.lineTo(x + 6, yy); ctx.stroke();
                }
                ctx.globalAlpha = 1;
                break;
        }
    }

    // ══════════════════════════════════════════════════════════
    // Face Rendering (expressions)
    // ══════════════════════════════════════════════════════════

    static _drawFace(ctx, x, baseY, dir, faceType) {
        // Calculate eye positions based on direction
        let leftEyeX, rightEyeX;
        if (dir === 'W' || dir === 'SW') {
            leftEyeX = x - 5; rightEyeX = x - 1;
        } else if (dir === 'E' || dir === 'SE') {
            leftEyeX = x - 1; rightEyeX = x + 3;
        } else {
            leftEyeX = x - 4; rightEyeX = x + 2;
        }

        const eyeY = baseY - 4;

        switch (faceType) {
            case 0: // neutral — simple dot eyes, no mouth
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(leftEyeX, eyeY, 2, 2);
                ctx.fillRect(rightEyeX, eyeY, 2, 2);
                break;

            case 1: // smile — dot eyes + smile arc
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(leftEyeX, eyeY, 2, 2);
                ctx.fillRect(rightEyeX, eyeY, 2, 2);
                // Small smile
                ctx.beginPath();
                ctx.arc(x, eyeY + 5, 3, 0.1 * Math.PI, 0.9 * Math.PI);
                ctx.strokeStyle = '#1a1a2e';
                ctx.lineWidth = 0.8;
                ctx.stroke();
                break;

            case 2: // happy — open round eyes + open mouth
                ctx.fillStyle = '#1a1a2e';
                // Round eyes
                ctx.beginPath();
                ctx.arc(leftEyeX + 1, eyeY + 1, 1.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(rightEyeX + 1, eyeY + 1, 1.5, 0, Math.PI * 2);
                ctx.fill();
                // Small white highlights
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(leftEyeX + 1, eyeY, 1, 1);
                ctx.fillRect(rightEyeX + 1, eyeY, 1, 1);
                // Open smile
                ctx.beginPath();
                ctx.arc(x, eyeY + 5, 2.5, 0, Math.PI);
                ctx.fillStyle = '#1a1a2e';
                ctx.fill();
                break;

            case 3: // cool — half-closed eyes, smirk
                ctx.fillStyle = '#1a1a2e';
                // Horizontal slit eyes
                ctx.fillRect(leftEyeX, eyeY + 1, 3, 1);
                ctx.fillRect(rightEyeX, eyeY + 1, 3, 1);
                // Little eyebrow raise on one side
                ctx.fillRect(rightEyeX, eyeY - 1, 3, 0.8);
                // Smirk (asymmetric)
                ctx.beginPath();
                ctx.moveTo(x - 2, eyeY + 5);
                ctx.quadraticCurveTo(x + 1, eyeY + 7, x + 3, eyeY + 4);
                ctx.strokeStyle = '#1a1a2e';
                ctx.lineWidth = 0.8;
                ctx.stroke();
                break;

            case 4: // wink — one eye closed, small smile
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(leftEyeX, eyeY, 2, 2);
                ctx.fillRect(rightEyeX, eyeY + 1, 3, 1);
                ctx.beginPath();
                ctx.arc(x, eyeY + 5, 3, 0.1 * Math.PI, 0.9 * Math.PI);
                ctx.strokeStyle = '#1a1a2e';
                ctx.lineWidth = 0.8;
                ctx.stroke();
                break;

            case 5: // surprised — wide round eyes, small "o" mouth
                ctx.fillStyle = '#1a1a2e';
                ctx.beginPath(); ctx.arc(leftEyeX + 1, eyeY + 1, 1.6, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(rightEyeX + 1, eyeY + 1, 1.6, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(leftEyeX + 1, eyeY, 1, 1);
                ctx.fillRect(rightEyeX + 1, eyeY, 1, 1);
                ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 0.8;
                ctx.beginPath(); ctx.arc(x, eyeY + 6, 1.5, 0, Math.PI * 2); ctx.stroke();
                break;

            case 6: // angry — slanted brows, frown
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(leftEyeX, eyeY + 0.5, 2, 2);
                ctx.fillRect(rightEyeX, eyeY + 0.5, 2, 2);
                ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(leftEyeX - 1, eyeY - 2.5); ctx.lineTo(leftEyeX + 2.5, eyeY - 1);
                ctx.moveTo(rightEyeX + 3, eyeY - 2.5); ctx.lineTo(rightEyeX - 0.5, eyeY - 1);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(x, eyeY + 7.5, 3, 1.15 * Math.PI, 1.85 * Math.PI);
                ctx.stroke();
                break;

            case 7: // sleepy — half-closed lids
                ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(leftEyeX + 1, eyeY + 1, 1.7, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
                ctx.beginPath(); ctx.arc(rightEyeX + 1, eyeY + 1, 1.7, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(x - 1, eyeY + 5, 2, 1);
                break;
        }
    }

    // ══════════════════════════════════════════════════════════
    // Hair Rendering (styles)
    // ══════════════════════════════════════════════════════════

    static _drawHair(ctx, x, baseY, hairColor, hairStyle, dir) {
        const isFacingBack = (dir === 'N' || dir === 'NW' || dir === 'NE');
        ctx.fillStyle = hairColor;

        // De espaldas se ve la nuca: cubrir toda la cabeza con pelo
        // (salvo calvo). Los detalles del peinado se dibujan encima.
        if (isFacingBack && hairStyle !== 3) {
            SpriteRenderer._roundRect(ctx, x - 8, baseY - 14, 16, 18, 5);
            ctx.fill();
            ctx.fillStyle = hairColor;
        }

        switch (hairStyle) {
            case 0: // short — classic
                SpriteRenderer._roundRect(ctx, x - 8, baseY - 15, 16, 8, 4);
                ctx.fill();
                if (dir !== 'N') {
                    if (dir === 'W' || dir === 'SW' || dir === 'NW' || dir === 'S') {
                        ctx.fillRect(x - 8, baseY - 10, 3, 8);
                    }
                    if (dir === 'E' || dir === 'SE' || dir === 'NE' || dir === 'S') {
                        ctx.fillRect(x + 5, baseY - 10, 3, 8);
                    }
                }
                break;

            case 1: // spiky — jagged top
                // Spikes
                ctx.beginPath();
                ctx.moveTo(x - 8, baseY - 8);
                ctx.lineTo(x - 6, baseY - 18);
                ctx.lineTo(x - 3, baseY - 10);
                ctx.lineTo(x - 1, baseY - 20);
                ctx.lineTo(x + 2, baseY - 11);
                ctx.lineTo(x + 5, baseY - 19);
                ctx.lineTo(x + 8, baseY - 9);
                ctx.lineTo(x + 8, baseY - 8);
                ctx.closePath();
                ctx.fill();
                // Base cover
                SpriteRenderer._roundRect(ctx, x - 8, baseY - 12, 16, 5, 3);
                ctx.fill();
                break;

            case 2: // long — flowing down
                SpriteRenderer._roundRect(ctx, x - 9, baseY - 15, 18, 9, 4);
                ctx.fill();
                // Flowing sides
                if (dir === 'W' || dir === 'SW' || dir === 'NW' || dir === 'S') {
                    SpriteRenderer._roundRect(ctx, x - 9, baseY - 10, 4, 18, 2);
                    ctx.fill();
                }
                if (dir === 'E' || dir === 'SE' || dir === 'NE' || dir === 'S') {
                    SpriteRenderer._roundRect(ctx, x + 5, baseY - 10, 4, 18, 2);
                    ctx.fill();
                }
                // Back flow if facing front
                if (!isFacingBack) {
                    ctx.globalAlpha = 0.6;
                    SpriteRenderer._roundRect(ctx, x - 7, baseY - 8, 14, 14, 3);
                    ctx.fill();
                    ctx.globalAlpha = 1.0;
                }
                break;

            case 3: // bald — no hair, just a subtle shine on head
                ctx.fillStyle = 'rgba(255,255,255,0.15)';
                ctx.beginPath();
                ctx.ellipse(x - 1, baseY - 8, 3, 2, -0.3, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 4: // mohawk — center ridge
                // Center tall mohawk
                ctx.beginPath();
                ctx.moveTo(x - 3, baseY - 10);
                ctx.lineTo(x - 2, baseY - 22);
                ctx.lineTo(x + 2, baseY - 22);
                ctx.lineTo(x + 3, baseY - 10);
                ctx.closePath();
                ctx.fill();
                // Slight taper at top
                const mohawkDarker = SpriteRenderer._darken(hairColor, 20);
                ctx.fillStyle = mohawkDarker;
                ctx.fillRect(x - 1, baseY - 22, 2, 3);
                // Shaved sides
                ctx.fillStyle = 'rgba(0,0,0,0.15)';
                ctx.fillRect(x - 7, baseY - 12, 4, 4);
                ctx.fillRect(x + 3, baseY - 12, 4, 4);
                break;

            case 5: // curly — bumpy rounded shapes
                ctx.fillStyle = hairColor;
                const bumps = [
                    [-7, -14, 5], [-2, -16, 5], [3, -15, 5],
                    [-8, -10, 4], [6, -10, 4],
                ];
                for (const [bx, by, r] of bumps) {
                    ctx.beginPath();
                    ctx.arc(x + bx, baseY + by, r, 0, Math.PI * 2);
                    ctx.fill();
                }
                // Side curls
                if (dir !== 'N') {
                    if (dir === 'W' || dir === 'SW' || dir === 'NW' || dir === 'S') {
                        ctx.beginPath();
                        ctx.arc(x - 8, baseY - 5, 3, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    if (dir === 'E' || dir === 'SE' || dir === 'NE' || dir === 'S') {
                        ctx.beginPath();
                        ctx.arc(x + 8, baseY - 5, 3, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
                break;

            case 6: { // ponytail
                ctx.fillStyle = hairColor;
                SpriteRenderer._roundRect(ctx, x - 8, baseY - 15, 16, 8, 4); ctx.fill();
                ctx.beginPath();
                ctx.ellipse(x + (isFacingBack ? 0 : 7), baseY - 3, 2.6, 6, isFacingBack ? 0 : -0.35, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = SpriteRenderer._darken(hairColor, 30);
                ctx.fillRect(x + (isFacingBack ? -2 : 5), baseY - 9, 4, 2);
                break;
            }

            case 7: { // buzz — very short / stubble
                ctx.globalAlpha = 0.85; ctx.fillStyle = hairColor;
                SpriteRenderer._roundRect(ctx, x - 7, baseY - 14, 14, 6, 3); ctx.fill();
                ctx.globalAlpha = 0.4;
                for (let i = 0; i < 10; i++) ctx.fillRect(x - 6 + (i % 5) * 3, baseY - 13 + Math.floor(i / 5) * 3, 1, 1);
                ctx.globalAlpha = 1;
                break;
            }

            case 8: { // afro
                ctx.fillStyle = hairColor;
                const puffs = [[-6, -13, 6], [0, -15, 7], [6, -13, 6], [-8, -8, 5], [8, -8, 5], [0, -10, 7]];
                for (const p of puffs) { ctx.beginPath(); ctx.arc(x + p[0], baseY + p[1], p[2], 0, Math.PI * 2); ctx.fill(); }
                break;
            }

            case 9: { // bun — top knot
                ctx.fillStyle = hairColor;
                SpriteRenderer._roundRect(ctx, x - 8, baseY - 14, 16, 7, 4); ctx.fill();
                ctx.beginPath(); ctx.arc(x, baseY - 16.5, 3.5, 0, Math.PI * 2); ctx.fill();
                if (dir === 'W' || dir === 'SW' || dir === 'S' || dir === 'NW') ctx.fillRect(x - 8, baseY - 10, 3, 6);
                if (dir === 'E' || dir === 'SE' || dir === 'S' || dir === 'NE') ctx.fillRect(x + 5, baseY - 10, 3, 6);
                break;
            }

            case 10: { // emo — side-swept bang
                ctx.fillStyle = hairColor;
                SpriteRenderer._roundRect(ctx, x - 8, baseY - 15, 16, 8, 4); ctx.fill();
                if (!isFacingBack) {
                    ctx.beginPath();
                    ctx.moveTo(x - 8, baseY - 12);
                    ctx.lineTo(x + 6, baseY - 12);
                    ctx.lineTo(x - 1, baseY - 3);
                    ctx.lineTo(x - 8, baseY - 6);
                    ctx.closePath(); ctx.fill();
                }
                break;
            }
        }
    }

    // ══════════════════════════════════════════════════════════
    // Accessories
    // ══════════════════════════════════════════════════════════

    static _drawAccessory(ctx, x, baseY, dir, accessory, skin, accColor) {
        const isFacingBack = (dir === 'N' || dir === 'NW' || dir === 'NE');

        switch (accessory) {
            case 0: // none
                break;

            case 1: // glasses — rounded frames
                if (!isFacingBack) {
                    let lx, rx;
                    if (dir === 'W' || dir === 'SW') {
                        lx = x - 6; rx = x - 1;
                    } else if (dir === 'E' || dir === 'SE') {
                        lx = x - 1; rx = x + 2;
                    } else {
                        lx = x - 5; rx = x + 1;
                    }
                    const gy = baseY - 6;
                    // Frames
                    ctx.strokeStyle = SpriteRenderer._darken(accColor, 60);
                    ctx.lineWidth = 0.8;
                    ctx.beginPath();
                    ctx.roundRect(lx, gy, 4, 4, 1);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.roundRect(rx, gy, 4, 4, 1);
                    ctx.stroke();
                    // Bridge
                    ctx.beginPath();
                    ctx.moveTo(lx + 4, gy + 2);
                    ctx.lineTo(rx, gy + 2);
                    ctx.stroke();
                    // Lens tint
                    ctx.fillStyle = 'rgba(200, 220, 255, 0.2)';
                    ctx.fillRect(lx + 0.5, gy + 0.5, 3, 3);
                    ctx.fillRect(rx + 0.5, gy + 0.5, 3, 3);
                }
                break;

            case 2: // sunglasses — dark tinted
                if (!isFacingBack) {
                    let lx, rx;
                    if (dir === 'W' || dir === 'SW') {
                        lx = x - 6; rx = x - 1;
                    } else if (dir === 'E' || dir === 'SE') {
                        lx = x - 1; rx = x + 2;
                    } else {
                        lx = x - 5; rx = x + 1;
                    }
                    const gy = baseY - 6;
                    // Dark lenses
                    ctx.fillStyle = '#1a1a2e';
                    SpriteRenderer._roundRect(ctx, lx, gy, 5, 4, 1);
                    ctx.fill();
                    SpriteRenderer._roundRect(ctx, rx, gy, 5, 4, 1);
                    ctx.fill();
                    // Shine
                    ctx.fillStyle = 'rgba(255,255,255,0.2)';
                    ctx.fillRect(lx + 1, gy + 0.5, 2, 1);
                    ctx.fillRect(rx + 1, gy + 0.5, 2, 1);
                    // Bridge
                    ctx.strokeStyle = '#1a1a2e';
                    ctx.lineWidth = 0.8;
                    ctx.beginPath();
                    ctx.moveTo(lx + 5, gy + 2);
                    ctx.lineTo(rx, gy + 2);
                    ctx.stroke();
                }
                break;

            case 3: // hat — beanie / cap
                ctx.fillStyle = accColor;
                // Main hat dome
                ctx.beginPath();
                ctx.ellipse(x, baseY - 14, 10, 7, 0, Math.PI, 0);
                ctx.fill();
                // Brim band
                ctx.fillStyle = SpriteRenderer._darken(accColor, 30);
                ctx.fillRect(x - 10, baseY - 14, 20, 3);
                // Front brim (only when facing forward)
                if (!isFacingBack) {
                    ctx.fillStyle = SpriteRenderer._darken(accColor, 20);
                    ctx.beginPath();
                    ctx.ellipse(x, baseY - 13, 11, 3, 0, 0, Math.PI);
                    ctx.fill();
                }
                break;

            case 4: // headband
                if (!isFacingBack) {
                    ctx.fillStyle = accColor;
                    ctx.fillRect(x - 8, baseY - 10, 16, 2);
                    // Small knot on side
                    ctx.fillRect(x + 7, baseY - 12, 2, 3);
                    ctx.fillRect(x + 8, baseY - 11, 3, 2);
                } else {
                    // Show band from back
                    ctx.fillStyle = accColor;
                    ctx.fillRect(x - 8, baseY - 10, 16, 2);
                    // Dangling tails
                    ctx.fillRect(x + 6, baseY - 10, 2, 6);
                    ctx.fillRect(x + 7, baseY - 8, 2, 5);
                }
                break;

            case 5: // earring
                if (!isFacingBack) {
                    let earX;
                    if (dir === 'W' || dir === 'SW') {
                        earX = x - 8;
                    } else if (dir === 'E' || dir === 'SE') {
                        earX = x + 7;
                    } else {
                        earX = x - 8; // Show on left by default for south
                    }
                    // Earring
                    ctx.fillStyle = accColor;
                    ctx.beginPath();
                    ctx.arc(earX, baseY - 1, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                    // Shine
                    ctx.fillStyle = '#fff8dc';
                    ctx.fillRect(earX - 0.5, baseY - 2, 1, 1);
                }
                break;

            case 6: // mask — surgical mask over lower face
                if (!isFacingBack) {
                    ctx.fillStyle = '#e6edf5';
                    SpriteRenderer._roundRect(ctx, x - 6, baseY - 5, 12, 8, 3); ctx.fill();
                    ctx.strokeStyle = '#c3ccd6'; ctx.lineWidth = 0.6;
                    ctx.beginPath(); ctx.moveTo(x - 6, baseY - 3); ctx.lineTo(x - 8, baseY - 4); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(x + 6, baseY - 3); ctx.lineTo(x + 8, baseY - 4); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(x - 5, baseY - 1); ctx.lineTo(x + 5, baseY - 1); ctx.stroke();
                }
                break;

            case 7: // beard
                if (!isFacingBack) {
                    ctx.fillStyle = '#3a2a1c';
                    SpriteRenderer._roundRect(ctx, x - 7, baseY - 1, 14, 5, 2); ctx.fill();
                    ctx.fillRect(x - 7, baseY - 3, 3, 4);
                    ctx.fillRect(x + 4, baseY - 3, 3, 4);
                    ctx.fillRect(x - 3, baseY - 2, 6, 1.5); // moustache
                }
                break;

            case 8: // eyepatch
                if (!isFacingBack) {
                    const ex = (dir === 'W' || dir === 'SW') ? x - 5 : (dir === 'E' || dir === 'SE') ? x + 1 : x - 4;
                    ctx.fillStyle = '#141420';
                    SpriteRenderer._roundRect(ctx, ex, baseY - 7, 5, 5, 1); ctx.fill();
                    ctx.strokeStyle = '#141420'; ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(ex, baseY - 6); ctx.lineTo(x - 8, baseY - 9);
                    ctx.moveTo(ex + 5, baseY - 6); ctx.lineTo(x + 8, baseY - 9);
                    ctx.stroke();
                }
                break;
        }
    }

    // ══════════════════════════════════════════════════════════
    // Hand Accessories / Guns
    // ══════════════════════════════════════════════════════════

    static _drawEquippedItem(ctx, x, baseY, dir, item, frame, isWalking, pose) {
        if (!item) return;
        if (pose === 'lay_down') return;

        // Check if item is a prop from the catalog
        const prop = window.PROP_CATALOG && window.PROP_CATALOG[item];

        if (prop && prop._img && prop._img.complete && prop._img.naturalWidth > 0) {
            // ── Prop sprite from catalog ──
            ctx.save();

            const bone = prop.attach_bone || 'right_hand';
            const scale = (prop.sprite_scale || 100) / 100;
            // Determine direction group and get the right pose data
            const isBack = (dir === 'N' || dir === 'NW' || dir === 'NE');
            const isLeft = (dir === 'W' || dir === 'SW' || dir === 'NW');
            const isSide = (dir === 'E' || dir === 'W');
            const flipH = prop.flip_h !== false;

            let activePose = null;
            let hasCustomDir = false;
            if (prop.pose_data) {
                if (isBack && prop.pose_data.back_hold) {
                    activePose = prop.pose_data.back_hold;
                    hasCustomDir = true;
                } else if (isSide && prop.pose_data.side_hold) {
                    activePose = prop.pose_data.side_hold;
                    hasCustomDir = true;
                } else if (prop.pose_data.hold) {
                    activePose = prop.pose_data.hold;
                }
            }

            // Read offset/rotation from the active direction pose
            const ox = activePose ? (activePose.offset_x || 0) : (prop.offset_x || 0);
            const oy = activePose ? (activePose.offset_y || 0) : (prop.offset_y || 0);
            const rot = (activePose ? (activePose.prop_rotation || 0) : (prop.prop_rotation || 0)) * Math.PI / 180;
            const imgW = prop._img.naturalWidth * scale;
            const imgH = prop._img.naturalHeight * scale;

            // Calculate bone endpoint from the active pose's arm angles + length
            let bx, by;
            const armAngleR = activePose ? (activePose.right_arm || 15) : 15;
            const armAngleL = activePose ? (activePose.left_arm || -15) : -15;
            const armLenR = activePose ? (activePose.right_arm_len != null ? activePose.right_arm_len : 100) : 100;
            const armLenL = activePose ? (activePose.left_arm_len != null ? activePose.left_arm_len : 100) : 100;

            if (bone === 'right_hand') {
                const armH = Math.round(14 * armLenR / 100) + 2;
                const rad = armAngleR * Math.PI / 180;
                bx = x + 8 - Math.sin(rad) * armH;
                by = baseY + 6 + Math.cos(rad) * armH;
            } else if (bone === 'left_hand') {
                const armH = Math.round(14 * armLenL / 100) + 2;
                const rad = armAngleL * Math.PI / 180;
                bx = x - 8 - Math.sin(rad) * armH;
                by = baseY + 6 + Math.cos(rad) * armH;
            } else if (bone === 'head') {
                bx = x; by = baseY - 12;
            } else if (bone === 'back') {
                bx = x; by = baseY + 10;
            } else {
                bx = x + 8; by = baseY + 18;
            }

            // Mirror bone position only when using front fallback (no custom dir)
            if (!hasCustomDir && flipH && (isLeft || isBack)) {
                bx = x - (bx - x);
            }

            ctx.translate(bx, by);
            if (!hasCustomDir && isLeft && flipH) ctx.scale(-1, 1);
            ctx.rotate(rot);

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(prop._img, ox - imgW / 2, oy - imgH / 2, imgW, imgH);

            ctx.restore();
            return;
        }

        // ── Legacy hardcoded gun fallback ──
        if (String(item).toLowerCase() !== 'gun') return;
        
        ctx.save();
        
        // Right hand position base
        let hx = x + 8;
        let hy = baseY + 18;
        
        if (pose === 'sit') {
            hy -= 4;
        } else {
            const armSwing = isWalking ? Math.sin(frame * 0.4) * 8 : 0;
            hy -= Math.sin(armSwing * Math.PI / 180) * 8;
        }

        const isBack = (dir === 'N' || dir === 'NW' || dir === 'NE');
        if (isBack) {
            hx = x - 9;
        } else if (dir === 'W' || dir === 'SW') {
            hx = x - 8;
        }

        ctx.translate(hx, hy);
        if (dir === 'W' || dir === 'SW' || dir === 'NW') {
            ctx.scale(-1, 1);
        }

        // Draw simple handgun
        ctx.fillStyle = '#2c3e50'; 
        ctx.fillRect(-1, -2, 8, 3); // barrel
        ctx.fillRect(0, 0, 3, 5);  // grip
        ctx.fillStyle = '#bdc3c7'; // slide
        ctx.fillRect(-1, -3, 8, 2);

        ctx.restore();
    }

    // ══════════════════════════════════════════════════════════
    // Bubbles / Typing
    // ══════════════════════════════════════════════════════════

    static _drawBubble(ctx, x, bottomY, text) {
        ctx.save();
        ctx.font = '500 11px Inter, sans-serif';
        ctx.textAlign = 'center';

        const maxW = 120;
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        for (const word of words) {
            const test = currentLine ? currentLine + ' ' + word : word;
            if (ctx.measureText(test).width > maxW && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = test;
            }
        }
        if (currentLine) lines.push(currentLine);

        if (lines.length > 3) {
            lines.length = 3;
            lines[2] = lines[2].slice(0, -3) + '...';
        }

        const lineH = 14;
        const padX = 10;
        const padY = 6;
        const bubbleW = Math.max(40, Math.max(...lines.map(l => ctx.measureText(l).width)) + padX * 2);
        const bubbleH = lines.length * lineH + padY * 2;
        const bubbleX = x - bubbleW / 2;
        const bubbleY = bottomY - bubbleH - 6;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        SpriteRenderer._roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 8);
        ctx.fill();

        ctx.shadowColor = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;
        SpriteRenderer._roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 8);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Tail
        ctx.beginPath();
        ctx.moveTo(x - 5, bubbleY + bubbleH);
        ctx.lineTo(x, bubbleY + bubbleH + 6);
        ctx.lineTo(x + 5, bubbleY + bubbleH);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fill();

        ctx.fillStyle = '#1a1a2e';
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], x, bubbleY + padY + lineH * (i + 1) - 3);
        }

        ctx.restore();
    }

    static _drawTypingIndicator(ctx, x, bottomY, now) {
        ctx.save();

        const dotR = 3;
        const gap = 8;
        const bubbleW = 36;
        const bubbleH = 20;
        const bubbleX = x - bubbleW / 2;
        const bubbleY = bottomY - bubbleH - 6;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        SpriteRenderer._roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 8);
        ctx.fill();

        // Tail
        ctx.beginPath();
        ctx.moveTo(x - 4, bubbleY + bubbleH);
        ctx.lineTo(x, bubbleY + bubbleH + 5);
        ctx.lineTo(x + 4, bubbleY + bubbleH);
        ctx.closePath();
        ctx.fill();

        const centerY = bubbleY + bubbleH / 2;
        for (let i = 0; i < 3; i++) {
            const phase = (now / 400 + i * 0.6) % (Math.PI * 2);
            const bounce = Math.sin(phase) * 2.5;
            ctx.beginPath();
            ctx.arc(x - gap + i * gap, centerY + bounce, dotR, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(100, 100, 120, ${0.5 + Math.sin(phase) * 0.3})`;
            ctx.fill();
        }

        ctx.restore();
    }

    // ══════════════════════════════════════════════════════════
    // Status Icon (animated phase indicator for NPCs)
    // ══════════════════════════════════════════════════════════

    static _drawStatusIcon(ctx, x, bottomY, icon, now) {
        ctx.save();

        const bubbleSize = 28;
        const bubbleY = bottomY - bubbleSize - 6;

        // Pulse animation (scale oscillates 0.85 → 1.15)
        const pulse = Math.sin(now / 300) * 0.15;
        const scale = 1.0 + pulse;

        // Bubble background
        ctx.fillStyle = 'rgba(139, 92, 246, 0.85)';
        ctx.beginPath();
        ctx.arc(x, bubbleY + bubbleSize / 2, bubbleSize / 2 * scale, 0, Math.PI * 2);
        ctx.fill();

        // Glow effect
        ctx.shadowColor = 'rgba(139, 92, 246, 0.4)';
        ctx.shadowBlur = 8 + Math.sin(now / 400) * 4;
        ctx.beginPath();
        ctx.arc(x, bubbleY + bubbleSize / 2, bubbleSize / 2 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Tail (small triangle pointing down)
        ctx.fillStyle = 'rgba(139, 92, 246, 0.85)';
        ctx.beginPath();
        ctx.moveTo(x - 4, bubbleY + bubbleSize - 2);
        ctx.lineTo(x, bubbleY + bubbleSize + 5);
        ctx.lineTo(x + 4, bubbleY + bubbleSize - 2);
        ctx.closePath();
        ctx.fill();

        // Emoji icon (scaled with pulse)
        ctx.font = `${Math.round(16 * scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(icon, x, bubbleY + bubbleSize / 2 + 1);

        ctx.restore();
    }

    // ══════════════════════════════════════════════════════════
    // Utilities
    // ══════════════════════════════════════════════════════════

    static _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    static _darken(hex, amount) {
        if (typeof hex !== 'string' || hex.length < 7) return '#808080';
        let r = parseInt(hex.slice(1, 3), 16);
        let g = parseInt(hex.slice(3, 5), 16);
        let b = parseInt(hex.slice(5, 7), 16);
        r = Math.max(0, r - amount);
        g = Math.max(0, g - amount);
        b = Math.max(0, b - amount);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    static _lighten(hex, amount) {
        if (typeof hex !== 'string' || hex.length < 7) return '#a0a0a0';
        let r = parseInt(hex.slice(1, 3), 16);
        let g = parseInt(hex.slice(3, 5), 16);
        let b = parseInt(hex.slice(5, 7), 16);
        r = Math.min(255, r + amount);
        g = Math.min(255, g + amount);
        b = Math.min(255, b + amount);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
}
