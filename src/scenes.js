// 场景注册表：所有场景在此集中登记
// 平台入口（wechat/game.js、douyin/game.js）与离屏渲染（preview/mini/record.js）共用
// 新增场景：src/screens/ 新文件 + 本文件 register + app.js 底部导航登记（TABS）三处同步
const { app, ui } = require('./app');

app.register('home', require('./screens/home'));
app.register('heroes', require('./screens/heroes'));
app.register('summon', require('./screens/summon'));
app.register('journey', require('./screens/journey'));
app.register('heroDetail', require('./screens/heroDetail'));
app.register('formation', require('./screens/formation'));
app.register('tower', require('./screens/tower'));
app.register('arena', require('./screens/arena'));
app.register('forge', require('./screens/forge'));
app.register('shop', require('./screens/shop'));
app.register('battle', require('./screens/battle'));

module.exports = { app, ui };
