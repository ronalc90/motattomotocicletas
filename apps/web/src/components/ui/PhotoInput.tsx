import { useRef, type ReactNode } from "react";
import { Camera } from "lucide-react";
import { Button, type ButtonProps } from "./Button";

interface Props extends Omit<ButtonProps, "onChange"> {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  capture?: boolean;
  children?: ReactNode;
  accept?: string;
}
/** Button that opens the camera (capture=environment) or the file picker. */
export function PhotoInput({ onFiles, multiple, capture = true, children, accept = "image/*", ...btn }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        {...(capture ? { capture: "environment" as const } : {})}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
      <Button type="button" icon={<Camera className="h-4 w-4" />} onClick={() => ref.current?.click()} {...btn}>
        {children ?? "Tomar foto"}
      </Button>
    </>
  );
}
