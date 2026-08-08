export interface ClientAuditUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
}

export interface ClientUpdatedBy {
  uid: string;
  name: string;
  email?: string;
}

export interface ClientAuditMetadata {
  updatedAt: Date;
  updatedBy: ClientUpdatedBy;
}

export const buildClientAuditMetadata = (
  user: ClientAuditUser,
  accountName?: string | null,
  updatedAt = new Date()
): ClientAuditMetadata => {
  const email = user.email?.trim() || undefined;
  const name = accountName?.trim() || user.displayName?.trim() || email || user.uid;

  return {
    updatedAt,
    updatedBy: {
      uid: user.uid,
      name,
      ...(email ? { email } : {}),
    },
  };
};

export const buildSystemClientAuditMetadata = (
  systemName: string,
  updatedAt = new Date()
): ClientAuditMetadata => ({
  updatedAt,
  updatedBy: {
    uid: systemName,
    name: systemName,
  },
});