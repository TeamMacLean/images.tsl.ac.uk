const thinky = require("../lib/thinky");

/**
 * One row per safe name in use, keyed by "<scope>/<safeName>".
 *
 * RethinkDB has no unique secondary index, but a primary key *is* unique and
 * an insert against an existing one fails atomically. That is what lets
 * lib/safeName.js hand out a name to exactly one writer, however many are
 * racing.
 */
const SafeNameLock = thinky.createModel(
  "SafeNameLock",
  {
    id: thinky.type.string(),
    ownerID: thinky.type.string(),
    createdAt: thinky.type.date().default(thinky.r.now()),
  },
  { enforce_extra: "none" },
);

module.exports = SafeNameLock;
