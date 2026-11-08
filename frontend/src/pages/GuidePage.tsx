import { Link } from "react-router";

export function GuidePage() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">手書きフォントを作ろう</h1>
      <p>
        自分の手書き文字から、PC にインストールして Word などで使えるフォント（.ttf /
        .otf）を作れます。
      </p>
      <div>
        <Link to="/editor" className="btn btn-primary">
          はじめる
        </Link>
      </div>
    </section>
  );
}
