// pages/create-game/create-game.js
const app = getApp();

Page({
  data: {
    gameName: '',
    location: '',
    latitude: null,
    longitude: null,
    startTime: '',
    maxPlayers: 8,
    courtCount: 2,
    remark: '',
    timeIndex: [0, 0, 0],
    timeRange: [[], [], []]
  },

  onLoad(options) {
    this.initTimeRange();
    this.loadDefaultLocation();
  },

  // 初始化时间选择器
  initTimeRange() {
    const dates = [];
    const hours = [];
    const minutes = [];
    
    // 生成未来30天的日期
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const weekDay = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
      dates.push(`${month}月${day}日 周${weekDay}`);
    }
    
    // 生成小时
    for (let i = 0; i < 24; i++) {
      hours.push(i < 10 ? `0${i}` : `${i}`);
    }
    
    // 生成分钟
    for (let i = 0; i < 60; i += 15) {
      minutes.push(i < 10 ? `0${i}` : `${i}`);
    }
    
    this.setData({
      timeRange: [dates, hours, minutes]
    });
  },

  // 加载默认位置
  loadDefaultLocation() {
    if (app.globalData.currentLocation) {
      this.setData({
        latitude: app.globalData.currentLocation.latitude,
        longitude: app.globalData.currentLocation.longitude
      });
    }
  },

  // 球局名称输入
  onGameNameInput(e) {
    this.setData({
      gameName: e.detail.value
    });
  },

  // 选择位置
  onPickLocation() {
    const that = this;
    wx.chooseLocation({
      success(res) {
        that.setData({
          location: res.address + res.name,
          latitude: res.latitude,
          longitude: res.longitude
        });
      },
      fail(err) {
        console.error('选择位置失败:', err);
      }
    });
  },

  // 时间列改变
  onTimeColumnChange(e) {
    const column = e.detail.column;
    const value = e.detail.value;
    const timeIndex = this.data.timeIndex;
    timeIndex[column] = value;
    this.setData({ timeIndex });
  },

  // 时间改变
  onTimeChange(e) {
    const value = e.detail.value;
    const timeRange = this.data.timeRange;
    const date = timeRange[0][value[0]];
    const hour = timeRange[1][value[1]];
    const minute = timeRange[2][value[2]];
    
    this.setData({
      timeIndex: value,
      startTime: `${date} ${hour}:${minute}`
    });
  },

  // 减少人数
  onDecrease() {
    let maxPlayers = this.data.maxPlayers;
    if (maxPlayers > 4) {
      maxPlayers -= 2;
      this.updateCourtCount(maxPlayers);
    }
  },

  // 增加人数
  onIncrease() {
    let maxPlayers = this.data.maxPlayers;
    if (maxPlayers < 30) {
      maxPlayers += 2;
      this.updateCourtCount(maxPlayers);
    }
  },

  // 更新场地数量
  updateCourtCount(maxPlayers) {
    const courtCount = Math.ceil(maxPlayers / 6);
    this.setData({
      maxPlayers,
      courtCount
    });
  },

  // 备注输入
  onRemarkInput(e) {
    this.setData({
      remark: e.detail.value
    });
  },

  // 取消
  onCancel() {
    wx.navigateBack();
  },

  // 创建球局
  onCreate() {
    const { gameName, location, startTime, maxPlayers, remark, latitude, longitude } = this.data;
    
    // 检查登录状态
    if (!app.globalData.openid || !app.globalData.userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }
    
    // 验证必填项
    if (!gameName) {
      wx.showToast({
        title: '请输入球局名称',
        icon: 'none'
      });
      return;
    }
    
    if (!location) {
      wx.showToast({
        title: '请选择球馆地点',
        icon: 'none'
      });
      return;
    }
    
    if (!startTime) {
      wx.showToast({
        title: '请选择开始时间',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '创建中...'
    });
    
    console.log('开始创建球局:', {
      creatorOpenid: app.globalData.openid,
      creatorName: app.globalData.userInfo ? app.globalData.userInfo.nickName : 'undefined',
      gameName,
      location,
      startTime,
      maxPlayers
    });
    
    // 调用云托管服务创建球局
    wx.cloud.callContainer({
      config: {
        env: app.globalData.env
      },
      path: '/api/game/create',
      header: {
        'X-WX-SERVICE': 'express-cks3'
      },
      method: 'POST',
      data: {
        creatorOpenid: app.globalData.openid,
        creatorName: app.globalData.userInfo.nickName,
        gameName,
        location,
        latitude,
        longitude,
        startTime,
        maxPlayers,
        remark,
        status: 'waiting'
      },
      success: (res) => {
        wx.hideLoading();
        console.log('创建球局响应:', res);
        
        if (res.data && res.data.success) {
          wx.showToast({
            title: '创建成功',
            icon: 'success'
          });
          
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          console.error('创建失败响应:', res.data);
          wx.showToast({
            title: res.data.message || '创建失败',
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('创建球局失败:', err);
        console.error('错误详情:', JSON.stringify(err));
        wx.showToast({
          title: '创建失败，请检查网络',
          icon: 'none',
          duration: 2000
        });
      }
    });
  }
});
