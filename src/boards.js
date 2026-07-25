/**
 * Board derivation module
 *
 * Pure functions deriving board state from the journal alone.
 * Deterministic: same journal in, same output out. All lists sorted.
 *
 * Boards are accounts with kind "board". Board-specific state (membership,
 * stance, premises, cross-board exposures) is carried entirely by annotate
 * postings with structured content fields. No new posting kinds or verifier
 * changes are required.
 *
 * Divergences are computed deterministically from derived state -- they are
 * read-side observations, never writable state.
 */

const { derive } = require("./derive");

// --------------- reversal helpers ---------------

function reversedSet(postings) {
  const ids = new Set();
  for (const p of postings) {
    if (p.kind === "reverse") {
      for (const pred of p.predecessors) ids.add(pred);
    }
  }
  return ids;
}

function livePostings(postings) {
  const rev = reversedSet(postings);
  return postings.filter((p) => !rev.has(p.id));
}

// --------------- membership ---------------

function deriveBoardMemberships(postings, accounts) {
  const live = livePostings(postings);
  const boardIds = new Set(
    Object.entries(accounts)
      .filter(([, a]) => a.kind === "board")
      .map(([id]) => id)
  );

  // latest-wins per board/member pair
  const map = {}; // boardId -> { memberId -> { status, posting } }
  const diagnostics = [];

  for (const p of live) {
    if (p.kind !== "annotate" || !p.content.membership) continue;

    const mem = p.content.membership;
    if (typeof mem !== "object" || !mem.board || !mem.member || !mem.action) {
      diagnostics.push({ posting: p.id, issue: "malformed membership annotation", content: mem });
      continue;
    }
    if (!boardIds.has(mem.board)) {
      diagnostics.push({ posting: p.id, issue: "membership references non-board account", board: mem.board });
      continue;
    }
    if (mem.action !== "added" && mem.action !== "removed") {
      diagnostics.push({ posting: p.id, issue: "membership action must be 'added' or 'removed'", action: mem.action });
      continue;
    }

    if (!map[mem.board]) map[mem.board] = {};
    map[mem.board][mem.member] = { status: mem.action, posting: p.id };
  }

  // Build result: per board, current members and removed members
  const result = {};
  for (const boardId of [...boardIds].sort()) {
    const entries = map[boardId] || {};
    const current = [];
    const removed = [];
    for (const [memberId, info] of Object.entries(entries).sort((a, b) => a[0].localeCompare(b[0]))) {
      if (info.status === "added") current.push({ member: memberId, via: info.posting });
      else removed.push({ member: memberId, via: info.posting });
    }
    result[boardId] = { current, removed };
  }

  return { memberships: result, diagnostics };
}

// --------------- stance ---------------

function deriveBoardStances(postings, accounts) {
  const live = livePostings(postings);
  const boardIds = new Set(
    Object.entries(accounts)
      .filter(([, a]) => a.kind === "board")
      .map(([id]) => id)
  );

  const diagnostics = [];
  // Per board: current stance (latest wins) + history (all)
  const current = {};  // boardId -> { stance, posting }
  const history = {};  // boardId -> [{ stance, posting, at }]

  for (const p of live) {
    if (p.kind !== "annotate" || !p.content.stance) continue;

    const st = p.content.stance;
    if (typeof st !== "object" || !st.board || !st.position) {
      diagnostics.push({ posting: p.id, issue: "malformed stance annotation", content: st });
      continue;
    }
    if (!boardIds.has(st.board)) {
      diagnostics.push({ posting: p.id, issue: "stance references non-board account", board: st.board });
      continue;
    }

    if (!history[st.board]) history[st.board] = [];
    history[st.board].push({ stance: st.position, posting: p.id, at: p.at });
    current[st.board] = { stance: st.position, posting: p.id };
  }

  const result = {};
  for (const boardId of [...boardIds].sort()) {
    result[boardId] = {
      current: current[boardId] || null,
      history: (history[boardId] || []),
    };
  }

  return { stances: result, diagnostics };
}

// --------------- premises ---------------

function deriveBoardPremises(postings, accounts) {
  const live = livePostings(postings);
  const boardIds = new Set(
    Object.entries(accounts)
      .filter(([, a]) => a.kind === "board")
      .map(([id]) => id)
  );

  const diagnostics = [];
  // Per board, per key: latest set/withdraw wins
  const map = {}; // boardId -> { key -> { action, value, posting } }
  const historyMap = {}; // boardId -> [{ key, action, value, posting, at }]

  for (const p of live) {
    if (p.kind !== "annotate" || !p.content.board_premise) continue;

    const bp = p.content.board_premise;
    if (typeof bp !== "object" || !bp.board || !bp.key || !bp.action) {
      diagnostics.push({ posting: p.id, issue: "malformed board_premise annotation", content: bp });
      continue;
    }
    if (!boardIds.has(bp.board)) {
      diagnostics.push({ posting: p.id, issue: "premise references non-board account", board: bp.board });
      continue;
    }
    if (bp.action !== "set" && bp.action !== "withdraw") {
      diagnostics.push({ posting: p.id, issue: "premise action must be 'set' or 'withdraw'", action: bp.action });
      continue;
    }

    if (!map[bp.board]) map[bp.board] = {};
    if (!historyMap[bp.board]) historyMap[bp.board] = [];

    if (bp.action === "withdraw" && !map[bp.board][bp.key]) {
      diagnostics.push({ posting: p.id, issue: "premise withdrawal with no known prior premise", board: bp.board, key: bp.key });
    }

    map[bp.board][bp.key] = { action: bp.action, value: bp.value, posting: p.id, category: bp.category };
    historyMap[bp.board].push({ key: bp.key, action: bp.action, value: bp.value, posting: p.id, at: p.at, category: bp.category });
  }

  const result = {};
  for (const boardId of [...boardIds].sort()) {
    const entries = map[boardId] || {};
    const current = [];
    for (const [key, info] of Object.entries(entries).sort((a, b) => a[0].localeCompare(b[0]))) {
      if (info.action === "set") {
        current.push({ key, value: info.value, category: info.category, via: info.posting });
      }
    }
    result[boardId] = {
      current,
      history: historyMap[boardId] || [],
    };
  }

  return { premises: result, diagnostics };
}

// --------------- cross-board exposures ---------------

function deriveCrossBoardExposures(postings, accounts) {
  const live = livePostings(postings);
  const boardIds = new Set(
    Object.entries(accounts)
      .filter(([, a]) => a.kind === "board")
      .map(([id]) => id)
  );
  const allAccountIds = new Set(Object.keys(accounts));

  const diagnostics = [];
  const exposures = [];

  for (const p of live) {
    if (p.kind !== "annotate" || !p.content.cross_board_exposure) continue;

    const exp = p.content.cross_board_exposure;
    if (typeof exp !== "object" || !exp.source_board || !exp.target_board || !exp.accounts) {
      diagnostics.push({ posting: p.id, issue: "malformed cross_board_exposure annotation", content: exp });
      continue;
    }
    if (!boardIds.has(exp.source_board)) {
      diagnostics.push({ posting: p.id, issue: "exposure source is not a board account", source: exp.source_board });
      continue;
    }
    if (!boardIds.has(exp.target_board)) {
      diagnostics.push({ posting: p.id, issue: "exposure target is not a board account", target: exp.target_board });
      continue;
    }
    if (exp.source_board === exp.target_board) {
      diagnostics.push({ posting: p.id, issue: "exposure source and target are the same board", board: exp.source_board });
      continue;
    }
    if (!Array.isArray(exp.accounts)) {
      diagnostics.push({ posting: p.id, issue: "exposure accounts must be an array", content: exp });
      continue;
    }

    // Validate referenced accounts exist
    const missing = exp.accounts.filter((a) => !allAccountIds.has(a));
    if (missing.length > 0) {
      diagnostics.push({ posting: p.id, issue: "exposure references nonexistent accounts", missing });
      continue;
    }

    exposures.push({
      source_board: exp.source_board,
      target_board: exp.target_board,
      accounts: exp.accounts.slice().sort(),
      description: exp.description || null,
      via: p.id,
    });
  }

  exposures.sort((a, b) => {
    const s = a.source_board.localeCompare(b.source_board);
    if (s !== 0) return s;
    return a.target_board.localeCompare(b.target_board);
  });

  return { exposures, diagnostics };
}

// --------------- divergences ---------------

function deriveBoardDivergences(postings, accounts) {
  const { memberships } = deriveBoardMemberships(postings, accounts);
  const { premises } = deriveBoardPremises(postings, accounts);
  const { stances } = deriveBoardStances(postings, accounts);
  const { exposures } = deriveCrossBoardExposures(postings, accounts);

  const boardIds = Object.entries(accounts)
    .filter(([, a]) => a.kind === "board")
    .map(([id]) => id)
    .sort();

  const divergences = [];

  // 1. Overlapping membership: members on more than one board
  const memberBoards = {}; // memberId -> [boardId]
  for (const boardId of boardIds) {
    const mem = memberships[boardId];
    if (!mem) continue;
    for (const m of mem.current) {
      if (!memberBoards[m.member]) memberBoards[m.member] = [];
      memberBoards[m.member].push(boardId);
    }
  }
  const overlaps = [];
  for (const [member, boards] of Object.entries(memberBoards).sort((a, b) => a[0].localeCompare(b[0]))) {
    if (boards.length > 1) {
      overlaps.push({ member, boards: boards.slice().sort() });
      divergences.push({
        type: "overlapping_membership",
        member,
        boards: boards.slice().sort(),
      });
    }
  }

  // 2. Premise variance: same premise key, different values across connected boards
  const connectedPairs = new Set();
  for (const exp of exposures) {
    const key = [exp.source_board, exp.target_board].sort().join("||");
    connectedPairs.add(key);
  }
  // Also consider boards sharing a member as connected
  for (const { boards } of overlaps) {
    for (let i = 0; i < boards.length; i++) {
      for (let j = i + 1; j < boards.length; j++) {
        connectedPairs.add([boards[i], boards[j]].sort().join("||"));
      }
    }
  }

  for (const pairKey of [...connectedPairs].sort()) {
    const [boardA, boardB] = pairKey.split("||");
    const premA = premises[boardA];
    const premB = premises[boardB];
    if (!premA || !premB) continue;

    const keysA = new Map(premA.current.map((p) => [p.key, p]));
    for (const pb of premB.current) {
      const pa = keysA.get(pb.key);
      if (pa && JSON.stringify(pa.value) !== JSON.stringify(pb.value)) {
        divergences.push({
          type: "premise_variance",
          key: pb.key,
          boards: [boardA, boardB].sort(),
          values: { [boardA]: pa.value, [boardB]: pb.value },
        });
      }
    }
  }

  // 3. Stance variance between connected boards
  for (const pairKey of [...connectedPairs].sort()) {
    const [boardA, boardB] = pairKey.split("||");
    const stA = stances[boardA] && stances[boardA].current;
    const stB = stances[boardB] && stances[boardB].current;
    if (stA && stB && stA.stance !== stB.stance) {
      divergences.push({
        type: "stance_variance",
        boards: [boardA, boardB].sort(),
        stances: { [boardA]: stA.stance, [boardB]: stB.stance },
      });
    }
  }

  // 4. Settled origin + open affected: an exposure's source accounts are
  //    settled at origin but the affected board's related accounts are still open
  for (const exp of exposures) {
    for (const acctId of exp.accounts) {
      const acct = accounts[acctId];
      if (acct && acct.state === "SETTLED") {
        // Check if any accounts on the target board referencing this are still open
        const targetAccounts = Object.entries(accounts)
          .filter(([, a]) => a.state === "OPEN")
          .filter(([id]) => {
            // Check if this account is addressed by any posting that also addresses the target board
            return postings.some((p) =>
              p.accounts.includes(id) && p.accounts.includes(exp.target_board)
            );
          })
          .map(([id]) => id);

        if (targetAccounts.length > 0) {
          divergences.push({
            type: "local_settlement_external_open",
            settled_account: acctId,
            source_board: exp.source_board,
            target_board: exp.target_board,
            open_accounts: targetAccounts.sort(),
          });
        }
      }
    }
  }

  // 5. Contested projection: same account addressed by postings from members
  //    of different boards with different stances
  const boardMembers = {}; // boardId -> Set of current members
  for (const boardId of boardIds) {
    const mem = memberships[boardId];
    if (!mem) continue;
    boardMembers[boardId] = new Set(mem.current.map((m) => m.member));
  }

  // For each account, check if it has postings from authors in boards with different stances
  const accountAuthors = {}; // accountId -> Set of authors
  for (const p of livePostings(postings)) {
    for (const acctId of p.accounts) {
      if (!accountAuthors[acctId]) accountAuthors[acctId] = new Set();
      accountAuthors[acctId].add(p.author);
    }
  }

  for (const [acctId, authors] of Object.entries(accountAuthors)) {
    if (accounts[acctId] && accounts[acctId].kind === "board") continue; // skip board accounts themselves
    const boardsInvolved = new Set();
    for (const author of authors) {
      for (const boardId of boardIds) {
        if (boardMembers[boardId] && boardMembers[boardId].has(author)) {
          boardsInvolved.add(boardId);
        }
      }
    }
    if (boardsInvolved.size < 2) continue;
    const boardArr = [...boardsInvolved].sort();
    const stanceValues = new Set();
    for (const b of boardArr) {
      if (stances[b] && stances[b].current) stanceValues.add(stances[b].current.stance);
    }
    if (stanceValues.size > 1) {
      divergences.push({
        type: "contested_projection",
        account: acctId,
        boards: boardArr,
      });
    }
  }

  // Sort divergences deterministically
  divergences.sort((a, b) => {
    const t = a.type.localeCompare(b.type);
    if (t !== 0) return t;
    return JSON.stringify(a).localeCompare(JSON.stringify(b));
  });

  return { divergences, overlaps };
}

// --------------- main entry point ---------------

function deriveBoards(postings, accounts) {
  if (!accounts) accounts = derive(postings);

  const boardIds = Object.entries(accounts)
    .filter(([, a]) => a.kind === "board")
    .map(([id]) => id)
    .sort();

  const { memberships, diagnostics: memDiag } = deriveBoardMemberships(postings, accounts);
  const { stances, diagnostics: stanceDiag } = deriveBoardStances(postings, accounts);
  const { premises, diagnostics: premDiag } = deriveBoardPremises(postings, accounts);
  const { exposures, diagnostics: expDiag } = deriveCrossBoardExposures(postings, accounts);
  const { divergences, overlaps } = deriveBoardDivergences(postings, accounts);

  // Additional informational diagnostics
  const infoDiag = [];
  for (const boardId of boardIds) {
    const mem = memberships[boardId];
    if (!mem || mem.current.length === 0) {
      infoDiag.push({ board: boardId, issue: "board account with no members" });
    }
  }
  // Accounts on many boards
  const memberBoardCount = {};
  for (const boardId of boardIds) {
    const mem = memberships[boardId];
    if (!mem) continue;
    for (const m of mem.current) {
      memberBoardCount[m.member] = (memberBoardCount[m.member] || 0) + 1;
    }
  }
  for (const [member, count] of Object.entries(memberBoardCount).sort((a, b) => a[0].localeCompare(b[0]))) {
    if (count > 1) {
      infoDiag.push({ member, issue: "account on multiple boards", count });
    }
  }

  const diagnostics = [
    ...memDiag,
    ...stanceDiag,
    ...premDiag,
    ...expDiag,
    ...infoDiag,
  ];

  // Build per-board map
  const boards = {};
  for (const boardId of boardIds) {
    boards[boardId] = {
      account: accounts[boardId],
      memberships: memberships[boardId] || { current: [], removed: [] },
      stance: stances[boardId] || { current: null, history: [] },
      premises: premises[boardId] || { current: [], history: [] },
      incoming_exposures: exposures.filter((e) => e.target_board === boardId),
      outgoing_exposures: exposures.filter((e) => e.source_board === boardId),
    };
  }

  return {
    boards,
    overlaps,
    exposures,
    divergences,
    diagnostics,
  };
}

module.exports = {
  deriveBoards,
  deriveBoardMemberships,
  deriveBoardStances,
  deriveBoardPremises,
  deriveCrossBoardExposures,
  deriveBoardDivergences,
};
