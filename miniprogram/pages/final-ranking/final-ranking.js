// pages/final-ranking/final-ranking.js
const app = getApp();

Page({
  data: {
    gameId: '',
    gameInfo: {},
    ranking: [],
    totalMatches: 0
  },

  onLoad(options) {
    const gameId = options.id;
    this.setData({ gameId });
    this.loadRanking();
  },

  // 加载排名
  loadRanking() {
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
          const game = res.result.game;
          const ranking = this.calculateRanking(game);
          
          this.setData({
            gameInfo: game,
            ranking: ranking,
            totalMatches: this.countTotalMatches(game.rounds || [])
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('加载排名失败:', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    });
  },

  // 计算排名
  calculateRanking(game) {
    const players = game.players || [];
    const rounds = game.rounds || [];
    
    // 统计每个玩家的胜负
    const stats = {};
    players.forEach(p => {
      const id = p.openid || p.id;
      stats[id] = {
        ...p,
        wins: 0,
        losses: 0,
        playCount: 0
      };
    });
    
    // 遍历所有轮次统计
    rounds.forEach(round => {
      round.matches.forEach(match => {
        if (match.result) {
          const winnerTeam = match.result.winner === 'team1' ? match.team1 : match.team2;
          const loserTeam = match.result.winner === 'team1' ? match.team2 : match.team1;
          
          winnerTeam.forEach(p => {
            const id = p.openid || p.id;
            if (stats[id]) {
              stats[id].wins++;
              stats[id].playCount++;
            }
          });
          
          loserTeam.forEach(p => {
            const id = p.openid || p.id;
            if (stats[id]) {
              stats[id].losses++;
              stats[id].playCount++;
            }
          });
        }
      });
    });
    
    // 转换为数组并计算胜率
    const ranking = Object.values(stats).map(p => {
      const total = p.wins + p.losses;
      const winRate = total > 0 ? (p.wins / total * 100).toFixed(1) : '0.0';
      return {
        ...p,
        winRate: parseFloat(winRate),
        winRateText: winRate + '%'
      };
    });
    
    // 排序: 胜率 > 胜场 > 参赛次数
    ranking.sort((a, b) => {
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.playCount - a.playCount;
    });
    
    // 添加排名（胜率相同则同列排名）
    ranking.forEach((p, index) => {
      if (index === 0) {
        p.rank = 1;
      } else {
        const prev = ranking[index - 1];
        // 如果胜率、胜场、参赛次数都相同，则同列排名
        if (p.winRate === prev.winRate && p.wins === prev.wins && p.playCount === prev.playCount) {
          p.rank = prev.rank;
        } else {
          p.rank = index + 1;
        }
      }
      // 根据排名设置奖牌类型
      if (p.rank === 1) {
        p.medal = 'gold';
        p.medalIcon = '🥇';
      } else if (p.rank === 2) {
        p.medal = 'silver';
        p.medalIcon = '🥈';
      } else if (p.rank === 3) {
        p.medal = 'bronze';
        p.medalIcon = '🥉';
      }
    });
    
    return ranking;
  },

  // 统计总对局数
  countTotalMatches(rounds) {
    let count = 0;
    rounds.forEach(r => {
      count += r.matches.filter(m => m.result).length;
    });
    return count;
  },

  // 分享成绩
  onShareResult() {
    // 触发分享
  },

  // 返回首页
  onBackHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    });
  },

  // 分享
  onShareAppMessage() {
    const topPlayer = this.data.ranking[0];
    const title = topPlayer 
      ? `"${this.data.gameInfo.gameName}"已结束,${topPlayer.nickName}夺冠!`
      : `"${this.data.gameInfo.gameName}"已结束`;
    return {
      title: title,
      path: `/pages/final-ranking/final-ranking?id=${this.data.gameId}`
    };
  }
});
