const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;
// 获取openid
const getOpenId = async () => {
  // 获取基础信息
  const wxContext = cloud.getWXContext();
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  };
};

// 获取小程序二维码
const getMiniProgramCode = async () => {
  // 获取小程序二维码的buffer
  const resp = await cloud.openapi.wxacode.get({
    path: "pages/index/index",
  });
  const { buffer } = resp;
  // 将图片上传云存储空间
  const upload = await cloud.uploadFile({
    cloudPath: "code.png",
    fileContent: buffer,
  });
  return upload.fileID;
};

// 创建集合
const createCollection = async () => {
  try {
    // 创建集合
    await db.createCollection("sales");
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华东",
        city: "上海",
        sales: 11,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华东",
        city: "南京",
        sales: 11,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华南",
        city: "广州",
        sales: 22,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华南",
        city: "深圳",
        sales: 22,
      },
    });
    return {
      success: true,
    };
  } catch (e) {
    // 这里catch到的是该collection已经存在，从业务逻辑上来说是运行成功的，所以catch返回success给前端，避免工具在前端抛出异常
    return {
      success: true,
      data: "create collection success",
    };
  }
};

// 查询数据
const selectRecord = async () => {
  // 返回数据库查询结果
  return await db.collection("sales").get();
};

// 更新数据
const updateRecord = async (event) => {
  try {
    // 遍历修改数据库信息
    for (let i = 0; i < event.data.length; i++) {
      await db
        .collection("sales")
        .where({
          _id: event.data[i]._id,
        })
        .update({
          data: {
            sales: event.data[i].sales,
          },
        });
    }
    return {
      success: true,
      data: event.data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 新增数据
const insertRecord = async (event) => {
  try {
    const insertRecord = event.data;
    // 插入数据
    await db.collection("sales").add({
      data: {
        region: insertRecord.region,
        city: insertRecord.city,
        sales: Number(insertRecord.sales),
      },
    });
    return {
      success: true,
      data: event.data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 删除数据
const deleteRecord = async (event) => {
  try {
    await db
      .collection("sales")
      .where({
        _id: event.data._id,
      })
      .remove();
    return {
      success: true,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// ==================== 球局相关操作 ====================

// 创建球局
const createGame = async (event) => {
  try {
    const { creatorOpenid, creatorName, creatorAvatar, creatorGender, creatorLevel, gameName, location, latitude, longitude, maxPlayers, courtCount, remark, status } = event;
    
    // 检查用户是否已有未结束的球局
    const existingGames = await db.collection('games')
      .where({
        status: _.in(['waiting', 'playing']),
        'players.openid': creatorOpenid
      })
      .count();
    
    if (existingGames.total > 0) {
      return { success: false, message: '你已有进行中的球局，请先结束或退出后再创建' };
    }
    
    const result = await db.collection('games').add({
      data: {
        creatorOpenid,
        creatorName,
        gameName,
        location,
        latitude,
        longitude,
        maxPlayers,
        courtCount,
        remark: remark || '',
        status: status || 'waiting',
        currentPlayers: 1,
        players: [{
          openid: creatorOpenid,
          nickName: creatorName,
          avatarUrl: creatorAvatar || '',
          gender: creatorGender || 1,
          level: creatorLevel || 'L3',
          isCreator: true,
          joinTime: new Date()
        }],
        createTime: new Date(),
        updateTime: new Date()
      }
    });
    
    return {
      success: true,
      gameId: result._id,
      message: '创建成功'
    };
  } catch (e) {
    console.error('创建球局失败:', e);
    return {
      success: false,
      message: e.message || '创建失败'
    };
  }
};

// 获取球局列表
const getGameList = async (event) => {
  try {
    const { openid, status, limit = 20, onlyMine = false } = event;
    
    // 自动清理超过24小时的球局
    const expireTime = Date.now() - 24 * 60 * 60 * 1000; // 24小时前
    try {
      await db.collection('games').where({
        createTime: _.lt(new Date(expireTime))
      }).remove();
    } catch (cleanErr) {
      console.log('清理过期球局:', cleanErr.message);
    }
    
    let query = db.collection('games');
    
    // 只看我的球局
    if (onlyMine && openid) {
      query = query.where({
        'players.openid': openid
      });
    }
    
    // 按状态筛选
    if (status) {
      query = query.where({ status });
    }
    
    const result = await query
      .orderBy('createTime', 'desc')
      .limit(limit)
      .get();
    
    // 标记当前用户是否参与
    const games = result.data.map(game => {
      const isJoined = game.players && game.players.some(p => p.openid === openid);
      const isCreator = game.creatorOpenid === openid;
      return {
        ...game,
        id: game._id,
        isJoined,
        isCreator
      };
    });
    
    return {
      success: true,
      games
    };
  } catch (e) {
    console.error('获取球局列表失败:', e);
    return {
      success: false,
      message: e.message || '获取失败',
      games: []
    };
  }
};

// 获取球局详情
const getGameDetail = async (event) => {
  try {
    const { gameId } = event;
    
    const result = await db.collection('games').doc(gameId).get();
    
    return {
      success: true,
      game: { ...result.data, id: result.data._id }
    };
  } catch (e) {
    console.error('获取球局详情失败:', e);
    return {
      success: false,
      message: e.message || '获取失败'
    };
  }
};

// 加入球局
const joinGame = async (event) => {
  try {
    const { gameId, openid, nickName, avatarUrl, gender, level } = event;
    
    // 检查用户是否已有其他未结束的球局
    const existingGames = await db.collection('games')
      .where({
        status: _.in(['waiting', 'playing']),
        'players.openid': openid
      })
      .count();
    
    if (existingGames.total > 0) {
      return { success: false, message: '你已有进行中的球局，请先结束或退出后再加入' };
    }
    
    // 先获取球局信息
    const gameRes = await db.collection('games').doc(gameId).get();
    const game = gameRes.data;
    
    // 检查是否已加入
    if (game.players && game.players.some(p => p.openid === openid)) {
      return { success: false, message: '你已经加入了该球局' };
    }
    
    // 检查人数是否已满
    if (game.currentPlayers >= game.maxPlayers) {
      return { success: false, message: '球局人数已满' };
    }
    
    // 加入球局
    await db.collection('games').doc(gameId).update({
      data: {
        players: _.push({
          openid,
          nickName,
          avatarUrl,
          gender: gender || 1,
          level: level || 'L3',
          isCreator: false,
          joinTime: new Date()
        }),
        currentPlayers: _.inc(1),
        updateTime: new Date()
      }
    });
    
    return { success: true, message: '加入成功' };
  } catch (e) {
    console.error('加入球局失败:', e);
    return { success: false, message: e.message || '加入失败' };
  }
};

// 退出球局
const leaveGame = async (event) => {
  try {
    const { gameId, openid } = event;
    
    const gameRes = await db.collection('games').doc(gameId).get();
    const game = gameRes.data;
    
    // 检查是否是创建者
    if (game.creatorOpenid === openid) {
      return { success: false, message: '创建者不能退出球局' };
    }
    
    // 移除玩家
    const newPlayers = (game.players || []).filter(p => p.openid !== openid);
    
    await db.collection('games').doc(gameId).update({
      data: {
        players: newPlayers,
        currentPlayers: _.inc(-1),
        updateTime: new Date()
      }
    });
    
    return { success: true, message: '已退出球局' };
  } catch (e) {
    console.error('退出球局失败:', e);
    return { success: false, message: e.message || '退出失败' };
  }
};

// 删除球局
const deleteGame = async (event) => {
  try {
    const { gameId, openid } = event;
    
    // 先获取球局信息确认是创建者
    const gameRes = await db.collection('games').doc(gameId).get();
    const game = gameRes.data;
    
    if (game.creatorOpenid !== openid) {
      return { success: false, message: '只有创建者才能删除球局' };
    }
    
    // 删除球局
    await db.collection('games').doc(gameId).remove();
    
    return { success: true, message: '球局已删除' };
  } catch (e) {
    console.error('删除球局失败:', e);
    return { success: false, message: e.message || '删除失败' };
  }
};

// 更新球局状态
const updateGameStatus = async (event) => {
  try {
    const { gameId, status } = event;
    
    await db.collection('games').doc(gameId).update({
      data: {
        status,
        updateTime: new Date()
      }
    });
    
    return { success: true, message: '状态更新成功' };
  } catch (e) {
    console.error('更新球局状态失败:', e);
    return { success: false, message: e.message || '更新失败' };
  }
};

// 开始球局轮转
const startGame = async (event) => {
  try {
    const { gameId, rounds, openid } = event;
    
    await db.collection('games').doc(gameId).update({
      data: {
        status: 'playing',
        rounds: rounds,
        currentRound: 1,
        startTime: new Date(),
        updateTime: new Date()
      }
    });
    
    return { success: true, message: '球局已开始' };
  } catch (e) {
    console.error('开始球局失败:', e);
    return { success: false, message: e.message || '开始失败' };
  }
};

// 记录比赛结果
const recordResult = async (event) => {
  try {
    const { gameId, roundIndex, courtId, winner, score, openid } = event;
    
    // 获取球局信息
    const gameRes = await db.collection('games').doc(gameId).get();
    const game = gameRes.data;
    const rounds = game.rounds || [];
    
    if (roundIndex >= 0 && roundIndex < rounds.length) {
      const round = rounds[roundIndex];
      const matchIndex = round.matches.findIndex(m => m.courtId === courtId);
      
      if (matchIndex >= 0) {
        const match = rounds[roundIndex].matches[matchIndex];
        
        // 获取胜利方和失败方的队员openid (team1/team2 结构)
        let winnerOpenids = [];
        let loserOpenids = [];
        
        if (winner === 'team1') {
          winnerOpenids = (match.team1 || []).map(p => p.openid);
          loserOpenids = (match.team2 || []).map(p => p.openid);
        } else if (winner === 'team2') {
          winnerOpenids = (match.team2 || []).map(p => p.openid);
          loserOpenids = (match.team1 || []).map(p => p.openid);
        }
        
        // 更新比赛结果
        rounds[roundIndex].matches[matchIndex].result = { winner, score };
        rounds[roundIndex].matches[matchIndex].status = 'finished';
        
        await db.collection('games').doc(gameId).update({
          data: {
            rounds: rounds,
            updateTime: new Date()
          }
        });
        
        // 更新胜利方用户统计（增加胜场和参与场次）
        for (const odId of winnerOpenids) {
          if (odId && !odId.startsWith('test_')) {
            await db.collection('users').where({ openid: odId }).update({
              data: {
                totalWins: _.inc(1),
                totalGames: _.inc(1)
              }
            });
          }
        }
        
        // 更新失败方用户统计（只增加参与场次）
        for (const odId of loserOpenids) {
          if (odId && !odId.startsWith('test_')) {
            await db.collection('users').where({ openid: odId }).update({
              data: {
                totalGames: _.inc(1)
              }
            });
          }
        }
        
        return { success: true, message: '结果已记录' };
      }
    }
    
    return { success: false, message: '未找到对应的比赛' };
  } catch (e) {
    console.error('记录结果失败:', e);
    return { success: false, message: e.message || '记录失败' };
  }
};

// ==================== 用户相关操作 ====================

// 用户登录/注册
const userLogin = async (event) => {
  try {
    const { openid, nickName, avatarUrl, gender, country, province, city } = event;
    
    // 查找用户是否存在
    const userRes = await db.collection('users').where({ openid }).get();
    
    if (userRes.data.length > 0) {
      // 用户已存在，更新信息
      await db.collection('users').where({ openid }).update({
        data: {
          nickName,
          avatarUrl,
          lastLoginTime: new Date()
        }
      });
      return { success: true, message: '登录成功', isNewUser: false };
    } else {
      // 新用户，创建记录
      await db.collection('users').add({
        data: {
          openid,
          nickName,
          avatarUrl,
          gender,
          country,
          province,
          city,
          totalGames: 0,
          totalWins: 0,
          createTime: new Date(),
          lastLoginTime: new Date()
        }
      });
      return { success: true, message: '注册成功', isNewUser: true };
    }
  } catch (e) {
    console.error('用户登录失败:', e);
    return { success: false, message: e.message || '登录失败' };
  }
};

// 添加测试成员
const addTestPlayers = async (event) => {
  try {
    const { gameId, maxCount = 8 } = event;
    
    // 测试成员数据 - 8人轮转
    const allTestPlayers = [
      { openid: 'test_player_1', nickName: '张三', avatarUrl: '', gender: 1, level: 'L3', isCreator: false, joinTime: new Date() },
      { openid: 'test_player_2', nickName: '李四', avatarUrl: '', gender: 1, level: 'L4', isCreator: false, joinTime: new Date() },
      { openid: 'test_player_3', nickName: '王五', avatarUrl: '', gender: 2, level: 'L2', isCreator: false, joinTime: new Date() },
      { openid: 'test_player_4', nickName: '赵六', avatarUrl: '', gender: 1, level: 'L5', isCreator: false, joinTime: new Date() },
      { openid: 'test_player_5', nickName: '孙七', avatarUrl: '', gender: 2, level: 'L3', isCreator: false, joinTime: new Date() },
      { openid: 'test_player_6', nickName: '周八', avatarUrl: '', gender: 1, level: 'L4', isCreator: false, joinTime: new Date() },
      { openid: 'test_player_7', nickName: '吴九', avatarUrl: '', gender: 2, level: 'L3', isCreator: false, joinTime: new Date() },
      { openid: 'test_player_8', nickName: '郑十', avatarUrl: '', gender: 1, level: 'L2', isCreator: false, joinTime: new Date() }
    ];
    
    // 获取球局信息
    const gameRes = await db.collection('games').doc(gameId).get();
    const game = gameRes.data;
    const existingPlayers = game.players || [];
    const maxPlayers = game.maxPlayers || 8;
    
    // 检查人数上限
    const remaining = maxPlayers - existingPlayers.length;
    if (remaining <= 0) {
      return { success: false, message: '球局人数已满' };
    }
    
    // 只添加允许数量的测试成员
    const addCount = Math.min(maxCount, remaining);
    const testPlayersToAdd = allTestPlayers.slice(0, addCount);
    
    // 合并玩家列表
    const allPlayers = [...existingPlayers, ...testPlayersToAdd];
    
    await db.collection('games').doc(gameId).update({
      data: {
        players: allPlayers,
        currentPlayers: allPlayers.length,
        updateTime: new Date()
      }
    });
    
    return { success: true, message: `已添加${addCount}个测试成员，当前共${allPlayers.length}/${maxPlayers}人` };
  } catch (e) {
    console.error('添加测试成员失败:', e);
    return { success: false, message: e.message || '添加失败' };
  }
};

// 获取用户统计
const getUserStats = async (event) => {
  try {
    const { openid } = event;
    
    const userRes = await db.collection('users').where({ openid }).get();
    
    if (userRes.data.length > 0) {
      const user = userRes.data[0];
      const totalGames = user.totalGames || 0;
      const totalWins = user.totalWins || 0;
      const winRate = totalGames > 0 ? Math.round(totalWins / totalGames * 100) : 0;
      
      return {
        success: true,
        stats: {
          totalGames,
          totalWins,
          winRate
        }
      };
    }
    
    return {
      success: true,
      stats: { totalGames: 0, totalWins: 0, winRate: 0 }
    };
  } catch (e) {
    console.error('获取用户统计失败:', e);
    return {
      success: false,
      stats: { totalGames: 0, totalWins: 0, winRate: 0 }
    };
  }
};

// 创建测试球局（创建者为虚拟用户，便于测试加入功能）
const createTestGame = async (event) => {
  try {
    const { gameName = '测试球局', maxPlayers = 8 } = event;
    
    const result = await db.collection('games').add({
      data: {
        creatorOpenid: 'test_creator_001',
        creatorName: '测试组织者',
        gameName: gameName,
        location: '测试场地',
        latitude: 0,
        longitude: 0,
        maxPlayers: maxPlayers,
        courtCount: 1,
        remark: '这是一个测试球局',
        status: 'waiting',
        currentPlayers: 1,
        players: [{
          openid: 'test_creator_001',
          nickName: '测试组织者',
          avatarUrl: '',
          gender: 1,
          level: 'L4',
          isCreator: true,
          joinTime: new Date()
        }],
        createTime: new Date(),
        updateTime: new Date()
      }
    });
    
    return {
      success: true,
      gameId: result._id,
      message: '测试球局创建成功'
    };
  } catch (err) {
    console.error('创建测试球局失败:', err);
    return { success: false, message: err.message };
  }
};

// 修复历史战绩数据 - 扫描所有已完成比赛并更新用户统计
const fixUserStats = async (event) => {
  try {
    const { openid } = event;
    
    console.log('开始修复用户统计, openid:', openid);
    
    if (!openid) {
      return { success: false, message: 'openid不能为空' };
    }
    
    // 获取所有球局（不限制状态）
    const gamesRes = await db.collection('games').get();
    const games = gamesRes.data || [];
    
    console.log('查询到球局数量:', games.length);
    
    let totalWins = 0;
    let totalGames = 0;
    
    // 遍历所有球局
    for (const game of games) {
      const rounds = game.rounds || [];
      
      // 遍历每一轮
      for (const round of rounds) {
        const matches = round.matches || [];
        
        // 遍历每场比赛
        for (const match of matches) {
          // 检查比赛是否有结果
          if (!match.result || !match.result.winner) continue;
          
          // 注意：数据结构是 team1/team2，不是 teamA/teamB
          const team1 = match.team1 || [];
          const team2 = match.team2 || [];
          const winner = match.result.winner;
          
          // 检查用户是否在这场比赛中
          const inTeam1 = team1.some(p => p && p.openid === openid);
          const inTeam2 = team2.some(p => p && p.openid === openid);
          
          if (inTeam1 || inTeam2) {
            totalGames++;
            
            // 检查是否获胜 (winner 值为 'team1' 或 'team2')
            if ((winner === 'team1' && inTeam1) || (winner === 'team2' && inTeam2)) {
              totalWins++;
            }
          }
        }
      }
    }
    
    console.log('统计结果 - 总场次:', totalGames, '胜场:', totalWins);
    
    // 更新用户统计数据
    const updateRes = await db.collection('users').where({ openid }).update({
      data: {
        totalGames: totalGames,
        totalWins: totalWins
      }
    });
    
    console.log('更新结果:', updateRes);
    
    return {
      success: true,
      message: '战绩数据已修复',
      stats: {
        totalGames,
        totalWins,
        winRate: totalGames > 0 ? Math.round(totalWins / totalGames * 100) : 0
      }
    };
  } catch (e) {
    console.error('修复用户统计失败:', e);
    return { success: false, message: e.message || '修复失败' };
  }
};

// 云函数入口函数
exports.main = async (event, context) => {
  switch (event.type) {
    // 原有功能
    case "getOpenId":
      return await getOpenId();
    case "getMiniProgramCode":
      return await getMiniProgramCode();
    case "createCollection":
      return await createCollection();
    case "selectRecord":
      return await selectRecord();
    case "updateRecord":
      return await updateRecord(event);
    case "insertRecord":
      return await insertRecord(event);
    case "deleteRecord":
      return await deleteRecord(event);
    
    // 球局相关
    case "createGame":
      return await createGame(event);
    case "getGameList":
      return await getGameList(event);
    case "getGameDetail":
      return await getGameDetail(event);
    case "joinGame":
      return await joinGame(event);
    case "leaveGame":
      return await leaveGame(event);
    case "deleteGame":
      return await deleteGame(event);
    case "updateGameStatus":
      return await updateGameStatus(event);
    case "startGame":
      return await startGame(event);
    case "recordResult":
      return await recordResult(event);
    
    // 用户相关
    case "userLogin":
      return await userLogin(event);
    case "getUserStats":
      return await getUserStats(event);
    case "addTestPlayers":
      return await addTestPlayers(event);
    case "createTestGame":
      return await createTestGame(event);
    case "fixUserStats":
      return await fixUserStats(event);
    
    default:
      return { success: false, message: '未知的操作类型' };
  }
};
