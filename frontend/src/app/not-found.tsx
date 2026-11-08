import Link from "next/link";

export default function NotFound() {
  return (
    <section className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-xl font-bold">ページが見つかりません</h1>
      <Link href="/" className="btn btn-primary">
        使い方へ
      </Link>
    </section>
  );
}
