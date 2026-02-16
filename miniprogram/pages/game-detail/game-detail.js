// pages/game-detail/game-detail.js
const app = getApp();
const RotationAlgorithm = require('../../utils/rotation-algorithm.js');

Page({
  data: {
    gameId: '',
    gameInfo: {},
    participants: [],
    emptySlots: [],
    estimatedRounds: 0,
    formulaN: 0,
    isCreator: false,
    hasJoined: false,
    currentRound: 1,
    totalRounds: 0,
    myCurrentMatch: null,
    myNextMatch: null,
    currentRoundMatches: [],
    allRounds: [],
    restPlayers: '',
    allMatchesFinished: false,
    statusMap: {
      'pending': '待开始',
      'playing': '进行中',
      'finished': '已结束'
    },
    statusTextMap: {
      'waiting': '等待开始',
      'playing': '进行中',
      'finished': '已结束'
    },
    showResultModal: false,
    currentMatchForResult: null,
    myScore: '',
    opponentScore: '',
    selectedResult: ''
  },

  onLoad(options) {
    const gameId = options.id;
    this.setData({ gameId });
    
    // 检查是否已登录（有userInfo表示已完成微信授权）
    if (!app.globalData.userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再加入球局',
        showCancel: false,
        confirmText: '去登录',
        success: () => {
          wx.reLaunch({
            url: '/pages/index/index'
          });
        }
      });
      return;
    }
    
    // 检查是否有openid，没有则先获取
    if (!app.globalData.openid) {
      this.initUserInfo().then(() => {
        this.loadGameDetail();
      });
    } else {
      this.loadGameDetail();
    }
  },

  // 初始化用户信息
  initUserInfo() {
    return new Promise((resolve) => {
      wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getOpenId' },
        success: (res) => {
          if (res.result && res.result.openid) {
            app.globalData.openid = res.result.openid;
          }
          resolve();
        },
        fail: () => {
          resolve();
        }
      });
    });
  },

  // 加载球局详情
  loadGameDetail() {
    wx.showLoading({ title: '加载中...' });
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'getGameDetail',
        gameId: this.data.gameId
      },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          const gameInfo = res.result.game;
          const currentOpenid = app.globalData.openid;
          const isCreator = gameInfo.creatorOpenid === currentOpenid;
          const players = gameInfo.players || [];
          const hasJoined = players.some(p => p.openid === currentOpenid);
          
          const maxPlayers = gameInfo.maxPlayers || 8;
          const emptySlots = maxPlayers - players.length;
          
          // 计算预计轮数: Round = C(n,2) / 2 = n*(n-1)/4
          const formulaN = players.length >= 4 ? players.length : maxPlayers;
          const estimatedRounds = Math.ceil(formulaN * (formulaN - 1) / 4);
          
          this.setData({
            gameInfo: gameInfo,
            participants: players,
            emptySlots: emptySlots > 0 ? new Array(emptySlots).fill({}) : [],
            estimatedRounds: estimatedRounds,
            formulaN: formulaN,
            isCreator: isCreator,
            hasJoined: hasJoined,
            allRounds: gameInfo.rounds || []
          });
          
          // 动态设置导航栏标题为球局名称
          wx.setNavigationBarTitle({
            title: gameInfo.gameName || '球局详情'
          });
          
          // 非创建者且未加入，自动加入球局
          if (!isCreator && !hasJoined && gameInfo.status === 'waiting') {
            this.autoJoinGame();
          }
          
          if (gameInfo.status === 'playing') {
            this.loadRoundInfo();
          }
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('加载球局详情失败:', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    });
  },

  // 自动加入球局
  autoJoinGame() {
    const { gameId, gameInfo } = this.data;
    const userInfo = app.globalData.userInfo || {};
    
    // 检查人数是否已满
    if (gameInfo.currentPlayers >= gameInfo.maxPlayers) {
      wx.showToast({ title: '球局人数已满', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '加入中...' });
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'joinGame',
        gameId: gameId,
        openid: app.globalData.openid,
        nickName: userInfo.nickName || '用户',
        avatarUrl: userInfo.avatarUrl || '',
        gender: userInfo.gender || 1,
        level: userInfo.level || 'L3'
      },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({ title: '已加入球局', icon: 'success' });
          this.setData({ hasJoined: true });
          this.loadGameDetail();
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

  // 添加测试人员
  onAddTestPlayers() {
    const { gameId, participants, gameInfo } = this.data;
    const maxPlayers = gameInfo.maxPlayers || 8;
    const remaining = maxPlayers - participants.length;
    
    if (remaining <= 0) {
      wx.showToast({ title: '球局人数已满', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '添加中...' });
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'addTestPlayers',
        gameId: gameId,
        maxCount: remaining
      },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({ title: '添加成功', icon: 'success' });
          this.loadGameDetail();
        } else {
          wx.showToast({ title: res.result?.message || '添加失败', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('添加测试人员失败:', err);
        wx.showToast({ title: '添加失败', icon: 'none' });
      }
    });
  },

  // 退出球局
  onLeaveGame() {
    const { gameId, gameInfo } = this.data;
    
    if (gameInfo.status !== 'waiting') {
      wx.showToast({ title: '球局已开始，无法退出', icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: '提示',
      content: '确定要退出该球局吗？',
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
                wx.showToast({ title: '已退出球局', icon: 'success' });
                setTimeout(() => {
                  wx.navigateBack();
                }, 1500);
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

  // 开始轮转
    // 添加测试成员
    onAddTestPlayers() {
      const that = this;
      const { participants, gameInfo } = this.data;
      const maxPlayers = gameInfo.maxPlayers || 8;
      const remaining = maxPlayers - participants.length;
      
      if (remaining <= 0) {
        wx.showToast({ title: '球局人数已满', icon: 'none' });
        return;
      }
      
      const addCount = Math.min(8, remaining);
      wx.showModal({
        title: '添加测试成员',
        content: `将添加${addCount}个测试成员，确定要添加吗？\n(当前${participants.length}/${maxPlayers}人)`,
        success(res) {
          if (res.confirm) {
            wx.showLoading({ title: '添加中...' });
            wx.cloud.callFunction({
              name: 'quickstartFunctions',
              data: {
                type: 'addTestPlayers',
                gameId: that.data.gameId,
                maxCount: addCount
              },
              success(res) {
                wx.hideLoading();
                if (res.result && res.result.success) {
                  wx.showToast({ title: res.result.message, icon: 'success' });
                  that.loadGameDetail();
                } else {
                  wx.showToast({ title: res.result?.message || '添加失败', icon: 'none' });
                }
              },
              fail(err) {
                wx.hideLoading();
                console.error('添加测试成员失败:', err);
                wx.showToast({ title: '添加失败', icon: 'none' });
              }
            });
          }
        }
      });
    },
  
    onStartGame() {
    const { participants, gameInfo } = this.data;
    
    if (participants.length < 4) {
      wx.showToast({
        title: '至少需要4人才能开始',
        icon: 'none'
      });
      return;
    }
    
    wx.showModal({
      title: '确认开始',
      content: `当前有${participants.length}人参与,确定开始轮转吗?`,
      success: (res) => {
        if (res.confirm) {
          this.generateRotation();
        }
      }
    });
  },

  // 生成轮转方案
  generateRotation() {
    const { participants, gameInfo } = this.data;
    // 使用球局设置的场地数，默认1个场地
    const courtCount = gameInfo.courtCount || 1;
    
    // 使用轮转算法生成方案
    const algorithm = new RotationAlgorithm(participants, courtCount);
    const rounds = algorithm.generateRotation();
    
    wx.showLoading({ title: '生成中...' });
    
    // 保存轮转方案到服务器
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'startGame',
        gameId: this.data.gameId,
        rounds: rounds,
        openid: app.globalData.openid
      },
      success: (res) => {
        wx.hideLoading();
        if (res.result && res.result.success) {
          wx.showToast({ title: '轮转已开始', icon: 'success' });
          setTimeout(() => {
            this.loadGameDetail();
          }, 1500);
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('开始轮转失败:', err);
        wx.showToast({ title: '开始失败', icon: 'none' });
      }
    });
  },

  // 加载轮次信息
  loadRoundInfo() {
    const { allRounds, currentRound, participants } = this.data;
    const round = allRounds[currentRound - 1];
    
    if (!round) return;
    
    // 找出本轮轮空的玩家
    const playingIds = new Set();
    round.matches.forEach(match => {
      match.team1.forEach(p => playingIds.add(p.openid || p.id));
      match.team2.forEach(p => playingIds.add(p.openid || p.id));
    });
    
    const restPlayerNames = participants
      .filter(p => !playingIds.has(p.openid || p.id))
      .map(p => p.nickName)
      .join('、');
    
    // 检查本轮所有比赛是否已结束
    const allMatchesFinished = round.matches.every(m => m.result);
    
    this.setData({
      totalRounds: allRounds.length,
      currentRoundMatches: round.matches,
      restPlayers: restPlayerNames,
      allMatchesFinished
    });
    
    this.findMyMatch(round, currentRound);
  },

  // 查找我的对局
  findMyMatch(round, roundIndex) {
    const myOpenid = app.globalData.openid;
    let myCurrentMatch = null;
    
    for (let match of round.matches) {
      const inTeam1 = match.team1.find(p => (p.openid || p.id) === myOpenid);
      const inTeam2 = match.team2.find(p => (p.openid || p.id) === myOpenid);
      
      if (inTeam1 || inTeam2) {
        myCurrentMatch = {
          courtId: match.courtId,
          myTeam: inTeam1 ? match.team1 : match.team2,
          opponents: inTeam1 ? match.team2 : match.team1,
          match: match
        };
        break;
      }
    }
    
    this.setData({ myCurrentMatch });
  },

  // 上一轮
  onPrevRound() {
    if (this.data.currentRound > 1) {
      this.setData({ currentRound: this.data.currentRound - 1 });
      this.loadRoundInfo();
    }
  },

  // 下一轮
  onNextRound() {
    if (this.data.currentRound < this.data.totalRounds) {
      this.setData({ currentRound: this.data.currentRound + 1 });
      this.loadRoundInfo();
    }
  },

  // 结束球局
  onEndGame() {
    wx.showModal({
      title: '结束球局',
      content: '确定结束球局并查看最终排名吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' });
          wx.cloud.callFunction({
            name: 'quickstartFunctions',
            data: {
              type: 'updateGameStatus',
              gameId: this.data.gameId,
              status: 'finished'
            },
            success: () => {
              wx.hideLoading();
              this.onViewRanking();
            },
            fail: () => {
              wx.hideLoading();
              wx.showToast({ title: '操作失败', icon: 'none' });
            }
          });
        }
      }
    });
  },

  // 查看排名
  onViewRanking() {
    wx.navigateTo({
      url: `/pages/final-ranking/final-ranking?id=${this.data.gameId}`
    });
  },

  // 直接点击选择胜方
  onSelectWinner(e) {
    const { matchIndex, winner } = e.currentTarget.dataset;
    const { currentRoundMatches, currentRound, allRounds, totalRounds } = this.data;
    
    const match = currentRoundMatches[matchIndex];
    if (!match) return;
    
    // 如果已记录且点击的是同一队伍，忽略
    if (match.result && match.result.winner === winner) {
      return;
    }
    
    // 判断是新记录还是修正
    const isCorrection = !!match.result;
    
    // 记录/修正胜方
    currentRoundMatches[matchIndex].result = {
      winner: winner,
      score: '21:0'
    };
    
    // 同步更新allRounds
    if (allRounds[currentRound - 1]) {
      allRounds[currentRound - 1].matches = currentRoundMatches;
    }
    
    // 检查本轮是否全部完成
    const allMatchesFinished = currentRoundMatches.every(m => m.result);
    
    this.setData({ 
      currentRoundMatches,
      allRounds,
      allMatchesFinished
    });
    
    // 保存到服务器
    this.saveMatchResult(matchIndex, winner);
    
    wx.showToast({ 
      title: isCorrection ? '已修正' : '已记录', 
      icon: 'success', 
      duration: 1000 
    });
    
    // 本轮全部完成后，自动进入下一轮
    if (allMatchesFinished && !isCorrection && currentRound < totalRounds) {
      setTimeout(() => {
        this.onNextRound();
      }, 1200);
    }
  },

  // 保存比赛结果到服务器
  saveMatchResult(matchIndex, winner) {
    const { gameId, currentRound, currentRoundMatches } = this.data;
    const match = currentRoundMatches[matchIndex];
    
    wx.cloud.callFunction({
      name: 'quickstartFunctions',
      data: {
        type: 'recordResult',
        gameId: gameId,
        roundIndex: currentRound - 1,
        courtId: match.courtId,
        winner: winner,
        score: '21:0',
        openid: app.globalData.openid
      },
      success: (res) => {
        console.log('结果已保存');
      },
      fail: (err) => {
        console.error('保存失败:', err);
      }
    });
  },

  // 关闭弹窗
  onCloseModal() {
    this.setData({
      showResultModal: false,
      myScore: '',
      opponentScore: ''
    });
  },

  // 切换轮次
  onSwitchRound(e) {
    const round = e.currentTarget.dataset.round;
    this.setData({ currentRound: round });
    this.loadRoundInfo();
  },

  // 阻止冒泡
  stopPropagation() {},

  // 分享
  onShareAppMessage() {
    const userInfo = app.globalData.userInfo || {};
    const userName = userInfo.nickName || '球友';
    return {
      title: `${userName}邀请您加入球局「${this.data.gameInfo.gameName}」`,
      path: `/pages/game-detail/game-detail?id=${this.data.gameId}`,
      imageUrl: '/images/share-banner.jpg'
    };
  }
});
