import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Lightbulb, 
  Database, 
  FileEdit,
  Loader2, 
} from 'lucide-react';
import { ChatEvent, ChatEventType } from '@/lib/types';

export const ChatEventRenderer = ({ event, isLoading }: { event: ChatEvent, isLoading?: boolean }) => {
  switch (event.type) {
    case ChatEventType.THOUGHT:
      return (
        <div className="mb-4 flex items-center gap-2 text-[13px] font-normal text-muted-foreground">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
          <span>{event.content}</span>
        </div>
      );

    case ChatEventType.TOOL_LOG:
      return <CollapsibleEvent 
                icon={<Database className="w-4 h-4" />} 
                label="Read" 
                event={event} 
              />;

    case ChatEventType.FILE_EDIT:
     return <CollapsibleEvent 
                icon={isLoading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <FileEdit className="w-4 h-4" />} 
                label={isLoading ? "Editing" : "Edited"} 
                event={event} 
                hideToggle 
                forceSingleLine={isLoading} // Keep it simple while loading
              />;

    case ChatEventType.MESSAGE:
      return (
        <div className="chat-markdown prose prose-sm mb-4 max-w-none overflow-x-hidden break-words leading-relaxed text-foreground dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {event.content}
          </ReactMarkdown>
          {isLoading && <span className="inline-block w-1.5 h-4 ml-1 bg-primary animate-pulse align-middle" />}
        </div>
      );

    default:
      return null;
  }
};

const CollapsibleEvent = ({ 
  icon, 
  label, 
  event,
  hideToggle = false,
  forceSingleLine = false
}: { 
  icon: React.ReactNode, 
  label: string, 
  event: ChatEvent,
  hideToggle?: boolean,
    forceSingleLine?: boolean
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Parse files
  const files = event.type === ChatEventType.FILE_EDIT 
    ? [event.filePath].filter(Boolean) as string[]
    : (event.metadata?.split(',') || []).filter(Boolean).map(f => f.trim());

  if (files.length === 0) return null;

  const hasMultipleFiles = files.length > 1;
  const showButton = !hideToggle && hasMultipleFiles && !forceSingleLine;

  return (
    <div className="my-2 flex min-w-0 flex-col gap-2 overflow-x-hidden">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3 overflow-hidden">
          <div className="shrink-0 text-muted-foreground">{icon}</div>
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            <span className="shrink-0 text-[13px] font-medium text-muted-foreground">{label}</span>
            
            {/* File Name Badge */}
            <span className="min-w-0 truncate rounded-md border border-border bg-card px-2 py-0.5 font-mono text-[12px] text-foreground">
              {files[0].split('/').pop()}
            </span>

            {/* +X more logic */}
            {!isExpanded && hasMultipleFiles && (
              <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
                +{files.length - 1} more
              </span>
            )}
          </div>
        </div>
        
        {showButton && (
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-4 rounded border border-border bg-background px-2 py-0.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {isExpanded ? 'Hide' : 'Show'}
          </button>
        )}
      </div>

      {/* List expansion logic */}
      {isExpanded && hasMultipleFiles && !forceSingleLine && (
        <div className="flex min-w-0 flex-col gap-2 overflow-hidden">
          {files.slice(1).map((file, idx) => (
            <div key={idx} className="flex min-w-0 items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
               <div className="shrink-0 opacity-0 text-muted-foreground">{icon}</div>
               <span className="w-8 shrink-0 text-[13px] font-medium text-muted-foreground">{label}</span>
               <span className="min-w-0 truncate rounded-md border border-border bg-card px-2 py-0.5 font-mono text-[12px] text-foreground">
                 {file.split('/').pop()}
               </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
