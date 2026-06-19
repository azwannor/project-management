"use client";

import { useState, useEffect, useRef } from "react";
import { X, Send, UserCircle, MessageSquare, Loader2, Paperclip, FileText } from "lucide-react";

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
}

export default function CommentsDrawer({ isOpen, onClose, entityId, entityType, entityTitle, currentUserId }: CommentsDrawerProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

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

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchComments().finally(() => setLoading(false));

      // Update read status
      fetch("/api/comments/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entityType === "task" ? { taskId: entityId } : { supportTicketId: entityId })
      }).catch(console.error);
      
      // Auto-refresh comments every 10 seconds while open
      const interval = setInterval(fetchComments, 10000);
      return () => clearInterval(interval);
    }
  }, [isOpen, entityId, entityType]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments, isOpen]);

  const uploadFile = async (file: File) => {
    setUploadingFile(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        setAttachmentUrl(data.url);
        setAttachmentName(file.name);
      } else {
        alert(data.error || "Upload failed");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to upload file");
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
          return <a key={i} href={part} target="_blank" rel="noreferrer" className={`underline hover:opacity-80 font-medium break-all ${isMe ? 'text-white' : 'text-blue-600'}`}>{part}</a>;
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
            return <span key={i} className={`font-semibold px-1 rounded-md ${isMe ? 'bg-white/20 text-white' : 'bg-blue-50/50 text-blue-600'}`}>@{part}</span>;
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
      <div className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white shadow-2xl z-[9999] flex flex-col animate-in slide-in-from-right duration-300 border-l border-slate-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-slate-800 text-sm truncate">Diskusi</h2>
              <p className="text-xs text-slate-500 truncate">{entityTitle}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50 space-y-4">
          {loading && comments.length === 0 ? (
            <div className="flex justify-center items-center h-full text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
              <MessageSquare className="w-10 h-10 opacity-20" />
              <p className="text-sm font-medium">Belum ada diskusi</p>
              <p className="text-xs text-slate-500">Jadilah yang pertama mengomentari {entityType === 'task' ? 'task' : 'tiket'} ini!</p>
            </div>
          ) : (
            comments.map((comment, idx) => {
              const isMe = currentUserId === comment.user.id;
              const showAvatar = idx === 0 || comments[idx - 1].user.id !== comment.user.id;
              
              return (
                <div key={comment.id} id={`comment-${comment.id}`} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''} transition-all duration-500 rounded-xl p-1 -mx-1`}>
                  {showAvatar ? (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 flex items-center justify-center text-blue-600 text-xs font-bold shadow-inner shrink-0 overflow-hidden">
                      {comment.user.photo ? (
                        <img src={comment.user.photo} alt={comment.user.name} className="w-full h-full object-cover" />
                      ) : (
                        comment.user.name.charAt(0)
                      )}
                    </div>
                  ) : (
                    <div className="w-8 shrink-0" /> // Spacer for consecutive messages
                  )}
                  
                  <div className={`flex flex-col max-w-[75%] group ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                      {showAvatar && (
                        <span className="text-[10px] font-semibold text-slate-500 mx-1">
                          {isMe ? 'Anda' : comment.user.name}
                        </span>
                      )}
                      <button 
                        onClick={() => { setReplyingTo(comment); textareaRef.current?.focus(); }}
                        className={`text-[10px] font-semibold text-slate-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100 px-1`}
                      >
                        Balas
                      </button>
                    </div>
                    <div 
                      className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm flex flex-col gap-2 ${
                        isMe 
                          ? 'bg-blue-600 text-white rounded-tr-sm' 
                          : 'bg-white text-slate-700 border border-slate-100 rounded-tl-sm'
                      }`}
                    >
                      {comment.replyTo && (
                        <div className={`p-2 rounded-lg text-xs border-l-2 mb-1 cursor-pointer opacity-90 hover:opacity-100 transition-opacity ${isMe ? 'bg-black/10 border-white/50 text-white' : 'bg-slate-50 border-blue-400 text-slate-600'}`} onClick={() => {
                          const el = document.getElementById(`comment-${comment.replyTo!.id}`);
                          if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            el.classList.add('bg-blue-100/50', 'ring-2', 'ring-blue-400', 'scale-[1.02]');
                            setTimeout(() => {
                              el.classList.remove('bg-blue-100/50', 'ring-2', 'ring-blue-400', 'scale-[1.02]');
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
                              className="max-w-[200px] cursor-pointer rounded-lg max-h-48 object-contain bg-black/5 border border-black/10 transition-transform hover:scale-[1.02]" 
                            />
                          ) : (
                            <a href={comment.attachment} target="_blank" rel="noreferrer" className={`flex items-center gap-2 p-2 rounded-lg text-xs font-semibold hover:opacity-80 transition-opacity ${isMe ? 'bg-white/20 text-white border border-white/10' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                              <FileText className="w-4 h-4" />
                              {comment.attachment.split('/').pop() || "Download File"}
                            </a>
                          )}
                        </div>
                      )}
                      {comment.content && formatContent(comment.content, isMe)}
                    </div>
                    <span className="text-[9px] font-medium text-slate-400 mt-1 mx-1">
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
        <div className="p-4 bg-white border-t border-slate-100 shrink-0 relative">
          
          {/* Mentions Dropdown */}
          {mentionQuery !== null && filteredMentions.length > 0 && (
            <div className="absolute bottom-full left-4 mb-2 w-64 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden z-50">
              <div className="max-h-48 overflow-y-auto p-1.5 space-y-0.5">
                {filteredMentions.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleMentionSelect(u.name)}
                    className="w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors flex items-center gap-2"
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
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border-l-2 border-blue-500 rounded-r-lg mb-1 relative">
                <div className="flex flex-col overflow-hidden text-xs w-full mr-4">
                  <span className="font-semibold text-blue-600 mb-0.5">Membalas {replyingTo.user.name}</span>
                  <span className="text-slate-500 truncate">{replyingTo.content || "Attachment"}</span>
                </div>
                <button type="button" onClick={() => setReplyingTo(null)} className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 rounded-md bg-slate-100 hover:bg-slate-200 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Attachment preview */}
            {attachmentUrl && (
              <div className="flex items-center justify-between p-2 bg-blue-50/50 border border-blue-100 rounded-lg relative overflow-hidden group">
                <div className="flex items-center gap-2 truncate">
                  {attachmentUrl.startsWith('data:image/') || attachmentUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                    <img src={attachmentUrl} className="h-12 w-12 object-cover rounded shadow-sm border border-black/5" alt="preview" />
                  ) : (
                    <FileText className="w-8 h-8 text-blue-600 shrink-0 p-1 bg-white rounded-md border border-blue-100" />
                  )}
                  <span className="text-xs text-blue-800 font-medium truncate pr-8">{attachmentName}</span>
                </div>
                <button type="button" onClick={() => { setAttachmentUrl(null); setAttachmentName(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="absolute right-2 p-1.5 text-slate-400 hover:text-slate-600 bg-white shadow-sm border border-slate-200 hover:border-slate-300 rounded-md opacity-50 group-hover:opacity-100 transition-all">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex items-end gap-2">
              <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors shrink-0 h-[44px] w-[44px] flex items-center justify-center"
                title="Attach file or image"
              >
                {uploadingFile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
              </button>

              <textarea
                ref={textareaRef}
                value={newComment}
                onChange={handleTextChange}
                onPaste={handlePaste}
                placeholder="Tulis komentar... ketik @ untuk tag"
                className="flex-1 max-h-32 min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none overflow-y-auto"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    if (mentionQuery !== null) {
                      // Prevent submit if they are selecting a mention
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
                className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors flex items-center justify-center shrink-0 h-[44px] w-[44px]"
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
