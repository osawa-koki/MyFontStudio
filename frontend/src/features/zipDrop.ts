import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { openZip } from "./archiveActions";

const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files") ?? false;

/** 画面に zip をドラッグ＆ドロップすると読み込む。Layout で 1 回だけ使う */
export function useZipDrop(): void {
  const router = useRouter();
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      const file = e.dataTransfer?.files[0];
      if (!file) return;
      void openZip(file).then((ok) => {
        if (ok) router.push("/editor");
      });
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [router]);
}
