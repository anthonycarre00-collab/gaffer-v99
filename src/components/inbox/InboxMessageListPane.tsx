import { Mail, MailOpen } from "lucide-react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { formatDateShort } from "../../lib/helpers";
import type { MessageData } from "../../store/gameStore";
import ContextMenu from "../ContextMenu";
import { Checkbox, GeneratedAvatar } from "../ui";
import {
 buildDeleteMessageMenuItem,
 buildMarkMessageReadMenuItem,
 buildOpenMessageMenuItem,
} from "./inboxContextMenuItems";
import {
 getCategoryColor,
 getListPaneClassName,
 getMessageRowClassName,
 getMessageSubjectClassName,
} from "./inboxHelpers";

interface InboxMessageListPaneProps {
 bulkSelectionEnabled: boolean;
 filteredMessages: MessageData[];
 hasSelectedMessage: boolean;
 language: string;
 selectedMessageId: string | null;
 selectedMessageIds: string[];
 onSelectMessage: (messageId: string) => void;
 onToggleMessageSelection: (messageId: string) => void;
 onRequestDeleteMessage: (message: MessageData) => void;
 onRequestMarkMessageRead: (messageId: string) => void;
}

/**
 * Returns a relative date label for recent messages, falling back to the
 * existing formatDateShort for older items. This is the WhatsApp/iMessage
 * pattern: "now", "5m", "1h", "Yesterday", then "Mon" / full date.
 */
function relativeDate(isoDate: string, language: string): string {
 const date = new Date(isoDate);
 const now = new Date();
 const diffMs = now.getTime() - date.getTime();
 const diffMin = Math.floor(diffMs / 60_000);
 const diffHr = Math.floor(diffMs / 3_600_000);
 const sameDay =
 date.getFullYear() === now.getFullYear() &&
 date.getMonth() === now.getMonth() &&
 date.getDate() === now.getDate();
 const yesterday = new Date(now);
 yesterday.setDate(now.getDate() - 1);
 const isYesterday =
 date.getFullYear() === yesterday.getFullYear() &&
 date.getMonth() === yesterday.getMonth() &&
 date.getDate() === yesterday.getDate();

 if (diffMin < 1) return "now";
 if (diffMin < 60) return `${diffMin}m`;
 if (sameDay) return `${diffHr}h`;
 if (isYesterday) return "Yday";
 // Within a week: short weekday name.
 if (diffMs < 7 * 86_400_000) {
 try {
 return new Intl.DateTimeFormat(language, { weekday: "short" }).format(date);
 } catch {
 return formatDateShort(isoDate, language);
 }
 }
 return formatDateShort(isoDate, language);
}

/**
 * Truncate the body preview to ~60 chars, stripping any leading sender
 * salutation ("Hi Gaffer, ..." → "Gaffer, ..."). For modern messaging UX,
 * we want a one-line preview the way WhatsApp/iMessage does.
 */
function bodyPreview(body: string): string {
 const trimmed = body.replace(/\s+/g, " ").trim();
 if (trimmed.length <= 70) return trimmed;
 return `${trimmed.slice(0, 67)}…`;
}

/** Map a sender role to a color used by the avatar fallback. */
// (Unused for now — kept for future role-based avatar tinting.)
// function avatarColorFromRole(role: string): string { ... }

export default function InboxMessageListPane({
 bulkSelectionEnabled,
 filteredMessages,
 hasSelectedMessage,
 language,
 selectedMessageId,
 selectedMessageIds,
 onSelectMessage,
 onToggleMessageSelection,
 onRequestDeleteMessage,
 onRequestMarkMessageRead,
}: InboxMessageListPaneProps): JSX.Element {
 const { t } = useTranslation();

 return (
 <div className={getListPaneClassName(hasSelectedMessage)}>
 <div className="bg-linear-to-r shrink-0 border-b border-slate-line-soft p-4 border-slate-line">
 <h3 className="text-sm font-heading font-bold text-ink flex items-center gap-2 uppercase tracking-wide">
 <Mail className="w-4 h-4 text-accent-400" />
 {t("inbox.title")}
 </h3>
 <p className="text-xs text-ink-faint mt-0.5 font-heading uppercase tracking-wider">
 {t("inbox.nMessages", { count: filteredMessages.length })}
 </p>
 </div>

 <div className="flex-1 overflow-y-auto">
 {filteredMessages.length === 0 ? (
 <div className="p-6 text-center">
 <MailOpen className="w-8 h-8 text-ink-faint dark:text-navy-600 mx-auto mb-2" />
 <p className="text-sm text-ink-faint">
 {t("inbox.noMessages")}
 </p>
 </div>
 ) : (
 filteredMessages.map((message) => {
 const categoryColor = getCategoryColor(message.category);
 const isSelected = selectedMessageId === message.id;
 const contextItems = [
 buildOpenMessageMenuItem(t, () => onSelectMessage(message.id)),
 buildMarkMessageReadMenuItem(t, message.read, () =>
 onRequestMarkMessageRead(message.id),
 ),
 buildDeleteMessageMenuItem(t, () => onRequestDeleteMessage(message)),
 ];

 // Determine urgency — high priority + unread = bold accent ring.
 const isUrgent = !message.read && message.priority === "high";

 return (
 <ContextMenu items={contextItems} key={message.id}>
 <div
 onClick={() => onSelectMessage(message.id)}
 className={getMessageRowClassName(isSelected, message.read)}
 data-testid={`inbox-row-${message.id}`}
 >
 {bulkSelectionEnabled ? (
 <div
 className="mt-1 flex shrink-0 items-center"
 onClick={(event) => event.stopPropagation()}
 >
 <Checkbox
 checked={selectedMessageIds.includes(message.id)}
 onChange={() => onToggleMessageSelection(message.id)}
 aria-label={t("inbox.selectMessageForDeletion", {
 subject: message.subject,
 })}
 data-testid={`inbox-select-message-${message.id}`}
 />
 </div>
 ) : null}
 {/* Modern avatar: shows the sender visually rather than just an icon */}
 <div
 className="relative shrink-0"
 title={`${message.sender} (${message.sender_role})`}
 >
 <GeneratedAvatar
 name={message.sender || message.sender_role || "unknown"}
 initials={(message.sender || message.sender_role || "?").split(/\s+/).slice(0, 2).map((w) => w[0]).join("")}
 className={`h-10 w-10 rounded-full ring-2 ${
 isUrgent
 ? "ring-danger-400"
 : isSelected
 ? "ring-accent-400"
 : "ring-transparent"
 }`}
 />
 {/* Category dot in the corner of the avatar */}
 <span
 className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-carbon-0 ${categoryColor} flex items-center justify-center text-[8px] text-ink`}
 title={message.category}
 >
 {/* Tiny category glyph — replaced by full icon below in the detail pane */}
 </span>
 </div>
 <div className="min-w-0 flex-1">
 <div className="flex items-center justify-between gap-2">
 <h4 className={getMessageSubjectClassName(message.read)}>
 {message.subject}
 </h4>
 <span
 className={`text-[10px] shrink-0 ${
 !message.read
 ? "text-accent-500 dark:text-accent-400 font-bold"
 : "text-ink-faint"
 }`}
 >
 {relativeDate(message.date, language)}
 </span>
 </div>
 <div className="flex items-center justify-between gap-2 mt-0.5">
 <p className="text-xs text-ink-dim truncate font-medium">
 {message.sender}
 </p>
 {!message.read ? (
 <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0" />
 ) : null}
 </div>
 {/* Body preview — one line, muted. This is the WhatsApp touch. */}
 <p className="text-[11px] text-ink-faint truncate mt-0.5 italic">
 {bodyPreview(message.body)}
 </p>
 </div>
 </div>
 </ContextMenu>
 );
 })
 )}
 </div>
 </div>
 );
}
