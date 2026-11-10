import { requireRecentReauth, service, writeAudit, type Ctx } from "./admin-core.ts";
import { detectStudioAssetMime } from "./studio-catalog-files.mjs";

type Studio = "story" | "reel" | "post";
const STUDIOS: Studio[] = ["story", "reel", "post"];
const BUCKET = "studio-assets";
const AUDIO_LIMIT = 25 * 1024 * 1024;
const IMAGE_LIMIT = 8 * 1024 * 1024;

function text(value: FormDataEntryValue | null, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function list(value: FormDataEntryValue | null, maxItems = 30): string[] {
  return typeof value === "string"
    ? [
        ...new Set(
          value
            .split(",")
            .map((item) => item.trim().slice(0, 80))
            .filter(Boolean),
        ),
      ].slice(0, maxItems)
    : [];
}

function studioList(value: FormDataEntryValue | null): Studio[] | null {
  const selected = list(value, 3);
  return selected.every((entry) => STUDIOS.includes(entry as Studio))
    ? (selected as Studio[])
    : null;
}

async function uploadAsset(file: File | null, kind: "audio" | "image", prefix: string) {
  if (!file || file.size < 1 || file.size > (kind === "audio" ? AUDIO_LIMIT : IMAGE_LIMIT)) {
    throw new Error(
      kind === "audio" ? "Choose an audio file up to 25 MB." : "Choose an image up to 8 MB.",
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = detectStudioAssetMime(bytes, kind);
  if (!mime) throw new Error(`The ${kind} file contents are not a supported format.`);
  const extension =
    mime === "audio/mpeg"
      ? "mp3"
      : mime === "audio/wav"
        ? "wav"
        : mime === "audio/ogg"
          ? "ogg"
          : mime === "audio/webm"
            ? "webm"
            : mime === "audio/mp4"
              ? "m4a"
              : mime.split("/")[1];
  const path = `${prefix}/${crypto.randomUUID()}.${extension}`;
  const { error } = await service()
    .storage.from(BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (error) throw new Error("The uploaded asset could not be stored.");
  return path;
}

async function sign(path: string | null, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await service().storage.from(BUCKET).createSignedUrl(path, expiresIn);
  return error ? null : data.signedUrl;
}

function available(c: Ctx, permission: string) {
  return c.get("admin").permissions.has(permission);
}

export const handleStudioCatalogAdminGet = async (c: Ctx) => {
  const db = service();
  const [music, stickers, categories] = await Promise.all([
    db
      .from("studio_music_tracks")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500),
    db
      .from("studio_stickers")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500),
    db.from("studio_sticker_categories").select("*").order("sort_order").order("name"),
  ]);
  if (music.error || stickers.error || categories.error)
    return c.json(
      { error: "The studio catalog is unavailable. Apply the studio catalog migration." },
      503,
    );
  const [musicItems, stickerItems] = await Promise.all([
    Promise.all(
      (music.data ?? []).map(async (item) => ({
        ...item,
        audio_url: await sign(item.audio_path),
        cover_url: await sign(item.cover_path),
      })),
    ),
    Promise.all(
      (stickers.data ?? []).map(async (item) => ({
        ...item,
        asset_url: await sign(item.asset_path),
        thumbnail_url: await sign(item.thumbnail_path),
      })),
    ),
  ]);
  return c.json({ music: musicItems, stickers: stickerItems, categories: categories.data ?? [] });
};

export const handleStudioCatalogPublicGet = async (c: Ctx) => {
  const studio = c.req.query("studio") as Studio;
  if (!STUDIOS.includes(studio)) return c.json({ error: "Choose a valid studio." }, 400);
  const search = (c.req.query("search") ?? "").trim().slice(0, 100);
  const category = c.req.query("category");
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 30, 1), 100);
  const offset = Math.min(Math.max(Number(c.req.query("offset")) || 0, 0), 100000);
  const db = service();
  let musicQuery = db
    .from("studio_music_tracks")
    .select(
      "id,title,artist_name,search_aliases,audio_path,cover_path,duration_seconds,genre,mood,language,tags,available_in,license_reference,excerpt_start_seconds,excerpt_end_seconds",
    )
    .eq("status", "published")
    .is("deleted_at", null)
    .contains("available_in", [studio]);
  let stickerQuery = db
    .from("studio_stickers")
    .select(
      "id,name,search_aliases,category_id,asset_path,thumbnail_path,alt_text,tags,attribution,animated,available_in",
    )
    .eq("status", "published")
    .is("deleted_at", null)
    .contains("available_in", [studio]);
  if (search) {
    const pattern = `%${search.replace(/[%,().]/g, " ")}%`;
    musicQuery = musicQuery.ilike("search_document", pattern);
    stickerQuery = stickerQuery.ilike("search_document", pattern);
  }
  const trackId = c.req.query("trackId");
  if (trackId) musicQuery = musicQuery.eq("id", trackId);
  if (category) stickerQuery = stickerQuery.eq("category_id", category);
  const [music, stickers, categories] = await Promise.all([
    musicQuery.order("title").range(offset, offset + limit),
    stickerQuery.order("name").range(offset, offset + limit),
    db
      .from("studio_sticker_categories")
      .select("id,name")
      .is("archived_at", null)
      .order("sort_order")
      .order("name"),
  ]);
  if (music.error || stickers.error || categories.error)
    return c.json({ error: "The shared studio catalog could not be loaded." }, 503);
  const [musicRows, stickerRows] = await Promise.all([
    Promise.all(
      (music.data ?? []).map(async (item) => ({
        id: item.id,
        title: item.title,
        artistName: item.artist_name,
        searchAliases: item.search_aliases,
        audioUrl: await sign(item.audio_path),
        coverUrl: await sign(item.cover_path),
        durationSeconds: item.duration_seconds,
        genre: item.genre,
        mood: item.mood,
        language: item.language,
        tags: item.tags,
        availableIn: item.available_in,
        licenseReference: item.license_reference,
        excerptStartSeconds: item.excerpt_start_seconds,
        excerptEndSeconds: item.excerpt_end_seconds,
      })),
    ),
    Promise.all(
      (stickers.data ?? []).map(async (item) => ({
        id: item.id,
        name: item.name,
        searchAliases: item.search_aliases,
        category: categories.data?.find((entry) => entry.id === item.category_id)?.name ?? "",
        assetUrl: await sign(item.asset_path),
        thumbnailUrl: await sign(item.thumbnail_path),
        altText: item.alt_text,
        tags: item.tags,
        attribution: item.attribution,
        animated: item.animated,
        availableIn: item.available_in,
      })),
    ),
  ]);
  const musicItems = musicRows.slice(0, limit);
  const stickerItems = stickerRows.slice(0, limit);
  const categoryIds = new Set(
    (stickers.data ?? []).slice(0, limit).map((item) => item.category_id),
  );
  const publicCategories = (categories.data ?? []).filter((entry) => categoryIds.has(entry.id));
  return c.json({
    music: musicItems,
    stickers: stickerItems,
    categories: publicCategories,
    nextOffset: musicRows.length > limit || stickerRows.length > limit ? offset + limit : null,
  });
};

export const handleStudioMusicCreate = async (c: Ctx) => {
  let audioPath: string | null = null;
  let coverPath: string | null = null;
  try {
    const form = await c.req.formData();
    const title = text(form.get("title"), 120);
    const artist = text(form.get("artistName"), 120);
    const availableIn = studioList(form.get("availableIn"));
    const status = text(form.get("status"), 16) || "draft";
    const license = text(form.get("licenseReference"), 500);
    const durationSeconds = Number(form.get("durationSeconds")) || null;
    const excerptStartSeconds = Number(form.get("excerptStartSeconds")) || 0;
    const excerptEndSeconds = form.get("excerptEndSeconds")
      ? Number(form.get("excerptEndSeconds"))
      : null;
    if (!title || !artist || !availableIn || !["draft", "published"].includes(status))
      return c.json(
        { error: "Enter a title and artist, and choose valid studio availability." },
        400,
      );
    if (
      (durationSeconds !== null && (!Number.isInteger(durationSeconds) || durationSeconds < 1)) ||
      !Number.isInteger(excerptStartSeconds) ||
      excerptStartSeconds < 0 ||
      (durationSeconds !== null && excerptStartSeconds >= durationSeconds) ||
      (excerptEndSeconds !== null &&
        (!Number.isInteger(excerptEndSeconds) ||
          excerptEndSeconds <= excerptStartSeconds ||
          (durationSeconds !== null && excerptEndSeconds > durationSeconds)))
    )
      return c.json({ error: "Use valid whole-second track and excerpt times." }, 400);
    if (
      status === "published" &&
      (!available(c, "motion.publish") || !license || availableIn.length === 0)
    )
      return c.json(
        {
          error:
            "Publishing requires publish permission, licensing information, and at least one studio.",
        },
        403,
      );
    audioPath = await uploadAsset(form.get("audioFile") as File | null, "audio", "music");
    if (form.get("coverFile") instanceof File && (form.get("coverFile") as File).size > 0)
      coverPath = await uploadAsset(form.get("coverFile") as File, "image", "covers");
    const { user } = c.get("admin");
    const { data, error } = await service()
      .from("studio_music_tracks")
      .insert({
        title,
        artist_name: artist,
        search_aliases: list(form.get("searchAliases")),
        audio_path: audioPath,
        cover_path: coverPath,
        duration_seconds: durationSeconds,
        genre: text(form.get("genre"), 80),
        mood: text(form.get("mood"), 80),
        language: text(form.get("language"), 80),
        tags: list(form.get("tags")),
        description: text(form.get("description"), 2000),
        status,
        available_in: availableIn,
        license_reference: license,
        excerpt_start_seconds: excerptStartSeconds,
        excerpt_end_seconds: excerptEndSeconds,
        created_by: user.id,
        updated_by: user.id,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error("The track record could not be saved.");
    await writeAudit(c.req.raw, {
      adminUserId: user.id,
      action:
        status === "published" ? "admin.studio_music.published" : "admin.studio_music.created",
      targetType: "studio_music_track",
      targetId: data.id,
      metadata: { availableIn },
    });
    return c.json({ id: data.id }, 201);
  } catch (error) {
    const paths = [audioPath, coverPath].filter((path): path is string => Boolean(path));
    if (paths.length) await service().storage.from(BUCKET).remove(paths);
    return c.json(
      { error: error instanceof Error ? error.message : "The track could not be saved." },
      400,
    );
  }
};

export const handleStudioStickerCreate = async (c: Ctx) => {
  let assetPath: string | null = null;
  let thumbnailPath: string | null = null;
  try {
    const form = await c.req.formData();
    const name = text(form.get("name"), 120);
    const categoryId = text(form.get("categoryId"), 50);
    const availableIn = studioList(form.get("availableIn"));
    const status = text(form.get("status"), 16) || "draft";
    if (!name || !categoryId || !availableIn || !["draft", "published"].includes(status))
      return c.json(
        { error: "Enter a name and category, and choose valid studio availability." },
        400,
      );
    const { data: categoryRecord } = await service()
      .from("studio_sticker_categories")
      .select("id")
      .eq("id", categoryId)
      .is("archived_at", null)
      .maybeSingle();
    if (!categoryRecord) return c.json({ error: "Choose an active sticker category." }, 400);
    if (status === "published" && (!available(c, "motion.publish") || availableIn.length === 0))
      return c.json(
        { error: "Publishing requires publish permission and at least one studio." },
        403,
      );
    assetPath = await uploadAsset(form.get("assetFile") as File | null, "image", "stickers");
    if (form.get("thumbnailFile") instanceof File && (form.get("thumbnailFile") as File).size > 0)
      thumbnailPath = await uploadAsset(
        form.get("thumbnailFile") as File,
        "image",
        "sticker-thumbnails",
      );
    const { user } = c.get("admin");
    const { data, error } = await service()
      .from("studio_stickers")
      .insert({
        name,
        search_aliases: list(form.get("searchAliases")),
        category_id: categoryId,
        asset_path: assetPath,
        thumbnail_path: thumbnailPath,
        alt_text: text(form.get("altText"), 300),
        tags: list(form.get("tags")),
        attribution: text(form.get("attribution"), 300),
        animated:
          detectStudioAssetMime(
            new Uint8Array(await (form.get("assetFile") as File).arrayBuffer()),
            "image",
          ) === "image/gif",
        status,
        available_in: availableIn,
        created_by: user.id,
        updated_by: user.id,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error("The sticker record could not be saved.");
    await writeAudit(c.req.raw, {
      adminUserId: user.id,
      action:
        status === "published" ? "admin.studio_sticker.published" : "admin.studio_sticker.created",
      targetType: "studio_sticker",
      targetId: data.id,
      metadata: { availableIn, categoryId },
    });
    return c.json({ id: data.id }, 201);
  } catch (error) {
    const paths = [assetPath, thumbnailPath].filter((path): path is string => Boolean(path));
    if (paths.length) await service().storage.from(BUCKET).remove(paths);
    return c.json(
      { error: error instanceof Error ? error.message : "The sticker could not be saved." },
      400,
    );
  }
};

export const handleStudioCatalogPatch = async (c: Ctx) => {
  const type = c.req.param("type");
  const id = c.req.param("id");
  if (type !== "music" && type !== "stickers")
    return c.json({ error: "Unknown catalog type." }, 404);
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return c.json({ error: "Invalid request." }, 400);
  const table = type === "music" ? "studio_music_tracks" : "studio_stickers";
  const allowed =
    Array.isArray(body.availableIn) &&
    body.availableIn.every((item) => STUDIOS.includes(item as Studio));
  const status = body.status;
  if (status !== undefined && !["draft", "published", "unpublished"].includes(String(status)))
    return c.json({ error: "Invalid publication status." }, 400);
  if (status !== undefined && !available(c, "motion.publish"))
    return c.json({ error: "Publish permission is required to change publication status." }, 403);
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: c.get("admin").user.id,
  };
  const fields =
    type === "music"
      ? {
          title: "title",
          artistName: "artist_name",
          searchAliases: "search_aliases",
          genre: "genre",
          mood: "mood",
          language: "language",
          excerptStartSeconds: "excerpt_start_seconds",
          excerptEndSeconds: "excerpt_end_seconds",
          tags: "tags",
          description: "description",
          licenseReference: "license_reference",
          availableIn: "available_in",
          status: "status",
        }
      : {
          name: "name",
          searchAliases: "search_aliases",
          categoryId: "category_id",
          altText: "alt_text",
          tags: "tags",
          attribution: "attribution",
          availableIn: "available_in",
          status: "status",
        };
  for (const [key, column] of Object.entries(fields)) if (key in body) patch[column] = body[key];
  if ("availableIn" in body && !allowed)
    return c.json({ error: "Choose valid studio availability." }, 400);
  if (type === "stickers" && "categoryId" in body) {
    const categoryId = typeof body.categoryId === "string" ? body.categoryId : "";
    const { data: category } = await service()
      .from("studio_sticker_categories")
      .select("id")
      .eq("id", categoryId)
      .is("archived_at", null)
      .maybeSingle();
    if (!category) return c.json({ error: "Choose an active sticker category." }, 400);
  }
  if (type === "stickers" && body.status === "published") {
    const { data: current } = await service()
      .from("studio_stickers")
      .select("category_id")
      .eq("id", id)
      .maybeSingle();
    const categoryId = typeof body.categoryId === "string" ? body.categoryId : current?.category_id;
    const { data: category } = await service()
      .from("studio_sticker_categories")
      .select("id")
      .eq("id", categoryId)
      .is("archived_at", null)
      .maybeSingle();
    if (!category)
      return c.json({ error: "Move this sticker to an active category before publishing." }, 400);
  }
  if (
    body.status === "published" &&
    Array.isArray(body.availableIn) &&
    body.availableIn.length === 0
  )
    return c.json({ error: "Choose at least one studio before publishing." }, 400);
  if (type === "music" && body.status === "published" && !String(body.licenseReference ?? "")) {
    const { data: current } = await service()
      .from(table)
      .select("license_reference")
      .eq("id", id)
      .maybeSingle();
    if (!current?.license_reference)
      return c.json({ error: "Add licensing information before publishing." }, 400);
  }
  const { data, error } = await service()
    .from(table)
    .update(patch)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id,status")
    .maybeSingle();
  if (error || !data) return c.json({ error: "The catalog item could not be updated." }, 400);
  await writeAudit(c.req.raw, {
    adminUserId: c.get("admin").user.id,
    action: `admin.studio_${type}.${String(status ?? "updated")}`,
    targetType: `studio_${type === "music" ? "music_track" : "sticker"}`,
    targetId: id,
    metadata: { status: data.status },
  });
  return c.json({ id: data.id, status: data.status });
};

export const handleStudioCatalogDelete = async (c: Ctx) => {
  const type = c.req.param("type");
  const table =
    type === "music" ? "studio_music_tracks" : type === "stickers" ? "studio_stickers" : null;
  if (!table) return c.json({ error: "Unknown catalog type." }, 404);
  const reauth = await requireRecentReauth(c, 10);
  if (reauth) return reauth;
  const { user } = c.get("admin");
  const { data, error } = await service()
    .from(table)
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id, updated_by: user.id })
    .eq("id", c.req.param("id"))
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data) return c.json({ error: "The catalog item could not be removed." }, 400);
  await writeAudit(c.req.raw, {
    adminUserId: user.id,
    action: `admin.studio_${type}.deleted`,
    targetType: type === "music" ? "studio_music_track" : "studio_sticker",
    targetId: c.req.param("id"),
    metadata: { retained: true },
  });
  return c.json({ ok: true });
};

export const handleStudioStickerCategoryCreate = async (c: Ctx) => {
  const body = (await c.req.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!name) return c.json({ error: "Enter a category name." }, 400);
  const { data, error } = await service()
    .from("studio_sticker_categories")
    .insert({ name, created_by: c.get("admin").user.id })
    .select("id,name")
    .single();
  if (error || !data) return c.json({ error: "The category could not be created." }, 400);
  await writeAudit(c.req.raw, {
    adminUserId: c.get("admin").user.id,
    action: "admin.studio_sticker_category.created",
    targetType: "studio_sticker_category",
    targetId: data.id,
  });
  return c.json(data, 201);
};

export const handleStudioStickerCategoryPatch = async (c: Ctx) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return c.json({ error: "Invalid category request." }, 400);
  const patch: Record<string, unknown> = {};
  if ("name" in body) {
    const name = text(typeof body.name === "string" ? body.name : null, 60);
    if (!name) return c.json({ error: "Enter a category name." }, 400);
    patch.name = name;
  }
  if ("sortOrder" in body) {
    if (
      !Number.isInteger(body.sortOrder) ||
      Number(body.sortOrder) < 0 ||
      Number(body.sortOrder) > 10000
    )
      return c.json({ error: "Category order must be a whole number from 0 to 10000." }, 400);
    patch.sort_order = body.sortOrder;
  }
  if ("archived" in body) {
    if (body.archived !== true && body.archived !== false)
      return c.json({ error: "Choose whether the category is archived." }, 400);
    if (body.archived) {
      const { count, error: referenceError } = await service()
        .from("studio_stickers")
        .select("id", { count: "exact", head: true })
        .eq("category_id", id)
        .is("deleted_at", null);
      if (referenceError) return c.json({ error: "Sticker references could not be checked." }, 500);
      if ((count ?? 0) > 0)
        return c.json(
          { error: "Move or remove every sticker reference before archiving this category." },
          409,
        );
    }
    patch.archived_at = body.archived ? new Date().toISOString() : null;
  }
  if (!Object.keys(patch).length)
    return c.json({ error: "No category changes were supplied." }, 400);
  const { data, error } = await service()
    .from("studio_sticker_categories")
    .update(patch)
    .eq("id", id)
    .select("id,name,sort_order,archived_at")
    .maybeSingle();
  if (error || !data) return c.json({ error: "The category could not be updated." }, 400);
  await writeAudit(c.req.raw, {
    adminUserId: c.get("admin").user.id,
    action: "admin.studio_sticker_category.updated",
    targetType: "studio_sticker_category",
    targetId: id,
    metadata: { archived: Boolean(data.archived_at), sortOrder: data.sort_order },
  });
  return c.json(data);
};

export const handleStudioCatalogAssetReplace = async (c: Ctx) => {
  const type = c.req.param("type");
  const id = c.req.param("id");
  if (type !== "music" && type !== "stickers")
    return c.json({ error: "Unknown catalog type." }, 404);
  const form = await c.req.formData();
  const table = type === "music" ? "studio_music_tracks" : "studio_stickers";
  const assetColumn = type === "music" ? "audio_path" : "asset_path";
  let assetPath: string | null = null;
  let secondaryPath: string | null = null;
  try {
    assetPath = await uploadAsset(
      form.get("assetFile") as File | null,
      type === "music" ? "audio" : "image",
      type === "music" ? "music" : "stickers",
    );
    const secondary = form.get(type === "music" ? "coverFile" : "thumbnailFile");
    if (secondary instanceof File && secondary.size > 0)
      secondaryPath = await uploadAsset(
        secondary,
        "image",
        type === "music" ? "covers" : "thumbnails",
      );
    const update: Record<string, unknown> = {
      [assetColumn]: assetPath,
      updated_by: c.get("admin").user.id,
      updated_at: new Date().toISOString(),
    };
    if (secondaryPath) update[type === "music" ? "cover_path" : "thumbnail_path"] = secondaryPath;
    if (type === "music") {
      const duration = Number(form.get("durationSeconds"));
      if (Number.isInteger(duration) && duration > 0) update.duration_seconds = duration;
    }
    const { data, error } = await service()
      .from(table)
      .update(update)
      .eq("id", id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error || !data)
      throw new Error("The replacement asset could not be attached to this catalog item.");
    await writeAudit(c.req.raw, {
      adminUserId: c.get("admin").user.id,
      action: `admin.studio_${type}.asset_replaced`,
      targetType: type === "music" ? "studio_music_track" : "studio_sticker",
      targetId: id,
    });
    return c.json({ id: data.id, replaced: true });
  } catch (error) {
    const paths = [assetPath, secondaryPath].filter((path): path is string => Boolean(path));
    if (paths.length) await service().storage.from(BUCKET).remove(paths);
    return c.json(
      { error: error instanceof Error ? error.message : "Asset replacement failed." },
      400,
    );
  }
};
