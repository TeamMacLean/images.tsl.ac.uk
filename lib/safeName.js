const thinky = require("./thinky");
const Util = require("./util");
const SafeNameLock = require("../models/safeNameLock");

const r = thinky.r;
const TABLE = "SafeNameLock";

// dbReady() only waits for the *database*. On a cold start the table itself is
// still being created, and inserting into it then fails, so every save in the
// first moments of a fresh deploy would error.
const tableReady = () => SafeNameLock.tableReady();

// Enough headroom for any realistic number of same-named siblings while still
// bounding the loop if something pathological happens.
const MAX_ATTEMPTS = 200;

const keyFor = (scope, safeName) => `${scope}/${safeName}`;

/**
 * Claim a safe name for `ownerID` within `scope`, retrying on collision.
 *
 * Picking a name by reading the siblings and then writing is a read-then-write
 * race: two saves arriving together both see "leaf_1" free and both take it,
 * ending up sharing one directory with one of them unreachable. Renaming the
 * loser afterwards is worse, because by then both records point at the same
 * directory and moving it takes the winner's data with it.
 *
 * So the name is reserved *before* the caller creates anything: each candidate
 * is inserted as a primary key, and whoever loses the insert simply tries the
 * next candidate.
 *
 * @param {string} scope   collision domain, e.g. `project/<groupID>`
 * @param {string} desiredName  the human name to derive a safe name from
 * @param {string} ownerID the record claiming it ("" for an unsaved record)
 * @param {Array}  siblings records already in this scope, to skip known-taken
 *                 names without a pointless round trip each
 * @returns {Promise<string>} the claimed safe name
 */
async function claim(scope, desiredName, ownerID, siblings = []) {
  await tableReady();

  const base = Util._toSafeName(desiredName);
  const taken = new Set(
    (Array.isArray(siblings) ? siblings : [])
      .filter((s) => s && s.id !== ownerID)
      .map((s) => s && s.safeName)
      .filter(Boolean),
  );

  let candidate = base;
  let counter = 1;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (taken.has(candidate)) {
      counter += 1;
      candidate = `${base}_${counter}`;
      continue;
    }

    const id = keyFor(scope, candidate);
    const result = await r
      .table(TABLE)
      .insert({ id, ownerID: ownerID || "", createdAt: r.now() })
      .run();

    if (result.inserted === 1) {
      return candidate;
    }

    // Someone already holds this name. If that someone is us, this is a
    // re-save of an unchanged record and the name is still ours.
    const holder = await r.table(TABLE).get(id).run();
    if (holder && ownerID && holder.ownerID === ownerID) {
      return candidate;
    }

    counter += 1;
    candidate = `${base}_${counter}`;
  }

  throw new Error(
    `Could not allocate a safe name for "${desiredName}" in ${scope} after ${MAX_ATTEMPTS} attempts`,
  );
}

/** Give a name back, so a later record can use it. Never throws. */
async function release(scope, safeName) {
  if (!safeName) return;
  try {
    await tableReady();
    await r.table(TABLE).get(keyFor(scope, safeName)).delete().run();
  } catch (err) {
    // A leaked lock only costs a "_2" suffix later; it must never fail a save.
    console.error("Failed to release safe name", scope, safeName, err);
  }
}

/**
 * Attach the owner id to a lock claimed before the record had one.
 * Without this a re-save of a brand new record cannot recognise its own lock.
 */
async function assignOwner(scope, safeName, ownerID) {
  if (!safeName || !ownerID) return;
  try {
    await tableReady();
    await r.table(TABLE).get(keyFor(scope, safeName)).update({ ownerID }).run();
  } catch (err) {
    console.error("Failed to record safe name owner", scope, safeName, err);
  }
}

module.exports = { claim, release, assignOwner, keyFor, MAX_ATTEMPTS, TABLE };
