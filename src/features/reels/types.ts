export interface Reel {
  id: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    verified?: boolean;
  };
  caption: string;
  audioTrack?: { title: string; artist: string; url: string };
  likes: number;
  commentCount?: number;
  canComment?: boolean;
  comments: Comment[];
  shares: number;
  isLiked: boolean;
  isSaved: boolean;
  isFollowing: boolean;
  canLike?: boolean;
  canSave?: boolean;
  canShare?: boolean;
  canFollow?: boolean;
  followLabel?: string;
  canReport?: boolean;
  canDelete?: boolean;
}

export interface Comment {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string;
  text: string;
  likes: number;
  isLiked: boolean;
  timestamp: string;
  replies?: Comment[];
  canDelete?: boolean;
  canReport?: boolean;
}
