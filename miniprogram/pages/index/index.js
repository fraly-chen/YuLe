// pages/index/index.js
const app = getApp();

Page({
  data: {
    userInfo: null,
    locationText: '当前位置',
    stats: {
      totalGames: 0,
      winRate: 0,
      totalWins: 0
    },
    gameList: [],
    statusMap: {
      'waiting': '等待开始',
      'playing': '进行中',
      'finished': '已结束'
    },
    // 登录弹窗相关
    showLoginModal: false,
    tempAvatarUrl: '',
    tempNickname: '',
    focusNickname: false,
    // 弹窗相关
    showCreateModal: false,
    gameName: '',
    location: '',
    latitude: null,
    longitude: null,
    courtCount: 2,
    maxPlayers: 8,
    // 触摸事件
    touchStartX: 0,
    touchStartY: 0
  },

  onLoad(options) {
    // 页面加载时检查登录状态，但不自动登录
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo
      });
      this.loadGameList();
      this.loadUserStats();
    }
  },

  onShow() {
    // 页面显示时检查登录状态
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo
      });
      this.loadUserStats();
      this.loadGameList();
    }
  },

  // 用户卡片点击事件
  onUserCardClick() {
    // 已登录时无操作
  },

  // 跳转编辑资料页面
  onEditProfile() {
    wx.navigateTo({
      url: '/pages/profile/profile'
    });
  },

  // 显示登录弹窗
  onShowLogin() {
    this.setData({
      showLoginModal: true,
      tempAvatarUrl: '',
      tempNickname: '',
      focusNickname: false
    });
  },

  // 关闭登录弹窗
  onCloseLoginModal() {
    this.setData({ showLoginModal: false, focusNickname: false });
  },

  // 选择头像回调
  onChooseAvatar(e) {
    console.log('选择头像:', e.detail.avatarUrl);
    this.setData({ tempAvatarUrl: e.detail.avatarUrl });
  },

  // 昵称输入
  onNicknameInput(e) {
    this.setData({ tempNickname: e.detail.value });
  },

  // 昵称失焦
  onNicknameBlur(e) {
    this.setData({ tempNickname: e.detail.value });
  },

  // 确认登录
  onConfirmLogin() {
    const { tempAvatarUrl, tempNickname } = this.data;
    
    if (!tempNickname.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    
    const that = this;
    const userInfo = {
      nickName: tempNickname.trim(),
      avatarUrl: tempAvatarUrl || ''
    };
    
    wx.showLoading({ title: '登录中...' });
    
    // 获取 openid
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: { type: 'getOpenId' },
      success: (res) => {
        console.log('getOpenId返回:', res);
        if (res.result && res.result.openid) {
          const openid = res.result.openid;
          app.globalData.openid = openid;
          app.globalData.userInfo = userInfo;
          
          that.setData({ 
            userInfo: userInfo,
            showLoginModal: false
          });
          
          // 保存用户信息
          that.saveUserInfo(openid, userInfo);
        } else {
          wx.hideLoading();
          wx.showToast({ title: '登录失败', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('获取openid失败:', err);
        wx.showToast({ title: '登录失败', icon: 'none' });
      }
    });
  },

  // 阻止事件冒泡
  stopEvent() {},

  // 保存用户信息
  saveUserInfo(openid, userInfo) {
    const that = this;
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'userLogin',
        openid: openid,
        nickName: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl,
        gender: userInfo.gender,
        country: userInfo.country,
        province: userInfo.province,
        city: userInfo.city
      },
      success: (res) => {
        wx.hideLoading();
        wx.showToast({ title: '登录成功', icon: 'success' });
        that.loadGameList();
        that.loadUserStats();
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('保存用户信息失败:', err);
        wx.showToast({ title: '登录成功', icon: 'success' });
        that.loadGameList();
        that.loadUserStats();
      }
    });
  },

  // 点击球局进入详情
  onGameTap(e) {
    const gameId = e.currentTarget.dataset.id;
    if (gameId) {
      wx.navigateTo({
        url: `/pages/game-detail/game-detail?id=${gameId}`
      });
    }
  },

  // 创建球局
  onCreateGame() {
    if (!app.globalData.userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }
    this.setData({
      showCreateModal: true,
      gameName: '',
      location: '',
      courtCount: 2,
      maxPlayers: 8
    });
  },

  // 关闭弹窗
  onCloseCreateModal() {
    this.setData({
      showCreateModal: false
    });
  },

  // 取消创建（别名）
  onCancelCreate() {
    this.setData({ showCreateModal: false });
  },

  // 球局名称输入
  onGameNameInput(e) {
    this.setData({
      gameName: e.detail.value
    });
  },

  // 减少人数上限
  onDecreaseMaxPlayers() {
    const { maxPlayers } = this.data;
    if (maxPlayers > 4) {
      this.setData({ maxPlayers: maxPlayers - 1 });
    }
  },

  // 增加人数上限
  onIncreaseMaxPlayers() {
    const { maxPlayers } = this.data;
    if (maxPlayers < 20) {
      this.setData({ maxPlayers: maxPlayers + 1 });
    }
  },

  // 确认创建
  onConfirmCreate() {
    const { gameName, maxPlayers } = this.data;
    
    if (!gameName) {
      wx.showToast({ title: '请输入球局名称', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '创建中...' });
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'createGame',
        creatorOpenid: app.globalData.openid,
        creatorName: app.globalData.userInfo.nickName,
        creatorAvatar: app.globalData.userInfo.avatarUrl || '',
        creatorGender: app.globalData.userInfo.gender || 1,
        creatorLevel: app.globalData.userInfo.level || 'L3',
        gameName,
        location: '待定',
        latitude: 0,
        longitude: 0,
        maxPlayers,
        courtCount: 1,
        remark: '',
        status: 'waiting'
      },
      success: (res) => {
        wx.hideLoading();
        
        if (res.result && res.result.success) {
          wx.showToast({ title: '创建成功', icon: 'success' });
          this.setData({ showCreateModal: false });
          this.loadGameList();
        } else {
          wx.showToast({ title: res.result?.message || '创建失败', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('创建球局失败:', err);
        wx.showToast({ title: '创建失败，请检查网络', icon: 'none' });
      }
    });
  },

  // 加载球局列表
  loadGameList() {
    wx.showLoading({ title: '加载中...' });
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'getGameList',
        openid: app.globalData.openid,
        limit: 20
      },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          this.setData({
            gameList: res.result.games || []
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('加载球局列表失败:', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    });
  },

  // 触摸开始
  onTouchStart(e) {
    const touch = e.touches[0];
    this.setData({
      touchStartX: touch.clientX,
      touchStartY: touch.clientY
    });
  },

  // 触摸移动
  onTouchMove(e) {
    const touch = e.touches[0];
    const { touchStartX, touchStartY } = this.data;
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      const index = e.currentTarget.dataset.index;
      const gameList = this.data.gameList;
      const item = gameList[index];
      
      if (item && item.isCreator) {
        let newTranslateX = (item.translateX || 0) + deltaX * 0.5;
        newTranslateX = Math.max(-70, Math.min(0, newTranslateX));
        gameList[index].translateX = newTranslateX;
        this.setData({ gameList, touchStartX: touch.clientX });
      }
    }
  },

  // 触摸结束
  onTouchEnd(e) {
    const index = e.currentTarget.dataset.index;
    const gameList = this.data.gameList;
    const item = gameList[index];
    
    if (item && item.translateX !== undefined) {
      if (item.translateX < -35) {
        gameList[index].translateX = -70;
      } else {
        gameList[index].translateX = 0;
      }
      this.setData({ gameList });
    }
  },

  // 删除球局
  onDeleteGame(e) {
    const gameId = e.currentTarget.dataset.id;
    this.deleteGame(gameId);
  },

  // 执行删除
  deleteGame(gameId) {
    wx.showModal({
      title: '提示',
      content: '确定要删除该球局吗?删除后无法恢复',
      confirmColor: '#f56c6c',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          wx.cloud.callFunction({
            name: 'quickstartFunctions',
            data: {
              type: 'deleteGame',
              gameId: gameId,
              openid: app.globalData.openid
            },
            success: (res) => {
              wx.hideLoading();
              if (res.result && res.result.success) {
                wx.showToast({ title: '已删除', icon: 'success' });
                this.loadGameList();
              } else {
                wx.showToast({ 
                  title: res.result?.message || '删除失败', 
                  icon: 'none' 
                });
              }
            },
            fail: (err) => {
              wx.hideLoading();
              console.error('删除球局失败:', err);
              wx.showToast({ title: '删除失败', icon: 'none' });
            }
          });
        }
      }
    });
  },

  loadUserStats() {
    const that = this;
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'getUserStats',
        openid: app.globalData.openid
      },
      success(res) {
        if (res.result && res.result.success) {
          that.setData({
            stats: res.result.stats
          });
        }
      },
      fail(err) {
        console.error('加载统计失败:', err);
      }
    });
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '羽乐宝 - 智能羽毛球轮转工具',
      path: '/pages/index/index',
      imageUrl: '/images/share-banner.jpg'
    };
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadGameList();
    this.loadUserStats();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  }
});
