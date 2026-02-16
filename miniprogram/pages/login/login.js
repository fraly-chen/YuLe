// pages/login/login.js
const app = getApp();

Page({
  data: {
    userInfo: null
  },

  onLoad(options) {
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo
      });
    }
  },

  // 微信登录
  onWxLogin() {
    const that = this;
    
    // 获取用户信息
    wx.getUserProfile({
      desc: '用于完善会员资料',
      success: (res) => {
        const userInfo = res.userInfo;
        that.setData({ userInfo });
        
        // 获取openid
        wx.cloud.callFunction({
          name: 'quickstartFunctions',
          data: {
            type: 'getOpenId'
          },
          success: (res) => {
            const openid = res.result.openid;
            app.globalData.openid = openid;
            app.globalData.userInfo = userInfo;
            
            // 保存用户信息到云托管服务
            that.saveUserInfo(openid, userInfo);
          },
          fail: (err) => {
            console.error('获取openid失败:', err);
            wx.showToast({
              title: '登录失败',
              icon: 'none'
            });
          }
        });
      },
      fail: (err) => {
        console.error('获取用户信息失败:', err);
        wx.showToast({
          title: '授权失败',
          icon: 'none'
        });
      }
    });
  },

  // 保存用户信息
  saveUserInfo(openid, userInfo) {
    wx.cloud.callContainer({
      config: {
        env: app.globalData.env
      },
      path: '/api/user/register',
      header: {
        'X-WX-SERVICE': 'express-cks3'
      },
      method: 'POST',
      data: {
        openid: openid,
        nickName: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl,
        gender: userInfo.gender,
        country: userInfo.country,
        province: userInfo.province,
        city: userInfo.city
      },
      success: (res) => {
        if (res.data && res.data.success) {
          wx.showToast({
            title: '登录成功',
            icon: 'success'
          });
          
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      },
      fail: (err) => {
        console.error('保存用户信息失败:', err);
        // 即使保存失败也允许继续使用
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        });
        
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    });
  },

  // 继续使用
  onContinue() {
    wx.navigateBack();
  }
});
