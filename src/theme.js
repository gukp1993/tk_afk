// 主题令牌：与原设计系统一致（墨黑漆器 + 鎏金 + 朱砂）
module.exports = {
  BG: '#171009',
  PANEL_HI: '#2e2113',
  PANEL_LO: '#221810',
  LINE: '#5a452a',
  LINE_HI: '#8a6a33',
  GOLD: '#d9a94e',
  GOLD_HI: '#f0cf8a',
  GOLD_DEEP: '#b8842e',
  TEXT: '#e9d8b4',
  DIM: '#a6906c',
  RED: '#c74a32',
  RED_HI: '#e86a4a',
  GREEN: '#4a9e78',
  BLUE: '#4d7fb5',
  PURPLE: '#9a6ed0',
  FACTION: {
    wei: { name: '魏', color: '#7fb0e8', fill: 'rgba(77,127,181,0.24)' },
    shu: { name: '蜀', color: '#6cc79a', fill: 'rgba(74,158,120,0.24)' },
    wu:  { name: '吴', color: '#f08a6a', fill: 'rgba(199,74,50,0.24)' },
    qun: { name: '群', color: '#c39af0', fill: 'rgba(154,110,208,0.24)' }
  },
  RARITY: {
    1: { name: 'N', color: '#c8ccd4', frame: '#8a8f99' },
    2: { name: 'R', color: '#6f9fd8', frame: '#4d7fb5' },
    3: { name: 'SR', color: '#c99af0', frame: '#9a6ed0' },
    4: { name: 'SSR', color: '#f0b95e', frame: '#e8a33d' }
  },
  font(size, bold) {
    return (bold ? 'bold ' : '') + size + 'px "Kaiti SC","STKaiti","KaiTi","STSong",serif';
  }
};
