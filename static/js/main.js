document.addEventListener('DOMContentLoaded', () => {
      const introScreen = document.getElementById('introScreen');
      const introPhotoBtn = document.getElementById('introPhotoBtn');
      const cvContent = document.getElementById('cvContent');

      const actionPanel = document.getElementById('actionPanel');
      const btnInterested = document.getElementById('btnInterested');
      const btnReject = document.getElementById('btnReject');

      const envelopeScene = document.getElementById('envelopeScene');
      const envelopeWrap = document.getElementById('envelopeWrap');

      const blackholeScene = document.getElementById('blackholeScene');
      const fragmentLayer = document.getElementById('fragmentLayer');
      const lifeCanvas = document.getElementById('lifeCanvas');

      const contactPanel = document.getElementById('contactPanel');
      const contactPanelBackdrop = document.getElementById('contactPanelBackdrop');
      const contactCloseBtn = document.getElementById('contactCloseBtn');
      const copyEmailBtn = document.getElementById('copyEmailBtn');
      const copyPhoneBtn = document.getElementById('copyPhoneBtn');
      const resetInterestedBtn = document.getElementById('resetInterestedBtn');
      const copyFeedback = document.getElementById('copyFeedback');
      const linkedinQr = document.getElementById('linkedinQr');
      const cvQr = document.getElementById('cvQr');

      const CONTACT = {
        name: 'Alexis Campos',
        role: 'Alternant technicien informatique',
        email: 'alexiscampos4@hotmail.com',
        phoneDisplay: '+33 6 10 49 81 40',
        phoneRaw: '+33610498140',
        linkedin: 'https://www.linkedin.com/in/alexis-campos-533ba7271/',
        cvPdfRelative: 'static/Alexis-Campos-CV.pdf',
        cvPdfAbsolute: 'https://fkmraxxx.github.io/curriculum-vitae/static/Alexis-Campos-CV.pdf',
        addressStreet: "1 rue de l’île au trésor",
        city: 'Wittelsheim',
        postalCode: '68310',
        country: 'France'
      };

      let isAnimating = false;
      let introStarted = false;
      let qrCodesBuilt = false;
      let copyFeedbackTimer = null;

      initLifeBackground();
      bindContactPanelActions();

      function initLifeBackground() {
        if (!lifeCanvas) return;

        const ctx = lifeCanvas.getContext('2d', {
          alpha: true,
          desynchronized: true
        });

        if (!ctx) return;

        const STEP_MS = 95;
        const BASE_DENSITY = 0.15;

        let dpr = 1;
        let width = 0;
        let height = 0;
        let cellSize = 10;
        let cols = 0;
        let rows = 0;

        let current = new Uint8Array(0);
        let next = new Uint8Array(0);

        let left = new Int16Array(0);
        let right = new Int16Array(0);
        let up = new Int16Array(0);
        let down = new Int16Array(0);

        let lastTime = 0;
        let acc = 0;
        let resizeTimer = null;

        const patterns = [
          [[1,0],[2,1],[0,2],[1,2],[2,2]],
          [[0,0],[1,0],[0,1],[1,1]],
          [[0,0],[1,0],[2,0]],
          [[1,0],[2,0],[0,1],[1,1],[1,2]]
        ];

        function chooseCellSize() {
          if (window.innerWidth < 640) return 13;
          if (window.innerWidth < 1100) return 11;
          return 10;
        }

        function index(x, y) {
          return y * cols + x;
        }

        function stamp(pattern, ox, oy) {
          for (const [px, py] of pattern) {
            const x = (ox + px + cols) % cols;
            const y = (oy + py + rows) % rows;
            current[index(x, y)] = 1;
          }
        }

        function clearGrid() {
          current.fill(0);
          next.fill(0);
        }

        function seed() {
          clearGrid();
          const total = cols * rows;

          for (let i = 0; i < total; i++) {
            current[i] = Math.random() < BASE_DENSITY ? 1 : 0;
          }

          const extraPatterns = Math.max(8, Math.floor(total / 900));
          for (let i = 0; i < extraPatterns; i++) {
            const pattern = patterns[(Math.random() * patterns.length) | 0];
            stamp(pattern, (Math.random() * cols) | 0, (Math.random() * rows) | 0);
          }
        }

        function pulse() {
          const injections = Math.max(6, Math.floor((cols * rows) / 1200));

          for (let i = 0; i < injections; i++) {
            const pattern = patterns[(Math.random() * patterns.length) | 0];
            stamp(pattern, (Math.random() * cols) | 0, (Math.random() * rows) | 0);
          }
        }

        function resize() {
          width = window.innerWidth;
          height = window.innerHeight;
          dpr = Math.min(window.devicePixelRatio || 1, 1.5);

          lifeCanvas.width = Math.floor(width * dpr);
          lifeCanvas.height = Math.floor(height * dpr);
          lifeCanvas.style.width = `${width}px`;
          lifeCanvas.style.height = `${height}px`;

          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.imageSmoothingEnabled = false;

          cellSize = chooseCellSize();
          cols = Math.ceil(width / cellSize);
          rows = Math.ceil(height / cellSize);

          current = new Uint8Array(cols * rows);
          next = new Uint8Array(cols * rows);

          left = new Int16Array(cols);
          right = new Int16Array(cols);
          up = new Int16Array(rows);
          down = new Int16Array(rows);

          for (let x = 0; x < cols; x++) {
            left[x] = x === 0 ? cols - 1 : x - 1;
            right[x] = x === cols - 1 ? 0 : x + 1;
          }

          for (let y = 0; y < rows; y++) {
            up[y] = y === 0 ? rows - 1 : y - 1;
            down[y] = y === rows - 1 ? 0 : y + 1;
          }

          seed();
          render();
        }

        function step() {
          let alive = 0;

          for (let y = 0; y < rows; y++) {
            const rowUp = up[y] * cols;
            const rowMid = y * cols;
            const rowDown = down[y] * cols;

            for (let x = 0; x < cols; x++) {
              const xl = left[x];
              const xr = right[x];
              const idx = rowMid + x;

              const neighbors =
                current[rowUp + xl] + current[rowUp + x] + current[rowUp + xr] +
                current[rowMid + xl]                    + current[rowMid + xr] +
                current[rowDown + xl] + current[rowDown + x] + current[rowDown + xr];

              const isAlive = current[idx] === 1;
              const nextState = (neighbors === 3 || (isAlive && neighbors === 2)) ? 1 : 0;

              next[idx] = nextState;
              alive += nextState;
            }
          }

          const tmp = current;
          current = next;
          next = tmp;

          const total = cols * rows;

          if (alive < total * 0.035 || alive > total * 0.58) {
            pulse();
          }
        }

        function render() {
          ctx.clearRect(0, 0, width, height);

          const pad = cellSize > 10 ? 1.2 : 1;
          const size = Math.max(1, cellSize - pad * 2);

          ctx.fillStyle = 'rgba(18, 59, 122, 0.14)';

          for (let y = 0; y < rows; y++) {
            const row = y * cols;
            const py = y * cellSize + pad;

            for (let x = 0; x < cols; x++) {
              if (current[row + x]) {
                ctx.fillRect(x * cellSize + pad, py, size, size);
              }
            }
          }
        }

        function tick(ts) {
          if (document.hidden) {
            lastTime = ts;
            requestAnimationFrame(tick);
            return;
          }

          if (!lastTime) lastTime = ts;
          acc += ts - lastTime;
          lastTime = ts;

          let updated = false;

          while (acc >= STEP_MS) {
            step();
            acc -= STEP_MS;
            updated = true;
          }

          if (updated) {
            render();
          }

          requestAnimationFrame(tick);
        }

        window.addEventListener('resize', () => {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => {
            acc = 0;
            lastTime = 0;
            resize();
          }, 120);
        });

        resize();
        requestAnimationFrame(tick);
      }

      function getTextNodes(root) {
        const walker = document.createTreeWalker(
          root,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode(node) {
              if (!node.nodeValue || !node.nodeValue.trim()) {
                return NodeFilter.FILTER_REJECT;
              }

              const parent = node.parentElement;
              if (!parent) return NodeFilter.FILTER_REJECT;
              if (parent.closest('#introScreen')) return NodeFilter.FILTER_REJECT;
              if (['SCRIPT', 'STYLE'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;

              return NodeFilter.FILTER_ACCEPT;
            }
          }
        );

        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        return nodes;
      }

      const typedNodes = getTextNodes(cvContent).map((node) => ({
        node,
        text: node.nodeValue
      }));

      typedNodes.forEach((item) => {
        item.node.nodeValue = '';
      });

      const TOTAL_TYPING_DURATION = 3200;

      function typeAllText() {
        return new Promise((resolve) => {
          const totalChars = typedNodes.reduce((sum, item) => sum + item.text.length, 0);

          if (totalChars === 0) {
            resolve();
            return;
          }

          const start = performance.now();

          function render(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / TOTAL_TYPING_DURATION, 1);
            const visibleChars = Math.floor(totalChars * progress);

            let remaining = visibleChars;

            typedNodes.forEach((item) => {
              const len = item.text.length;
              const charsForNode = Math.max(0, Math.min(len, remaining));
              item.node.nodeValue = item.text.slice(0, charsForNode);
              remaining -= charsForNode;
            });

            if (progress < 1) {
              requestAnimationFrame(render);
            } else {
              restoreFullText();
              resolve();
            }
          }

          requestAnimationFrame(render);
        });
      }

      function restoreFullText() {
        typedNodes.forEach((item) => {
          item.node.nodeValue = item.text;
        });
      }

      function disableActions() {
        isAnimating = true;
        btnInterested.disabled = true;
        btnReject.disabled = true;
      }

      function hideActions() {
        actionPanel.classList.remove('is-visible');
      }

      async function startCvAnimation() {
        if (introStarted) return;
        introStarted = true;

        introScreen.classList.add('hidden');
        cvContent.classList.remove('cv-hidden');

        await typeAllText();
        actionPanel.classList.add('is-visible');
      }

      function resetFx() {
        envelopeScene.classList.remove('show');
        envelopeWrap.classList.remove('show', 'paper-in', 'sealed', 'done');
        blackholeScene.classList.remove('show');
        fragmentLayer.innerHTML = '';

        contactPanel.classList.remove('show');
        contactPanel.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';

        copyFeedback.classList.remove('show', 'error');
        copyFeedback.textContent = '';
      }

      function wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }

function bindContactPanelActions() {
  if (contactPanelBackdrop) {
    contactPanelBackdrop.addEventListener('click', resetInterestedScene);
  }

  if (contactCloseBtn) {
    contactCloseBtn.addEventListener('click', resetInterestedScene);
  }

  if (resetInterestedBtn) {
    resetInterestedBtn.addEventListener('click', resetInterestedScene);
  }

  if (copyEmailBtn) {
    copyEmailBtn.addEventListener('click', () => {
      copyText(CONTACT.email, 'Email copié.');
    });
  }

  if (copyPhoneBtn) {
    copyPhoneBtn.addEventListener('click', () => {
      copyText(CONTACT.phoneDisplay, 'Téléphone copié.');
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && contactPanel.classList.contains('show')) {
      resetInterestedScene();
    }
  });
}

      function showCopyFeedback(message, isError = false) {
        clearTimeout(copyFeedbackTimer);
        copyFeedback.textContent = message;
        copyFeedback.classList.add('show');
        copyFeedback.classList.toggle('error', isError);

        copyFeedbackTimer = setTimeout(() => {
          copyFeedback.classList.remove('show', 'error');
          copyFeedback.textContent = '';
        }, 2200);
      }

      async function copyText(text, successMessage) {
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
          } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
          }

          showCopyFeedback(successMessage);
        } catch (error) {
          showCopyFeedback('Copie impossible sur ce navigateur.', true);
        }
      }

      function renderContactQRCodes() {
        if (qrCodesBuilt) return;

        if (typeof QRCode === 'undefined') {
          linkedinQr.innerHTML = '<span style="font-size:12px;color:#5e6b7c;">QR indisponible</span>';
          cvQr.innerHTML = '<span style="font-size:12px;color:#5e6b7c;">QR indisponible</span>';
          qrCodesBuilt = true;
          return;
        }

        linkedinQr.innerHTML = '';
        cvQr.innerHTML = '';

        new QRCode(linkedinQr, {
          text: CONTACT.linkedin,
          width: 132,
          height: 132,
          correctLevel: QRCode.CorrectLevel.H
        });

        new QRCode(cvQr, {
          text: CONTACT.cvPdfAbsolute,
          width: 132,
          height: 132,
          correctLevel: QRCode.CorrectLevel.H
        });

        qrCodesBuilt = true;
      }

      function openContactPanel() {
        renderContactQRCodes();
        contactPanel.classList.add('show');
        contactPanel.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        setTimeout(() => {
          contactCloseBtn.focus();
        }, 30);
      }

      function escapeVCard(value) {
        return String(value || '')
          .replace(/\\/g, '\\\\')
          .replace(/\n/g, '\\n')
          .replace(/,/g, '\\,')
          .replace(/;/g, '\\;');
      }

      function downloadVCard() {
        const vcard = [
          'BEGIN:VCARD',
          'VERSION:3.0',
          `FN:${escapeVCard(CONTACT.name)}`,
          'N:Campos;Alexis;;;',
          `TITLE:${escapeVCard(CONTACT.role)}`,
          `TEL;TYPE=CELL:${CONTACT.phoneRaw}`,
          `EMAIL;TYPE=INTERNET:${CONTACT.email}`,
          `URL:${CONTACT.linkedin}`,
          `ADR;TYPE=HOME:;;${escapeVCard(CONTACT.addressStreet)};${escapeVCard(CONTACT.city)};;${escapeVCard(CONTACT.postalCode)};${escapeVCard(CONTACT.country)}`,
          'END:VCARD'
        ].join('\n');

        const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = 'Alexis-Campos.vcf';
        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1200);
        showCopyFeedback('vCard téléchargée.');
      }

      function resetInterestedScene() {
        resetFx();

        restoreFullText();

        cvContent.classList.remove(
          'cv-hidden',
          'soft-hide',
          'invisible-only',
          'is-folding-center'
        );

        cvContent.style.removeProperty('--foldX');
        cvContent.style.removeProperty('--foldY');

        introScreen.classList.add('hidden');

        isAnimating = false;
        btnInterested.disabled = false;
        btnReject.disabled = false;
        actionPanel.classList.add('is-visible');
      }

      async function launchInterested() {
        if (isAnimating || cvContent.classList.contains('cv-hidden')) return;

        disableActions();
        hideActions();
        blackholeScene.classList.remove('show');

        const rect = cvContent.getBoundingClientRect();
        const targetX = (window.innerWidth / 2) - (rect.left + rect.width / 2);
        const targetY = (window.innerHeight / 2) - (rect.top + rect.height / 2) - 20;

        cvContent.style.setProperty('--foldX', `${targetX}px`);
        cvContent.style.setProperty('--foldY', `${targetY}px`);

        envelopeScene.classList.add('show');
        envelopeWrap.classList.add('show');

        await wait(120);

        requestAnimationFrame(() => {
          cvContent.classList.add('is-folding-center');
        });

        await wait(760);
        envelopeWrap.classList.add('paper-in');

        await wait(650);
        envelopeWrap.classList.add('sealed');

        await wait(480);
        envelopeWrap.classList.add('done');
        cvContent.classList.add('invisible-only');

        await wait(240);
        openContactPanel();
      }

      function createFragmentCanvas(sourceCanvas, sx, sy, sw, sh) {
        const pieceCanvas = document.createElement('canvas');
        const ratio = window.devicePixelRatio || 1;

        pieceCanvas.width = Math.max(1, Math.floor(sw * ratio));
        pieceCanvas.height = Math.max(1, Math.floor(sh * ratio));

        const ctx = pieceCanvas.getContext('2d');
        ctx.scale(ratio, ratio);
        ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

        return pieceCanvas;
      }

      async function buildCvFragments() {
        const rect = cvContent.getBoundingClientRect();

        const canvas = await html2canvas(cvContent, {
          backgroundColor: null,
          scale: window.devicePixelRatio || 1,
          useCORS: true
        });

        const pieces = [];
        const cols = 12;
        const rows = 18;
        const pieceW = rect.width / cols;
        const pieceH = rect.height / rows;

        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const left = rect.left + x * pieceW;
            const top = rect.top + y * pieceH;
            const width = (x === cols - 1) ? (rect.width - x * pieceW) : pieceW;
            const height = (y === rows - 1) ? (rect.height - y * pieceH) : pieceH;

            const frag = document.createElement('div');
            frag.className = 'cv-fragment';
            frag.style.left = `${left}px`;
            frag.style.top = `${top}px`;
            frag.style.width = `${width}px`;
            frag.style.height = `${height}px`;

            const pieceCanvas = createFragmentCanvas(
              canvas,
              x * pieceW,
              y * pieceH,
              width,
              height
            );

            frag.appendChild(pieceCanvas);
            fragmentLayer.appendChild(frag);

            pieces.push({
              el: frag,
              cx: left + width / 2,
              cy: top + height / 2,
              xIndex: x,
              yIndex: y
            });
          }
        }

        return pieces;
      }

      async function launchReject() {
        if (isAnimating || cvContent.classList.contains('cv-hidden')) return;

        disableActions();
        hideActions();
        envelopeScene.classList.remove('show');
        envelopeWrap.classList.remove('show', 'sealed', 'done');

        restoreFullText();

        const pieces = await buildCvFragments();

        cvContent.classList.add('soft-hide');
        blackholeScene.classList.add('show');

        const holeX = window.innerWidth / 2;
        const holeY = window.innerHeight / 2;

        pieces.forEach((piece) => {
          const dx = piece.cx - holeX;
          const dy = piece.cy - holeY;
          const dist = Math.hypot(dx, dy) || 1;

          const nx = dx / dist;
          const ny = dy / dist;

          const scatter = 18 + Math.random() * 24;
          const scatterX = nx * scatter + (Math.random() - 0.5) * 24;
          const scatterY = ny * scatter + (Math.random() - 0.5) * 24;
          const swirl = 42 + Math.random() * 74;

          const tangentX = -ny * swirl;
          const tangentY = nx * swirl;

          const toHoleX = holeX - piece.cx + tangentX * 0.35;
          const toHoleY = holeY - piece.cy + tangentY * 0.35;

          const breakDelay = Math.random() * 160;
          const suckDelay = 180 + Math.random() * 280;
          const totalDur = 900 + Math.random() * 700;

          piece.el.style.transition =
            `transform ${totalDur}ms cubic-bezier(.14,.88,.2,1), opacity ${totalDur}ms ease, filter ${totalDur}ms ease`;

          setTimeout(() => {
            piece.el.style.transform = `translate(${scatterX}px, ${scatterY}px) rotate(${(-18 + Math.random() * 36).toFixed(2)}deg) scale(.98)`;
            piece.el.style.filter = 'blur(.2px)';
          }, breakDelay);

          setTimeout(() => {
            piece.el.style.transform =
              `translate(${toHoleX}px, ${toHoleY}px) rotate(${(540 + Math.random() * 540).toFixed(2)}deg) scale(0.02)`;
            piece.el.style.opacity = '0';
            piece.el.style.filter = 'blur(5px) brightness(.7)';
          }, suckDelay);
        });

        setTimeout(() => {
          fragmentLayer.innerHTML = '';
        }, 2300);
      }

      introPhotoBtn.addEventListener('click', startCvAnimation, { once: true });
      btnInterested.addEventListener('click', launchInterested);
      btnReject.addEventListener('click', launchReject);

      window.addEventListener('beforeprint', () => {
        restoreFullText();
        resetFx();

        cvContent.classList.remove(
          'cv-hidden',
          'soft-hide',
          'invisible-only',
          'is-folding-center'
        );

        cvContent.style.removeProperty('--foldX');
        cvContent.style.removeProperty('--foldY');

        introScreen.classList.add('hidden');
        actionPanel.classList.remove('is-visible');
      });
    });
