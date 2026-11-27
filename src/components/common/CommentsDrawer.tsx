"use client";

import { useState, useEffect, useRef } from "react";
import { X, Send, UserCircle, MessageSquare, Loader2, Paperclip, FileText } from "lucide-react";
import { useI18n } from "@/i18n";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    photo: string | null;
  };
  attachment: string | null;
  replyTo?: {
    id: string;
    content: string;
    user: { id: string; name: string };
  } | null;
}

interface CommentsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entityId: string;
  entityType: "task" | "supportTicket";
  entityTitle: string;
  currentUserId?: string; // Optional, to style your own messages
  onCommentsRead?: () => void;
}

export default function CommentsDrawer({ isOpen, onClose, entityId, entityType, entityTitle, currentUserId, onCommentsRead }: CommentsDrawerProps) {
  const { locale } = useI18n();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Mentions state
  const [allUsers, setAllUsers] = useState<{id: string, name: string}[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);

  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);

  useEffect(() => {
    fetch('/api/users').then(res => res.json()).then(data => setAllUsers(data || []));
  }, []);

  const fetchComments = async () => {
    if (!entityId) return;
    try {
      const param = entityType === "task" ? `taskId=${entityId}` : `supportTicketId=${entityId}`;
      const res = await fetch(`/api/comments?${param}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const activeKey = `${entityType}:${entityId}`;
  const loading = isOpen && loadedKey !== activeKey;

  useEffect(() => {
    if (!isOpen || !entityId) return;
    let cancelled = false;
    const param = entityType === "task" ? `taskId=${entityId}` : `supportTicketId=${entityId}`;

    const loadComments = async () => {
      try {
        const res = await fetch(`/api/comments?${param}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setComments(data);
          setLoadedKey(activeKey);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setLoadedKey(activeKey);
      }
    };

    void loadComments();

    const controller = new AbortController();
    fetch("/api/comments/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entityType === "task" ? { taskId: entityId } : { supportTicketId: entityId }),
      signal: controller.signal,
    })
      .then(() => {
        if (!cancelled) onCommentsRead?.();
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error(err);
      });

    const interval = setInterval(loadComments, 10000);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  }, [isOpen, entityId, entityType, activeKey, onCommentsRead]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments, isOpen]);

  const uploadFile = async (file: File) => {
    setUploadingFile(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setAttachmentUrl(data.url);
        setAttachmentName(file.name);
      } else {
        setUploadError(data.error || "Upload failed");
      }
    } catch (e) {
      console.error(e);
      setUploadError("Failed to upload file");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadFile(file);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1 || items[i].kind === 'file') {
          const file = items[i].getAsFile();
          if (file) {
            uploadFile(file);
            e.preventDefault();
            return;
          }
        }
      }
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newComment.trim() && !attachmentUrl) || sending || uploadingFile) return;

    setSending(true);
    try {
      const payload = {
        content: newComment.trim(),
        attachment: attachmentUrl,
        replyToId: replyingTo?.id,
        ...(entityType === "task" ? { taskId: entityId } : { supportTicketId: entityId })
      };

      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setNewComment("");
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        setAttachmentUrl(null);
        setAttachmentName(null);
        setReplyingTo(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchComments(); // Refresh immediately
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = `${target.scrollHeight}px`;
    
    const val = target.value;
    setNewComment(val);

    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');

    if (lastAtPos !== -1) {
      if (lastAtPos === 0 || textBeforeCursor[lastAtPos - 1] === ' ' || textBeforeCursor[lastAtPos - 1] === '\n') {
        const query = textBeforeCursor.slice(lastAtPos + 1);
        if (!query.includes('\n')) {
          setMentionQuery(query);
          setMentionStartIndex(lastAtPos);
          return;
        }
      }
    }
    setMentionQuery(null);
  };

  const handleMentionSelect = (userName: string) => {
    if (mentionStartIndex !== -1) {
      const before = newComment.slice(0, mentionStartIndex);
      // If user typed something after the cursor, we want to keep it. 
      // But for simplicity, we usually replace up to the cursor.
      const after = newComment.slice(textareaRef.current?.selectionStart || newComment.length);
      setNewComment(`${before}@${userName} ${after}`);
      setMentionQuery(null);
      setMentionStartIndex(-1);
      textareaRef.current?.focus();
    }
  };

  const filteredMentions = mentionQuery !== null 
    ? allUsers.filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    : [];

  const formatContent = (content: string, isMe: boolean) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    const renderTextWithUrls = (text: string) => {
      const parts = text.split(urlRegex);
      return parts.map((part, i) => {
        if (i % 2 === 1) {
          return <a key={i} href={part} target="_blank" rel="noreferrer" className={`underline hover:opacity-80 font-medium break-all ${isMe ? 'text-white dark:text-[#161A26]' : 'text-[var(--brand)]'}`}>{part}</a>;
        }
        return part;
      });
    };

    if (allUsers.length === 0) return <p className="whitespace-pre-wrap leading-relaxed break-words">{renderTextWithUrls(content)}</p>;
    
    // Sort names by length descending so "Kevin Wijaya" matches before "Kevin"
    const names = [...allUsers].map(u => u.name).sort((a,b) => b.length - a.length);
    const escapedNames = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`@(${escapedNames.join('|')})\\b`, 'gi');
    
    const parts = content.split(regex);
    return (
      <p className="whitespace-pre-wrap leading-relaxed break-words">
        {parts.map((part, i) => {
          if (i % 2 === 1) { // Matched name
            return <span key={i} className={`font-semibold px-1 rounded-md ${isMe ? 'bg-black/15 text-white dark:text-[#161A26]' : 'bg-[var(--brand-tint)] text-[var(--brand)]'}`}>@{part}</span>;
          }
          return <span key={i}>{renderTextWithUrls(part)}</span>;
        })}
      </p>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[9998]"
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-[var(--bg-surface)] text-[var(--text-ink)] shadow-2xl z-[9999] flex flex-col animate-in slide-in-from-right duration-300 border-l border-[var(--border-subtle)]">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 bg-[var(--brand-tint)] text-[var(--brand)] border border-[var(--brand-stroke)] rounded-xl shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-heading font-bold text-[var(--text-ink)] text-sm truncate">
                {locale === "id" ? "Komentar & Diskusi" : "Comments & Discussion"}
              </h2>
              <p className="text-xs text-[var(--text-muted)] truncate">{entityTitle}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-ink)] hover:bg-[var(--bg-subtle)] rounded-xl transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-5 bg-[var(--bg-canvas)] space-y-4">
          {loading && comments.length === 0 ? (
            <div className="flex justify-center items-center h-full text-[var(--text-muted)]">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] gap-2 text-center px-4">
              <MessageSquare className="w-10 h-10 opacity-20" />
              <p className="text-sm font-medium text-[var(--text-ink2)]">
                {locale === "id" ? "Belum ada diskusi" : "No comments yet"}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {locale === "id"
                  ? `Jadilah yang pertama mengomentari ${entityType === "task" ? "tugas" : "tiket"} ini!`
                  : `Be the first to comment on this ${entityType === "task" ? "task" : "ticket"}!`}
              </p>
            </div>
          ) : (
            comments.map((comment, idx) => {
              const isMe = currentUserId === comment.user.id;
              const showAvatar = idx === 0 || comments[idx - 1].user.id !== comment.user.id;
              
              return (
                <div key={comment.id} id={`comment-${comment.id}`} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''} transition-all duration-500 rounded-xl p-1 -mx-1`}>
                  {showAvatar ? (
                    <div className="w-8 h-8 rounded-full bg-[var(--brand-tint)] border border-[var(--brand-stroke)] flex items-center justify-center text-[var(--brand)] text-xs font-bold shrink-0 overflow-hidden">
                      {comment.user.photo ? (
                        <img src={comment.user.photo} alt={comment.user.name} className="w-full h-full object-cover" />
                      ) : (
                        comment.user.name.charAt(0)
                      )}
                    </div>
                  ) : (
                    <div className="w-8 shrink-0" />
                  )}
                  
                  <div className={`flex flex-col max-w-[75%] group ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                      {showAvatar && (
                        <span className="text-[10px] font-semibold text-[var(--text-muted)] mx-1">
                          {isMe ? (locale === "id" ? "Anda" : "You") : comment.user.name}
                        </span>
                      )}
                      <button 
                        onClick={() => { setReplyingTo(comment); textareaRef.current?.focus(); }}
                        className="text-[10px] font-semibold text-[var(--text-muted)] hover:text-[var(--brand)] transition-colors opacity-0 group-hover:opacity-100 px-1 cursor-pointer"
                      >
                        Balas
                      </button>
                    </div>
                    <div 
                      className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm flex flex-col gap-2 ${
                        isMe 
                          ? 'bg-[var(--brand)] text-white dark:text-[#161A26] rounded-tr-sm' 
                          : 'bg-[var(--bg-surface)] text-[var(--text-ink)] border border-[var(--border-subtle)] rounded-tl-sm'
                      }`}
                    >
                      {comment.replyTo && (
                        <div className={`p-2 rounded-lg text-xs border-l-2 mb-1 cursor-pointer opacity-90 hover:opacity-100 transition-opacity ${isMe ? 'bg-black/15 border-white/50 dark:border-[#161A26]/40 text-white dark:text-[#161A26]' : 'bg-[var(--bg-subtle)] border-[var(--brand)] text-[var(--text-ink2)]'}`} onClick={() => {
                          const el = document.getElementById(`comment-${comment.replyTo!.id}`);
                          if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            el.classList.add('ring-2', 'ring-[var(--brand)]', 'scale-[1.02]');
                            setTimeout(() => {
                              el.classList.remove('ring-2', 'ring-[var(--brand)]', 'scale-[1.02]');
                            }, 1500);
                          }
                        }}>
                          <span className="font-bold opacity-80 block mb-0.5">{comment.replyTo.user.name}</span>
                          <span className="line-clamp-2 truncate max-w-[200px] block opacity-90">{comment.replyTo.content || "Attachment"}</span>
                        </div>
                      )}
                      {comment.attachment && (
                        <div>
                          {comment.attachment.match(/\.(jpeg|jpg|gif|png|webp)$/i) || comment.attachment.startsWith('data:image/') ? (
                            <img 
                              src={comment.attachment} 
                              alt="attachment" 
                              onClick={() => setLightboxImage(comment.attachment as string)}
                              className="max-w-[200px] cursor-pointer rounded-lg max-h-48 object-contain bg-black/5 border border-[var(--border-subtle)] transition-transform hover:scale-[1.02]" 
                            />
                          ) : (
                            <a href={comment.attachment} target="_blank" rel="noreferrer" className={`flex items-center gap-2 p-2 rounded-lg text-xs font-semibold hover:opacity-80 transition-opacity ${isMe ? 'bg-white/20 text-white dark:text-[#161A26] border border-white/15' : 'bg-[var(--bg-subtle)] text-[var(--text-ink)] border border-[var(--border-subtle)]'}`}>
                              <FileText className="w-4 h-4" />
                              {comment.attachment.split('/').pop() || "Download File"}
                            </a>
                          )}
                        </div>
                      )}
                      {comment.content && formatContent(comment.content, isMe)}
                    </div>
                    <span className="text-[9px] font-medium text-[var(--text-muted)] mt-1 mx-1">
                      {new Date(comment.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] shrink-0 relative">
          
          {/* Mentions Dropdown */}
          {mentionQuery !== null && filteredMentions.length > 0 && (
            <div className="absolute bottom-full left-4 mb-2 w-64 bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-xl rounded-xl overflow-hidden z-50">
              <div className="max-h-48 overflow-y-auto p-1.5 space-y-0.5">
                {filteredMentions.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleMentionSelect(u.name)}
                    className="w-full text-left px-3 py-2 text-sm font-medium text-[var(--text-ink)] hover:bg-[var(--brand-tint)] hover:text-[var(--brand)] rounded-lg transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <UserCircle className="w-4 h-4 opacity-50" />
                    {u.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSend} className="flex flex-col gap-2">
            
            {/* Replying To Preview */}
            {replyingTo && (
              <div className="flex items-center justify-between p-2.5 bg-[var(--bg-subtle)] border-l-2 border-[var(--brand)] rounded-r-lg mb-1 relative">
                <div className="flex flex-col overflow-hidden text-xs w-full mr-6">
                  <span className="font-semibold text-[var(--brand)] mb-0.5">Membalas {replyingTo.user.name}</span>
                  <span className="text-[var(--text-muted)] truncate">{replyingTo.content || "Attachment"}</span>
                </div>
                <button type="button" onClick={() => setReplyingTo(null)} className="absolute top-2 right-2 p-1 text-[var(--text-muted)] hover:text-[var(--text-ink)] rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] transition-colors cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Attachment preview */}
            {attachmentUrl && (
              <div className="flex items-center justify-between p-2 bg-[var(--brand-tint)] border border-[var(--brand-stroke)] rounded-lg relative overflow-hidden group">
                <div className="flex items-center gap-2 truncate">
                  {attachmentUrl.startsWith('data:image/') || attachmentUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                    <img src={attachmentUrl} className="h-12 w-12 object-cover rounded shadow-sm border border-[var(--border-subtle)]" alt="preview" />
                  ) : (
                    <FileText className="w-8 h-8 text-[var(--brand)] shrink-0 p-1 bg-[var(--bg-surface)] rounded-md border border-[var(--border-subtle)]" />
                  )}
                  <span className="text-xs text-[var(--text-ink)] font-medium truncate pr-8">{attachmentName}</span>
                </div>
                <button type="button" onClick={() => { setAttachmentUrl(null); setAttachmentName(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="absolute right-2 p-1.5 text-[var(--text-muted)] hover:text-[var(--text-ink)] bg-[var(--bg-surface)] shadow-sm border border-[var(--border-subtle)] rounded-md opacity-70 group-hover:opacity-100 transition-all cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {uploadError && (
              <div className="text-xs font-medium text-[var(--err)] bg-[var(--err-bg)] border border-[var(--err-stroke)] rounded-lg px-3 py-1.5">
                {uploadError}
              </div>
            )}

            <div className="flex items-end gap-2">
              <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="p-3 text-[var(--text-muted)] hover:text-[var(--brand)] hover:bg-[var(--brand-tint)] rounded-xl transition-colors shrink-0 h-[44px] w-[44px] flex items-center justify-center cursor-pointer"
                title="Attach file or image"
              >
                {uploadingFile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
              </button>

              <textarea
                ref={textareaRef}
                value={newComment}
                onChange={handleTextChange}
                onPaste={handlePaste}
                placeholder={locale === "id" ? "Tulis komentar (@ tag)..." : "Write a comment (@ tag)..."}
                className="flex-1 max-h-32 min-h-[42px] bg-[var(--bg-canvas)] text-[var(--text-ink)] placeholder:text-[var(--text-muted)] border border-[var(--border-subtle)] rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/15 transition-all resize-none overflow-y-auto"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    if (mentionQuery !== null) {
                      return;
                    }
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
              />
              <button
                type="submit"
                disabled={(!newComment.trim() && !attachmentUrl) || sending || uploadingFile}
                className="p-3 bg-[var(--brand)] text-white dark:text-[#161A26] rounded-xl hover:bg-[var(--brand-hover)] disabled:opacity-50 transition-colors flex items-center justify-center shrink-0 h-[44px] w-[44px] cursor-pointer"
              >
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
              </button>
            </div>
          </form>
        </div>

      </div>

      {/* Lightbox Overlay */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[10000] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <img 
            src={lightboxImage} 
            className="max-w-full max-h-[90vh] object-contain animate-in zoom-in-95 duration-200 shadow-2xl rounded-sm" 
            alt="Fullscreen preview" 
          />
          <button 
            className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
            onClick={(e) => { e.stopPropagation(); setLightboxImage(null); }}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </>
  );
}
