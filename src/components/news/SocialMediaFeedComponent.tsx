/**
 * SocialMediaFeed component — displays fan/pundit/journalist posts.
 *
 * Shows a scrolling feed of social media reactions after matches + transfers.
 * Different visual style per post type (fan = casual, pundit = analytical,
 * journalist = breaking news style).
 */

import { type SocialMediaPost, getSocialTypeLabel, getSocialTypeColor } from "./SocialMediaFeed";
import { Heart, Repeat2, MessageCircle } from "lucide-react";

interface SocialMediaFeedProps {
 posts: SocialMediaPost[];
}

export function SocialMediaFeedComponent({ posts }: SocialMediaFeedProps) {
 if (posts.length === 0) {
  return (
   <div className="text-center py-4 text-xs text-ink-faint">
    No social media reactions yet.
   </div>
  );
 }

 return (
  <div className="flex flex-col gap-3">
   {posts.map((post) => (
    <div
     key={post.id}
     className="rounded border border-slate-line bg-carbon-1 p-3 transition-colors"
    >
     {/* Header */}
     <div className="flex items-center gap-2 mb-2">
      <span className="text-lg">{post.avatar}</span>
      <div className="flex-1 min-w-0">
       <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold text-ink truncate">
         {post.author}
        </span>
        <span className="text-xs text-ink-faint truncate">
         {post.handle}
        </span>
       </div>
       <span className={`text-[10px] font-heading font-bold uppercase tracking-wider ${getSocialTypeColor(post.type)}`}>
        {getSocialTypeLabel(post.type)}
       </span>
      </div>
      <span className="text-[10px] text-ink-faint">
       {post.timestamp}
      </span>
     </div>

     {/* Content */}
     <p className="text-sm text-ink-dim leading-relaxed mb-2">
      {post.content}
     </p>

     {/* Engagement */}
     <div className="flex items-center gap-4 text-[10px] text-ink-faint">
      <span className="flex items-center gap-1">
       <Heart className="w-3 h-3" />
       {post.likes.toLocaleString()}
      </span>
      <span className="flex items-center gap-1">
       <Repeat2 className="w-3 h-3" />
       {post.reposts.toLocaleString()}
      </span>
      <span className="flex items-center gap-1">
       <MessageCircle className="w-3 h-3" />
       {post.replies.toLocaleString()}
      </span>
     </div>
    </div>
   ))}
  </div>
 );
}
