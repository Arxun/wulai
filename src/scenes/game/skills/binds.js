import { ULT_SKILL_NAME } from '../../../config/lore';
import { HEAVY_MP, WHIRL_CD, WHIRL_MP, WULAI_CD, WULAI_MP } from '../stores/combatStore';

/**
 * 技能和键位的对照。电脑是键盘，手机是屏幕右下角的按钮文字。
 * 只给系统菜单读，不参与出招。出招仍在 Player.jsx / MobileRightPanel.jsx。
 */
export const SKILL_BINDS = [
  {
    id: 'attack',
    name: '普攻',
    desc: '连按依次刺、劈、砍、旋。人在空中时，这一下变成下砸。',
    pc: 'J',
    mobile: '普攻',
    mp: 0,
    cd: 0,
  },
  {
    id: 'skill',
    name: '崩击',
    desc: '把人砸开的一记重击，范围比普攻更远。',
    pc: 'K',
    mobile: '崩',
    mp: HEAVY_MP,
    cd: 0,
  },
  {
    id: 'whirl',
    name: '回旋斩',
    desc: '原地转圈，刀锋扫过身边一圈。转的时候还能走。',
    pc: 'E',
    mobile: 'E',
    mp: WHIRL_MP,
    cd: WHIRL_CD,
  },
  {
    id: 'wulai',
    name: ULT_SKILL_NAME,
    desc: '大招。砸地后留下一圈会持续灼烧的坑。',
    pc: 'R',
    mobile: '武',
    mp: WULAI_MP,
    cd: WULAI_CD,
  },
];
