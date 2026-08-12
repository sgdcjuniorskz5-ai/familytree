let _transformState = { x: 0, y: 0, k: 1 };
let _containerEl = null;
let _svgEl = null;
let _onSelectCallback = null;
let _onFocusCallback = null;
let _lastNodes = [];
let _lastLinks = [];
let _lastMembers = [];
let _lastFocusId = null;
let _dragMode = false;
let _draggingCard = null;
let _dragStartPos = null;
let _lastLinkEls = [];
let _draggedCards = [];
let _dragOffsets = [];

function getTransformState() {
  return _transformState;
}

function setTransformState(ts) {
  _transformState = { x: ts.x, y: ts.y, k: ts.k };
}

function initTreeRenderer(containerId, svgId, onSelect, onFocus) {
  _containerEl = document.getElementById(containerId);
  _svgEl = document.getElementById(svgId);
  _onSelectCallback = onSelect;
  _onFocusCallback = onFocus;

  _containerEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = _svgEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let nextK = _transformState.k * delta;
    nextK = Math.max(0.15, Math.min(2.5, nextK));
    _transformState.x = mx - (mx - _transformState.x) * (nextK / _transformState.k);
    _transformState.y = my - (my - _transformState.y) * (nextK / _transformState.k);
    _transformState.k = nextK;

    _applyTransform();
  });

  // Touch variables for pan/zoom
  let isDragging = false, dragX = 0, dragY = 0;
  let lastTouchDist = 0;
  let lastTouchCenter = { x: 0, y: 0 };

  _containerEl.addEventListener('mousedown', (e) => {
    if (e.target.closest('.card-node')) return;
    isDragging = true;
    dragX = e.clientX;
    dragY = e.clientY;
    _containerEl.style.cursor = 'grabbing';
  });

  // Touch events for mobile pan/zoom
  _containerEl.addEventListener('touchstart', (e) => {
    const target = e.target;
    if (target.closest('.card-node') || target.closest('.card-select-checkbox')) return;
    
    if (e.touches.length === 1) {
      isDragging = true;
      dragX = e.touches[0].clientX;
      dragY = e.touches[0].clientY;
      e.preventDefault();
    } else if (e.touches.length === 2) {
      // Pinch to zoom
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      lastTouchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      lastTouchCenter = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
      isDragging = false;
      e.preventDefault();
    }
  }, { passive: false });

  _containerEl.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - dragX;
      const dy = e.touches[0].clientY - dragY;
      _transformState.x += dx;
      _transformState.y += dy;
      dragX = e.touches[0].clientX;
      dragY = e.touches[0].clientY;
      _applyTransform();
      e.preventDefault();
    } else if (e.touches.length === 2) {
      // Pinch zoom
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const center = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
      
      if (lastTouchDist > 0) {
        const scale = dist / lastTouchDist;
        const rect = _svgEl.getBoundingClientRect();
        const mx = center.x - rect.left;
        const my = center.y - rect.top;
        
        let nextK = _transformState.k * scale;
        nextK = Math.max(0.15, Math.min(2.5, nextK));
        _transformState.x = mx - (mx - _transformState.x) * (nextK / _transformState.k);
        _transformState.y = my - (my - _transformState.y) * (nextK / _transformState.k);
        _transformState.k = nextK;
        _applyTransform();
      }
      lastTouchDist = dist;
      lastTouchCenter = center;
      e.preventDefault();
    }
  }, { passive: false });

  _containerEl.addEventListener('touchend', (e) => {
    isDragging = false;
    lastTouchDist = 0;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    _transformState.x += e.clientX - dragX;
    _transformState.y += e.clientY - dragY;
    dragX = e.clientX;
    dragY = e.clientY;
    _applyTransform();
  });
  window.addEventListener('mouseup', () => {
    isDragging = false;
    _containerEl.style.cursor = '';
  });
}

function _applyTransform() {
  const zoomGroup = _svgEl.querySelector('#zoom-group');
  if (zoomGroup) {
    zoomGroup.setAttribute('transform', `translate(${_transformState.x}, ${_transformState.y}) scale(${_transformState.k})`);
  }
}

function centerNode(id, layout) {
  if (!layout) return;
  const node = layout.nodes.find(n => n.id === id);
  if (!node) return;
  const rect = _svgEl.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  _transformState.x = cx - (node.x + node.width / 2) * _transformState.k;
  _transformState.y = cy - (node.y + node.height / 2) * _transformState.k;
  _applyTransform();
}

function resetView(layout) {
  if (!layout || !layout.nodes || layout.nodes.length === 0) return;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  layout.nodes.forEach(n => {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x + n.width);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y + n.height);
  });
  const pad = 80;
  const treeW = maxX - minX + pad * 2;
  const treeH = maxY - minY + pad * 2;
  const rect = _svgEl.getBoundingClientRect();
  const scaleX = rect.width / treeW;
  const scaleY = rect.height / treeH;
  _transformState.k = Math.min(scaleX, scaleY, 1.0);
  _transformState.x = (rect.width - treeW * _transformState.k) / 2 - (minX - pad) * _transformState.k;
  _transformState.y = (rect.height - treeH * _transformState.k) / 2 - (minY - pad) * _transformState.k;
  _applyTransform();
}

function _getNodeById(id) {
  return _lastNodes.find(n => n.id === id) || null;
}

function _resolveLinkCoords(link) {
  if (link.type === 'spouse') {
    const left = _getNodeById(link.leftId);
    const right = _getNodeById(link.rightId);
    if (!left || !right) return null;
    return {
      x1: left.x + left.width,
      y1: left.y + left.height / 2,
      x2: right.x,
      y2: right.y + right.height / 2,
      mx: (left.x + left.width + right.x) / 2,
      my: left.y + left.height / 2
    };
  } else if (link.type === 'line') {
    const child = _getNodeById(link.childId);
    if (!child) return null;
    const bx = child.x + child.width / 2;
    const by = child.y;
    let tx, ty;
    if (link.parentIds && link.parentIds.length === 2) {
      const p1 = _getNodeById(link.parentIds[0]);
      const p2 = _getNodeById(link.parentIds[1]);
      if (!p1 || !p2) return null;
      tx = (p1.x + p1.width / 2 + p2.x + p2.width / 2) / 2;
      ty = p1.y + p1.height;
    } else if (link.parentIds && link.parentIds.length === 1) {
      const p = _getNodeById(link.parentIds[0]);
      if (!p) return null;
      tx = p.x + p.width / 2;
      ty = p.y + p.height;
    } else {
      return null;
    }
    return { x1: tx, y1: ty, x2: bx, y2: by };
  }
  return null;
}

function _renderLinks(zoomGroup, themeColors) {
  _lastLinkEls = [];
  _lastLinks.forEach((link, i) => {
    const c = _resolveLinkCoords(link);
    if (!c) return;

    if (link.type === 'spouse') {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", c.x1);
      line.setAttribute("y1", c.my);
      line.setAttribute("x2", c.x2);
      line.setAttribute("y2", c.my);
      line.setAttribute("stroke", "#e74c3c");
      line.setAttribute("stroke-width", "2");
      line.setAttribute("stroke-dasharray", "5,5");
      zoomGroup.appendChild(line);

      const heart = document.createElementNS("http://www.w3.org/2000/svg", "text");
      heart.setAttribute("x", c.mx);
      heart.setAttribute("y", c.my + 3);
      heart.setAttribute("text-anchor", "middle");
      heart.setAttribute("dominant-baseline", "middle");
      heart.setAttribute("font-size", "16px");
      heart.setAttribute("fill", "#e74c3c");
      heart.setAttribute("class", "heart-icon");
      heart.textContent = "\u2665";
      zoomGroup.appendChild(heart);

      _lastLinkEls.push({ link, el: line, heart });
    } else if (link.type === 'line') {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const my = (c.y1 + c.y2) / 2;
      const d = `M${c.x1},${c.y1} C${c.x1},${my} ${c.x2},${my} ${c.x2},${c.y2}`;
      path.setAttribute("d", d);
      path.setAttribute("stroke", "#7b2d26");
      path.setAttribute("stroke-width", "2");
      path.setAttribute("fill", "none");
      zoomGroup.appendChild(path);
      _lastLinkEls.push({ link, el: path });
    }
  });
}

function _updateLinks() {
  _lastLinkEls.forEach(({ link, el, heart }) => {
    const c = _resolveLinkCoords(link);
    if (!c) return;

    if (link.type === 'spouse') {
      el.setAttribute("x1", c.x1);
      el.setAttribute("y1", c.my);
      el.setAttribute("x2", c.x2);
      el.setAttribute("y2", c.my);
      if (heart) {
        heart.setAttribute("x", c.mx);
        heart.setAttribute("y", c.my + 3);
      }
    } else if (link.type === 'line') {
      const my = (c.y1 + c.y2) / 2;
      const d = `M${c.x1},${c.y1} C${c.x1},${my} ${c.x2},${my} ${c.x2},${c.y2}`;
      el.setAttribute("d", d);
    }
  });
}

function renderTree(members, layout, focusId) {
  const zoomGroup = _svgEl.querySelector('#zoom-group');
  if (!zoomGroup) return;
  zoomGroup.innerHTML = '';

  const nodes = layout.nodes;
  const links = layout.links;

  if (!nodes || nodes.length === 0) {
    zoomGroup.innerHTML = '';
    return;
  }

  const cs = getComputedStyle(document.documentElement);
  const themeColors = {
    cardFill: cs.getPropertyValue('--bg-secondary').trim() || '#111827',
    cardStroke: cs.getPropertyValue('--border-color').trim() || '#334155',
    textPrimary: cs.getPropertyValue('--text-primary').trim() || '#f3f4f6',
    textSecondary: cs.getPropertyValue('--text-secondary').trim() || '#9ca3af',
    textMuted: cs.getPropertyValue('--text-muted').trim() || '#6b7280',
    accentGold: cs.getPropertyValue('--accent-gold').trim() || '#fbbf24',
    genderMale: cs.getPropertyValue('--gender-male').trim() || '#14b8a6',
    genderFemale: cs.getPropertyValue('--gender-female').trim() || '#f43f5e',
    genderOther: cs.getPropertyValue('--gender-other').trim() || '#a855f7',
    genderMaleBg: cs.getPropertyValue('--gender-male-bg').trim() || 'rgba(20,184,166,0.07)',
    genderFemaleBg: cs.getPropertyValue('--gender-female-bg').trim() || 'rgba(244,63,94,0.07)',
    genderOtherBg: cs.getPropertyValue('--gender-other-bg').trim() || 'rgba(168,85,247,0.07)',
  };

  _lastNodes = nodes;
  _lastLinks = links;
  _lastMembers = members;
  _lastFocusId = focusId;

  _renderLinks(zoomGroup, themeColors);

  nodes.forEach(n => {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", n.role === "focus" ? "card-node focus-card" : "card-node");
    g.setAttribute("data-id", n.id);
    g.setAttribute("transform", `translate(${n.x}, ${n.y})`);

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", n.width);
    rect.setAttribute("height", n.height);
    rect.setAttribute("rx", "12");
    rect.setAttribute("class", "card");
    rect.setAttribute("fill", themeColors.cardFill);
    rect.setAttribute("stroke", n.role === "focus" ? themeColors.accentGold : themeColors.cardStroke);
    rect.setAttribute("stroke-width", n.role === "focus" ? "3" : "2");
    rect.setAttribute("filter", "url(#shadow)");
    g.appendChild(rect);

    const avSize = 44;
    const initials = (n.firstName || "?")[0].toUpperCase();

    if (n.avatar) {
      const clipId = "clip-" + n.id;
      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      const clipPath = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
      clipPath.setAttribute("id", clipId);
      const clipCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      clipCircle.setAttribute("cx", "32");
      clipCircle.setAttribute("cy", "32");
      clipCircle.setAttribute("r", "22");
      clipPath.appendChild(clipCircle);
      defs.appendChild(clipPath);
      g.appendChild(defs);

      const img = document.createElementNS("http://www.w3.org/2000/svg", "image");
      img.setAttribute("x", "10");
      img.setAttribute("y", "10");
      img.setAttribute("width", String(avSize));
      img.setAttribute("height", String(avSize));
      img.setAttribute("href", n.avatar);
      img.setAttribute("clip-path", `url(#${clipId})`);
      img.setAttribute("preserveAspectRatio", "xMidYMid slice");
      g.appendChild(img);

      const border = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      border.setAttribute("cx", "32");
      border.setAttribute("cy", "32");
      border.setAttribute("r", "22");
      border.setAttribute("fill", "none");
      border.setAttribute("stroke", themeColors.cardStroke);
      border.setAttribute("stroke-width", "1.5");
      g.appendChild(border);
    } else {
      const bg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      bg.setAttribute("cx", "32");
      bg.setAttribute("cy", "32");
      bg.setAttribute("r", "22");
      bg.setAttribute("fill", n.gender === "female" ? themeColors.genderFemaleBg : (n.gender === "other" ? themeColors.genderOtherBg : themeColors.genderMaleBg));
      bg.setAttribute("stroke", n.gender === "female" ? themeColors.genderFemale : (n.gender === "other" ? themeColors.genderOther : themeColors.genderMale));
      bg.setAttribute("stroke-width", "1.5");
      g.appendChild(bg);

      const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
      txt.setAttribute("x", "32");
      txt.setAttribute("y", "32");
      txt.setAttribute("text-anchor", "middle");
      txt.setAttribute("dominant-baseline", "central");
      txt.setAttribute("fill", n.gender === "female" ? themeColors.genderFemale : (n.gender === "other" ? themeColors.genderOther : themeColors.genderMale));
      txt.setAttribute("font-size", "18");
      txt.setAttribute("font-weight", "700");
      txt.textContent = initials;
      g.appendChild(txt);
    }

    const name = document.createElementNS("http://www.w3.org/2000/svg", "text");
    name.setAttribute("x", "64");
    name.setAttribute("y", "28");
    name.setAttribute("class", "card-name");
    name.setAttribute("fill", themeColors.textPrimary);
    name.textContent = n.firstName;
    g.appendChild(name);

    const dates = document.createElementNS("http://www.w3.org/2000/svg", "text");
    dates.setAttribute("x", "64");
    dates.setAttribute("y", "46");
    dates.setAttribute("class", "card-dates");
    dates.setAttribute("fill", themeColors.textSecondary);
    dates.textContent = (n.birthDate || "??") + " \u2014 " + (n.deathDate || "??");
    g.appendChild(dates);

    if (n.occupation) {
      const occ = document.createElementNS("http://www.w3.org/2000/svg", "text");
      occ.setAttribute("x", "10");
      occ.setAttribute("y", "82");
      occ.setAttribute("class", "card-occupation");
      occ.setAttribute("fill", themeColors.textMuted);
      occ.textContent = n.occupation;
      g.appendChild(occ);
    }

    g.style.cursor = _dragMode ? "move" : "pointer";
    
    g.addEventListener("mousedown", (e) => {
      if (!_dragMode) return;
      e.stopPropagation();
      e.preventDefault();

      const isSelected = window._selectedIds && window._selectedIds.has(n.id);
      if (isSelected && window._selectedIds.size > 1) {
        _draggedCards = [];
        _dragOffsets = [];
        _lastNodes.forEach(node => {
          if (window._selectedIds.has(node.id)) {
            _draggedCards.push(node);
            _dragOffsets.push({ dx: node.x - n.x, dy: node.y - n.y });
          }
        });
      } else {
        _draggedCards = [n];
        _dragOffsets = [{ dx: 0, dy: 0 }];
      }

      _draggingCard = n;
      _dragStartPos = { x: e.clientX, y: e.clientY };

      _draggedCards.forEach(dc => {
        const el = _svgEl.querySelector(`[data-id="${dc.id}"]`);
        if (el) el.style.opacity = "0.7";
      });
    });

    g.addEventListener("click", (e) => {
      e.stopPropagation();
      if (_draggingCard) return;
      if (_onSelectCallback) _onSelectCallback(n.id);
    });
    g.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      if (_onFocusCallback) _onFocusCallback(n.id);
    });

    zoomGroup.appendChild(g);
  });

  if (window._massSelectionMode) {
    nodes.forEach(n => {
      const mg = document.createElementNS("http://www.w3.org/2000/svg", "g");
      mg.setAttribute("class", "card-select-checkbox");
      mg.setAttribute("transform", `translate(${n.x}, ${n.y})`);
      mg.style.cursor = "pointer";
      mg.style.display = "block";

      const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      r.setAttribute("width", "20");
      r.setAttribute("height", "20");
      r.setAttribute("x", String(n.width - 26));
      r.setAttribute("y", "4");
      r.setAttribute("rx", "4");
      r.setAttribute("fill", window._selectedIds.has(n.id) ? "#e74c3c" : "rgba(255,255,255,0.9)");
      r.setAttribute("stroke", "#ccc");
      r.setAttribute("stroke-width", "1.5");
      mg.appendChild(r);

      let check = null;
      if (window._selectedIds.has(n.id)) {
        check = document.createElementNS("http://www.w3.org/2000/svg", "text");
        check.setAttribute("x", String(n.width - 16));
        check.setAttribute("y", "19");
        check.setAttribute("text-anchor", "middle");
        check.setAttribute("fill", "#fff");
        check.setAttribute("font-size", "14");
        check.setAttribute("font-weight", "bold");
        check.textContent = "\u2713";
        mg.appendChild(check);
      }

      mg.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (window._selectedIds.has(n.id)) {
          window._selectedIds.delete(n.id);
          r.setAttribute("fill", "rgba(255,255,255,0.9)");
          if (check) { check.remove(); check = null; }
        } else {
          window._selectedIds.add(n.id);
          r.setAttribute("fill", "#e74c3c");
          check = document.createElementNS("http://www.w3.org/2000/svg", "text");
          check.setAttribute("x", String(n.width - 16));
          check.setAttribute("y", "19");
          check.setAttribute("text-anchor", "middle");
          check.setAttribute("fill", "#fff");
          check.setAttribute("font-size", "14");
          check.setAttribute("font-weight", "bold");
          check.textContent = "\u2713";
          mg.appendChild(check);
        }
        updateSelectionBar();
      });

      zoomGroup.appendChild(mg);
    });
  }

  return nodes;
}

function updateSelectionBar() {
  const count = document.getElementById("mass-count");
  if (count) {
    count.textContent = window._selectedIds.size;
  }
}

function toggleDragMode() {
  _dragMode = !_dragMode;
  const container = document.getElementById('canvas-container');
  if (_dragMode) {
    container.classList.add('drag-mode');
    showToast('Режим перемещения: перетаскивайте карточки. Выделите несколько для группового перемещения', 'info', 3000);
  } else {
    container.classList.remove('drag-mode');
  }
  if (_lastMembers.length > 0) {
    renderTree(_lastMembers, { nodes: _lastNodes, links: _lastLinks }, _lastFocusId);
  }
}

document.addEventListener('mousemove', (e) => {
  if (!_draggingCard || !_dragStartPos) return;
  const dx = (e.clientX - _dragStartPos.x) / _transformState.k;
  const dy = (e.clientY - _dragStartPos.y) / _transformState.k;
  _dragStartPos = { x: e.clientX, y: e.clientY };

  _draggedCards.forEach((dc, i) => {
    dc.x += dx;
    dc.y += dy;
    const el = _svgEl.querySelector(`[data-id="${dc.id}"]`);
    if (el) {
      el.setAttribute('transform', `translate(${dc.x}, ${dc.y})`);
    }
  });

  _updateLinks();
});

document.addEventListener('mouseup', () => {
  if (_draggingCard) {
    _draggedCards.forEach(dc => {
      const el = _svgEl.querySelector(`[data-id="${dc.id}"]`);
      if (el) el.style.opacity = "";
    });
    _draggingCard = null;
    _dragStartPos = null;
    _draggedCards = [];
    _dragOffsets = [];
    if (_lastMembers.length > 0) {
      renderTree(_lastMembers, { nodes: _lastNodes, links: _lastLinks }, _lastFocusId);
    }
  }
});
