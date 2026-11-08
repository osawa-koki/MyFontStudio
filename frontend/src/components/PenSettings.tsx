import { PEN_SIZE_MAX, PEN_SIZE_MIN } from "../lib/project/project";
import type { PenParams } from "../types/project";

interface Props {
  pen: PenParams;
  usePressure: boolean;
  showModel: boolean;
  ignoreTouch: boolean;
  onPenChange(pen: Partial<PenParams>): void;
  onUsePressureChange(value: boolean): void;
  onShowModelChange(value: boolean): void;
  onIgnoreTouchChange(value: boolean): void;
}

/** ペン設定：太さ、筆圧の有無、お手本の表示、指の入力の無視 */
export function PenSettings(props: Props) {
  return (
    <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
      <legend className="px-1 text-xs text-slate-500">ペン設定</legend>
      <label className="flex items-center gap-2">
        太さ
        <input
          type="range"
          min={PEN_SIZE_MIN}
          max={PEN_SIZE_MAX}
          step={1}
          value={props.pen.size}
          onChange={(e) => props.onPenChange({ size: Number(e.target.value) })}
          aria-valuetext={`${props.pen.size}`}
        />
        <span className="w-8 text-right tabular-nums">{props.pen.size}</span>
      </label>
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={props.usePressure}
          onChange={(e) => props.onUsePressureChange(e.target.checked)}
        />
        筆圧
      </label>
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={props.showModel}
          onChange={(e) => props.onShowModelChange(e.target.checked)}
        />
        お手本
      </label>
      <label
        className="flex items-center gap-1"
        title="ペンで描くとき、手のひらが触れても線にならないようにします"
      >
        <input
          type="checkbox"
          checked={props.ignoreTouch}
          onChange={(e) => props.onIgnoreTouchChange(e.target.checked)}
        />
        指の入力を無視
      </label>
    </fieldset>
  );
}
