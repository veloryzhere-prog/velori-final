const createId = () =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function createPostEditorStore(initialPosts = []) {
  const posts = new Map((initialPosts ?? []).map((post) => [post.id, structuredClone(post)]));

  return {
    posts,
    getPosts() {
      return [...posts.values()].map((post) => structuredClone(post));
    },
    getPost(id) {
      const post = posts.get(id);
      return post ? structuredClone(post) : undefined;
    },
    createPost(input) {
      const post = {
        id: input.id ?? createId(),
        title: input.title ?? "Untitled Post",
        status: input.status ?? "draft",
        aspectRatio: input.aspectRatio ?? "1:1",
        brandKitId: input.brandKitId ?? null,
        templateId: input.templateId ?? null,
        slides: Array.isArray(input.slides)
          ? input.slides.map((slide) => ({
              id: slide.id ?? createId(),
              postId: input.id ?? null,
              order: slide.order ?? 0,
              background: slide.background ?? "solid",
              duration: slide.duration ?? 5,
              layers: Array.isArray(slide.layers)
                ? slide.layers.map((layer) => ({
                    id: layer.id ?? createId(),
                    slideId: slide.id ?? null,
                    type: layer.type ?? "text",
                    name: layer.name ?? "Layer",
                    order: layer.order ?? 0,
                    x: layer.x ?? 0,
                    y: layer.y ?? 0,
                    width: layer.width ?? 0,
                    height: layer.height ?? 0,
                    rotation: layer.rotation ?? 0,
                    opacity: layer.opacity ?? 1,
                    blendMode: layer.blendMode ?? "normal",
                    visible: layer.visible ?? true,
                    locked: layer.locked ?? false,
                    text: layer.text ?? null,
                    image: layer.image ?? null,
                    shape: layer.shape ?? null,
                    animations: Array.isArray(layer.animations) ? layer.animations : [],
                  }))
                : [],
              animations: Array.isArray(slide.animations) ? slide.animations : [],
            }))
          : [],
        createdAt: input.createdAt ?? new Date().toISOString(),
        updatedAt: input.updatedAt ?? new Date().toISOString(),
      };

      posts.set(post.id, structuredClone(post));
      return structuredClone(post);
    },
    updatePost(id, input) {
      const existing = posts.get(id);
      if (!existing) return undefined;
      const next = {
        ...structuredClone(existing),
        ...input,
        id,
        updatedAt: new Date().toISOString(),
      };
      posts.set(id, next);
      return structuredClone(next);
    },
    deletePost(id) {
      const deleted = posts.get(id);
      posts.delete(id);
      return deleted ? structuredClone(deleted) : undefined;
    },
    createSlide(postId, input) {
      const post = posts.get(postId);
      if (!post) return undefined;
      const slide = {
        id: input.id ?? createId(),
        postId,
        order: input.order ?? post.slides.length,
        background: input.background ?? "solid",
        duration: input.duration ?? 5,
        layers: Array.isArray(input.layers) ? input.layers : [],
        animations: Array.isArray(input.animations) ? input.animations : [],
      };
      post.slides.push(slide);
      post.updatedAt = new Date().toISOString();
      posts.set(postId, structuredClone(post));
      return structuredClone(slide);
    },
    updateSlide(postId, slideId, input) {
      const post = posts.get(postId);
      if (!post) return undefined;
      const index = post.slides.findIndex((slide) => slide.id === slideId);
      if (index < 0) return undefined;
      post.slides[index] = {
        ...post.slides[index],
        ...input,
        id: slideId,
        postId,
        updatedAt: undefined,
      };
      post.updatedAt = new Date().toISOString();
      posts.set(postId, structuredClone(post));
      return structuredClone(post.slides[index]);
    },
    deleteSlide(postId, slideId) {
      const post = posts.get(postId);
      if (!post) return undefined;
      const deleted = post.slides.find((slide) => slide.id === slideId);
      post.slides = post.slides.filter((slide) => slide.id !== slideId);
      post.updatedAt = new Date().toISOString();
      posts.set(postId, structuredClone(post));
      return deleted ? structuredClone(deleted) : undefined;
    },
    createLayer(postId, slideId, input) {
      const post = posts.get(postId);
      if (!post) return undefined;
      const slide = post.slides.find((item) => item.id === slideId);
      if (!slide) return undefined;

      const layer = {
        id: input.id ?? createId(),
        slideId,
        type: input.type ?? "text",
        name: input.name ?? "Layer",
        order: input.order ?? slide.layers.length,
        x: input.x ?? 0,
        y: input.y ?? 0,
        width: input.width ?? 0,
        height: input.height ?? 0,
        rotation: input.rotation ?? 0,
        opacity: input.opacity ?? 1,
        blendMode: input.blendMode ?? "normal",
        visible: input.visible ?? true,
        locked: input.locked ?? false,
        text: input.text ?? null,
        image: input.image ?? null,
        shape: input.shape ?? null,
        animations: Array.isArray(input.animations) ? input.animations : [],
      };

      slide.layers.push(layer);
      post.updatedAt = new Date().toISOString();
      posts.set(postId, structuredClone(post));
      return structuredClone(layer);
    },
    updateLayer(postId, slideId, layerId, input) {
      const post = posts.get(postId);
      if (!post) return undefined;
      const slide = post.slides.find((item) => item.id === slideId);
      if (!slide) return undefined;
      const index = slide.layers.findIndex((layer) => layer.id === layerId);
      if (index < 0) return undefined;
      slide.layers[index] = { ...slide.layers[index], ...input, id: layerId, slideId };
      post.updatedAt = new Date().toISOString();
      posts.set(postId, structuredClone(post));
      return structuredClone(slide.layers[index]);
    },
    deleteLayer(postId, slideId, layerId) {
      const post = posts.get(postId);
      if (!post) return undefined;
      const slide = post.slides.find((item) => item.id === slideId);
      if (!slide) return undefined;
      const deleted = slide.layers.find((layer) => layer.id === layerId);
      slide.layers = slide.layers.filter((layer) => layer.id !== layerId);
      post.updatedAt = new Date().toISOString();
      posts.set(postId, structuredClone(post));
      return deleted ? structuredClone(deleted) : undefined;
    },
  };
}

export function handlePostEditorRequest(request, store = createPostEditorStore()) {
  const { method = "GET", resource, id, slideId, layerId, payload } = request ?? {};

  if (resource === "posts") {
    if (method === "GET" && !id) return { status: 200, body: store.getPosts() };
    if (method === "GET" && id) {
      const post = store.getPost(id);
      return post
        ? { status: 200, body: post }
        : { status: 404, body: { error: "Post not found" } };
    }
    if (method === "POST") {
      const post = store.createPost(payload ?? {});
      return { status: 201, body: post };
    }
    if (method === "PUT" && id) {
      const post = store.updatePost(id, payload ?? {});
      return post
        ? { status: 200, body: post }
        : { status: 404, body: { error: "Post not found" } };
    }
    if (method === "DELETE" && id) {
      const deleted = store.deletePost(id);
      return deleted
        ? { status: 200, body: deleted }
        : { status: 404, body: { error: "Post not found" } };
    }
  }

  if (resource === "slides") {
    if (!id) return { status: 400, body: { error: "A post id is required" } };
    if (method === "GET" && slideId) {
      const post = store.getPost(id);
      const slide = post?.slides.find((item) => item.id === slideId);
      return slide
        ? { status: 200, body: slide }
        : { status: 404, body: { error: "Slide not found" } };
    }
    if (method === "GET") {
      const post = store.getPost(id);
      return post
        ? { status: 200, body: post.slides }
        : { status: 404, body: { error: "Post not found" } };
    }
    if (method === "POST") {
      const slide = store.createSlide(id, payload ?? {});
      return slide
        ? { status: 201, body: slide }
        : { status: 404, body: { error: "Post not found" } };
    }
    if (method === "PUT" && slideId) {
      const slide = store.updateSlide(id, slideId, payload ?? {});
      return slide
        ? { status: 200, body: slide }
        : { status: 404, body: { error: "Slide not found" } };
    }
    if (method === "DELETE" && slideId) {
      const deleted = store.deleteSlide(id, slideId);
      return deleted
        ? { status: 200, body: deleted }
        : { status: 404, body: { error: "Slide not found" } };
    }
  }

  if (resource === "layers") {
    if (!id || !slideId)
      return { status: 400, body: { error: "A post id and slide id are required" } };
    if (method === "GET" && layerId) {
      const post = store.getPost(id);
      const slide = post?.slides.find((item) => item.id === slideId);
      const layer = slide?.layers.find((item) => item.id === layerId);
      return layer
        ? { status: 200, body: layer }
        : { status: 404, body: { error: "Layer not found" } };
    }
    if (method === "GET") {
      const post = store.getPost(id);
      const slide = post?.slides.find((item) => item.id === slideId);
      return slide
        ? { status: 200, body: slide.layers }
        : { status: 404, body: { error: "Slide not found" } };
    }
    if (method === "POST") {
      const layer = store.createLayer(id, slideId, payload ?? {});
      return layer
        ? { status: 201, body: layer }
        : { status: 404, body: { error: "Slide not found" } };
    }
    if (method === "PUT" && layerId) {
      const layer = store.updateLayer(id, slideId, layerId, payload ?? {});
      return layer
        ? { status: 200, body: layer }
        : { status: 404, body: { error: "Layer not found" } };
    }
    if (method === "DELETE" && layerId) {
      const deleted = store.deleteLayer(id, slideId, layerId);
      return deleted
        ? { status: 200, body: deleted }
        : { status: 404, body: { error: "Layer not found" } };
    }
  }

  return { status: 400, body: { error: "Unsupported resource or method" } };
}

export const postEditorStore = createPostEditorStore();
