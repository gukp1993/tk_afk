const store = require('./utils/store');

App({
  onLaunch() {
    store.load();
    store.checkDailyReset();
  },
  onHide() {
    store.save();
  }
});
