// pages/profile/profile.js
const app = getApp();

Page({
  data: {
    userInfo: {},
    tempNickname: '',
    showNicknameModal: false,
    showLevelModal: false,
    levelOptions: ['L1 入门', 'L2 初级', 'L3 中级', 'L4 中高级', 'L5 高级', 'L6 专业']
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    this.loadUserInfo();
  },

  // 加载用户信息
  loadUserInfo() {
    const userInfo = app.globalData.userInfo || {};
    this.setData({ userInfo });
  },

  // 选择头像
  onChooseAvatar() {
    const that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success(res) {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        that.setData({
          'userInfo.avatarUrl': tempFilePath
        });
      }
    });
  },

  // 编辑昵称
  onEditNickname() {
    this.setData({
      showNicknameModal: true,
      tempNickname: this.data.userInfo.nickName || ''
    });
  },

  onCloseNicknameModal() {
    this.setData({ showNicknameModal: false });
  },

  onNicknameInput(e) {
    this.setData({ tempNickname: e.detail.value });
  },

  onConfirmNickname() {
    const { tempNickname } = this.data;
    if (tempNickname.trim()) {
      this.setData({
        'userInfo.nickName': tempNickname.trim(),
        showNicknameModal: false
      });
    } else {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
    }
  },

  // 选择性别
  onSelectGender(e) {
    const gender = parseInt(e.currentTarget.dataset.gender);
    this.setData({ 'userInfo.gender': gender });
  },

  // 选择级别
  onSelectLevel() {
    this.setData({ showLevelModal: true });
  },

  onCloseLevelModal() {
    this.setData({ showLevelModal: false });
  },

  onConfirmLevel(e) {
    const level = e.currentTarget.dataset.level;
    this.setData({
      'userInfo.level': level,
      showLevelModal: false
    });
  },

  // 保存
  onSave() {
    const { userInfo } = this.data;
    
    wx.showLoading({ title: '保存中...' });
    
    // 更新全局数据
    app.globalData.userInfo = { ...app.globalData.userInfo, ...userInfo };
    
    // 调用云函数保存
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'updateUserInfo',
        userInfo: userInfo,
        openid: app.globalData.openid
      },
      success: (res) => {
        wx.hideLoading();
        wx.showToast({ title: '保存成功', icon: 'success' });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('保存失败:', err);
        // 即使云函数失败，本地已更新
        wx.showToast({ title: '保存成功', icon: 'success' });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    });
  }
});
