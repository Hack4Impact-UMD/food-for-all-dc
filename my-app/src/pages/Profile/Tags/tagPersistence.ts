import {
  collection,
  doc,
  Firestore,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import dataSources from "../../../config/dataSources";
import {
  editTagMetadata,
  normalizeTagColors,
  TagColorMap,
} from "../../../utils/tagColors";
import type { ClientAuditMetadata } from "../../../utils/clientAudit";

// One batch write is reserved for the master tag document. Keeping the entire
// rename in a single batch guarantees that Firestore applies all changes or none.
export const MAX_ATOMIC_TAG_RENAME_CLIENTS = 499;

export class TagRenameTooLargeError extends Error {
  constructor() {
    super("This tag is used by too many client profiles to rename safely.");
    this.name = "TagRenameTooLargeError";
  }
}

export interface TagMetadata {
  tags: string[];
  tagColors: TagColorMap;
}

export const removeTagMetadataIfUnused = async (
  db: Firestore,
  tag: string
): Promise<TagMetadata | null> => {
  const affectedClients = await getDocs(
    query(
      collection(db, dataSources.firebase.clientsCollection),
      where("tags", "array-contains", tag)
    )
  );
  if (!affectedClients.empty && affectedClients.docs.length > 0) return null;

  const tagsDocRef = doc(db, dataSources.firebase.tagsCollection, dataSources.firebase.tagsDocId);
  const tagsSnapshot = await getDoc(tagsDocRef);
  if (!tagsSnapshot.exists()) return null;

  const data = tagsSnapshot.data();
  const tags = Array.isArray(data.tags)
    ? data.tags.filter((savedTag): savedTag is string => typeof savedTag === "string")
    : [];
  const tagColors = normalizeTagColors(data.tagColors);
  const updatedMetadata = {
    tags: tags.filter((savedTag) => savedTag !== tag),
    tagColors: Object.fromEntries(
      Object.entries(tagColors).filter(([savedTag]) => savedTag !== tag)
    ),
  };

  if (updatedMetadata.tags.length === tags.length && !(tag in tagColors)) return null;

  await setDoc(tagsDocRef, updatedMetadata, { merge: true });
  return updatedMetadata;
};

interface SaveTagEditOptions {
  db: Firestore;
  tags: string[];
  tagColors: TagColorMap;
  tagColorPalette: string[];
  oldTag: string;
  newTag: string;
  newColor: string;
  auditMetadata: ClientAuditMetadata;
}

export const saveTagEdit = async ({
  db,
  tags,
  tagColors,
  tagColorPalette,
  oldTag,
  newTag,
  newColor,
  auditMetadata,
}: SaveTagEditOptions): Promise<{ tags: string[]; tagColors: TagColorMap }> => {
  const updatedMetadata = editTagMetadata(tags, tagColors, oldTag, newTag, newColor);
  const tagsDocRef = doc(db, dataSources.firebase.tagsCollection, dataSources.firebase.tagsDocId);
  const metadataWrite = { ...updatedMetadata, tagColorPalette };

  if (newTag === oldTag) {
    await setDoc(tagsDocRef, metadataWrite, { merge: true });
    return updatedMetadata;
  }

  const affectedClients = await getDocs(
    query(
      collection(db, dataSources.firebase.clientsCollection),
      where("tags", "array-contains", oldTag)
    )
  );

  if (affectedClients.docs.length > MAX_ATOMIC_TAG_RENAME_CLIENTS) {
    throw new TagRenameTooLargeError();
  }

  const batch = writeBatch(db);
  affectedClients.docs.forEach((clientSnapshot) => {
    const currentTags: string[] = clientSnapshot.data().tags || [];
    const updatedTags = Array.from(
      new Set(currentTags.map((tag) => (tag === oldTag ? newTag : tag)))
    );
    batch.update(clientSnapshot.ref, { tags: updatedTags, ...auditMetadata });
  });
  batch.set(tagsDocRef, metadataWrite, { merge: true });
  await batch.commit();

  return updatedMetadata;
};
