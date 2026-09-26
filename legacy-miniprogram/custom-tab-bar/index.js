Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '主城', icon: '🏯' },
      { pagePath: '/pages/heroes/heroes', text: '群英', icon: '⚔' },
      { pagePath: '/pages/summon/summon', text: '点将', icon: '📜' },
      { pagePath: '/pages/journey/journey', text: '王庭', icon: '🏛' }
    ]
  },
  methods: {
    switchTab(e) {
      const path = e.currentTarget.dataset.path;
      wx.switchTab({ url: path });
    }
  }
});
