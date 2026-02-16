// utils/rotation-algorithm.js
/**
 * 羽毛球轮转算法 - 8人版本
 * 核心要求：
 * 1. 8人参与，每场4人上场（两两组队对战）
 * 2. 每个人和其他人都组过队 - C(8,2)=28种组合
 * 3. 尽量平均上场
 */

class RotationAlgorithm {
  constructor(players, courtCount) {
    this.players = players;
    this.courtCount = courtCount || 1;
    this.rounds = [];
  }

  /**
   * 生成所有搭档组合
   * 8人共有 C(8,2) = 28 种搭档组合
   */
  generateAllPairs() {
    const pairs = [];
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) {
        pairs.push({
          players: [this.players[i], this.players[j]],
          used: false
        });
      }
    }
    return pairs;generateRotation
  }

  /**
   * 获取搭档组合的唯一key
   */
  getPairKey(p1, p2) {
    const id1 = p1.openid || p1.nickName;
    const id2 = p2.openid || p2.nickName;
    return [id1, id2].sort().join('_');
  }

  /**
   * 检查两个搭档组合是否有重复玩家
   */
  hasOverlap(pair1, pair2) {
    const ids1 = pair1.players.map(p => p.openid || p.nickName);
    const ids2 = pair2.players.map(p => p.openid || p.nickName);
    return ids1.some(id => ids2.includes(id));
  }

  /**
   * 生成轮转方案 - 确保每人和其他人都组过队
   */
  generateRotation() {
    const n = this.players.length;
    
    if (n < 4) {
      console.error('人数不足4人，无法进行轮转');
      return [];
    }

    // 生成所有搭档组合
    const allPairs = this.generateAllPairs();
    const usedPairKeys = new Set();
    
    // 记录每个玩家的上场次数
    const playCount = {};
    this.players.forEach(p => {
      playCount[p.openid || p.nickName] = 0;
    });

    // 计算需要的轮数：要覆盖所有28种搭档组合，每轮消耗2个组合，需要14轮
    const totalPairs = allPairs.length; // 28
    const pairsPerRound = this.courtCount * 2; // 每轮使用的搭档组合数
    const totalRounds = Math.ceil(totalPairs / pairsPerRound);

    console.log(`总共${n}人，${totalPairs}种搭档组合，计划${totalRounds}轮`);

    for (let round = 0; round < totalRounds; round++) {
      const roundMatches = this.generateSingleRound(allPairs, usedPairKeys, playCount, round);
      
      if (roundMatches.length > 0) {
        this.rounds.push({
          round: round + 1,
          matches: roundMatches,
          status: 'pending'
        });
      }
    }

    // 输出统计信息
    console.log('轮转生成完成：');
    console.log('- 总轮数:', this.rounds.length);
    console.log('- 已使用搭档组合:', usedPairKeys.size, '/', totalPairs);
    console.log('- 各玩家上场次数:', playCount);

    return this.rounds;
  }

  /**
   * 生成单轮对局
   */
  generateSingleRound(allPairs, usedPairKeys, playCount, roundIndex) {
    const matches = [];
    
    // 找出所有未使用的搭档组合
    const unusedPairs = allPairs.filter(p => !p.used);
    
    if (unusedPairs.length < 2) {
      // 如果未使用的组合不足，复用已使用的（保证均衡上场）
      return this.generateBalancedRound(playCount, usedPairKeys, roundIndex);
    }

    // 按玩家上场次数排序，优先选择上场少的玩家参与的组合
    unusedPairs.sort((a, b) => {
      const scoreA = a.players.reduce((sum, p) => sum + (playCount[p.openid || p.nickName] || 0), 0);
      const scoreB = b.players.reduce((sum, p) => sum + (playCount[p.openid || p.nickName] || 0), 0);
      return scoreA - scoreB;
    });

    // 为每块场地选择一场比赛
    for (let court = 0; court < this.courtCount; court++) {
      const match = this.findMatchFromUnusedPairs(unusedPairs, usedPairKeys, court + 1);
      
      if (match) {
        matches.push(match);
        
        // 更新上场次数
        [...match.team1, ...match.team2].forEach(p => {
          const id = p.openid || p.nickName;
          playCount[id] = (playCount[id] || 0) + 1;
        });
      }
    }

    return matches;
  }

  /**
   * 从未使用的搭档组合中找到一场比赛
   */
  findMatchFromUnusedPairs(unusedPairs, usedPairKeys, courtId) {
    // 遍历未使用的组合，找两个不重叠的组合
    for (let i = 0; i < unusedPairs.length; i++) {
      if (unusedPairs[i].used) continue;
      
      for (let j = i + 1; j < unusedPairs.length; j++) {
        if (unusedPairs[j].used) continue;
        
        // 检查两个组合是否有重叠玩家
        if (!this.hasOverlap(unusedPairs[i], unusedPairs[j])) {
          // 找到了！标记为已使用
          unusedPairs[i].used = true;
          unusedPairs[j].used = true;
          
          const key1 = this.getPairKey(unusedPairs[i].players[0], unusedPairs[i].players[1]);
          const key2 = this.getPairKey(unusedPairs[j].players[0], unusedPairs[j].players[1]);
          usedPairKeys.add(key1);
          usedPairKeys.add(key2);

          return {
            courtId: courtId,
            team1: [...unusedPairs[i].players],
            team2: [...unusedPairs[j].players],
            status: 'pending',
            result: null
          };
        }
      }
    }
    
    return null;
  }

  /**
   * 生成均衡上场的轮次（当所有搭档组合都用完后）
   */
  generateBalancedRound(playCount, usedPairKeys, roundIndex) {
    const matches = [];
    
    // 按上场次数排序
    const sortedPlayers = [...this.players].sort((a, b) => {
      const countA = playCount[a.openid || a.nickName] || 0;
      const countB = playCount[b.openid || b.nickName] || 0;
      return countA - countB;
    });

    // 选择上场次数最少的4人
    const selectedPlayers = sortedPlayers.slice(0, 4);
    
    if (selectedPlayers.length >= 4) {
      // 基于轮次index变换配对方式
      const pairingIndex = roundIndex % 3;
      let team1, team2;
      
      switch (pairingIndex) {
        case 0:
          team1 = [selectedPlayers[0], selectedPlayers[1]];
          team2 = [selectedPlayers[2], selectedPlayers[3]];
          break;
        case 1:
          team1 = [selectedPlayers[0], selectedPlayers[2]];
          team2 = [selectedPlayers[1], selectedPlayers[3]];
          break;
        case 2:
          team1 = [selectedPlayers[0], selectedPlayers[3]];
          team2 = [selectedPlayers[1], selectedPlayers[2]];
          break;
      }

      matches.push({
        courtId: 1,
        team1: team1,
        team2: team2,
        status: 'pending',
        result: null
      });

      // 更新上场次数
      [...team1, ...team2].forEach(p => {
        const id = p.openid || p.nickName;
        playCount[id] = (playCount[id] || 0) + 1;
      });
    }

    return matches;
  }

  /**
   * 获取最终排名
   */
  getFinalRanking() {
    const stats = {};
    
    this.players.forEach(p => {
      const id = p.openid || p.nickName;
      stats[id] = {
        ...p,
        wins: 0,
        losses: 0,
        playCount: 0
      };
    });
    
    this.rounds.forEach(round => {
      round.matches.forEach(match => {
        if (match.result) {
          const winnerTeam = match.result.winner === 'team1' ? match.team1 : match.team2;
          const loserTeam = match.result.winner === 'team1' ? match.team2 : match.team1;
          
          winnerTeam.forEach(p => {
            const id = p.openid || p.nickName;
            if (stats[id]) {
              stats[id].wins++;
              stats[id].playCount++;
            }
          });
          
          loserTeam.forEach(p => {
            const id = p.openid || p.nickName;
            if (stats[id]) {
              stats[id].losses++;
              stats[id].playCount++;
            }
          });
        }
      });
    });
    
    return Object.values(stats)
      .map(p => ({
        ...p,
        winRate: p.playCount > 0 ? parseFloat((p.wins / p.playCount * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);
  }
}

module.exports = RotationAlgorithm;
