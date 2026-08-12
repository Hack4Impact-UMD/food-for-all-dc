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
import { editTagMetadata, normalizeTagColors, TagColorMap } from "../../../utils/tagColors";
import type { ClientAuditWriteMetadata } from "../../../utils/clientAudit";

// One batch write is reserved for the master tag document. Keeping the entire
// rename in a single batch guarantees that Firestore applies all changes or none.
export const MAX_ATOMIC_TAG_CLIENTS = 499;
export const MAX_ATOMIC_TAG_RENAME_CLIENTS = MAX_ATOMIC_TAG_CLIENTS;

export class TagRenameTooLargeError extends Error {
  constructor() {
    super("This tag is used by too many client profiles to rename safely.");
    this.name = "TagRenameTooLargeError";
  }
}

export class TagDeleteTooLargeError extends Error {
  constructor() {
    super("This tag is used by too many client profiles to delete safely.");
    this.name = "TagDeleteTooLargeError";
  }
}

export interface TagMetadata {
  tags: string[];
  tagColors: TagColorMap;
}

interface AssignTagToClientOptions {
  db: Firestore;
  clientUid: string;
  clientTags: string[];
  tag: string;
  metadata?: TagMetadata;
  tagColorPalette: string[];
  auditMetadata: ClientAuditWriteMetadata;
}

export const assignTagToClient = async ({
  db,
  clientUid,
  clientTags,
  tag,
  metadata,
  tagColorPalette,
  auditMetadata,
}: AssignTagToClientOptions): Promise<void> => {
  const batch = writeBatch(db);
  batch.set(
    doc(db, dataSources.firebase.clientsCollection, clientUid),
    {
      tags: Array.from(new Set([...clientTags, tag])),
      ...auditMetadata,
    },
    { merge: true }
  );
  batch.set(
    doc(db, dataSources.firebase.tagsCollection, dataSources.firebase.tagsDocId),
    metadata ? { ...metadata, tagColorPalette } : { tagColorPalette },
    { merge: true }
  );
  await batch.commit();
};

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

interface DeleteTagGloballyOptions {
  db: Firestore;
  tag: string;
  tags: string[];
  tagColors: TagColorMap;
  auditMetadata: ClientAuditWriteMetadata;
}

export const deleteTagGlobally = async ({
  db,
  tag,
  tags,
  tagColors,
  auditMetadata,
}: DeleteTagGloballyOptions): Promise<TagMetadata> => {
  const tagsDocRef = doc(
    db,
    dataSources.firebase.tagsCollection,
    dataSources.firebase.tagsDocId
  );
  const tagsSnapshot = await getDoc(tagsDocRef);
  const savedMetadata = tagsSnapshot.exists() ? tagsSnapshot.data() : null;
  const savedTags = savedMetadata?.tags;
  const currentTags = Array.isArray(savedTags)
    ? savedTags.filter((savedTag): savedTag is string => typeof savedTag === "string")
    : tags;
  const currentTagColors = savedMetadata
    ? normalizeTagColors(savedMetadata.tagColors)
    : tagColors;
  const affectedClients = await getDocs(
    query(
      collection(db, dataSources.firebase.clientsCollection),
      where("tags", "array-contains", tag)
    )
  );

  if (affectedClients.docs.length > MAX_ATOMIC_TAG_CLIENTS) {
    throw new TagDeleteTooLargeError();
  }

  const updatedMetadata = {
    tags: currentTags.filter((savedTag) => savedTag !== tag),
    tagColors: Object.fromEntries(
      Object.entries(currentTagColors).filter(([savedTag]) => savedTag !== tag)
    ),
  };
  const batch = writeBatch(db);

  affectedClients.docs.forEach((clientSnapshot) => {
    const currentTags: string[] = clientSnapshot.data().tags || [];
    batch.update(clientSnapshot.ref, {
      tags: currentTags.filter((savedTag) => savedTag !== tag),
      ...auditMetadata,
    });
  });
  batch.set(tagsDocRef, updatedMetadata, { merge: true });
  await batch.commit();

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
  auditMetadata: ClientAuditWriteMetadata;
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
