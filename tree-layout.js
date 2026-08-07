const CARD_W = 220;
const CARD_H = 100;
const H_GAP = 60;
const V_GAP = 80;

function calculateTreeLayout(members, focusId) {
  const nodes = [];
  const links = [];
  const addedIds = new Set();

  const focus = members.find(m => m.id === focusId);
  if (!focus) return { nodes, links };

  function addNode(member, x, y, role) {
    if (!member || addedIds.has(member.id)) return;
    addedIds.add(member.id);
    nodes.push({
      id: member.id, x, y,
      width: CARD_W, height: CARD_H,
      firstName: member.firstName,
      lastName: member.lastName,
      maidenName: member.maidenName || "",
      gender: member.gender,
      birthDate: member.birthDate,
      deathDate: member.deathDate,
      occupation: member.occupation || "",
      avatar: member.avatar || "",
      role
    });
  }

  function getById(id) { return id ? members.find(m => m.id === id) : null; }

  function getAllSpouses(member) {
    if (!member) return [];
    const spouses = [];
    const seen = new Set();
    if (member.spouses) {
      member.spouses.forEach(s => {
        const sp = getById(s.id);
        if (sp && !seen.has(sp.id)) { seen.add(sp.id); spouses.push(sp); }
      });
    }
    members.forEach(m => {
      if (m.id === member.id) return;
      if (m.spouses && m.spouses.some(s => s.id === member.id)) {
        if (!seen.has(m.id)) { seen.add(m.id); spouses.push(m); }
      }
    });
    if (spouses.length === 0) {
      const partnerIds = new Set();
      for (const child of members) {
        if (child.fatherId === member.id && child.motherId) partnerIds.add(child.motherId);
        if (child.motherId === member.id && child.fatherId) partnerIds.add(child.fatherId);
      }
      for (const pid of partnerIds) {
        const p = getById(pid);
        if (p && !seen.has(p.id)) { seen.add(p.id); spouses.push(p); }
      }
    }
    return spouses;
  }

  function getSpouse(member) {
    const all = getAllSpouses(member);
    if (all.length === 0) return null;
    for (const sp of all) {
      const hasChildren = members.some(m =>
        (m.fatherId === member.id && m.motherId === sp.id) ||
        (m.fatherId === sp.id && m.motherId === member.id)
      );
      if (hasChildren) return sp;
    }
    return all[0];
  }

  function ancWidth(person, visited) {
    if (!person || visited.has(person.id)) return CARD_W;
    visited.add(person.id);
    const f = getById(person.fatherId);
    const m = getById(person.motherId);
    if (!f && !m) return CARD_W;
    if (f && m) return ancWidth(f, visited) + H_GAP + ancWidth(m, visited);
    return ancWidth((f || m), visited);
  }

  function getAncestorWidth(person) {
    if (!person) return 0;
    const f = getById(person.fatherId);
    const m = getById(person.motherId);
    if (!f && !m) return 0;
    if (f && m) return ancWidth(f, new Set()) + H_GAP + ancWidth(m, new Set());
    return ancWidth(f || m, new Set());
  }

  function placeUp(person, cx, personY, visited) {
    if (!person || visited.has(person.id)) {
      if (person) addNode(person, cx - CARD_W / 2, personY, 'ancestor');
      return;
    }
    visited.add(person.id);
    addNode(person, cx - CARD_W / 2, personY, 'ancestor');

    const f = getById(person.fatherId);
    const m = getById(person.motherId);
    if (!f && !m) return;

    const py = personY - (CARD_H + V_GAP);

    if (f && m) {
      const fw = ancWidth(f, new Set());
      const mw = ancWidth(m, new Set());
      const tw = fw + H_GAP + mw;
      const fcx = cx - tw / 2 + fw / 2;
      const mcx = cx + tw / 2 - mw / 2;

      placeUp(f, fcx, py, visited);
      placeUp(m, mcx, py, visited);

      links.push({ type: 'spouse', leftId: f.id, rightId: m.id });
      links.push({ type: 'line', childId: person.id, parentIds: [f.id, m.id] });
    } else {
      const s = f || m;
      placeUp(s, cx, py, visited);
      links.push({ type: 'line', childId: person.id, parentIds: [s.id] });
    }
  }

  // ============ MAIN ============

  const primarySpouse = getSpouse(focus);
  const allFocusSpouses = getAllSpouses(focus);
  const fy = 0;

  if (primarySpouse) {
    const focusAncW = getAncestorWidth(focus);
    const spouseAncW = getAncestorWidth(primarySpouse);
    const ancestorSpacing = focusAncW + H_GAP + spouseAncW;
    const pairW = CARD_W * 2 + H_GAP;
    const spacing = Math.max(pairW, ancestorSpacing);

    const fx = -spacing / 2;
    const sx = spacing / 2;
    addNode(focus, fx, fy, 'focus');
    addNode(primarySpouse, sx, fy, 'spouse');
    links.push({ type: 'spouse', leftId: focus.id, rightId: primarySpouse.id });

    if (focus.fatherId || focus.motherId) placeUp(focus, fx + CARD_W / 2, fy, new Set());
    if (primarySpouse.fatherId || primarySpouse.motherId) placeUp(primarySpouse, sx + CARD_W / 2, fy, new Set());
  } else {
    addNode(focus, 0, fy, 'focus');
    if (focus.fatherId || focus.motherId) placeUp(focus, CARD_W / 2, fy, new Set());
  }

  // ============ CHILDREN ============

  const childY = fy + CARD_H + V_GAP;
  const allSpouseIds = new Set(allFocusSpouses.map(s => s.id));

  const children = members.filter(m => {
    if (m.fatherId === focus.id || m.motherId === focus.id) return true;
    if (allSpouseIds.has(m.fatherId) && m.motherId === focus.id) return true;
    if (allSpouseIds.has(m.motherId) && m.fatherId === focus.id) return true;
    return false;
  });

  const parentMidX = primarySpouse
    ? (() => {
        const focusAncW = getAncestorWidth(focus);
        const spouseAncW = getAncestorWidth(primarySpouse);
        const ancestorSpacing = focusAncW + H_GAP + spouseAncW;
        const pairW = CARD_W * 2 + H_GAP;
        const spacing = Math.max(pairW, ancestorSpacing);
        return (-spacing / 2 + CARD_W / 2 + spacing / 2 + CARD_W / 2) / 2;
      })()
    : CARD_W / 2;

  if (children.length > 0) {
    const groups = children.map(c => {
      const cAllSpouses = getAllSpouses(c);
      const gc = members.filter(m => {
        if (cAllSpouses.length > 0) {
          const spIds = cAllSpouses.map(s => s.id);
          if (spIds.includes(m.fatherId) || spIds.includes(m.motherId)) {
            if (m.fatherId !== c.id && m.motherId !== c.id) return true;
          }
        }
        return m.fatherId === c.id || m.motherId === c.id;
      });
      const spouseBlockW = cAllSpouses.length > 0
        ? CARD_W * (1 + cAllSpouses.length) + H_GAP * cAllSpouses.length
        : CARD_W;
      let w = spouseBlockW;
      if (gc.length > 0) {
        const gcW = gc.length * CARD_W + (gc.length - 1) * H_GAP;
        w = Math.max(w, gcW);
      }
      return { child: c, allSpouses: cAllSpouses, grandchildren: gc, width: w };
    });

    const totalW = groups.reduce((s, g) => s + g.width, 0) + (groups.length - 1) * H_GAP;
    let curX = parentMidX - totalW / 2;
    const gcY = childY + CARD_H + V_GAP;

    groups.forEach(gr => {
      const gcx = curX + gr.width / 2;

      if (gr.allSpouses.length > 0) {
        const totalSpouseW = CARD_W * (1 + gr.allSpouses.length) + H_GAP * gr.allSpouses.length;
        const spouseStartX = gcx - totalSpouseW / 2;
        addNode(gr.child, spouseStartX, childY, 'child');
        const focusParentIds = primarySpouse ? [focus.id, primarySpouse.id] : [focus.id];
        links.push({ type: 'line', childId: gr.child.id, parentIds: focusParentIds });
        gr.allSpouses.forEach((sp, i) => {
          const spX = spouseStartX + CARD_W + H_GAP + i * (CARD_W + H_GAP);
          addNode(sp, spX, childY, 'spouse');
          links.push({ type: 'spouse', leftId: gr.child.id, rightId: sp.id });
        });
      } else {
        addNode(gr.child, gcx - CARD_W / 2, childY, 'child');
        const focusParentIds = primarySpouse ? [focus.id, primarySpouse.id] : [focus.id];
        links.push({ type: 'line', childId: gr.child.id, parentIds: focusParentIds });
      }

      gr.grandchildren.forEach((g, i) => {
        const gx = gcx - (gr.grandchildren.length * CARD_W + (gr.grandchildren.length - 1) * H_GAP) / 2 + i * (CARD_W + H_GAP);
        addNode(g, gx, gcY, 'grandchild');
        links.push({ type: 'line', childId: g.id, parentIds: [gr.child.id] });
      });

      curX += gr.width + H_GAP;
    });
  }

  return { nodes, links };
}
