/**
 * 通用控制面板：用配置数组描述控件，不关心具体业务。
 *
 * items 的元素：
 *   { type: 'slider', label, value, min, max, step, onChange }
 *   { type: 'button', label, onClick, active? }
 *   { type: 'group', items: [...] }     // 同一组按钮挨在一起（比如模式切换）
 * 任一项可以带 `hidden: true` 来隐藏。
 */
export default function ControlPanel({ items, className = 'panel' }) {
  return <div className={className}>{items.filter((i) => !i.hidden).map(renderItem)}</div>;
}

function renderItem(item, index) {
  switch (item.type) {
    case 'slider':
      return (
        <label key={index}>
          {item.label}
          <input
            type="range"
            min={item.min}
            max={item.max}
            step={item.step}
            value={item.value}
            onChange={(e) => item.onChange(Number(e.target.value))}
          />
        </label>
      );
    case 'group':
      return (
        <div key={index} className="panel-group">
          {item.items.filter((i) => !i.hidden).map(renderItem)}
        </div>
      );
    case 'button':
    default:
      return (
        <button key={index} className={item.active ? 'active' : ''} onClick={item.onClick}>
          {item.label}
        </button>
      );
  }
}
