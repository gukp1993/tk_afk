// 挂机定三国 · 微信小游戏入口
const { app } = require('./src/app');

app.register('home', require('./src/screens/home'));
app.register('heroes', require('./src/screens/heroes'));
app.register('summon', require('./src/screens/summon'));
app.register('journey', require('./src/screens/journey'));
app.register('heroDetail', require('./src/screens/heroDetail'));
app.register('formation', require('./src/screens/formation'));
app.register('tower', require('./src/screens/tower'));
app.register('arena', require('./src/screens/arena'));
app.register('forge', require('./src/screens/forge'));
app.register('shop', require('./src/screens/shop'));
app.register('battle', require('./src/screens/battle'));

app.init();
app.switchTab('home');
