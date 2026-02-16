// pages/game-list/game-list.js
const app = getApp();

Page({
  data: {
    currentTab: 0,
    gameList: [],
    statusMap: {
      'waiting': '等待中',
      'playing': '进行中',
      'finished': '已结束'
    },
    touchStartX: 0,
    touchStartY: 0
  },

  onLoad(options) {
    if (options.type === 'my') {
      this.setData({ currentTab: 1 });
    }
    this.loadGameList();
  },

  onShow() {
    this.loadGameList();
  },

  // 切换标签
  onTabChange(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      currentTab: index
    });
    this.loadGameList();
  },

  // 加载球局列表
  loadGameList() {
    const { currentTab } = this.data;
    wx.showLoading({ title: '加载中...' });
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'getGameList',
        openid: app.globalData.openid,
        onlyMine: currentTab === 1,
        limit: 50
      },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          // 添加 creatorOpenid 字段用于判断是否创建者
          const games = (res.result.games || []).map(g => ({
            ...g,
            translateX: 0
          }));
          this.setData({ gameList: games });
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
    
    // 判断是否横向滑动
    if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX < -20) {
      const index = e.currentTarget.dataset.index;
      const gameList = this.data.gameList;
      const item = gameList[index];
      
      // 检查是否为创建者
      if (item.creatorOpenid === app.globalData.openid) {
        gameList[index].translateX = Math.max(deltaX * 2, -150);
        this.setData({ gameList });
      }
    }
  },

  // 触摸结束
  onTouchEnd(e) {
    const index = e.currentTarget.dataset.index;
    const gameList = this.data.gameList;
    const item = gameList[index];
    
    if (item.translateX && item.translateX < -75) {
      gameList[index].translateX = -150;
    } else {
      gameList[index].translateX = 0;
    }
    this.setData({ gameList });
  },

  // 长按事件(备用删除方式)
  onLongPress(e) {
    const item = e.currentTarget.dataset.item;
    
    if (item.creatorOpenid === app.globalData.openid) {
      wx.showActionSheet({
        itemList: ['删除球局'],
        itemColor: '#f56c6c',
        success: (res) => {
          if (res.tapIndex === 0) {
            this.deleteGame(item.id);
          }
        }
      });
    }
  },

  // 加入球局
  onJoinGame(e) {
    const gameId = e.currentTarget.dataset.id;
    
    wx.showLoading({ title: '加入中...' });
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'joinGame',
        gameId: gameId,
        openid: app.globalData.openid,
        nickName: app.globalData.userInfo.nickName,
        avatarUrl: app.globalData.userInfo.avatarUrl,
        gender: app.globalData.userInfo.gender || 1,
        level: app.globalData.userInfo.level || 'L3'
      },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({ title: '加入成功', icon: 'success' });
          setTimeout(() => {
            wx.navigateTo({ url: `/pages/game-detail/game-detail?id=${gameId}` });
          }, 1500);
        } else {
          wx.showToast({ title: res.result?.message || '加入失败', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('加入球局失败:', err);
        wx.showToast({ title: '加入失败', icon: 'none' });
      }
    });
  },

  // 退出球局
  onQuitGame(e) {
    const gameId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '提示',
      content: '确定要退出该球局吗?',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '退出中...' });
          
          wx.cloud.callFunction({
            name: 'quickstartFunctions',
            data: {
              type: 'leaveGame',
              gameId: gameId,
              openid: app.globalData.openid
            },
            success: (res) => {
              wx.hideLoading();
              if (res.result && res.result.success) {
                wx.showToast({ title: '已退出', icon: 'success' });
                this.loadGameList();
              } else {
                wx.showToast({ title: res.result?.message || '退出失败', icon: 'none' });
              }
            },
            fail: (err) => {
              wx.hideLoading();
              console.error('退出球局失败:', err);
              wx.showToast({ title: '退出失败', icon: 'none' });
            }
          });
        }
      }
    });
  },

  // 删除球局
  onDeleteGame(e) {
    const gameId = e.currentTarget.dataset.id;
    this.deleteGame(gameId);
  },

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
                wx.showToast({ title: res.result?.message || '删除失败', icon: 'none' });
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

  // 查看球局详情
  onGameDetail(e) {
    const gameId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/game-detail/game-detail?id=${gameId}`
    });
  },

  // 查看结果
  onViewResult(e) {
    const gameId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/final-ranking/final-ranking?id=${gameId}`
    });
  },

  // 创建球局
  onCreateGame() {
    wx.navigateTo({
      url: '/pages/create-game/create-game'
    });
  },

  // 阻止冒泡
  stopPropagation() {},

  // 下拉刷新
  onPullDownRefresh() {
    this.loadGameList();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  }
});
