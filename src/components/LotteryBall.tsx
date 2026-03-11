import { COLOR_MAP, getColorHex } from '../utils/constants';

interface Props {
  number: number;
  size?: 'sm' | 'md' | 'lg';
  isSpecial?: boolean;
}

export default function LotteryBall({ number, size = 'md', isSpecial = false }: Props) {
  const bg = getColorHex(COLOR_MAP[number]);
  const s = size === 'sm' ? 'w-7 h-7 text-[11px]' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-9 h-9 text-sm';

  return (
    <div
      className={`${s} rounded-full flex items-center justify-center text-white font-bold shadow-md select-none shrink-0 ${isSpecial ? 'ring-2 ring-yellow-400 ring-offset-1' : ''}`}
      style={{ backgroundColor: bg }}
    >
      {String(number).padStart(2, '0')}
    </div>
  );
}
