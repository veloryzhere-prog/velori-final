export function putStoryDraftMedia(key: string, blob: Blob): Promise<IDBValidKey>;
export function getStoryDraftMedia(key: string): Promise<Blob | undefined>;
export function deleteStoryDraftMedia(key: string): Promise<undefined>;
