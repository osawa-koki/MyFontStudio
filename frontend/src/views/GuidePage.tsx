import type { ReactNode } from "react";
import { GuideActions } from "../components/GuideActions";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5"
    >
      <h2 id={id} className="text-lg font-bold text-blue-900">
        {title}
      </h2>
      <div className="flex flex-col gap-2 leading-relaxed">{children}</div>
    </section>
  );
}

/** 使い方ページ（仕様 9 章）。説明文は静的な HTML として書き出す（サーバーコンポーネント） */
export function GuidePage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 py-4">
        <h1 className="text-3xl font-bold">手書きフォントを作ろう</h1>
        <p className="text-lg">
          自分の手書き文字から、PC にインストールして Word などで使えるフォント（.ttf /
          .otf）を作れます。 履歴書などの書類を、手書き風の文字で作るのに使えます。
        </p>
        <GuideActions />
      </section>

      <Section id="what" title="1. このアプリでできること">
        <ul className="list-disc pl-6">
          <li>1 文字ずつ手書きした文字から、フォントファイル（.ttf / .otf）を作れます。</li>
          <li>作ったフォントは Windows・macOS にインストールして、Word などで使えます。</li>
          <li>
            すべての処理はブラウザの中で行います。
            <strong>手書きのデータがブラウザの外に送信されることはありません。</strong>
          </li>
        </ul>
      </Section>

      <Section id="steps" title="2. 作り方の手順">
        <ol className="list-decimal pl-6">
          <li>「入力」ページで、作りたい文字（氏名・住所など）を入力して「追加」します。</li>
          <li>1 文字ずつ枠の中に描いて「保存」します。保存すると次の文字へ進みます。</li>
          <li>「プレビュー」ページで、文章に当てて確かめます。</li>
          <li>
            フォントをダウンロードします。<strong>Word で使うなら .ttf</strong> を選んでください。
          </li>
        </ol>
      </Section>

      <Section id="tips" title="3. きれいに描くコツ">
        <ul className="list-disc pl-6">
          <li>点線の枠（推奨描画範囲）の内側いっぱいに描くと、ほかの文字と大きさがそろいます。</li>
          <li>「お手本」を表示すると、文字の位置と大きさの目安になります。</li>
          <li>
            ペンタブレットや iPad + Apple Pencil がおすすめです（筆圧で線の太さが変わります）。
          </li>
          <li>住所・氏名・学校名など、履歴書で使う文字から作ると早く使えるようになります。</li>
          <li>英数字（半角）は、描いた幅に合わせて詰めて並びます。漢字・かなは等幅です。</li>
        </ul>
      </Section>

      <Section id="save" title="4. 途中保存">
        <ul className="list-disc pl-6">
          <li>
            ヘッダーの「zip で保存」で、作業をまるごと zip ファイルに保存できます。「zip
            を開く」で続きから再開できます。
          </li>
          <li>
            ブラウザにも自動で保存しますが、これは保険です。ブラウザの履歴やキャッシュを削除すると消えるので、
            大事な作業は zip で保存してください。
          </li>
        </ul>
      </Section>

      <Section id="install" title="5. フォントのインストール方法">
        <h3 className="font-bold">Windows</h3>
        <ul className="list-disc pl-6">
          <li>ダウンロードした .ttf を右クリックして「インストール」を選びます。</li>
          <li>
            作り直したフォントを入れるときは、先に古いフォントを削除し（設定 → 個人用設定 →
            フォント）、Word を再起動してから入れ直します。
          </li>
        </ul>
        <h3 className="font-bold">macOS</h3>
        <ul className="list-disc pl-6">
          <li>
            ダウンロードした .ttf をダブルクリックし、Font Book で「インストール」を押します。
          </li>
        </ul>
      </Section>

      <Section id="word" title="6. Word で使うときの注意">
        <ul className="list-disc pl-6">
          <li>
            フォント一覧から、設定したフォント名（日本語名を付けた場合はその名前）を選びます。
          </li>
          <li>作っていない文字は、別のフォントで表示されるか、箱の形（×印）になります。</li>
          <li>
            提出する前に <strong>PDF で保存</strong>すると、相手の PC
            にフォントがなくても手書きの見た目のまま届きます。 Word のまま渡すときは、「ファイル →
            オプション → 保存」の「ファイルにフォントを埋め込む」を ON にします。
          </li>
          <li>
            どちらも <strong>.ttf</strong> を使ってください（.otf は Word の文書に埋め込めず、PDF
            保存で文字が画像になる場合があります）。
          </li>
        </ul>
      </Section>

      <Section id="faq" title="7. よくある質問">
        <dl className="flex flex-col gap-3">
          <div>
            <dt className="font-bold">Q. 文字が箱（×印）になる</dt>
            <dd className="pl-4">
              その文字をまだ作っていません。「プレビュー」で未作成の文字を確かめ、入力ページで描いてください。
            </dd>
          </div>
          <div>
            <dt className="font-bold">Q. フォントを作り直したのに Word に反映されない</dt>
            <dd className="pl-4">
              古いフォントを削除してから新しいフォントを入れ、Word を再起動してください（Windows
              はフォントを覚えているため）。
            </dd>
          </div>
          <div>
            <dt className="font-bold">Q. zip を開けない</dt>
            <dd className="pl-4">
              このアプリで保存した zip だけを開けます。展開して中身を変えた zip や、壊れた zip
              は開けません。 読み込めなかった文字があるときは、その一覧を表示します。
            </dd>
          </div>
          <div>
            <dt className="font-bold">Q. 前回の作業が消えた</dt>
            <dd className="pl-4">
              ブラウザの自動保存は、キャッシュの削除やプライベートブラウズで消えます。zip
              で保存したファイルから再開してください。
            </dd>
          </div>
        </dl>
      </Section>
    </div>
  );
}
