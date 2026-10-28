import { useEffect, useState } from 'react';
import { combat } from './stores/combatStore';

const LINE = '胜败乃兵家常事，请大侠重新来过';

/** 死亡全屏文案（渐变字，3s 内淡入再淡出） */
export default function DeathQuote() {
  const [dead, setDead] = useState(combat.dead);
  const [key, setKey] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      if (combat.dead && !dead) setKey((k) => k + 1);
      setDead(combat.dead);
    }, 50);
    return () => clearInterval(id);
  }, [dead]);

  if (!dead) return null;

  return (
    <div className="death-quote" aria-live="polite">
      <p key={key}>{LINE}</p>
    </div>
  );
}
