"use client";

import { useMemo, useState } from "react";
import type { NoteCard, NoteType } from "@/lib/notebook.mjs";

const NOTE_TYPE_OPTIONS: Array<{ value: NoteType; label: string }> = [
  { value: "freeform", label: "自由笔记" },
  { value: "quote", label: "原文摘录" },
  { value: "understanding", label: "自己的理解" },
  { value: "question", label: "疑问" },
  { value: "term", label: "术语" },
  { value: "mentor-answer", label: "AI 回答" },
  { value: "review", label: "待复习" },
];

export type NoteDraft = {
  type?: NoteType;
  title?: string;
  body?: string;
  quote?: string;
  tags?: string[];
  sectionId?: string;
  sourceUrl?: string;
  anchor?: string;
};

type NotebookWorkspaceProps = {
  notes: NoteCard[];
  compact?: boolean;
  repositoryId?: string;
  documentId?: string;
  initialDraft?: NoteDraft;
  syncLabel: string;
  historyCount: (noteId: string) => number;
  onCreate: (draft: NoteDraft) => void;
  onUpdate: (note: NoteCard) => void;
  onDelete: (noteId: string) => void;
  onRestore: (noteId: string) => void;
  onOpenSource: (note: NoteCard) => void;
  onOpenLibrary?: () => void;
};

function noteTypeLabel(type: NoteType) {
  return NOTE_TYPE_OPTIONS.find((option) => option.value === type)?.label || "自由笔记";
}

export function NotebookWorkspace({
  notes,
  compact = false,
  repositoryId = "",
  documentId = "",
  initialDraft = {},
  syncLabel,
  historyCount,
  onCreate,
  onUpdate,
  onDelete,
  onRestore,
  onOpenSource,
  onOpenLibrary,
}: NotebookWorkspaceProps) {
  const [composing, setComposing] = useState(Boolean(initialDraft.quote || initialDraft.body));
  const [type, setType] = useState<NoteType>(initialDraft.type || "freeform");
  const [title, setTitle] = useState(initialDraft.title || "");
  const [body, setBody] = useState(initialDraft.body || "");
  const [quote, setQuote] = useState(initialDraft.quote || "");
  const [tags, setTags] = useState((initialDraft.tags || []).join("，"));
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<NoteType | "all">("all");
  const [tagFilter, setTagFilter] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");

  const allTags = useMemo(() => [...new Set(notes.flatMap((note) => note.tags))].sort(), [notes]);
  const visibleNotes = useMemo(() => notes
    .filter((note) => !compact || (!repositoryId || note.repositoryId === repositoryId) && (!documentId || note.documentId === documentId))
    .filter((note) => typeFilter === "all" || note.type === typeFilter)
    .filter((note) => !tagFilter || note.tags.includes(tagFilter))
    .filter((note) => !reviewOnly || note.reviewNeeded)
    .filter((note) => !query || [note.title, note.body, note.quote, ...note.tags].join(" ").toLowerCase().includes(query.toLowerCase()))
    .sort((left, right) => Number(right.pinned) - Number(left.pinned) || right.updatedAt.localeCompare(left.updatedAt)),
  [compact, documentId, notes, query, repositoryId, reviewOnly, tagFilter, typeFilter]);

  function resetComposer() {
    setType("freeform");
    setTitle("");
    setBody("");
    setQuote("");
    setTags("");
    setComposing(false);
  }

  function submitNote() {
    if (!body.trim() && !quote.trim()) return;
    onCreate({
      ...initialDraft,
      type,
      title: title.trim(),
      body: body.trim(),
      quote: quote.trim(),
      tags: tags.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean),
    });
    resetComposer();
  }

  function updateFlags(note: NoteCard, patch: Partial<NoteCard>) {
    onUpdate({ ...note, ...patch });
  }

  return <section className={`notebook-workspace ${compact ? "compact" : "full"}`}>
    <header className="notebook-workspace-heading">
      <div><p className="overline">{compact ? "当前文章笔记" : "按文章 · 主题标签"}</p><h2>{compact ? documentId || "我的笔记" : "我的笔记"}</h2><small>{syncLabel}</small></div>
      <button className="new-note-button" onClick={() => setComposing(true)}>＋ 新建空白笔记</button>
    </header>

    {!compact && <div className="notebook-filters">
      <label><span>搜索笔记</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索自己的理解、摘录和标签" /></label>
      <label><span>笔记类型</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as NoteType | "all")}><option value="all">全部类型</option>{NOTE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label><span>主题标签</span><select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}><option value="">全部标签</option>{allTags.map((tag) => <option key={tag}>{tag}</option>)}</select></label>
      <button className={reviewOnly ? "active" : ""} onClick={() => setReviewOnly((value) => !value)}>↻ 只看待复习</button>
    </div>}

    {composing && <div className="note-composer">
      <div className="note-type-picker">{NOTE_TYPE_OPTIONS.map((option) => <button className={type === option.value ? "active" : ""} key={option.value} onClick={() => setType(option.value)}>{option.label}</button>)}</div>
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="标题（可选）" />
      {quote && <blockquote>{quote}</blockquote>}
      <textarea autoFocus value={body} onChange={(event) => setBody(event.target.value)} placeholder={quote ? "写下自己的理解、疑问或例子…" : "不需要先选择原文，直接记下现在的想法…"} />
      <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="标签，用逗号分隔" />
      <div><button onClick={resetComposer}>取消</button><button className="primary" disabled={!body.trim() && !quote.trim()} onClick={submitNote}>保存笔记卡片</button></div>
    </div>}

    <div className="note-card-list">
      {visibleNotes.map((note) => <article className={`note-card ${note.pinned ? "pinned" : ""}`} key={note.id}>
        <header><span>{noteTypeLabel(note.type)}</span><small>{new Date(note.updatedAt).toLocaleDateString("zh-CN")}</small></header>
        {note.title && <h3>{note.title}</h3>}
        {note.quote && <blockquote>“{note.quote}”</blockquote>}
        {editingId === note.id ? <div className="note-inline-editor"><textarea value={editingBody} onChange={(event) => setEditingBody(event.target.value)} /><div><button onClick={() => setEditingId(null)}>取消</button><button onClick={() => { updateFlags(note, { body: editingBody }); setEditingId(null); }}>保存</button></div></div> : <p>{note.body || "这张卡片只保存了原文摘录。"}</p>}
        <div className="note-tags">{note.tags.map((tag) => <button key={tag} onClick={() => { setTagFilter(tag); if (compact) onOpenLibrary?.(); }}>#{tag}</button>)}</div>
        <div className="note-card-flags"><button className={note.pinned ? "active" : ""} onClick={() => updateFlags(note, { pinned: !note.pinned })}>置顶</button><button className={note.resolved ? "active" : ""} onClick={() => updateFlags(note, { resolved: !note.resolved })}>{note.resolved ? "已解决" : "未解决"}</button><button className={note.reviewNeeded ? "active" : ""} onClick={() => updateFlags(note, { reviewNeeded: !note.reviewNeeded })}>待复习</button></div>
        <footer><button onClick={() => onOpenSource(note)}>定位原文</button><button onClick={() => { setEditingId(note.id); setEditingBody(note.body); }}>编辑</button>{historyCount(note.id) > 0 && <button onClick={() => onRestore(note.id)}>恢复上一版本</button>}<button className="danger" onClick={() => onDelete(note.id)}>删除</button></footer>
      </article>)}
      {!visibleNotes.length && <div className="notebook-empty"><span>✎</span><strong>{compact ? "这篇文章还没有笔记" : "还没有符合条件的笔记"}</strong><p>可以直接新建空白笔记，也可以从原文、术语解释或 AI 回答创建卡片。</p></div>}
    </div>
    {compact && onOpenLibrary && <button className="open-note-library" onClick={onOpenLibrary}>打开完整笔记库 →</button>}
  </section>;
}
