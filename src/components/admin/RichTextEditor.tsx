import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { Link } from "@tiptap/extension-link";
import { TextAlign } from "@tiptap/extension-text-align";
import { Heading } from "@tiptap/extension-heading";
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  LinkIcon,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEffect } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeight?: string;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  icon: Icon,
  tooltip,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  tooltip: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            onClick={onClick}
            disabled={disabled}
            variant={active ? "default" : "outline"}
            className="h-9 w-9 rounded-lg"
          >
            <Icon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="rounded-lg text-xs" side="bottom">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  const isDisabled = editor.isEditable === false;

  return (
    <div className="flex flex-wrap gap-1 rounded-t-2xl border border-b-0 border-border bg-muted p-3">
      {/* Undo/Redo */}
      <div className="flex gap-1 border-r border-border pr-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={isDisabled || !editor.can().undo()}
          icon={Undo2}
          tooltip="Undo"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={isDisabled || !editor.can().redo()}
          icon={Redo2}
          tooltip="Redo"
        />
      </div>

      {/* Text Formatting */}
      <div className="flex gap-1 border-r border-border pr-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          disabled={isDisabled}
          icon={Bold}
          tooltip="Bold"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          disabled={isDisabled}
          icon={Italic}
          tooltip="Italic"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          disabled={isDisabled}
          icon={Underline}
          tooltip="Underline"
        />
      </div>

      {/* Headings */}
      <div className="flex gap-1 border-r border-border pr-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          disabled={isDisabled}
          icon={Heading2}
          tooltip="Heading 2"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          disabled={isDisabled}
          icon={Heading1}
          tooltip="Heading 3"
        />
      </div>

      {/* Lists */}
      <div className="flex gap-1 border-r border-border pr-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          disabled={isDisabled}
          icon={List}
          tooltip="Bullet List"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          disabled={isDisabled}
          icon={ListOrdered}
          tooltip="Ordered List"
        />
      </div>

      {/* Text Alignment */}
      <div className="flex gap-1 border-r border-border pr-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          active={editor.isActive({ textAlign: "left" })}
          disabled={isDisabled}
          icon={AlignLeft}
          tooltip="Align Left"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          active={editor.isActive({ textAlign: "center" })}
          disabled={isDisabled}
          icon={AlignCenter}
          tooltip="Align Center"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          active={editor.isActive({ textAlign: "right" })}
          disabled={isDisabled}
          icon={AlignRight}
          tooltip="Align Right"
        />
      </div>

      {/* Link */}
      <div className="flex gap-1 border-r border-border pr-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                onClick={() => {
                  const url = prompt("Enter URL:");
                  if (url) {
                    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
                  }
                }}
                disabled={isDisabled}
                variant={editor.isActive("link") ? "default" : "outline"}
                className="h-9 w-9 rounded-lg"
              >
                <LinkIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="rounded-lg text-xs" side="bottom">
              Add Link
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Colors */}
      <div className="flex gap-1">
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold text-muted-foreground px-1">Text</span>
          <ColorPicker
            value={editor.getAttributes("textStyle")?.color || "#000000"}
            onChange={(color) => editor.chain().focus().setColor(color).run()}
            disabled={isDisabled}
            label="Text Color"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold text-muted-foreground px-1">Highlight</span>
          <ColorPicker
            value={editor.getAttributes("highlight")?.color || "#FFFF00"}
            onChange={(color) => editor.chain().focus().toggleHighlight({ color }).run()}
            disabled={isDisabled}
            label="Highlight Color"
          />
        </div>
      </div>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  disabled = false,
  placeholder = "Write something here…",
  minHeight = "300px",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: value,
    editable: !disabled,
    onCreate: ({ editor: ed }) => {
      if (ed.isEmpty && value) {
        ed.commands.setContent(value);
      }
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (editor && !editor.isFocused) {
      const currentContent = editor.getHTML();
      if (currentContent !== value && value) {
        editor.commands.setContent(value, false);
      }
    }
  }, [value, editor]);

  if (!editor) {
    return <div className="text-sm text-muted-foreground">Loading editor…</div>;
  }

  return (
    <div className="rounded-2xl border border-border shadow-card overflow-hidden">
      <Toolbar editor={editor} />
      <div
        className="prose prose-sm rounded-b-2xl border-t border-border bg-card px-4 py-3 max-w-none dark:prose-invert"
        style={{ minHeight }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
