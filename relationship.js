// Relationship calculator for the family tree

// Traverses up to find all ancestors and their generational distance
function getAncestors(members, id, depth = 0, path = [], visited = new Set()) {
  if (!id || visited.has(id)) return {};
  visited.add(id);

  const member = members.find(m => m.id === id);
  if (!member) return {};

  const ancestors = {};
  ancestors[id] = { depth, path };

  if (member.fatherId) {
    Object.assign(
      ancestors,
      getAncestors(members, member.fatherId, depth + 1, [...path, member.fatherId], visited)
    );
  }
  if (member.motherId) {
    Object.assign(
      ancestors,
      getAncestors(members, member.motherId, depth + 1, [...path, member.motherId], visited)
    );
  }

  return ancestors;
}

// Find children of a member
function getChildrenIds(members, parentId) {
  return members
    .filter(m => m.fatherId === parentId || m.motherId === parentId)
    .map(m => m.id);
}

// Undirected BFS to find any connection path (for marriage-based or complex paths)
function findShortestPath(members, startId, endId) {
  const queue = [[startId, []]];
  const visited = new Set([startId]);

  while (queue.length > 0) {
    const [currentId, path] = queue.shift();

    if (currentId === endId) {
      return path;
    }

    const current = members.find(m => m.id === currentId);
    if (!current) continue;

    // Get all neighbors and the type of relationship
    const neighbors = [];

    // Parents
    if (current.fatherId) neighbors.push({ id: current.fatherId, type: 'parent', gender: 'male' });
    if (current.motherId) neighbors.push({ id: current.motherId, type: 'parent', gender: 'female' });

    // Children
    const childrenIds = getChildrenIds(members, currentId);
    for (const childId of childrenIds) {
      const child = members.find(m => m.id === childId);
      if (child) {
        neighbors.push({ id: childId, type: 'child', gender: child.gender });
      }
    }

    // Spouses
    if (current.spouses && current.spouses.length > 0) {
      for (const sp of current.spouses) {
        const spouse = members.find(m => m.id === sp.id);
        if (spouse) {
          neighbors.push({ id: sp.id, type: 'spouse', gender: spouse.gender });
        }
      }
    }

    for (const n of neighbors) {
      if (!visited.has(n.id)) {
        visited.add(n.id);
        queue.push([n.id, [...path, { from: currentId, to: n.id, type: n.type, gender: n.gender }]]);
      }
    }
  }

  return null;
}

// Translates a path of relations to a Russian description
function describePath(path, targetGender) {
  if (!path || path.length === 0) return 'Нет связи';

  // Direct cases
  if (path.length === 1) {
    const step = path[0];
    if (step.type === 'spouse') {
      return targetGender === 'male' ? 'Муж' : 'Жена';
    }
    if (step.type === 'parent') {
      return targetGender === 'male' ? 'Отец' : 'Мать';
    }
    if (step.type === 'child') {
      return targetGender === 'male' ? 'Сын' : 'Дочь';
    }
  }

  // Common double links
  if (path.length === 2) {
    const [s1, s2] = path;
    
    // Spouse's parent
    if (s1.type === 'spouse' && s2.type === 'parent') {
      if (s1.gender === 'female') {
        return targetGender === 'male' ? 'Тесть (отец жены)' : 'Теща (мать жены)';
      } else {
        return targetGender === 'male' ? 'Свекор (отец мужа)' : 'Свекровь (мать мужа)';
      }
    }
    // Sibling's spouse
    if (s1.type === 'parent' && s2.type === 'child' && s1.to !== s2.to) {
      // This is a sibling
      return null; // Will be handled by genetic algorithm
    }
  }

  // Fallback description based on the chain
  const descriptionParts = [];
  let currentGender = '';
  
  for (let i = 0; i < path.length; i++) {
    const step = path[i];
    const isLast = i === path.length - 1;
    
    if (step.type === 'spouse') {
      descriptionParts.push(step.gender === 'male' ? 'муж' : 'жена');
    } else if (step.type === 'parent') {
      descriptionParts.push(step.gender === 'male' ? 'отец' : 'мать');
    } else if (step.type === 'child') {
      descriptionParts.push(step.gender === 'male' ? 'сын' : 'дочь');
    }
  }

  // Format: "Жена -> Брат -> Сын" -> "Сын брата жены" (Nephew of wife)
  // Let's build a simple chain description
  let desc = '';
  if (path[0].type === 'spouse') {
    const spouseWord = path[0].gender === 'male' ? 'мужа' : 'жены';
    if (path.length === 2) {
      const s2 = path[1];
      if (s2.type === 'parent') return targetGender === 'male' ? `Отец ${spouseWord}` : `Мать ${spouseWord}`;
      if (s2.type === 'child') return targetGender === 'male' ? `Сын (от др. брака) ${spouseWord}` : `Дочь (от др. брака) ${spouseWord}`;
      // Sibling of spouse
      // A -> spouse -> parent -> child (where child is not spouse)
    }
  }

  return 'Дальний родственник (через брак)';
}

function getRelationship(members, personAId, personBId) {
  if (personAId === personBId) return 'Вы сами';

  const personA = members.find(m => m.id === personAId);
  const personB = members.find(m => m.id === personBId);
  if (!personA || !personB) return 'Нет связи';

  const gB = personB.gender; // target gender

  // 1. Genetic Relationship Check via Ancestors
  const ancA = getAncestors(members, personAId);
  const ancB = getAncestors(members, personBId);

  const commonAncestorIds = Object.keys(ancA).filter(id => id in ancB);

  if (commonAncestorIds.length > 0) {
    // Find MRCA (Minimum sum of depths)
    let mrcaId = commonAncestorIds[0];
    let minSum = ancA[mrcaId].depth + ancB[mrcaId].depth;

    for (const id of commonAncestorIds) {
      const sum = ancA[id].depth + ancB[id].depth;
      if (sum < minSum) {
        minSum = sum;
        mrcaId = id;
      }
    }

    const dA = ancA[mrcaId].depth;
    const dB = ancB[mrcaId].depth;

    // Translate dA and dB to relationship
    if (dA === 0 && dB === 0) return 'Вы сами';
    
    // Direct Line (Ancestor)
    if (dA === 0) {
      if (dB === 1) return gB === 'male' ? 'Сын' : 'Дочь';
      if (dB === 2) return gB === 'male' ? 'Внук' : 'Внучка';
      if (dB === 3) return gB === 'male' ? 'Правнук' : 'Правнучка';
      return gB === 'male' ? `${dB - 2}-жды правнук` : `${dB - 2}-жды правнучка`;
    }
    
    // Direct Line (Descendant)
    if (dB === 0) {
      if (dA === 1) return gB === 'male' ? 'Отец' : 'Мать';
      if (dA === 2) return gB === 'male' ? 'Дедушка' : 'Бабушка';
      if (dA === 3) return gB === 'male' ? 'Прадедушка' : 'Прабабушка';
      const praCount = dA - 2;
      const prefix = 'пра'.repeat(praCount);
      return gB === 'male' ? `${prefix}дедушка` : `${prefix}бабушка`;
    }

    // Siblings / Cousins / Aunt-Uncle / Nephew-Niece
    if (dA === 1 && dB === 1) {
      // Check if they share both parents or only one
      const fatherA = personA.fatherId;
      const motherA = personA.motherId;
      const fatherB = personB.fatherId;
      const motherB = personB.motherId;
      
      const shareFather = fatherA && fatherA === fatherB;
      const shareMother = motherA && motherA === motherB;
      
      if (shareFather && shareMother) {
        return gB === 'male' ? 'Брат' : 'Сестра';
      } else if (shareFather || shareMother) {
        return gB === 'male' ? 'Единокровный/единоутробный брат' : 'Единокровная/единоутробная сестра';
      }
      return gB === 'male' ? 'Брат' : 'Сестра'; // Fallback
    }

    // Nephew / Niece
    if (dA === 2 && dB === 1) {
      return gB === 'male' ? 'Дядя' : 'Тетя';
    }
    if (dA === 1 && dB === 2) {
      return gB === 'male' ? 'Племянник' : 'Племянница';
    }

    // Great Uncle/Aunt or Grand Nephew/Niece
    if (dA === 3 && dB === 1) {
      return gB === 'male' ? 'Двоюродный дедушка' : 'Двоюродная бабушка';
    }
    if (dA === 1 && dB === 3) {
      return gB === 'male' ? 'Внучатый племянник' : 'Внучатая племянница';
    }

    // Cousins
    if (dA >= 2 && dB >= 2) {
      const degree = Math.min(dA, dB) - 1;
      const removed = Math.abs(dA - dB);

      let cousinType = '';
      if (degree === 1) cousinType = 'двоюродный';
      else if (degree === 2) cousinType = 'троюродный';
      else if (degree === 3) cousinType = 'четырехюродный';
      else cousinType = `${degree}-юродный`;

      let relationName = '';
      if (removed === 0) {
        relationName = gB === 'male' ? 'брат' : 'сестра';
      } else {
        // Person B is either in older or younger generation
        if (dB < dA) {
          // B is older generation (e.g. cousin once removed upwards: cousin of parent)
          relationName = gB === 'male' ? 'дядя' : 'тетя';
        } else {
          // B is younger generation (e.g. cousin once removed downwards: child of cousin)
          relationName = gB === 'male' ? 'племянник' : 'племянница';
        }
      }

      // Add gender capitalization
      const fullName = `${cousinType} ${relationName}`;
      return fullName.charAt(0).toUpperCase() + fullName.slice(1) + (removed > 0 ? ` (в ${removed}-м колене)` : '');
    }
  }

  // 2. Non-genetic Relationship via marriage path
  const path = findShortestPath(members, personAId, personBId);
  if (path) {
    const desc = describePath(path, gB);
    if (desc) return desc;
  }

  return 'Нет прямой связи';
}
