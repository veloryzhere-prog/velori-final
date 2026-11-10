import type {
  AudioTrack,
  BrandOverride,
  Slide,
  Sticker,
  Story,
  StoryEditorRequest,
  StoryEditorResponse,
  Transition,
} from "./types.js";

export interface StoryEditorStore {
  getStories(): Story[];
  getStory(storyId: string): Story | undefined;
  createStory(input?: Partial<Story>): Story;
  updateStory(storyId: string, input?: Partial<Story>): Story | undefined;
  deleteStory(storyId: string): Story | undefined;
  getSlides(storyId: string): Slide[] | undefined;
  createSlide(storyId: string, input?: Partial<Slide>): Slide | undefined;
  updateSlide(storyId: string, slideId: string, input?: Partial<Slide>): Slide | undefined;
  deleteSlide(storyId: string, slideId: string): Slide | undefined;
  getStickers(storyId: string, slideId: string): Sticker[] | undefined;
  createSticker(storyId: string, slideId: string, input?: Partial<Sticker>): Sticker | undefined;
  updateSticker(
    storyId: string,
    slideId: string,
    stickerId: string,
    input?: Partial<Sticker>,
  ): Sticker | undefined;
  deleteSticker(storyId: string, slideId: string, stickerId: string): Sticker | undefined;
  getAudioTracks(storyId: string): AudioTrack[] | undefined;
  createAudioTrack(storyId: string, input?: Partial<AudioTrack>): AudioTrack | undefined;
  updateAudioTrack(
    storyId: string,
    trackId: string,
    input?: Partial<AudioTrack>,
  ): AudioTrack | undefined;
  deleteAudioTrack(storyId: string, trackId: string): AudioTrack | undefined;
  getTransitions(storyId: string): Transition[] | undefined;
  createTransition(storyId: string, input?: Partial<Transition>): Transition | undefined;
  updateTransition(
    storyId: string,
    transitionId: string,
    input?: Partial<Transition>,
  ): Transition | undefined;
  deleteTransition(storyId: string, transitionId: string): Transition | undefined;
  getBrandOverride(storyId: string): BrandOverride | null | undefined;
  setBrandOverride(storyId: string, input?: Partial<BrandOverride>): BrandOverride | undefined;
  deleteBrandOverride(storyId: string): BrandOverride | undefined;
}

export function createStoryEditorStore(
  initialStories?: Array<Partial<Story> & { id?: string }>,
): StoryEditorStore;
export function handleStoryEditorRequest(
  request: StoryEditorRequest,
  store?: StoryEditorStore,
): StoryEditorResponse;
