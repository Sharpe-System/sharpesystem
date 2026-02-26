export async function writeIntake(uid, intake) {
  if (!uid) throw new Error("missing_uid");

  const ref = fsDoc(db, "users", uid);
  const snap = await fsGetDoc(ref);
  if (!snap.exists()) throw new Error("user_doc_missing");

  const cur = snap.data() || {};

  const patch = {
    intake,
    updatedAt: new Date().toISOString()
  };

  // preserve protected fields EXACTLY if present
  if ("tier" in cur) patch.tier = cur.tier;
  if ("active" in cur) patch.active = cur.active;
  if ("role" in cur) patch.role = cur.role;

  await fsUpdateDoc(ref, patch);
}
