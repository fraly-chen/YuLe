// app.js
App({
  onLaunch: function () {
    this.globalData = {
      // env 参数说明：
      // env 参数决定接下来小程序发起的云开发调用(wx.cloud.xxx)会请求到哪个云环境的资源
      // 此处请填入环境 ID, 环境 ID 可在微信开发者工具右上顶部工具栏点击云开发按钮打开获取
      env: "cloud1-3glycnrb998d7765",
      userInfo: null,
      openid: null,
      currentLocation: null,
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }
    
    // 恢复登录态
    this.restoreLoginState();
  },
  
  // 恢复登录态
  restoreLoginState() {
    try {
      const loginData = wx.getStorageSync('loginData');
      if (loginData) {
        const { openid, userInfo, loginTime } = loginData;
        // 登录态有效期: 30天
        const expireTime = 30 * 24 * 60 * 60 * 1000;
        if (Date.now() - loginTime < expireTime) {
          this.globalData.openid = openid;
          this.globalData.userInfo = userInfo;
          console.log('登录态已恢复');
        } else {
          // 过期清除
          wx.removeStorageSync('loginData');
          console.log('登录态已过期');
        }
      }
    } catch (e) {
      console.error('恢复登录态失败:', e);
    }
  },
  
  // 保存登录态
  saveLoginState(openid, userInfo) {
    try {
      wx.setStorageSync('loginData', {
        openid,
        userInfo,
        loginTime: Date.now()
      });
      console.log('登录态已保存');
    } catch (e) {
      console.error('保存登录态失败:', e);
    }
  },
  
  // 清除登录态
  clearLoginState() {
    try {
      wx.removeStorageSync('loginData');
      this.globalData.openid = null;
      this.globalData.userInfo = null;
      console.log('登录态已清除');
    } catch (e) {
      console.error('清除登录态失败:', e);
    }
  }
});
